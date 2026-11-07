# Record: round-trip exercise handoff — 2026-11-07

> Written so a fresh session can resume without this conversation's memory.

## The exercise

Aim: determine, more accurately, whether the extracted rules match the original
intent in the prompts.

Processing:

1. Extract formal rules from prompt prose.
2. Generate human-readable prose from the extracted rules.
3. Compare the original and the generated prose. When they match, we are good;
   when they do not, explain the difference in a form a human reads quickly.

The complaint that started it: the comparisons offered so far are unclear to a
human. This record is the handoff for that exercise.

## What was done (this exercise)

- `scripts/prompts-build.mjs` now writes, per compiled prompt, `rendered.md`
  (prose generated from the rules, via `ruleset_render`) and `comparison.md`
  (the original-vs-generated comparison).
- The comparison lists the lines a rule captured — with the rule id, a verdict,
  and what was kept or lost — and then the lines no rule captured, so the gap in
  intent is visible rather than hidden.
- `make prompts` regenerates all of it; `tests/31` checks the two new forms.
- Fixed a manifest bug: the full build appended to a stale manifest, duplicating
  entries across repeated runs.

## Prior conversation (gist)

- krank is a production-rules engine whose notation an LLM can emit reliably,
  plus a renderer that writes the rules back into prose for a round trip.
- The object model (`dataflow.in/object-model.json`, 79 objects) names the facts;
  the extractors (`scripts/site-facts.mjs`) produce them from files; the markers
  (`documents/13-markers.md`) tie prompt lines to rules.
- `prompts.out/` is the generated formal form (`rules.json`, `marked.md`,
  `reduced.md`, `rendered.md`, `comparison.md`); `make prompts` builds it.
- The studio (local, `make studio`) drives the interaction cycle: write prose,
  review candidates, approve, render, compare, check; it streams live progress
  and the model's reasoning.
- The shared rules split `prompts/capabilities/` into `artifacts/` and
  `execution/` (`v2026-11-06.1`, breaking).
- The general pattern, recorded in the skeleton, is: capture intent in prose,
  render it into an exact form, iterate with the human to verify and elaborate.

## Current state (verified 2026-11-07)

- 8 prompt families are compiled; the rest of the corpus is not. The comparison
  makes the gap explicit — e.g. `prompts/01-contract.md` has 4 lines captured and
  150 not captured.
- The comparison is deterministic (the renderer's output next to the original),
  and it now names the uncovered lines explicitly.
- `sources/browser/index.html` carries an uncommitted reformatting (functionally
  identical, roughly 189 → 549 lines) done outside this session; decide whether
  to keep or revert it.

## Next tasks (in order)

1. Compile the remaining prompt families (research, capabilities artifacts and
   execution, the conventions remainder) so fewer lines read "not captured".
2. If the deterministic comparison is still unclear, add a model-written
   plain-language explanation of each mismatch.

## Commits (this session)

- `0305135` feat: render prose from rules and write a per-prompt comparison
