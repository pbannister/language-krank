# Feature: Prompts Output

## Purpose

`prompts.out/` is the generated formal form of the prompt corpus: marked prose,
reduced prose, and the approved rule sets. The human writes `prompts/`; the model
compiles; `make prompts` generates `prompts.out/`. The model works from the
reduced form and proves conformance with `krank check`.

## Requirements

- `PROMPTS-OUT-R001` — `make prompts` must generate `prompts.out/` from the approved candidates, writing `rules.json`, `marked.md`, and `reduced.md` per compiled prompt plus a `manifest.json`.
- `PROMPTS-OUT-R002` — A line must be marked and removed only when all its identified clauses have explicitly approved executable rules, supported facts, and a current recorded check; partial lines and context must be retained, and exact source positions and quotations must prevent substring or repeated-text removal errors.
- `PROMPTS-OUT-R003` — The regression suite must verify that only eligible lines carry reduction markers, that those exact lines are removed, and that legacy, unapproved, unsupported, incomplete, or stale evidence retains prose; the manifest must distinguish identified, executable, approved, and removable coverage.
- `PROMPTS-OUT-R004` — `prompts.out/` is generated and gitignored; it is never edited by hand.
- `PROMPTS-OUT-R005` — A compile entry may name `approved` to select a candidate for output, but selection must never imply requirement approval; a missing or unknown selection must not authorize reduction, and legacy candidates must remain readable without automatic approval migration.
- `PROMPTS-OUT-R006` — The studio, catalog view, coverage report, and builder must share core review and reduction decisions; coverage must describe the selected reading rather than the union of alternatives, and generated output must expose retained reasons and the evaluated scope without claiming future enforcement.

## Behavior

- `make prompts` regenerates the tree deterministically from `prompts/`, the compile entries, and the markers.

## Dependencies

- `04-browser-demo.md` — the compile catalog supplies the candidates.
- `06-fact-extractors.md` — the markers are the facts the extractor reads.
