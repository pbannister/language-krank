# TODO

## Open Questions

- [ ] decide whether to add a string-matching operator (`matches` with a regex, or `contains`), which is deliberately absent from the operator set.
- [ ] decide whether an `any` (disjunction) operator is worth adding, given that disjunction is expressible as multiple rules with the same `then`.
- [ ] try the round trip on real prose: translate a few rules of `prompts/01-contract.md` into a rule set, render them back, and compare.
- [ ] decide whether `sources/` should grow a browser demo (the engine is already browser-safe; only the CLI reads files).
- [ ] trim the inherited site-build and project-pages features, scripts, and tests once the rules engine no longer needs a complete-project fixture.

## Recently Completed

- [x] create the project from `00-project-skeleton` and vendor the shared rules (2026-11-04).
- [x] write the notation and semantics in `documents/10-rule-notation.md`.
- [x] implement the interpreter `sources/ruleset-run.mjs`, the renderer `sources/ruleset-render.mjs`, and the CLI `sources/ruleset-command.mjs`.
- [x] add the engine and render tests (`tests/20-ruleset-run.sh`, `tests/21-ruleset-render.sh` and their `.mjs` bodies).
- [x] add feature `prompts/features/03-rules-engine.md` and the glossary terms for the notation.
- [x] add variable binding and a small operator set (`eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`) to the engine, renderer, and notation (2026-11-04).
