import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
	applyMode,
	DEFAULT_STATE,
	getModeLabel,
	parseModeArg,
	type CodexWebSearchState,
} from "./config.ts";
import { isCodexModel, patchProviderPayload } from "./web-search.ts";

function notify(ctx: ExtensionContext, state: CodexWebSearchState) {
	if (!ctx.hasUI) return;
	ctx.ui.notify(
		`codex-web-search: ${state.enabled ? "enabled" : "disabled"}, ${state.live ? "live" : "cached"}`,
		"info",
	);
}

export default function (pi: ExtensionAPI) {
	let state: CodexWebSearchState = { ...DEFAULT_STATE };

	pi.on("session_start", async (_event, ctx) => {
		notify(ctx, state);
	});

	pi.on("before_provider_request", async (event, ctx) => {
		if (!state.enabled) return;
		if (!ctx.model || !isCodexModel(ctx.model)) return;

		const codexCredential = ctx.modelRegistry.authStorage.get("openai-codex");
		if (!codexCredential || codexCredential.type !== "oauth") return;

		const codexApiKey = await ctx.modelRegistry.getApiKeyForProvider("openai-codex");
		if (!codexApiKey) return;

		return patchProviderPayload(event.payload, state);
	});

	pi.registerCommand("codex-web-search", {
		description: "Set Codex web search mode to off, cached, or live",
		handler: async (args, ctx) => {
			const trimmed = args?.trim();
			const parsed = parseModeArg(trimmed);
			if (trimmed && parsed === undefined) {
				ctx.ui.notify("Usage: /codex-web-search [off|cached|live]", "warning");
				return;
			}

			if (!trimmed && ctx.hasUI) {
				const selected = await ctx.ui.select("Codex web search mode", [
					"off",
					"cached",
					"live",
				]);
				if (!selected) return;
				applyMode(state, selected as "off" | "cached" | "live");
			} else if (parsed) {
				applyMode(state, parsed);
			}

			ctx.ui.notify(`codex-web-search: ${getModeLabel(state)}`, "info");
		},
	});
}
