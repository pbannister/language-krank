// 20-ruleset-run.test.mjs — node:test cases for sources/ruleset-run.mjs.
// Invoked by tests/20-ruleset-run.sh.

import test from "node:test";
import assert from "node:assert/strict";
import {
    ruleset_run,
    is_match,
    fact_key,
    is_variable,
    is_operator,
} from "../sources/ruleset-run.mjs";

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

test("is_variable and is_operator recognise their forms", () => {
    assert.equal(is_variable("$p"), true);
    assert.equal(is_variable("p"), false);
    assert.equal(is_variable("$p q"), false);
    assert.equal(is_operator({ gt: 5 }), true);
    assert.equal(is_operator({ gt: 5, lt: 10 }), true);
    assert.equal(is_operator({ gt: 5, name: "x" }), false);
    assert.equal(is_operator({}), false);
});

test("a $variable binds a fact value and is substituted in an action", () => {
    const ruleset = {
        facts: [{ type: "task", priority: "high" }],
        rules: [
            {
                id: "echo",
                when: [{ fact: { type: "task", priority: "$p" } }],
                then: [{ assert: { type: "alert", priority: "$p" } }],
            },
        ],
    };
    const result = ruleset_run(ruleset);
    assert.deepEqual(result.facts[1], { type: "alert", priority: "high" });
});

test("two conditions binding the same variable must agree", () => {
    const rule = {
        id: "same",
        when: [
            { fact: { type: "task", priority: "$p" } },
            { fact: { type: "cap", priority: "$p" } },
        ],
        then: [{ emit: "$p" }],
    };
    const agree = {
        facts: [{ type: "task", priority: "high" }, { type: "cap", priority: "high" }],
        rules: [rule],
    };
    assert.deepEqual(ruleset_run(agree).emitted, ["high"]);

    const disagree = {
        facts: [{ type: "task", priority: "high" }, { type: "cap", priority: "low" }],
        rules: [rule],
    };
    assert.deepEqual(ruleset_run(disagree).emitted, []);
});

test("comparison and membership operators filter facts", () => {
    const ruleset = {
        facts: [
            { type: "task", priority: "high", score: 9 },
            { type: "task", priority: "low", score: 2 },
        ],
        rules: [
            { id: "high-score", when: [{ fact: { type: "task", score: { gt: 5 } } }], then: [{ emit: "high" }] },
            { id: "low-score", when: [{ fact: { type: "task", score: { lte: 5 } } }], then: [{ emit: "low" }] },
            {
                id: "member",
                when: [{ fact: { type: "task", priority: { in: ["high", "critical"] } } }],
                then: [{ emit: "urgent" }],
            },
        ],
    };
    const result = ruleset_run(ruleset);
    assert.deepEqual(result.emitted, ["high", "low", "urgent"]);
});

test("an operator object may carry a range", () => {
    const ruleset = {
        facts: [{ type: "n", v: 5 }, { type: "n", v: 15 }],
        rules: [
            { id: "mid", when: [{ fact: { type: "n", v: { gt: 4, lt: 10 } } }], then: [{ emit: "mid" }] },
        ],
    };
    const result = ruleset_run(ruleset);
    assert.deepEqual(result.emitted, ["mid"]);
    assert.equal(result.firings, 1);
});

test("an unbound variable in an action is refused", () => {
    const ruleset = {
        facts: [{ type: "task" }],
        rules: [{ id: "bad", when: [{ fact: { type: "task" } }], then: [{ emit: "$missing" }] }],
    };
    assert.throws(() => ruleset_run(ruleset), /unbound variable/);
});

test("an unbound variable in an operator operand is refused", () => {
    const ruleset = {
        facts: [{ type: "task", score: 5 }],
        rules: [
            { id: "bad", when: [{ fact: { type: "task", score: { gt: "$missing" } } }], then: [{ emit: "x" }] },
        ],
    };
    assert.throws(() => ruleset_run(ruleset), /unbound variable/);
});

test("a negated condition may not bind a new variable", () => {
    const ruleset = {
        facts: [],
        rules: [
            { id: "bad", when: [{ fact: { type: "alert", level: "$l" }, not: true }], then: [{ emit: "x" }] },
        ],
    };
    assert.throws(() => ruleset_run(ruleset), /may not bind/);
});

test("a negated condition may reference an already-bound variable", () => {
    const ruleset = {
        facts: [{ type: "task", priority: "high" }],
        rules: [
            {
                id: "uncovered",
                when: [
                    { fact: { type: "task", priority: "$p" } },
                    { fact: { type: "cover", priority: "$p" }, not: true },
                ],
                then: [{ emit: "$p" }],
            },
        ],
    };
    const result = ruleset_run(ruleset);
    assert.deepEqual(result.emitted, ["high"]);
});

test("a retract action substitutes the bound variable", () => {
    const ruleset = {
        facts: [
            { type: "task", id: "a" },
            { type: "task", id: "b" },
            { type: "done", id: "a" },
        ],
        rules: [
            {
                id: "drop-done",
                when: [
                    { fact: { type: "task", id: "$i" } },
                    { fact: { type: "done", id: "$i" } },
                ],
                then: [{ retract: { type: "task", id: "$i" } }],
            },
        ],
    };
    const result = ruleset_run(ruleset);
    assert.deepEqual(result.facts, [
        { type: "task", id: "b" },
        { type: "done", id: "a" },
    ]);
});

test("a variable is substituted recursively in an emitted value", () => {
    const ruleset = {
        facts: [{ type: "task", priority: "high" }],
        rules: [
            {
                id: "report",
                when: [{ fact: { type: "task", priority: "$p" } }],
                then: [{ emit: { message: "$p" } }],
            },
        ],
    };
    const result = ruleset_run(ruleset);
    assert.deepEqual(result.emitted, [{ message: "high" }]);
});

test("a binding with the same facts and variables fires once", () => {
    const ruleset = {
        facts: [{ type: "task", priority: "high" }],
        rules: [
            { id: "once", when: [{ fact: { type: "task", priority: "$p" } }], then: [{ emit: "$p" }] },
        ],
    };
    const result = ruleset_run(ruleset);
    assert.equal(result.firings, 1);
    assert.deepEqual(result.emitted, ["high"]);
});

test("an action must have exactly one of assert, retract, emit", () => {
    const ruleset = {
        facts: [{ type: "task" }],
        rules: [
            { id: "bad", when: [{ fact: { type: "task" } }], then: [{ assert: { type: "x" }, emit: "y" }] },
        ],
    };
    assert.throws(() => ruleset_run(ruleset), /exactly one/);
});
