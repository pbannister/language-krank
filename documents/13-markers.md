# Markers

A marker is a deterministic annotation that makes a prose line or a fact
machine-readable. The human writes prose; the model writes the markers when it
generates the formal form. This document is the grammar.

## Two shapes

A marker is an HTML comment holding one JSON object:

```markdown
<!-- krank: {"rule": "refuse-unstated-change"} -->
```

- a **rule marker** maps a prose line to a rule id, so the reducer removes the
  line by id instead of by substring;
- a **fact marker** asserts a fact the prose cannot express as a string, for
  example `{"type":"session","id":"s1","goal":"..."}`.

The shapes are distinguished by their keys: a fact marker has `type`; a rule
marker has `rule`. Both are single-line, contain no `-->`, and contain no `<`.

## Grammar

`<!--` `krank:` one JSON object `-->`

- The JSON object is one line.
- The extractor reads it verbatim.
- `tests/30-object-model.test.mjs` and `tests/26-browser-demo.test.mjs` require
  every marker's `type` to be registered and every `rule` to exist.
- A malformed marker is ignored by the extractor; it is still a defect to fix,
  because the line it should cover falls back to human review.

## Where markers live

- `prompts/` — human prose, no markers.
- `prompts.out/` — the generated formal form: the same prose, with a rule marker
  on every line a rule covers, and a `## KRANK facts` section carrying fact
  markers for the objects the prose cannot express.

The reducer uses the rule markers rather than substring matching, so an edit that
rephrases a covered line does not silently re-cover it.

## Example

`prompts/`:

```markdown
- A file may be modified only when the task states the operation.
```

`prompts.out/`:

```markdown
- A file may be modified only when the task states the operation. <!-- krank: {"rule":"refuse-unstated-change"} -->

## KRANK facts
<!-- krank: {"type":"task","id":"t1"} -->
<!-- krank: {"type":"operation","task":"t1","verb":"modify"} -->
```

## Rules

- A marker is a fact or a rule mapping, not an instruction; the engine consumes
  it and the reader ignores it.
- A fact marker's `type` must be in `dataflow.in/object-model.json`.
- A rule marker's `rule` must exist in the candidate's rule set.
- The markers are generated output; they are never hand-edited.
