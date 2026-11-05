# Feature: Krank Rules Engine

## Purpose

A human writes intent in prose. A model translates the prose into a rule set,
which a small deterministic interpreter evaluates against facts. A renderer
translates the rule set back into prose so the translation can be checked against
the original intent.

## Requirements

- `KRANK-R001` — A rule set must be a JSON document with a `facts` array and a `rules` array.
- `KRANK-R002` — A rule must have a non-empty string `id`, a `when` array of conditions, and a `then` array of actions.
- `KRANK-R003` — A condition must be `{"fact": PATTERN}` or `{"fact": PATTERN, "not": true}`, where a pattern value is a scalar (equality), a `$variable` (binding), or an operator object.
- `KRANK-R004` — An action must be one of `assert`, `retract`, or `emit`.
- `KRANK-R005` — The interpreter must fire rules forward in document order until no unfired rule binding remains, and a rule binding must fire at most once.
- `KRANK-R006` — The interpreter must refuse a malformed rule (a missing id, an action that is none of `assert`, `retract`, `emit`, or an action with more than one of those keys).
- `KRANK-R007` — The renderer must translate a rule set into deterministic prose, so the same rule set always renders to the same text.
- `KRANK-R008` — The command-line tool must run or render a rule set from a file without prompting, and fail closed on a missing file or invalid JSON.
- `KRANK-R009` — A `$variable` in a pattern must bind the matched fact's value, left to right; two conditions that name the same variable must agree.
- `KRANK-R010` — An operator object must hold every one of its operators, drawn from `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, and `in`.
- `KRANK-R011` — A `$variable` in an action must be replaced by its bound value, in an `assert` or `retract` fact and in any leaf of an `emit` value.
- `KRANK-R012` — The interpreter must refuse a rule that uses an unbound variable, and a negated condition that would bind a new variable.

## Behavior

- Running the engine returns the final facts, the emitted values, and the firings.
- Rendering a rule set produces readable prose a reviewer can compare to the original intent.
- Assert of an equal fact is a no-op; retract removes every matching fact.

## Dependencies

- None.
