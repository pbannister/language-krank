# Feature: Fact Extractors

## Purpose

A rule is only as good as its facts. The extractors read project artifacts and
emit the registry's fact types, so the check workflow can run the compiled rule
sets against real files. The engine stays generic; the extractor is the frontier.

## Requirements

- `EXTRACTOR-R001` — `scripts/site-facts.mjs` must emit, per file, the file facts and an `entities` list whose first entry is the `file` fact.
- `EXTRACTOR-R002` — The task extractor must read `prompts/tasks/*.md` and emit `task`, `task_section`, `task_op_line`, `task_file_row`, `task_verify`, `task_feature`, and `task_acceptance` facts.
- `EXTRACTOR-R003` — The feature extractor must read `prompts/features/*.md` and emit `feature`, `feature_section`, `requirement`, and `feature_dependency` facts.
- `EXTRACTOR-R004` — The test extractor must read `tests/*.sh` and emit a `test` fact with its declared tier and whether the tier is one the workflow defines.
- `EXTRACTOR-R005` — Every emitted type must be registered in `dataflow.in/object-model.json`; an unregistered type is a defect.
- `EXTRACTOR-R006` — The extractors must be read-only and deterministic: the same tree yields the same facts.

## Behavior

- `make studio` builds the facts into `dataflow.out/studio/browser/files.json`.
- The studio's check panel runs the selected rule set against the selected file's `entities`.
- `tests/26-browser-demo.test.mjs` asserts the task and feature extraction and that the conforming files produce no finding.

## Dependencies

- `04-browser-demo.md` — the check panel consumes the facts.
- `03-rules-engine.md` — the engine evaluates them.
