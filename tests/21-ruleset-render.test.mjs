// 21-ruleset-render.test.mjs — node:test cases for sources/ruleset-render.mjs.
// Invoked by tests/21-ruleset-render.sh.

import test from "node:test";
import assert from "node:assert/strict";
import { rule_render, ruleset_render, fact_render } from "../sources/ruleset-render.mjs";

test("fact_render produces a noun phrase with the right article", () => {
  assert.equal(fact_render({ type: "task", status: "open" }), 'a task with status "open"');
  assert.equal(fact_render({ type: "task" }), "a task");
  assert.equal(fact_render({ type: "alert" }), "an alert");
  assert.equal(fact_render({}), "a fact");
  assert.equal(fact_render({ status: "open" }), 'a fact with status "open"');
});

test("rule_render renders condition and action in order", () => {
  const rule = {
    id: "flag-open",
    when: [{ fact: { type: "task", status: "open" } }],
    then: [{ emit: "open task" }],
  };
  assert.equal(
    rule_render(rule),
    'Rule "flag-open": when there is a task with status "open", then emit "open task".',
  );
});

test("rule_render renders a negated condition without an article", () => {
  const rule = {
    id: "no-alert",
    when: [{ fact: { type: "alert" }, not: true }],
    then: [{ emit: "clear" }],
  };
  assert.equal(
    rule_render(rule),
    'Rule "no-alert": when there is no alert, then emit "clear".',
  );
});

test("rule_render renders assert and retract actions", () => {
  const rule = {
    id: "move",
    when: [{ fact: { type: "task", status: "open" } }],
    then: [{ assert: { type: "done" } }, { retract: { type: "task", status: "open" } }],
  };
  assert.equal(
    rule_render(rule),
    'Rule "move": when there is a task with status "open", then assert a done, and retract every fact matching a task with status "open".',
  );
});

test("ruleset_render includes facts and rules and is deterministic", () => {
  const ruleset = {
    facts: [{ type: "task", status: "open" }],
    rules: [{ id: "r1", when: [{ fact: { type: "task" } }], then: [{ emit: "x" }] }],
  };
  const first = ruleset_render(ruleset);
  const second = ruleset_render(ruleset);
  assert.equal(first, second);
  assert.ok(first.includes("Facts:"));
  assert.ok(first.includes("Rules:"));
  assert.ok(first.includes('a task with status "open"'));
  assert.ok(first.includes('Rule "r1"'));
});
