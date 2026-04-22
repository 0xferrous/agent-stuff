export interface CodexWebSearchState {
	enabled: boolean;
	live: boolean;
}

export const DEFAULT_STATE: CodexWebSearchState = {
	enabled: true,
	live: false,
};

export function getModeLabel(state: CodexWebSearchState): string {
	if (!state.enabled) return "disabled";
	return state.live ? "live" : "cached";
}

export function parseModeArg(args?: string): "off" | "cached" | "live" | undefined {
	const value = args?.trim().toLowerCase();
	if (!value) return undefined;
	if (["off", "disable", "disabled"].includes(value)) return "off";
	if (["cached", "cache"].includes(value)) return "cached";
	if (["live", "on", "enable", "enabled"].includes(value)) return "live";
	return undefined;
}

export function applyMode(state: CodexWebSearchState, mode: "off" | "cached" | "live"): void {
	state.enabled = mode !== "off";
	state.live = mode === "live";
}
