import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

interface CapturedChange {
  toolName: "write" | "edit" | "read";
  path: string;
  timestamp: number;
}

interface AgentSummaryEntryData {
  content: string;
}

type EntryRendererAPI = ExtensionAPI & {
  registerEntryRenderer<T>(
    customType: string,
    renderer: (entry: { data?: T }, options: { expanded: boolean }, theme: any) => Text,
  ): void;
};

export default function (pi: ExtensionAPI) {
  const renderSummary = (content: string, theme: any) => {
    let text = theme.fg("accent", theme.bold("🤖 Agent Summary\n\n"));
    text += content;
    return new Text(text, 0, 0);
  };

  // Keep the message renderer for summaries already stored by older versions.
  pi.registerMessageRenderer("agent-summary", (message, _options, theme) =>
    renderSummary(String(message.content), theme),
  );

  // Custom entries render in the transcript but never participate in LLM context.
  (pi as EntryRendererAPI).registerEntryRenderer<AgentSummaryEntryData>(
    "agent-summary",
    (entry, _options, theme) => renderSummary(entry.data?.content ?? "", theme),
  );

  // Prevent summaries stored by older versions as custom messages from reaching the LLM.
  pi.on("context", async (event) => ({
    messages: event.messages.filter(
      (message) => !(message.role === "custom" && message.customType === "agent-summary"),
    ),
  }));

  // Track file operations for the current agent turn
  let capturedChanges: CapturedChange[] = [];

  // Reset at the start of each agent run
  pi.on("agent_start", async (_event, ctx) => {
    capturedChanges = [];
  });

  // Capture read/write/edit tool calls
  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("read", event)) {
      capturedChanges.push({
        toolName: "read",
        path: event.input.path,
        timestamp: Date.now(),
      });
    }

    if (isToolCallEventType("write", event)) {
      capturedChanges.push({
        toolName: "write",
        path: event.input.path,
        timestamp: Date.now(),
      });
    }

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
      return; // No file activity to report
    }

    // Defer sending the summary to ensure it renders after agent_end completes
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Group by path and count operations
    const byPath = new Map<string, { read: number; write: number; edit: number }>();
    for (const change of capturedChanges) {
      const existing = byPath.get(change.path) ?? { read: 0, write: 0, edit: 0 };
      if (change.toolName === "read") {
        existing.read++;
      } else if (change.toolName === "write") {
        existing.write++;
      } else {
        existing.edit++;
      }
      byPath.set(change.path, existing);
    }

    const totalReads = capturedChanges.filter((c) => c.toolName === "read").length;
    const totalWrites = capturedChanges.filter((c) => c.toolName === "write").length;
    const totalEdits = capturedChanges.filter((c) => c.toolName === "edit").length;
    const totalMutations = totalWrites + totalEdits;

    const consultedEntries = Array.from(byPath.entries()).filter(([, counts]) => counts.read > 0);
    const changedEntries = Array.from(byPath.entries()).filter(([, counts]) => counts.write > 0 || counts.edit > 0);

    // Build summary text with distinct sections
    let summary = `Agent summary: ${totalReads} consult${totalReads !== 1 ? "s" : ""}, ${totalMutations} change${totalMutations !== 1 ? "s" : ""}`;
    summary += ` (${capturedChanges.length} total operation${capturedChanges.length !== 1 ? "s" : ""})\n\n`;

    summary += "Consulted files:\n";
    if (consultedEntries.length === 0) {
      summary += "• none\n";
    } else {
      for (const [path, counts] of consultedEntries) {
        summary += `• ${path} (${counts.read} read${counts.read > 1 ? "s" : ""})\n`;
      }
    }

    summary += "\nChanged files:\n";
    if (changedEntries.length === 0) {
      summary += "• none\n";
    } else {
      for (const [path, counts] of changedEntries) {
        const parts: string[] = [];
        if (counts.write > 0) parts.push(`${counts.write} write${counts.write > 1 ? "s" : ""}`);
        if (counts.edit > 0) parts.push(`${counts.edit} edit${counts.edit > 1 ? "s" : ""}`);
        summary += `• ${path} (${parts.join(", ")})\n`;
      }
    }

    // Append a durable TUI-only entry instead of an LLM-visible custom message.
    pi.appendEntry<AgentSummaryEntryData>("agent-summary", { content: summary });

    // Reset for next run
    capturedChanges = [];
  });
}
