import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const usage = "Usage: /followup <n-repetitions> <message>";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("followup", {
    description: "Send repeated follow-up user messages",
    handler: async (args, ctx) => {
      const trimmed = args?.trim() ?? "";
      if (!trimmed) {
        if (ctx.hasUI) {
          ctx.ui.notify(usage, "warning");
        }
        return;
      }

      const [countRaw, ...rest] = trimmed.split(/\s+/);
      const count = Number.parseInt(countRaw, 10);
      const message = rest.join(" ").trim();

      if (!Number.isFinite(count) || count <= 0 || !message) {
        if (ctx.hasUI) {
          ctx.ui.notify(usage, "warning");
        }
        return;
      }

      for (let i = 0; i < count; i += 1) {
        pi.sendUserMessage(message, {
          deliverAs: "followUp",
          triggerTurn: i === 0,
        });
      }
    },
  });
}
