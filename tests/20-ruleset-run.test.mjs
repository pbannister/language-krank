// 20-ruleset-run.test.mjs — node:test cases for sources/ruleset-run.mjs.
// Invoked by tests/20-ruleset-run.sh.

import test from "node:test";
import assert from "node:assert/strict";
import { ruleset_run, is_match, fact_key } from "../sources/ruleset-run.mjs";

test("a matching fact fires a rule and emits", () => {
  const ruleset = {
    facts: [{ type: "task", status: "open" }],
    rules: [
      { id: "r1", when: [{ fact: { type: "task", status: "open" } }], then: [{ emit: "open task" }] },
    ],
  };
  const result = ruleset_run(ruleset);
  assert.deepEqual(result.emitted, ["open task"]);
  assert.equal(result.firings, 1);
});

test("a non-matching fact fires nothing", () => {
  const ruleset = {
    facts: [{ type: "task", status: "closed" }],
    rules: [
      { id: "r1", when: [{ fact: { type: "task", status: "open" } }], then: [{ emit: "open task" }] },
    ],
  };
  const result = ruleset_run(ruleset);
  assert.deepEqual(result.emitted, []);
  assert.equal(result.firings, 0);
});

test("assert forward-chains into a second rule", () => {
  const ruleset = {
    facts: [{ type: "task", status: "open", priority: "high" }],
    rules: [
      {
        id: "detect",
        when: [{ fact: { type: "task", priority: "high" } }],
        then: [{ assert: { type: "alert", message: "high priority" } }],
      },
      {
        id: "report",
        when: [{ fact: { type: "alert" } }],
        then: [{ emit: "alert raised" }],
      },
    ],
  };
  const result = ruleset_run(ruleset);
  assert.deepEqual(result.emitted, ["alert raised"]);
  assert.equal(result.firings, 2);
  assert.ok(result.facts.some((fact) => fact.type === "alert"));
});

test("negation holds only when no fact matches", () => {
  const no_alert = {
    facts: [{ type: "task", status: "open" }],
    rules: [
      {
        id: "no-alert",
        when: [{ fact: { type: "alert" }, not: true }],
        then: [{ emit: "nothing to report" }],
      },
    ],
  };
  assert.deepEqual(ruleset_run(no_alert).emitted, ["nothing to report"]);

  const with_alert = {
    facts: [{ type: "task", status: "open" }, { type: "alert" }],
    rules: [
      {
        id: "no-alert",
        when: [{ fact: { type: "alert" }, not: true }],
        then: [{ emit: "nothing to report" }],
      },
    ],
  };
  assert.deepEqual(ruleset_run(with_alert).emitted, []);
});

test("a rule binding fires once (refraction)", () => {
  // The rule asserts nothing, so it would match the same fact forever without
  // refraction. It must fire exactly once.
  const ruleset = {
    facts: [{ type: "task", status: "open" }],
    rules: [
      { id: "once", when: [{ fact: { type: "task" } }], then: [{ emit: "seen" }] },
    ],
  };
  const result = ruleset_run(ruleset);
  assert.equal(result.firings, 1);
  assert.deepEqual(result.emitted, ["seen"]);
});

test("assert of an equal fact is a no-op", () => {
  const ruleset = {
    facts: [{ type: "task", status: "open" }],
    rules: [
      { id: "dup", when: [{ fact: { type: "task" } }], then: [{ assert: { type: "task", status: "open" } }] },
    ],
  };
  const result = ruleset_run(ruleset);
  assert.equal(result.facts.length, 1);
  assert.equal(result.firings, 1);
});

test("retract removes every matching fact", () => {
  const ruleset = {
    facts: [{ type: "task", status: "open" }, { type: "task", status: "closed" }],
    rules: [
      {
        id: "clear-open",
        when: [{ fact: { type: "task", status: "open" } }],
        then: [{ retract: { type: "task", status: "open" } }],
      },
    ],
  };
  const result = ruleset_run(ruleset);
  assert.deepEqual(result.facts, [{ type: "task", status: "closed" }]);
});

test("a retract-and-reassert cycle terminates (refraction, not the cap)", () => {
  // The two rules ping-pong between two fact values. Each binding fires once,
  // so the engine reaches a fixpoint after two firings rather than looping.
  const ruleset = {
    facts: [{ type: "x", v: 1 }],
    rules: [
      {
        id: "bump",
        when: [{ fact: { type: "x", v: 1 } }],
        then: [{ retract: { type: "x", v: 1 } }, { assert: { type: "x", v: 2 } }],
      },
      {
        id: "reset",
        when: [{ fact: { type: "x", v: 2 } }],
        then: [{ retract: { type: "x", v: 2 } }, { assert: { type: "x", v: 1 } }],
      },
    ],
  };
  const result = ruleset_run(ruleset);
  assert.equal(result.firings, 2);
  assert.deepEqual(result.facts, [{ type: "x", v: 1 }]);
});

test("a rule with no id is refused", () => {
  const ruleset = { facts: [], rules: [{ when: [], then: [] }] };
  assert.throws(() => ruleset_run(ruleset), /non-empty string id/);
});

test("an unknown action is refused", () => {
  const ruleset = {
    facts: [{ type: "task" }],
    rules: [{ id: "bad", when: [{ fact: { type: "task" } }], then: [{ poke: true }] }],
  };
  assert.throws(() => ruleset_run(ruleset), /no assert, retract, or emit/);
});

test("is_match is subset equality and fact_key ignores key order", () => {
  assert.equal(is_match({ type: "task", status: "open", priority: "high" }, { type: "task" }), true);
  assert.equal(is_match({ type: "task", status: "open" }, { type: "task", status: "closed" }), false);
  assert.equal(
    fact_key({ type: "task", status: "open" }),
    fact_key({ status: "open", type: "task" }),
  );
});

test("a rule with only negative conditions fires once when they hold", () => {
  const ruleset = {
    facts: [],
    rules: [{ id: "empty", when: [{ fact: { type: "anything" }, not: true }], then: [{ emit: "empty" }] }],
  };
  const result = ruleset_run(ruleset);
  assert.equal(result.firings, 1);
  assert.deepEqual(result.emitted, ["empty"]);
});
