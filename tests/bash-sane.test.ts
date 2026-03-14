import test from "node:test";
import assert from "node:assert/strict";

import {
	analyzeScript,
	appendRule,
	createEmptyPolicy,
	findPathRuleForPolicies,
	findRawRuleForPolicies,
	pathPrefixChoices,
	type PolicyFile,
} from "../extensions/bash-sane/index.ts";
import { pathFixtures, rawFixtures } from "./bash-sane.fixtures.ts";

function pathCommands(script: string): string[][] {
	const result = analyzeScript(script);
	assert.equal(result.kind, "path", `expected path analysis for: ${script}`);
	return result.commands.map((command) => command.words);
}

function rawReason(script: string): string {
	const result = analyzeScript(script);
	assert.equal(result.kind, "raw", `expected raw analysis for: ${script}`);
	return result.target.reason;
}

test("path extraction fixtures", () => {
	for (const fixture of pathFixtures) {
		assert.deepEqual(pathCommands(fixture.input), fixture.expected, fixture.name);
	}
});

test("raw fallback fixtures", () => {
	for (const fixture of rawFixtures) {
		assert.match(rawReason(fixture.input), fixture.expectedReason, fixture.name);
	}
});

test("builds capped prefix choices", () => {
	assert.deepEqual(pathPrefixChoices(["a", "b", "c"]), ["a", "a b", "a b c"]);
	assert.equal(pathPrefixChoices(["1", "2", "3", "4", "5", "6", "7", "8"]).length, 7);
});

function withRules(builder: (persistent: PolicyFile, session: PolicyFile) => void) {
	const persistent = createEmptyPolicy();
	const session = createEmptyPolicy();
	builder(persistent, session);
	return { persistent, session };
}

test("policy engine prefers deeper directories over parent directories", () => {
	const { persistent, session } = withRules((p, s) => {
		appendRule(p, "/work", { effect: "allow", path: ["git"] });
		appendRule(s, "/work/project", { effect: "deny", path: ["git", "push"] });
	});

	const match = findPathRuleForPolicies("/work/project/subdir", ["git", "push", "origin", "main"], [persistent, session]);
	assert(match);
	assert.equal(match.effect, "deny");
	assert.equal(match.directory, "/work/project");
	assert.deepEqual(match.rule, { effect: "deny", path: ["git", "push"] });
});

test("policy engine prefers longer path matches within same directory", () => {
	const { persistent } = withRules((p) => {
		appendRule(p, "/repo", { effect: "allow", path: ["git"] });
		appendRule(p, "/repo", { effect: "deny", path: ["git", "push"] });
		appendRule(p, "/repo", { effect: "allow", path: ["git", "push", "origin"] });
	});

	const pushOrigin = findPathRuleForPolicies("/repo", ["git", "push", "origin", "main"], [persistent]);
	assert(pushOrigin);
	assert.equal(pushOrigin.effect, "allow");
	assert.deepEqual(pushOrigin.rule, { effect: "allow", path: ["git", "push", "origin"] });

	const pushFork = findPathRuleForPolicies("/repo", ["git", "push", "fork", "main"], [persistent]);
	assert(pushFork);
	assert.equal(pushFork.effect, "deny");
	assert.deepEqual(pushFork.rule, { effect: "deny", path: ["git", "push"] });
});

test("later rule wins on same directory and same path length", () => {
	const { persistent } = withRules((p) => {
		appendRule(p, "/repo", { effect: "allow", path: ["gh", "pr"] });
		appendRule(p, "/repo", { effect: "deny", path: ["gh", "pr"] });
	});

	const match = findPathRuleForPolicies("/repo", ["gh", "pr", "merge"], [persistent]);
	assert(match);
	assert.equal(match.effect, "deny");
});

test("raw rule matching respects deeper directory precedence", () => {
	const { persistent, session } = withRules((p, s) => {
		appendRule(p, "/repo", { effect: "allow", raw: "if foo; then bar; fi" });
		appendRule(s, "/repo/sub", { effect: "deny", raw: "if foo; then bar; fi" });
	});

	const match = findRawRuleForPolicies("/repo/sub/deeper", "if foo; then bar; fi", [persistent, session]);
	assert(match);
	assert.equal(match.effect, "deny");
	assert.equal(match.directory, "/repo/sub");
});

test("no rule match returns null", () => {
	const policy = createEmptyPolicy();
	appendRule(policy, "/repo", { effect: "allow", path: ["git", "status"] });
	assert.equal(findPathRuleForPolicies("/elsewhere", ["git", "status"], [policy]), null);
	assert.equal(findRawRuleForPolicies("/repo", "echo hi", [policy]), null);
});
