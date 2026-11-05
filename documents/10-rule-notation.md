# Rule Notation and the Krank Engine

This document defines the notation a rule set is written in, the semantics of the
interpreter that runs it, and the round-trip used to check a translation.

## Purpose

A human writes intent in prose. A model translates that prose into a rule set. A
small deterministic interpreter evaluates the rule set against facts. A renderer
translates the rule set back into prose, and the regenerated prose is compared to
the original intent.

The interpreter is a **production-rule engine**: it holds facts, matches rules
against them, and fires the actions of matching rules, forward, until no rule can
fire. This is the lineage of OPS5 and CLIPS, cut down to the smallest set of
concepts an LLM can emit reliably.

The notation is JSON because:

- a model emits JSON more reliably than a custom syntax,
- a browser and Node both parse it natively,
- the interpreter needs no parser beyond `JSON.parse`.

## The rule set

A rule set is one JSON document:

```json
{
    "facts": [ {"type": "task", "status": "open", "priority": "high"} ],
    "rules": [
        {
            "id": "flag-open-high-priority",
            "when": [ {"fact": {"type": "task", "status": "open", "priority": "high"}} ],
            "then": [ {"emit": "an open high-priority task exists"} ]
        }
    ]
}
```

### Fact

A **fact** is a JSON object whose values are JSON scalars (string, number,
boolean, or null). The key `type` names the kind of fact by convention; it is not
special to the engine.

### Rule

A **rule** is an object with three required keys and one optional key:

- `id` — a non-empty string, unique within the set.
- `when` — an array of conditions; all must hold (a conjunction).
- `then` — an array of actions, applied in order when the rule fires.
- `priority` — an optional finite number, default 0. A higher priority fires
  first; equal priorities keep document order.

### Condition

A **condition** is `{"fact": PATTERN}` or `{"fact": PATTERN, "not": true}`.

A pattern is an object keyed by fact key. Each value is a **matcher**:

- a scalar (string, number, boolean, or null) — the fact's value must equal it;
- a `$variable` such as `"$priority"` — the fact's value is bound to the variable;
- an **operator object** such as `{"gt": 5}` — the fact's value must satisfy it.

A fact matches a pattern when it has every key in the pattern and every matcher
holds. Extra keys on the fact are ignored, so a pattern with no keys matches every
fact. `"not": true` inverts the condition: it holds when no fact matches the
pattern. A negated condition may reference variables already bound by earlier
conditions, but it may not bind a new one.

A **count condition** is `{"count": {"fact": PATTERN, "at_least": N}}` or
`{"count": {"fact": PATTERN, "at_most": N}}`, or both bounds together. It holds
when the number of facts matching the pattern is within the bounds. The pattern may
reference variables already bound by earlier conditions, but it may not bind a new
one. A count condition makes a "for all" non-vacuous: pair `at_least: 1` with a
negated condition to mean "at least one, and none of them forbidden".

```json
{"count": {"fact": {"type": "checklist", "task": "$t"}, "at_least": 1}}
```

This holds when at least one checklist fact belongs to the task bound to `$t`.

Disjunction is expressed by writing two rules with the same `then`, not by an
`any` operator. The notation has no `any`.

### Action

An **action** is one of:

- `{"assert": FACT}` — add the fact; a no-op when an equal fact already exists.
- `{"retract": PATTERN}` — remove every fact matching the pattern.
- `{"emit": VALUE}` — record `VALUE` in the output.

`emit` is the observable result; `assert` and `retract` change state.

### Variable

A **variable** is a string of the form `"$name"`, where `name` starts with a letter
or underscore and continues with letters, digits, or underscores.

- In a pattern value, a variable **binds** the matched fact's value. When the
  variable is already bound (by an earlier condition), the fact's value must equal
  it, so two conditions that name the same variable must agree.
- In an action template, a variable is **replaced** by its bound value: in an
  `assert` or `retract` fact, and in any leaf of an `emit` value.
- A variable that no condition binds is an error. A rule that uses one is refused
  before matching, with a message naming the rule and the variable.

Variables bind left to right: a condition may use a variable an earlier condition
bound, never one a later condition binds.

```json
{
    "id": "echo-priority",
    "when": [ {"fact": {"type": "task", "priority": "$p"}} ],
    "then": [ {"assert": {"type": "alert", "priority": "$p"}} ]
}
```

### Operator

An **operator object** is a non-empty object whose keys are all operators. The
fact's value must satisfy every operator in the object, so one object can carry a
range.

| Operator | Holds when |
|---|---|
| `eq` | the value equals the operand |
| `ne` | the value does not equal the operand |
| `lt`, `lte` | the value is less than, or at most, the operand |
| `gt`, `gte` | the value is greater than, or at least, the operand |
| `in` | the value is one of the operand array |
| `prefix` | the value is a string that starts with the operand |

An operand is a scalar, an already-bound `$variable`, or (for `in` only) an array
of scalars. `prefix` compares strings; a non-string value is a no-match, not an
error. A numeric comparison holds only when both sides are numbers; a non-numeric
comparison is a no-match, not an error.

```json
{"fact": {"type": "task", "score": {"gt": 4, "lt": 10}}}
```

This matches a task whose score is greater than 4 and less than 10.

## Semantics

The interpreter is deterministic and forward-chaining.

1. Load the facts (a set: two facts are the same fact when their keys and values
   are equal).
2. Scan the rules in agenda order: priority descending, then document order. For
   each rule, enumerate its **bindings** — every way to satisfy its conditions —
   in canonical order.
3. Fire the first rule with a binding that has not fired before: apply its `then`
   in order, and record the firing.
4. Refraction: a rule binding fires at most once. A binding is the rule id, the
   multiset of matched facts, and the variable assignment.
5. Repeat from step 2 until no rule has an unfired binding (a fixpoint).
6. If the number of firings reaches a cap (10 000 by default), stop with an error:
   the set did not reach a fixpoint.

Before any matching, the engine validates every rule: a string `id`, `when` and
`then` arrays, exactly one key per action, and every variable bound before it is
used. A malformed rule is refused with a message naming the rule and the problem,
rather than silently matching nothing.

Two facts are the same fact when their keys and values are equal, so an `assert`
of an equal fact is a no-op and a `retract` removes every equal fact.

A condition that names a literal `type` is matched against the facts of that type
only: the engine indexes facts by `type`. A `$variable` or an operator on `type`
falls back to scanning every fact.

## Session

`ruleset_run` evaluates a rule set once and discards its state. A **session** keeps
working memory across runs:

```js
const session = ruleset_session(ruleset);
session.assert({ type: "task", priority: "high" });
session.run();
session.assert({ type: "cap", priority: "high" });
session.run();          // only bindings the new fact enables fire
```

- `assert(fact)` adds a fact and returns whether it was new.
- `retract(pattern)` removes matching facts and returns how many.
- `facts()`, `emitted()`, and `trace()` return snapshots.
- `run()` evaluates to a fixpoint and returns `{ facts, emitted, trace, firings }`;
  `emitted`, `trace`, and `firings` accumulate over the session's runs.
- `reset()` restores the initial facts and clears refraction.
- `forget_refraction()` clears refraction without losing facts, so a binding may
  fire again.

`ruleset_run` is the one-shot form: `ruleset_run(rs)` is
`ruleset_session(rs).run()`.

## Round trip

The three-step check is:

1. prose → rule set (a model translates),
2. rule set → prose (the renderer),
3. prose (step 2) compared to prose (step 1), by a human or a model.

The renderer is deterministic, so step 2 is reproducible and the comparison in
step 3 is between two pieces of prose, not between prose and a data structure.

## Minimality

The notation has two kinds of condition (positive, negated), three actions
(assert, retract, emit), one control structure (conjunction, with disjunction by
multiple rules), and three matchers (scalar equality, variable binding, operator
object). Anything more is added only when a real rule set cannot be expressed
without it.

The engine has no certainty factors, no conflict-resolution strategy beyond a
rule's `priority`, and no Rete network. Firing order is priority descending, then
document order; a rule binding fires once.
