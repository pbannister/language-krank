# TODO

## Open Questions

## Recently Completed

- [x] create the project from `00-project-skeleton` and vendor the shared rules (2026-11-04).
- [x] write the notation and semantics in `documents/10-rule-notation.md`.
- [x] implement the interpreter `sources/ruleset-run.mjs`, the renderer `sources/ruleset-render.mjs`, and the CLI `sources/ruleset-command.mjs`.
- [x] add the engine and render tests (`tests/20-ruleset-run.sh`, `tests/21-ruleset-render.sh` and their `.mjs` bodies).
- [x] add feature `prompts/features/03-rules-engine.md` and the glossary terms for the notation.
- [x] add variable binding and a small operator set (`eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`) to the engine, renderer, and notation (2026-11-04).
- [x] add a priority agenda, a `ruleset_session` working-memory object, and a per-`type` fact index (2026-11-04).
- [x] add `make publish` (`scripts/release-publish.sh`) to tag, push, and publish to npm (2026-11-04).
- [x] run the round trip on real prose from `prompts/01-contract.md`, recorded in `documents/11-round-trip.md` with fixture `dataflow.in/round-trip.json` (2026-11-04).
- [x] add a zero-build browser demo in `sources/browser/`, served by `make demo` (2026-11-05).
- [x] publish the demo with the project pages (`scripts/site-demo.sh`, `site.in/pages.nav`) and exclude it from the npm package (`files`) (2026-11-05).
- [x] make the published demo a round-trip page: original prose, compiled rules, rendered prose, the comparison, and the run result; plus a playground page (2026-11-05).
- [x] make the demo compile and check: select a compiled prompt (rules, rendered prose, comparison, reduced prompt), then select a project file or directory and run the rules against build-time facts (2026-11-05).
- [x] list every prompt file in the demo and show the line-by-line difference between the original and the reduced prompt (2026-11-05).
- [x] add `krank check <ruleset> [facts] [--fail-on-emit]`, the conformance entry point a model or test calls instead of reading the rules (2026-11-05).
- [x] add the `prefix` operator, so a protected path can name a prefix rather than an exact path (2026-11-05).
- [x] add a `count` condition (`at_least`/`at_most`), so a "for all" is non-vacuous; the round-trip's `mark-complete` now requires at least one checklist (2026-11-05).
- [x] build the first iteration of the prompt studio: a step rail with prompt, candidates, rules, prose, comparison with hints, reduced prompt with its diff, check, and approve (2026-11-05).
- [x] give the conventions prompt two candidates (HTML indentation in or out), so the studio's choice is a real one (2026-11-05).
