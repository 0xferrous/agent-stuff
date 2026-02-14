import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

interface CapturedChange {
  toolName: "write" | "edit";
  path: string;
  timestamp: number;
}

export default function (pi: ExtensionAPI) {
  // Register custom message renderer for pretty display
  pi.registerMessageRenderer("file-change-tracker", (message, options, theme) => {
    let text = theme.fg("accent", theme.bold("📝 File Changes Summary\n\n"));
    text += message.content;
    return new Text(text, 0, 0);
  });
  // Track changes for the current agent turn
  let capturedChanges: CapturedChange[] = [];

  // Reset at the start of each agent turn
  pi.on("agent_start", async (_event, ctx) => {
    capturedChanges = [];
  });

  // Capture write and edit tool calls
  pi.on("tool_call", async (event, ctx) => {
    // Capture write operations
    if (isToolCallEventType("write", event)) {
      capturedChanges.push({
        toolName: "write",
        path: event.input.path,
        timestamp: Date.now(),
      });
    }

    // Capture edit operations
    if (isToolCallEventType("edit", event)) {
      capturedChanges.push({
        toolName: "edit",
        path: event.input.path,
        timestamp: Date.now(),
      });
    }
  });

  // Display summary when agent finishes
  pi.on("agent_end", async (event, ctx) => {
    if (capturedChanges.length === 0) {
      return; // No changes to report
    }

    // Group by path and count operations
    const byPath = new Map<string, { write: number; edit: number }>();
    for (const change of capturedChanges) {
      const existing = byPath.get(change.path) ?? { write: 0, edit: 0 };
      if (change.toolName === "write") {
        existing.write++;
      } else {
        existing.edit++;
      }
      byPath.set(change.path, existing);
    }

    // Build summary text
    let summary = `${capturedChanges.length} operation${capturedChanges.length > 1 ? "s" : ""}:\n\n`;

    for (const [path, counts] of byPath.entries()) {
      const parts: string[] = [];
      if (counts.write > 0) parts.push(`${counts.write} write${counts.write > 1 ? "s" : ""}`);
      if (counts.edit > 0) parts.push(`${counts.edit} edit${counts.edit > 1 ? "s" : ""}`);
      summary += `• ${path} (${parts.join(", ")})\n`;
    }

    // Send as a custom message (non-blocking)
    pi.sendMessage({
      customType: "file-change-tracker",
      content: summary,
      display: true,
    });
  });
}
