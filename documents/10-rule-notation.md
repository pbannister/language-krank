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

A **rule** is an object with exactly three keys:

- `id` — a non-empty string, unique within the set.
- `when` — an array of conditions; all must hold (a conjunction).
- `then` — an array of actions, applied in order when the rule fires.

### Condition

A **condition** is `{"fact": PATTERN}` or `{"fact": PATTERN, "not": true}`.

A pattern is matched by subset equality: a fact matches a pattern when, for every
key in the pattern, the fact has an equal value under that key. A pattern with no
keys matches every fact. `"not": true` inverts the condition: it holds when no
fact matches the pattern.

Disjunction is expressed by writing two rules with the same `then`, not by an
`any` operator. The notation has no `any`.

### Action

An **action** is one of:

- `{"assert": FACT}` — add the fact; a no-op when an equal fact already exists.
- `{"retract": PATTERN}` — remove every fact matching the pattern.
- `{"emit": VALUE}` — record `VALUE` in the output.

`emit` is the observable result; `assert` and `retract` change state.

## Semantics

The interpreter is deterministic and forward-chaining.

1. Load the facts (a set: two facts are the same fact when their keys and values
   are equal).
2. Scan the rules in document order. For each rule, enumerate its **bindings** —
   every way to satisfy its conditions — in canonical order.
3. Fire the first rule with a binding that has not fired before: apply its `then`
   in order, and record the firing.
4. Refraction: a rule binding fires at most once. A binding is the rule id plus
   the multiset of matched facts.
5. Repeat from step 2 until no rule has an unfired binding (a fixpoint).
6. If the number of firings reaches a cap (10 000 by default), stop with an error:
   the set did not reach a fixpoint.

Two facts are the same fact when their keys and values are equal, so an `assert`
of an equal fact is a no-op and a `retract` removes every equal fact.

## Round trip

The three-step check is:

1. prose → rule set (a model translates),
2. rule set → prose (the renderer),
3. prose (step 2) compared to prose (step 1), by a human or a model.

The renderer is deterministic, so step 2 is reproducible and the comparison in
step 3 is between two pieces of prose, not between prose and a data structure.

## Minimality

The notation has three kinds of condition (positive, negated) and three actions
(assert, retract, emit), one control structure (conjunction, with disjunction by
multiple rules), and one matching rule (subset equality). Anything more is added
only when a real rule set cannot be expressed without it.

The engine has no certainty factors, no salience, and no complex conflict
resolution. Firing order is document order; a rule binding fires once.
