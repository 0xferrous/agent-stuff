/**
 * Turn Timer Extension
 *
 * Shows live timing of the currently executing turn in the status bar,
 * and appends the final timing to the transcript when the turn ends.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
  let turnStartTime: number | null = null;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let agentStartTime: number | null = null;
  let currentTurnIndex = 0;

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const updateTimer = (ctx: { ui: { setStatus: (id: string, text: string | undefined) => void; setWidget: (id: string, content: string[] | undefined) => void; theme: { fg: (color: string, text: string) => string } } }) => {
    if (turnStartTime === null || agentStartTime === null) return;

    const elapsed = Date.now() - turnStartTime;
    const totalElapsed = Date.now() - agentStartTime;
    const theme = ctx.ui.theme;

    // Show widget above editor (both current turn and total time)
    const widgetText = `${theme.fg("dim", `Turn ${currentTurnIndex}: ${formatDuration(elapsed)}`)}  ${theme.fg("muted", `|  Total: ${formatDuration(totalElapsed)}`)}`;
    ctx.ui.setWidget("turn-timer", [widgetText]);
  };

  const clearTimer = () => {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setStatus("turn-timer", undefined);
    ctx.ui.setWidget("turn-timer", undefined);
    agentStartTime = null;
  });

  pi.on("agent_start", async (_event, ctx) => {
    agentStartTime = Date.now();
    if (!ctx.hasUI) return;
    ctx.ui.setStatus("turn-timer", undefined);
  });

  pi.on("turn_start", async (event, ctx) => {
    currentTurnIndex = event.turnIndex;
    turnStartTime = Date.now();

    // Only update UI if available
    if (!ctx.hasUI) return;

    // Update immediately
    updateTimer(ctx);

    // Then update every second
    clearTimer();
    timerInterval = setInterval(() => updateTimer(ctx), 1000);
  });

  pi.on("turn_end", async (event, ctx) => {
    clearTimer();

    if (turnStartTime === null || agentStartTime === null) return;

    const elapsed = Date.now() - turnStartTime;
    const totalElapsed = Date.now() - agentStartTime;
    const duration = formatDuration(elapsed);
    const totalDuration = formatDuration(totalElapsed);

    // Display timing via notify (ephemeral, not sent to LLM)
    if (ctx.hasUI) {
      ctx.ui.notify(`Turn ${event.turnIndex} completed in ${duration}`, "info");
    }

    turnStartTime = null;
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (agentStartTime === null) return;

    const elapsed = Date.now() - agentStartTime;
    const duration = formatDuration(elapsed);

    // Display aggregate timing via notify (ephemeral, not sent to LLM)
    if (ctx.hasUI) {
      ctx.ui.notify(`Total time: ${duration}`, "success");
      ctx.ui.setWidget("turn-timer", undefined);
    }

    agentStartTime = null;
  });

  pi.on("session_switch", async (_event, ctx) => {
    clearTimer();
    turnStartTime = null;
    agentStartTime = null;
    if (ctx.hasUI) {
      ctx.ui.setStatus("turn-timer", undefined);
      ctx.ui.setWidget("turn-timer", undefined);
    }
  });

  pi.on("session_shutdown", async () => {
    clearTimer();
  });
}
