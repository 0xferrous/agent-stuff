import { parse } from "just-bash";
import type { CommandNode, PipelineNode, ScriptNode, SimpleCommandNode, StatementNode, WordNode } from "just-bash";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const POLICY_PATH = path.join(os.homedir(), ".pi", "agent", "pi-bash-sane.policy.json");
export const POLICY_VERSION = 1;
export const MAX_COMMAND_DEPTH = 7;
export const ACTIONS = [
	"allow",
	"allow(session)",
	"allow(persistent)",
	"deny",
	"deny(session)",
	"deny(persistent)",
] as const;
export const SKIPPED_WRAPPERS = new Set(["sudo", "env", "command", "nohup", "time", "builtin"]);
export const IGNORED_BUILTINS = new Set([
	"alias",
	"bg",
	"bind",
	"break",
	"builtin",
	"caller",
	"cd",
	"command",
	"compgen",
	"complete",
	"compopt",
	"continue",
	"declare",
	"dirs",
	"disown",
	"echo",
	"enable",
	"eval",
	"exec",
	"exit",
	"export",
	"false",
	"fc",
	"fg",
	"getopts",
	"hash",
	"help",
	"history",
	"jobs",
	"kill",
	"let",
	"local",
	"logout",
	"mapfile",
	"popd",
	"printf",
	"pushd",
	"pwd",
	"read",
	"readarray",
	"readonly",
	"return",
	"set",
	"shift",
	"shopt",
	"suspend",
	"test",
	"times",
	"trap",
	"true",
	"type",
	"typeset",
	"ulimit",
	"umask",
	"unalias",
	"unset",
	"wait",
]);

export type CommandSpec = {
	flags?: ReadonlySet<string>;
	optionsWithValue?: ReadonlyMap<string, number>;
	commandOnly?: boolean;
};

export const COMMAND_SPECS: Readonly<Record<string, CommandSpec>> = {
	systemctl: {
		flags: new Set(["--user", "--system", "--global", "--runtime", "--no-pager", "--no-legend", "--plain", "--full", "--quiet", "--all"]),
		optionsWithValue: new Map([
			["-H", 1],
			["--host", 1],
			["-M", 1],
			["--machine", 1],
			["-t", 1],
			["--type", 1],
			["--state", 1],
		]),
	},
	git: {
		flags: new Set(["--no-pager", "--paginate", "--help", "--version"]),
		optionsWithValue: new Map([
			["-C", 1],
			["-c", 1],
			["--git-dir", 1],
			["--work-tree", 1],
			["--namespace", 1],
			["--config-env", 1],
		]),
	},
	gh: {
		flags: new Set(["--help", "--version"]),
		optionsWithValue: new Map([
			["-R", 1],
			["--repo", 1],
			["--hostname", 1],
		]),
	},
	nix: {
		flags: new Set(["--help", "--version", "--refresh", "--offline", "--accept-flake-config", "--impure"]),
		optionsWithValue: new Map([
			["--option", 2],
			["--extra-experimental-features", 1],
			["--arg", 2],
			["--argstr", 2],
			["-I", 1],
			["--store", 1],
			["--eval-store", 1],
		]),
	},
	journalctl: {
		flags: new Set(["--user", "--system", "--no-pager", "--catalog", "--reverse", "--utc", "-x", "-e", "-f"]),
		optionsWithValue: new Map([
			["-u", 1],
			["--unit", 1],
			["-n", 1],
			["--lines", 1],
			["--since", 1],
			["--until", 1],
			["-p", 1],
			["--priority", 1],
			["-b", 1],
			["--boot", 1],
			["-g", 1],
			["--grep", 1],
			["-o", 1],
			["--output", 1],
			["-D", 1],
			["--directory", 1],
		]),
		commandOnly: true,
	},
	"nix-store": {
		flags: new Set(["--delete", "--gc", "--verify", "--repair"]),
		optionsWithValue: new Map([
			["--add-root", 1],
			["--realise", 1],
			["--query", 1],
			["--verify-path", 1],
		]),
		commandOnly: true,
	},
};

export type Effect = "allow" | "deny";
export type Action = (typeof ACTIONS)[number];
export type PathRule = { effect: Effect; path: string[] };
export type RawRule = { effect: Effect; raw: string };
export type Rule = PathRule | RawRule;
export type PolicyFile = {
	version: number;
	directories: Record<string, Rule[]>;
};
export type RuleMatch = {
	effect: Effect;
	directory: string;
	rule: Rule;
	ruleIndex: number;
	directoryDepth: number;
	pathDepth: number;
};
export type AnalyzedCommand = {
	kind: "path";
	words: string[];
	display: string;
	sourceText: string;
};
export type RawTarget = {
	kind: "raw";
	raw: string;
	reason: string;
};
export type AnalyzeResult =
	| { kind: "path"; commands: AnalyzedCommand[] }
	| { kind: "raw"; target: RawTarget };

export type RuleTarget =
	| { kind: "path"; words: string[]; display: string }
	| { kind: "raw"; raw: string; display: string };

export function createEmptyPolicy(): PolicyFile {
	return { version: POLICY_VERSION, directories: {} };
}

export function normalizeDirectory(directory: string): string {
	const resolved = path.resolve(directory);
	return resolved === "" ? path.sep : resolved;
}

export function getAncestorDirectories(directory: string): string[] {
	const resolved = normalizeDirectory(directory);
	const ancestors: string[] = [];
	let current = resolved;
	while (true) {
		ancestors.push(current);
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return ancestors.reverse();
}

export function directoryDepth(directory: string): number {
	if (directory === path.sep) return 0;
	return directory.split(path.sep).filter(Boolean).length;
}

export function isPathRule(rule: Rule): rule is PathRule {
	return "path" in rule;
}

export function isRawRule(rule: Rule): rule is RawRule {
	return "raw" in rule;
}

export function isRule(value: unknown): value is Rule {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<PathRule & RawRule>;
	if (candidate.effect !== "allow" && candidate.effect !== "deny") return false;
	if (Array.isArray(candidate.path)) return candidate.path.every((part) => typeof part === "string" && part.length > 0);
	return typeof candidate.raw === "string" && candidate.raw.length > 0;
}

export function sanitizePolicy(value: unknown): PolicyFile {
	if (!value || typeof value !== "object") throw new Error("Policy root must be an object");
	const candidate = value as Partial<PolicyFile>;
	const directoriesValue = candidate.directories;
	if (!directoriesValue || typeof directoriesValue !== "object" || Array.isArray(directoriesValue)) {
		throw new Error("Policy must contain a directories object");
	}

	const directories: Record<string, Rule[]> = {};
	for (const [dir, rules] of Object.entries(directoriesValue)) {
		if (!Array.isArray(rules)) {
			throw new Error(`Directory entry ${dir} must be an array`);
		}
		directories[normalizeDirectory(dir)] = rules.filter(isRule).map((rule) =>
			isPathRule(rule)
				? { effect: rule.effect, path: [...rule.path] }
				: { effect: rule.effect, raw: rule.raw },
		);
	}

	return {
		version: typeof candidate.version === "number" ? candidate.version : POLICY_VERSION,
		directories,
	};
}

export function isPrefix(prefix: string[], words: string[]): boolean {
	if (prefix.length > words.length) return false;
	return prefix.every((part, index) => part === words[index]);
}

export function compareMatches(a: RuleMatch, b: RuleMatch): number {
	if (a.directoryDepth !== b.directoryDepth) return a.directoryDepth - b.directoryDepth;
	if (a.pathDepth !== b.pathDepth) return a.pathDepth - b.pathDepth;
	return a.ruleIndex - b.ruleIndex;
}

export function formatRule(rule: Rule): string {
	return JSON.stringify(rule);
}

export function formatPath(words: string[]): string {
	return words.join(" ");
}

export function actionEffect(action: Action): Effect {
	return action.startsWith("allow") ? "allow" : "deny";
}

export function actionScope(action: Action): "once" | "session" | "persistent" {
	if (action.endsWith("(session)")) return "session";
	if (action.endsWith("(persistent)")) return "persistent";
	return "once";
}

function isLiteralWordPart(part: { type: string; value?: string; parts?: unknown[] }): string | null {
	switch (part.type) {
		case "Literal":
		case "SingleQuoted":
		case "Escaped":
			return part.value;
		case "DoubleQuoted": {
			let text = "";
			for (const nested of (part.parts ?? []) as Array<{ type: string; value?: string; parts?: unknown[] }>) {
				const value = isLiteralWordPart(nested);
				if (value === null) return null;
				text += value;
			}
			return text;
		}
		default:
			return null;
	}
}

export function wordToLiteral(word: WordNode | null): string | null {
	if (!word) return null;
	let text = "";
	for (const part of word.parts) {
		const value = isLiteralWordPart(part);
		if (value === null) return null;
		text += value;
	}
	return text;
}

export function isAssignmentLike(token: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(token);
}

export function collectCommandTokens(command: SimpleCommandNode): string[] | null {
	const tokens: string[] = [];
	const name = wordToLiteral(command.name);
	if (command.name && name === null) return null;
	if (name) tokens.push(name);
	for (const arg of command.args) {
		const value = wordToLiteral(arg);
		if (value === null) return null;
		tokens.push(value);
	}
	return tokens;
}

export function isShortOptionCluster(token: string): boolean {
	return /^-[A-Za-z]{2,}$/.test(token);
}

export function optionValueArity(commandName: string, token: string): number {
	const spec = COMMAND_SPECS[commandName];
	if (token === "--") return 0;
	if (token.startsWith("--") && token.includes("=")) return 0;
	if (/^-[A-Za-z]=.+/.test(token)) return 0;
	if (isShortOptionCluster(token)) return 0;
	return spec?.optionsWithValue?.get(token) ?? 1;
}

export function isKnownFlag(commandName: string, token: string): boolean {
	return COMMAND_SPECS[commandName]?.flags?.has(token) ?? false;
}

export function skipLeadingOptions(commandName: string, args: string[]): number {
	let index = 0;
	while (index < args.length) {
		const token = args[index]!;
		if (token === "--") {
			index += 1;
			break;
		}
		if (!token.startsWith("-") || token === "-") break;
		if (isKnownFlag(commandName, token) || isShortOptionCluster(token) || token.includes("=")) {
			index += 1;
			continue;
		}
		const arity = optionValueArity(commandName, token);
		index += 1;
		for (let consumed = 0; consumed < arity && index < args.length; consumed += 1) {
			index += 1;
		}
	}
	return index;
}

export function deriveCommandWords(command: SimpleCommandNode): string[] | null {
	const tokens = collectCommandTokens(command);
	if (tokens === null) return null;
	if (tokens.length === 0) return [];

	let index = 0;
	while (index < tokens.length && SKIPPED_WRAPPERS.has(tokens[index]!)) {
		const wrapper = tokens[index]!;
		index += 1;
		if (wrapper === "env") {
			while (index < tokens.length && isAssignmentLike(tokens[index]!)) {
				index += 1;
			}
		}
	}

	const commandName = tokens[index];
	if (!commandName) return [];
	if (IGNORED_BUILTINS.has(commandName)) return [];
	const spec = COMMAND_SPECS[commandName];
	if (spec?.commandOnly) return [commandName];

	const args = tokens.slice(index + 1);
	const firstPositionalIndex = skipLeadingOptions(commandName, args);
	const words: string[] = [commandName];
	for (let i = firstPositionalIndex; i < args.length && words.length < MAX_COMMAND_DEPTH; i += 1) {
		const token = args[i]!;
		if (token === "--") break;
		if (token.startsWith("-")) break;
		if (isAssignmentLike(token)) break;
		words.push(token);
	}
	return words;
}

function collectAnalyzedCommandsFromCommand(command: CommandNode): AnalyzeResult {
	switch (command.type) {
		case "SimpleCommand": {
			const words = deriveCommandWords(command);
			if (words === null) {
				return { kind: "raw", target: { kind: "raw", raw: "", reason: "non-literal command word" } };
			}
			if (words.length === 0) return { kind: "path", commands: [] };
			return {
				kind: "path",
				commands: [
					{
						kind: "path",
						words,
						display: formatPath(words),
						sourceText: formatPath(words),
					},
				],
			};
		}
		case "Subshell":
		case "Group":
			return collectAnalyzedCommandsFromStatements(command.body);
		case "If": {
			let commands: AnalyzedCommand[] = [];
			for (const clause of command.clauses) {
				const condition = collectAnalyzedCommandsFromStatements(clause.condition);
				if (condition.kind === "raw") return condition;
				commands = commands.concat(condition.commands);
				const body = collectAnalyzedCommandsFromStatements(clause.body);
				if (body.kind === "raw") return body;
				commands = commands.concat(body.commands);
			}
			if (command.elseBody) {
				const elseBody = collectAnalyzedCommandsFromStatements(command.elseBody);
				if (elseBody.kind === "raw") return elseBody;
				commands = commands.concat(elseBody.commands);
			}
			return { kind: "path", commands };
		}
		case "For":
		case "While":
		case "Until": {
			let condition: AnalyzeResult = { kind: "path", commands: [] };
			if (command.type !== "For") {
				condition = collectAnalyzedCommandsFromStatements(command.condition);
			}
			if (condition.kind === "raw") return condition;
			const body = collectAnalyzedCommandsFromStatements(command.body);
			if (body.kind === "raw") return body;
			return { kind: "path", commands: condition.commands.concat(body.commands) };
		}
		case "Case": {
			let commands: AnalyzedCommand[] = [];
			for (const item of command.items) {
				const body = collectAnalyzedCommandsFromStatements(item.body);
				if (body.kind === "raw") return body;
				commands = commands.concat(body.commands);
			}
			return { kind: "path", commands };
		}
		case "CStyleFor":
		case "ArithmeticCommand":
		case "ConditionalCommand":
			return { kind: "raw", target: { kind: "raw", raw: "", reason: `unsupported ${command.type} analysis` } };
		case "FunctionDef":
			return { kind: "raw", target: { kind: "raw", raw: "", reason: "function definition present" } };
	}
}

function collectAnalyzedCommandsFromPipeline(pipeline: PipelineNode): AnalyzeResult {
	let commands: AnalyzedCommand[] = [];
	for (const command of pipeline.commands) {
		const result = collectAnalyzedCommandsFromCommand(command);
		if (result.kind === "raw") return result;
		commands = commands.concat(result.commands);
	}
	return { kind: "path", commands };
}

function collectAnalyzedCommandsFromStatements(statements: StatementNode[]): AnalyzeResult {
	let commands: AnalyzedCommand[] = [];
	for (const statement of statements) {
		for (const pipeline of statement.pipelines) {
			const result = collectAnalyzedCommandsFromPipeline(pipeline);
			if (result.kind === "raw") return result;
			commands = commands.concat(result.commands);
		}
	}
	return { kind: "path", commands };
}

export function analyzeScript(raw: string): AnalyzeResult {
	try {
		const script = parse(raw) as ScriptNode;
		const result = collectAnalyzedCommandsFromStatements(script.statements);
		if (result.kind === "raw") {
			return { kind: "raw", target: { kind: "raw", raw, reason: result.target.reason } };
		}
		return {
			kind: "path",
			commands: result.commands.map((command) => ({ ...command, sourceText: raw })),
		};
	} catch (error) {
		return {
			kind: "raw",
			target: {
				kind: "raw",
				raw,
				reason: error instanceof Error ? error.message : "parse failure",
			},
		};
	}
}

export function appendRule(policy: PolicyFile, directory: string, rule: Rule) {
	const normalized = normalizeDirectory(directory);
	policy.directories[normalized] ??= [];
	policy.directories[normalized]!.push(rule);
}

export function findPathRuleForPolicies(
	directory: string,
	words: string[],
	policies: PolicyFile[],
): RuleMatch | null {
	const ancestors = getAncestorDirectories(directory);
	let best: RuleMatch | null = null;
	for (const ancestor of ancestors) {
		const depth = directoryDepth(ancestor);
		const rules = policies.flatMap((policy) => policy.directories[ancestor] ?? []);
		rules.forEach((rule, ruleIndex) => {
			if (!isPathRule(rule)) return;
			if (!isPrefix(rule.path, words)) return;
			const match: RuleMatch = {
				effect: rule.effect,
				directory: ancestor,
				rule,
				ruleIndex,
				directoryDepth: depth,
				pathDepth: rule.path.length,
			};
			if (!best || compareMatches(best, match) < 0) best = match;
		});
	}
	return best;
}

export function findRawRuleForPolicies(
	directory: string,
	raw: string,
	policies: PolicyFile[],
): RuleMatch | null {
	const ancestors = getAncestorDirectories(directory);
	let best: RuleMatch | null = null;
	for (const ancestor of ancestors) {
		const depth = directoryDepth(ancestor);
		const rules = policies.flatMap((policy) => policy.directories[ancestor] ?? []);
		rules.forEach((rule, ruleIndex) => {
			if (!isRawRule(rule)) return;
			if (rule.raw !== raw) return;
			const match: RuleMatch = {
				effect: rule.effect,
				directory: ancestor,
				rule,
				ruleIndex,
				directoryDepth: depth,
				pathDepth: Number.MAX_SAFE_INTEGER,
			};
			if (!best || compareMatches(best, match) < 0) best = match;
		});
	}
	return best;
}

export function pathPrefixChoices(words: string[]): string[] {
	const prefixes: string[] = [];
	for (let i = 1; i <= Math.min(words.length, MAX_COMMAND_DEPTH); i += 1) {
		prefixes.push(formatPath(words.slice(0, i)));
	}
	return prefixes;
}

async function ensurePolicyFileExists(): Promise<void> {
	await mkdir(path.dirname(POLICY_PATH), { recursive: true });
	try {
		await readFile(POLICY_PATH, "utf8");
	} catch {
		await writeFile(POLICY_PATH, `${JSON.stringify(createEmptyPolicy(), null, 2)}\n`, "utf8");
	}
}

export default function (pi: ExtensionAPI) {
	let persistentPolicy = createEmptyPolicy();
	let sessionPolicy = createEmptyPolicy();
	let persistentWritesEnabled = true;

	async function warn(ctx: ExtensionContext, message: string) {
		if (ctx.hasUI) ctx.ui.notify(message, "warning");
		console.warn(`[bash-sane] ${message}`);
	}

	async function loadPolicy(ctx: ExtensionContext) {
		sessionPolicy = createEmptyPolicy();
		persistentPolicy = createEmptyPolicy();
		persistentWritesEnabled = true;
		await ensurePolicyFileExists();
		try {
			const text = await readFile(POLICY_PATH, "utf8");
			persistentPolicy = sanitizePolicy(JSON.parse(text));
		} catch (error) {
			persistentPolicy = createEmptyPolicy();
			persistentWritesEnabled = false;
			const policyWarning = error instanceof Error ? error.message : "invalid policy JSON";
			await warn(ctx, `bash-sane: invalid policy file at ${POLICY_PATH}; using session-only mode (${policyWarning})`);
		}
	}

	async function savePersistentPolicy(ctx: ExtensionContext) {
		if (!persistentWritesEnabled) {
			await warn(ctx, `bash-sane: ${POLICY_PATH} is invalid; storing rule in memory for this session only`);
			return false;
		}
		await mkdir(path.dirname(POLICY_PATH), { recursive: true });
		await writeFile(POLICY_PATH, `${JSON.stringify(persistentPolicy, null, 2)}\n`, "utf8");
		return true;
	}


	async function choosePrefix(ctx: ExtensionContext, words: string[]): Promise<string[] | null> {
		const choices = pathPrefixChoices(words);
		const choice = await ctx.ui.select("Select command scope", choices);
		if (!choice) return null;
		const index = choices.indexOf(choice);
		if (index < 0) return null;
		return words.slice(0, index + 1);
	}

	async function chooseDirectory(ctx: ExtensionContext, cwd: string): Promise<string | null> {
		const ancestors = [...getAncestorDirectories(cwd)].reverse();
		return await ctx.ui.select("Select directory scope", ancestors);
	}

	async function chooseAction(ctx: ExtensionContext, title: string): Promise<Action | null> {
		const choice = await ctx.ui.select(title, [...ACTIONS]);
		return (choice as Action | null) ?? null;
	}

	function blockReason(match: RuleMatch): string {
		return `Blocked by bash-sane policy at ${match.directory}: ${formatRule(match.rule)}`;
	}

	async function applyDecision(
		ctx: ExtensionContext,
		cwd: string,
		target: RuleTarget,
		action: Action,
	): Promise<{ allow: boolean; blockedReason?: string }> {
		const effect = actionEffect(action);
		const scope = actionScope(action);
		if (scope === "once") {
			return effect === "allow" ? { allow: true } : { allow: false, blockedReason: "Blocked by user" };
		}

		let rule: Rule;
		if (target.kind === "path") {
			const words = await choosePrefix(ctx, target.words);
			if (!words) return { allow: false, blockedReason: "Blocked by user" };
			rule = { effect, path: words };
		} else {
			rule = { effect, raw: target.raw };
		}

		if (scope === "session") {
			appendRule(sessionPolicy, cwd, rule);
			return effect === "allow" ? { allow: true } : { allow: false, blockedReason: "Blocked by user" };
		}

		const directory = await chooseDirectory(ctx, cwd);
		if (!directory) return { allow: false, blockedReason: "Blocked by user" };
		appendRule(persistentPolicy, directory, rule);
		const saved = await savePersistentPolicy(ctx);
		if (!saved) {
			appendRule(sessionPolicy, directory, rule);
		}
		return effect === "allow" ? { allow: true } : { allow: false, blockedReason: "Blocked by user" };
	}

	async function promptForCommand(
		ctx: ExtensionContext,
		cwd: string,
		command: AnalyzedCommand,
		rawCommand: string,
	): Promise<{ allow: boolean; blockedReason?: string }> {
		const title = [
			"bash-sane",
			`cwd: ${cwd}`,
			`command: ${command.display}`,
			"",
			`bash: ${rawCommand}`,
		].join("\n");
		const action = await chooseAction(ctx, title);
		if (!action) return { allow: false, blockedReason: "Blocked by user" };
		return applyDecision(ctx, cwd, { kind: "path", words: command.words, display: command.display }, action);
	}

	async function promptForRaw(
		ctx: ExtensionContext,
		cwd: string,
		target: RawTarget,
	): Promise<{ allow: boolean; blockedReason?: string }> {
		const title = [
			"bash-sane",
			`cwd: ${cwd}`,
			`mode: raw (${target.reason})`,
			"",
			`bash: ${target.raw}`,
		].join("\n");
		const action = await chooseAction(ctx, title);
		if (!action) return { allow: false, blockedReason: "Blocked by user" };
		return applyDecision(ctx, cwd, { kind: "raw", raw: target.raw, display: target.raw }, action);
	}

	pi.on("session_start", async (_event, ctx) => {
		await loadPolicy(ctx);
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const rawCommand = event.input.command;
		const cwd = normalizeDirectory(ctx.cwd);
		const analysis = analyzeScript(rawCommand);

		if (analysis.kind === "raw") {
			const rawMatch = findRawRuleForPolicies(cwd, rawCommand, [persistentPolicy, sessionPolicy]);
			if (rawMatch) {
				if (rawMatch.effect === "deny") {
					return { block: true, reason: blockReason(rawMatch) };
				}
				return;
			}
			if (!ctx.hasUI) {
				return {
					block: true,
					reason: `Blocked by bash-sane: no UI available for raw approval (${analysis.target.reason})`,
				};
			}
			const decision = await promptForRaw(ctx, cwd, analysis.target);
			if (!decision.allow) {
				return { block: true, reason: decision.blockedReason ?? "Blocked by user" };
			}
			return;
		}

		let unresolved: AnalyzedCommand[] = [];
		for (const command of analysis.commands) {
			const match = findPathRuleForPolicies(cwd, command.words, [persistentPolicy, sessionPolicy]);
			if (!match) {
				unresolved.push(command);
				continue;
			}
			if (match.effect === "deny") {
				return { block: true, reason: blockReason(match) };
			}
		}

		if (unresolved.length === 0) {
			return;
		}
		if (!ctx.hasUI) {
			return {
				block: true,
				reason: "Blocked by bash-sane: no UI available for unknown bash command",
			};
		}

		for (const command of unresolved) {
			const currentMatch = findPathRuleForPolicies(cwd, command.words, [persistentPolicy, sessionPolicy]);
			if (currentMatch?.effect === "allow") continue;
			if (currentMatch?.effect === "deny") {
				return { block: true, reason: blockReason(currentMatch) };
			}
			const decision = await promptForCommand(ctx, cwd, command, rawCommand);
			if (!decision.allow) {
				return { block: true, reason: decision.blockedReason ?? "Blocked by user" };
			}
		}
		return;
	});
}
