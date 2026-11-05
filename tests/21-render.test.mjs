// 21-render.test.mjs — node:test cases for sources/render.mjs.
// Invoked by tests/21-render.sh.

import test from "node:test";
import assert from "node:assert/strict";
import { renderRule, renderRuleset, renderFact } from "../sources/render.mjs";

test("renderFact produces a noun phrase with the right article", () => {
  assert.equal(renderFact({ type: "task", status: "open" }), 'a task with status "open"');
  assert.equal(renderFact({ type: "task" }), "a task");
  assert.equal(renderFact({ type: "alert" }), "an alert");
  assert.equal(renderFact({}), "a fact");
  assert.equal(renderFact({ status: "open" }), 'a fact with status "open"');
});

test("renderRule renders condition and action in order", () => {
  const rule = {
    id: "flag-open",
    when: [{ fact: { type: "task", status: "open" } }],
    then: [{ emit: "open task" }],
  };
  assert.equal(
    renderRule(rule),
    'Rule "flag-open": when there is a task with status "open", then emit "open task".',
  );
});

test("renderRule renders a negated condition without an article", () => {
  const rule = {
    id: "no-alert",
    when: [{ fact: { type: "alert" }, not: true }],
    then: [{ emit: "clear" }],
  };
  assert.equal(
    renderRule(rule),
    'Rule "no-alert": when there is no alert, then emit "clear".',
  );
});

test("renderRule renders assert and retract actions", () => {
  const rule = {
    id: "move",
    when: [{ fact: { type: "task", status: "open" } }],
    then: [{ assert: { type: "done" } }, { retract: { type: "task", status: "open" } }],
  };
  assert.equal(
    renderRule(rule),
    'Rule "move": when there is a task with status "open", then assert a done, and retract every fact matching a task with status "open".',
  );
});

test("renderRuleset includes facts and rules and is deterministic", () => {
  const ruleset = {
    facts: [{ type: "task", status: "open" }],
    rules: [{ id: "r1", when: [{ fact: { type: "task" } }], then: [{ emit: "x" }] }],
  };
  const first = renderRuleset(ruleset);
  const second = renderRuleset(ruleset);
  assert.equal(first, second);
  assert.ok(first.includes("Facts:"));
  assert.ok(first.includes("Rules:"));
  assert.ok(first.includes('a task with status "open"'));
  assert.ok(first.includes('Rule "r1"'));
});
