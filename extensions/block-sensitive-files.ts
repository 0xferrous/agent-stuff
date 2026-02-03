/**
 * Block Sensitive Files Extension
 *
 * Intercepts read, write, and edit tool calls and rejects access to
 * sensitive files like .env, .envrc, and other configuration files containing secrets.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Patterns for files that should be blocked from reading, writing, or editing
const BLOCKED_PATTERNS = [
	/\.env$/,        // .env files
	/\.env\..+$/,    // .env.local, .env.production, etc.
	/\.envrc$/,      // .envrc (direnv)
	/\.envrc\..+$/,  // .envrc.local, etc.
	/\/\.ssh\//,     // SSH directory
	/\/\.aws\//,     // AWS config directory
	/\/\.gnupg\//,   // GPG directory
];

function isSensitivePath(path: string): boolean {
	return BLOCKED_PATTERNS.some((pattern) => pattern.test(path));
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		// Only intercept read, write, and edit tool calls
		if (event.toolName !== "read" && event.toolName !== "write" && event.toolName !== "edit") {
			return undefined;
		}

		const { path } = event.input as { path: string };

		// Check if path matches any blocked pattern
		if (isSensitivePath(path)) {
			if (ctx.hasUI) {
				ctx.ui.notify(`Blocked ${event.toolName} of sensitive file: ${path}`, "warning");
			}
			return {
				block: true,
				reason: `${event.toolName} access to "${path}" is blocked because it appears to be a sensitive file containing secrets.`,
			};
		}

		return undefined;
	});

	// Register a command to list blocked patterns
	pi.registerCommand("blocked-files", {
		description: "List file patterns blocked from reading, writing, and editing",
		handler: async (_args, ctx) => {
			if (ctx.hasUI) {
				const patterns = BLOCKED_PATTERNS.map((p) => p.toString()).join("\n");
				ctx.ui.notify(`Blocked patterns:\n${patterns}`, "info");
			}
		},
	});
}
