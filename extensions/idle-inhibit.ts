/**
 * Idle Inhibit Extension
 *
 * Holds a systemd-logind idle inhibitor while pi is actively running the agent.
 * This helps prevent idle-triggered suspend while the model is thinking or tools
 * are executing.
 *
 * Requires: systemd-inhibit
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const STATUS_ID = "idle-inhibit";
const WHY = "pi agent is running";
const KEEPALIVE_SCRIPT = "setInterval(() => {}, 1 << 30)";
const COMMON_SYSTEMD_INHIBIT_PATHS = [
  "/run/current-system/sw/bin/systemd-inhibit",
  "/usr/bin/systemd-inhibit",
  "/bin/systemd-inhibit",
];

function findSystemdInhibit(): string {
  const pathEntries = (process.env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .map((entry) => `${entry}/systemd-inhibit`);

  for (const candidate of [...pathEntries, ...COMMON_SYSTEMD_INHIBIT_PATHS]) {
    if (existsSync(candidate)) return candidate;
  }

  return "systemd-inhibit";
}

export default function (pi: ExtensionAPI) {
  let inhibitor: ChildProcess | null = null;
  let activeAgents = 0;
  let warnedUnavailable = false;

  const setStatus = (ctx: ExtensionContext, active: boolean) => {
    if (!ctx.hasUI) return;
    ctx.ui.setStatus(STATUS_ID, active ? "idle inhibited" : undefined);
  };

  const notifyUnavailable = (ctx: ExtensionContext, detail?: string) => {
    if (warnedUnavailable || !ctx.hasUI) return;
    warnedUnavailable = true;
    ctx.ui.notify(
      detail
        ? `Idle inhibit unavailable: ${detail}`
        : "Idle inhibit unavailable",
      "warning",
    );
  };

  const attachExitHandler = (child: ChildProcess) => {
    child.once("exit", (code, signal) => {
      if (inhibitor === child) {
        inhibitor = null;
      }

      if (activeAgents > 0) {
        // Lost the inhibitor mid-run. Warn once and clear status.
        warnedUnavailable = false;
      }

      // No ctx here, so UI cleanup happens on the next lifecycle event.
      void code;
      void signal;
    });
  };

  const startInhibitor = async (ctx: ExtensionContext) => {
    if (inhibitor) {
      setStatus(ctx, true);
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      const child = spawn(
        findSystemdInhibit(),
        [
          "--what=idle",
          "--mode=block",
          `--why=${WHY}`,
          process.execPath,
          "-e",
          KEEPALIVE_SCRIPT,
        ],
        {
          stdio: "ignore",
        },
      );

      child.once("spawn", () => {
        finish(() => {
          inhibitor = child;
          attachExitHandler(child);
          setStatus(ctx, true);
          resolve();
        });
      });

      child.once("error", (error) => {
        finish(() => {
          notifyUnavailable(ctx, error.message);
          setStatus(ctx, false);
          resolve();
        });
      });

      child.once("exit", (code, signal) => {
        finish(() => {
          const detail = signal
            ? `exited via ${signal}`
            : `exited with code ${code ?? "unknown"}`;
          notifyUnavailable(ctx, detail);
          setStatus(ctx, false);
          resolve();
        });
      });
    });
  };

  const stopInhibitor = (ctx?: ExtensionContext) => {
    const child = inhibitor;
    inhibitor = null;

    if (ctx) setStatus(ctx, false);
    if (!child) return;

    child.kill("SIGTERM");

    const forceKillTimer = setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 1000);
    forceKillTimer.unref();
  };

  pi.on("session_start", async (_event, ctx) => {
    setStatus(ctx, false);
  });

  pi.on("agent_start", async (_event, ctx) => {
    activeAgents += 1;
    await startInhibitor(ctx);
    setStatus(ctx, inhibitor !== null);
  });

  pi.on("agent_end", async (_event, ctx) => {
    activeAgents = Math.max(0, activeAgents - 1);

    if (activeAgents === 0) {
      stopInhibitor(ctx);
    } else {
      setStatus(ctx, inhibitor !== null);
    }
  });

  pi.on("session_switch", async (_event, ctx) => {
    activeAgents = 0;
    stopInhibitor(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    activeAgents = 0;
    stopInhibitor(ctx);
  });
}
