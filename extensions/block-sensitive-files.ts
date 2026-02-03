/**
 * Block Sensitive Files Extension
 *
 * Intercepts read, write, and edit tool calls and rejects access to
 * sensitive files like .env, .envrc, and other configuration files containing secrets.
 *
 * Also redacts sensitive environment variable values from tool results and bash command outputs.
 * Set PI_SENSITIVE_ENV_VARS to a comma-separated list of environment variable names
 * to redact (e.g., PI_SENSITIVE_ENV_VARS=API_KEY,DATABASE_URL).
 *
 * Provides a `blocked-files` command to list blocked patterns and sensitive env vars.
 */

import fs from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ImageContent, TextContent } from "@mariozechner/pi-ai";

// Patterns for files that should be blocked from reading, writing, or editing
const BLOCKED_PATTERNS = [
  /\.env$/, // .env files
  /\.env\..+$/, // .env.local, .env.production, etc.
  /\.envrc$/, // .envrc (direnv)
  /\.envrc\..+$/, // .envrc.local, etc.
  /\/\.ssh\//, // SSH directory
  /\/\.aws\//, // AWS config directory
  /\/\.gnupg\//, // GPG directory
];

function isSensitivePath(filePath: string) {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(filePath));
}

// Read sensitive env vars and get their values
function getSensitiveValues() {
  const envVarList = process.env.PI_SENSITIVE_ENV_VARS;
  if (!envVarList) {
    return [];
  }

  const varNames = envVarList
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const values: string[] = [];

  for (const varName of varNames) {
    const value = process.env[varName];
    if (value) {
      values.push(value);
    }
  }

  return values;
}

// Redact sensitive values from text
function redactSensitiveValues(text: string) {
  let redacted = text;

  for (const value of getSensitiveValues()) {
    if (value.length > 0) {
      const replacement = "*".repeat(value.length);
      redacted = redacted.replaceAll(value, replacement);
    }
  }

  return redacted;
}

// Redact sensitive values from content array
function redactContent(content: (TextContent | ImageContent)[]) {
  return content.map((item) => {
    if (item.type === "text" && item.text) {
      return { ...item, text: redactSensitiveValues(item.text) };
    }
    return item;
  });
}

export default function (pi: ExtensionAPI) {
  // Block read, write, and edit tool calls for sensitive files
  pi.on("tool_call", async (event, ctx) => {
    // Only intercept read, write, and edit tool calls
    if (
      event.toolName !== "read" &&
      event.toolName !== "write" &&
      event.toolName !== "edit"
    ) {
      return undefined;
    }

    const { path } = event.input;

    // Check if path matches any blocked pattern
    if (isSensitivePath(path as string)) {
      if (ctx.hasUI) {
        ctx.ui.notify(
          `Blocked ${event.toolName} of sensitive file: ${path}`,
          "warning",
        );
      }
      return {
        block: true,
        reason: `${event.toolName} access to "${path}" is blocked because it appears to be a sensitive file containing secrets.`,
      };
    }

    return undefined;
  });

  // Redact sensitive values from tool results
  pi.on("tool_result", async (event, _ctx) => {
    // Skip if no sensitive env vars configured
    const sensitiveValues = getSensitiveValues();
    if (sensitiveValues.length === 0) {
      return undefined;
    }

    // Check if content contains sensitive values
    const hasSensitiveValue = sensitiveValues.some((value) => {
      return event.content.some((item) => {
        if (item.type === "text" && item.text) {
          return item.text.includes(value);
        }
        return false;
      });
    });

    if (!hasSensitiveValue) {
      return undefined;
    }

    return {
      content: redactContent(event.content),
      details: event.details,
      isError: event.isError,
    };
  });

  // Redact sensitive values from user bash commands (! and !!)
  pi.on("user_bash", async (event, _ctx2) => {
    // Skip if no sensitive env vars configured
    const sensitiveValues = getSensitiveValues();
    if (sensitiveValues.length === 0) {
      return undefined;
    }

    // Execute the bash command ourselves so we can redact the output
    const result = await pi.exec("bash", ["-c", event.command], {
      cwd: event.cwd,
    });

    // Redact sensitive values from stdout and stderr
    const redactedStdout = redactSensitiveValues(result.stdout);
    const redactedStderr = redactSensitiveValues(result.stderr);
    const redactedOutput =
      redactedStdout + (redactedStderr ? redactedStderr : "");

    return {
      result: {
        output: redactedOutput,
        exitCode: result.code,
        cancelled: result.killed,
        truncated: false,
      },
    };
  });

  // Register a command to list blocked patterns and sensitive env vars
  pi.registerCommand("blocked-files", {
    description:
      "List file patterns blocked from reading, writing, and editing, and sensitive env vars being redacted",
    handler: async (_args, ctx) => {
      if (ctx.hasUI) {
        const patterns = BLOCKED_PATTERNS.map((p) => p.toString()).join("\n");
        const sensitiveEnvVars =
          process.env.PI_SENSITIVE_ENV_VARS || "(none configured)";

        const message = `Blocked file patterns:\n${patterns}\n\nSensitive env vars (PI_SENSITIVE_ENV_VARS):\n${sensitiveEnvVars}`;
        ctx.ui.notify(message, "info");
      }
    },
  });
}
