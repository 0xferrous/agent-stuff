/**
 * Bash Permission Gate Extension
 *
 * Asks for confirmation before executing any bash command.
 * Shows the command and allows user to approve or block execution.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		// Only intercept bash tool calls
		if (event.toolName !== "bash") return undefined;

		// In non-interactive mode, allow by default
		if (!ctx.hasUI) {
			return undefined;
		}

		const command = event.input.command as string;
		const cwd = event.input.cwd as string | undefined;

		// Build confirmation message
		let message = `Execute bash command?`;
		if (cwd) {
			message += `\n\nWorking directory: ${cwd}`;
		}
		message += `\n\nCommand:\n  ${command}`;

		const choice = await ctx.ui.select(message, ["Allow", "Block"]);

		if (choice !== "Allow") {
			return { block: true, reason: "Blocked by user" };
		}

		return undefined;
	});
}
