/**
 * Block Sensitive Reads Extension
 *
 * Intercepts read tool calls and rejects access to sensitive files
 * like .env, .envrc, and other configuration files containing secrets.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

// Patterns for files that should be blocked from reading
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
		// Type narrowing for read tool
		if (!isToolCallEventType("read", event)) {
			return undefined;
		}

		const { path } = event.input;

		// Check if path matches any blocked pattern
		if (isSensitivePath(path)) {
			if (ctx.hasUI) {
				ctx.ui.notify(`Blocked read of sensitive file: ${path}`, "warning");
			}
			return {
				block: true,
				reason: `Access to "${path}" is blocked because it appears to be a sensitive file containing secrets.`,
			};
		}

		return undefined;
	});

	// Optional: Register a command to list blocked patterns
	pi.registerCommand("blocked-reads", {
		description: "List file patterns blocked from reading",
		handler: async (_args, ctx) => {
			if (ctx.hasUI) {
				const patterns = BLOCKED_PATTERNS.map((p) => p.toString()).join("\n");
				ctx.ui.notify(`Blocked patterns:\n${patterns}`, "info");
			}
		},
	});
}
