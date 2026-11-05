# Feature: Krank Rules Engine

## Purpose

A human writes intent in prose. A model translates the prose into a rule set,
which a small deterministic interpreter evaluates against facts. A renderer
translates the rule set back into prose so the translation can be checked against
the original intent.

## Requirements

- `KRANK-R001` — A rule set must be a JSON document with a `facts` array and a `rules` array.
- `KRANK-R002` — A rule must have a non-empty string `id`, a `when` array of conditions, and a `then` array of actions.
- `KRANK-R003` — A condition must be `{"fact": PATTERN}` or `{"fact": PATTERN, "not": true}`, matched by subset equality.
- `KRANK-R004` — An action must be one of `assert`, `retract`, or `emit`.
- `KRANK-R005` — The interpreter must fire rules forward in document order until no unfired rule binding remains, and a rule binding must fire at most once.
- `KRANK-R006` — The interpreter must refuse a malformed rule (a missing id, or an action that is none of `assert`, `retract`, `emit`).
- `KRANK-R007` — The renderer must translate a rule set into deterministic prose, so the same rule set always renders to the same text.
- `KRANK-R008` — The command-line tool must run or render a rule set from a file without prompting, and fail closed on a missing file or invalid JSON.

## Behavior

- Running the engine returns the final facts, the emitted values, and the firings.
- Rendering a rule set produces readable prose a reviewer can compare to the original intent.
- Assert of an equal fact is a no-op; retract removes every matching fact.

## Dependencies

- None.
