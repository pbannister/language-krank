// 25-round-trip.test.mjs — node:test cases for the round-trip fixture.
// Invoked by tests/25-round-trip.sh.
//
// The fixture is the rule set discussed in documents/11-round-trip.md. The test
// guards the recorded emissions and rendered phrases, so a change to the engine
// or the fixture shows up here rather than in a stale document.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ruleset_run, ruleset_render } from "../sources/krank.mjs";

const ruleset = JSON.parse(readFileSync(new URL("../dataflow.in/round-trip.json", import.meta.url), "utf8"));

test("the round-trip fixture fires the recorded verdicts", () => {
    const result = ruleset_run(ruleset);
    assert.equal(result.firings, 5);
    assert.deepEqual(result.emitted, [
        { refused: { verb: "modify", reason: "not stated by the task and not required by the workflow" } },
        { refused: { path: "logs/session.log", reason: "protected path" } },
        { ask: { because: "the ambiguity can change output, scope, or safety" } },
        { permitted: "one verification line" },
        { complete: "t10" },
    ]);
});

test("the round-trip fixture renders the recorded phrases", () => {
    const prose = ruleset_render(ruleset);
    assert.ok(prose.includes("there is a change with task $t and verb $v"));
    assert.ok(prose.includes("there is no statement with task $t and verb $v"));
    assert.ok(prose.includes("there is no workflow with requires $v"));
    assert.ok(prose.includes('changes in ["output", "scope", "safety"]'));
    assert.ok(prose.includes('there is no checklist with task $t and status "open"'));
    assert.ok(prose.includes("path starting with $g"));
    assert.ok(prose.includes("at least 1 checklist with task $t"));
});

test("a task with no checklist is not complete", () => {
    const bare = {
        facts: [{ type: "task", id: "t1" }],
        rules: [ruleset.rules.find((rule) => rule.id === "mark-complete")],
    };
    assert.deepEqual(ruleset_run(bare).emitted, []);
});

test("the fixture's bare task t11 is not complete", () => {
    const result = ruleset_run(ruleset);
    assert.ok(!result.emitted.some((item) => item.complete === "t11"));
});
