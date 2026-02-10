import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const usage = "Usage: /followup <n-repetitions> <message>";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function (pi: ExtensionAPI) {
  pi.registerCommand("followup", {
    description: "Send repeated follow-up user messages",
    handler: async (args, ctx) => {
      const trimmed = args?.trim() ?? "";
      if (!trimmed) {
        if (ctx.hasUI) ctx.ui.notify(usage, "warning");
        return;
      }

      const [countRaw, ...rest] = trimmed.split(/\s+/);
      const count = Number.parseInt(countRaw, 10);
      const message = rest.join(" ").trim();

      if (!Number.isFinite(count) || count <= 0 || !message) {
        if (ctx.hasUI) ctx.ui.notify(usage, "warning");
        return;
      }

      if (ctx.isIdle()) {
        await pi.sendUserMessage(message);

        if (count > 1) {
          await sleep(500);
          for (let i = 1; i < count; i += 1) {
            await pi.sendUserMessage(message, { deliverAs: "followUp" });
          }
        }
      } else {
        for (let i = 0; i < count; i += 1) {
          await pi.sendUserMessage(message, { deliverAs: "followUp" });
        }
      }

      if (ctx.hasUI) {
        ctx.ui.notify(`Queued ${count} follow-up message${count === 1 ? "" : "s"}.`, "info");
      }
    },
  });
}
