# Feature: Prompts Output

## Purpose

`prompts.out/` is the generated formal form of the prompt corpus: marked prose,
reduced prose, and the approved rule sets. The human writes `prompts/`; the model
compiles; `make prompts` generates `prompts.out/`. The model works from the
reduced form and proves conformance with `krank check`.

## Requirements

- `PROMPTS-OUT-R001` — `make prompts` must generate `prompts.out/` from the approved candidates, writing `rules.json`, `marked.md`, and `reduced.md` per compiled prompt plus a `manifest.json`.
- `PROMPTS-OUT-R002` — Every covered line must carry a rule marker in `marked.md` (`<!-- krank: {"rule":"<id>"} -->`), and the reducer must remove exactly the marked lines.
- `PROMPTS-OUT-R003` — `tests/31-prompts-build` must fail when a case's line is not marked, when a covered line remains in the reduced form, or when the manifest reports a missing marker.
- `PROMPTS-OUT-R004` — `prompts.out/` is generated and gitignored; it is never edited by hand.
- `PROMPTS-OUT-R005` — A compile entry may name `approved` to select the candidate; without it, the first candidate is used and the manifest records which one.

## Behavior

- `make prompts` regenerates the tree deterministically from `prompts/`, the compile entries, and the markers.

## Dependencies

- `04-browser-demo.md` — the compile catalog supplies the candidates.
- `06-fact-extractors.md` — the markers are the facts the extractor reads.
