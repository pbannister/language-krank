# TODO

## Open Questions

- [ ] decide whether the notation needs a value-comparison beyond equality (for example `less than`, or a regex), or whether those belong in the prose above the rule set.
- [ ] decide whether an `any` (disjunction) operator is worth adding, given that disjunction is expressible as multiple rules with the same `then`.
- [ ] try the round trip on real prose: translate a few rules of `prompts/01-contract.md` into a rule set, render them back, and compare.
- [ ] decide whether `sources/` should grow a browser demo (the engine is already browser-safe; only the CLI reads files).
- [ ] trim the inherited site-build and project-pages features, scripts, and tests once the rules engine no longer needs a complete-project fixture.

## Recently Completed

- [x] create the project from `00-project-skeleton` and vendor the shared rules (2026-11-04).
- [x] write the notation and semantics in `documents/10-rule-notation.md`.
- [x] implement the interpreter `sources/engine.mjs`, the renderer `sources/render.mjs`, and the CLI `sources/cli.mjs`.
- [x] add the engine and render tests (`tests/20-engine.sh`, `tests/21-render.sh` and their `.mjs` bodies).
- [x] add feature `prompts/features/03-rules-engine.md` and the glossary terms for the notation.
