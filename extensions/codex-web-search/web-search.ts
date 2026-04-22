import type { Model } from "@mariozechner/pi-ai";
import type { CodexWebSearchState } from "./config.ts";

interface ProviderPayload {
	tools?: unknown[];
	tool_choice?: unknown;
	parallel_tool_calls?: boolean;
	[key: string]: unknown;
}

interface WebSearchTool {
	type: "web_search";
	external_web_access: boolean;
}

export function isCodexModel(model: Model<any>): boolean {
	return (
		model.provider === "openai-codex" ||
		model.api === "openai-codex-responses" ||
		model.id.toLowerCase().includes("codex")
	);
}

export function patchProviderPayload(payload: unknown, state: CodexWebSearchState): unknown {
	if (!isRecord(payload)) return payload;

	const nextPayload: ProviderPayload = {
		...payload,
	};
	const nextTool = buildWebSearchTool(state);
	const existingTools = Array.isArray(payload.tools) ? [...payload.tools] : [];
	const existingIndex = existingTools.findIndex(isWebSearchToolLike);

	if (existingIndex >= 0) {
		existingTools[existingIndex] = {
			...(isRecord(existingTools[existingIndex]) ? existingTools[existingIndex] : {}),
			...nextTool,
		};
	} else {
		existingTools.push(nextTool);
	}

	nextPayload.tools = existingTools;
	if (nextPayload.tool_choice === undefined) {
		nextPayload.tool_choice = "auto";
	}
	if (nextPayload.parallel_tool_calls === undefined) {
		nextPayload.parallel_tool_calls = true;
	}

	return nextPayload;
}

function buildWebSearchTool(state: CodexWebSearchState): WebSearchTool {
	return {
		type: "web_search",
		external_web_access: state.live,
	};
}

function isWebSearchToolLike(value: unknown): boolean {
	return isRecord(value) && (value.type === "web_search" || value.type === "web_search_preview");
}

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
