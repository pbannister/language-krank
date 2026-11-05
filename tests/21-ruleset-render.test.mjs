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

test("fact_render keeps a $variable visible", () => {
  assert.equal(fact_render({ type: "task", priority: "$p" }), "a task with priority $p");
});

test("rule_render renders a comparison operator as prose", () => {
  const rule = {
    id: "big",
    when: [{ fact: { type: "task", score: { gt: 5 } } }],
    then: [{ emit: "big" }],
  };
  assert.equal(
    rule_render(rule),
    'Rule "big": when there is a task with score greater than 5, then emit "big".',
  );
});

test("rule_render renders an operator range as prose", () => {
  const rule = {
    id: "mid",
    when: [{ fact: { type: "n", v: { gt: 4, lt: 10 } } }],
    then: [{ emit: "mid" }],
  };
  assert.equal(
    rule_render(rule),
    'Rule "mid": when there is a n with v greater than 4 and less than 10, then emit "mid".',
  );
});

test("rule_render renders membership and a negated condition", () => {
  const rule = {
    id: "urgent",
    when: [
      { fact: { type: "task", priority: { in: ["high", "critical"] } } },
      { fact: { type: "task", priority: "$p" } },
      { fact: { type: "cover", priority: "$p" }, not: true },
    ],
    then: [{ emit: "urgent" }],
  };
  const text = rule_render(rule);
  assert.ok(text.includes('priority in ["high", "critical"]'));
  assert.ok(text.includes("there is no cover with priority $p"));
});
