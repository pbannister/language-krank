# TODO

## Open Questions

- [ ] trim the inherited site-build and project-pages features, scripts, and tests once the rules engine no longer needs a complete-project fixture.

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
