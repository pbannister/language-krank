# Project Overview

This repository holds **krank**, a small production-rules engine whose notation an
LLM can emit reliably, plus the round-trip renderer used to check a translation.

A human writes intent in prose. A model translates the prose into a rule set. The
engine evaluates the rule set against facts, deterministically and forward. A
renderer translates the rule set back into prose, and the regenerated prose is
compared to the original intent.

- The notation and semantics: `documents/10-rule-notation.md`.
- The interpreter and session: `sources/ruleset-run.mjs` (`ruleset_run`, `ruleset_session`).
- The renderer: `sources/ruleset-render.mjs`.
- The library barrel: `sources/krank.mjs` (re-exports the interpreter, session, and renderer).
- The command-line tool: `sources/ruleset-command.mjs` (`run` and `render`).

## Consuming krank

The interpreter and renderer are browser-safe ES modules with no dependencies.
The package surface is `@bannister.us/krank`.

- Install the library: `npm install @bannister.us/krank`.
- Import it: `import { ruleset_run, ruleset_session, ruleset_render } from "@bannister.us/krank";`.
- Run the tool without installing: `npx krank run ruleset.json`, or `npx krank render ruleset.json`.
- In a browser, import the modules directly from a served URL, for example `import { ruleset_run } from "https://host/krank/sources/ruleset-run.mjs"`. The barrel and the two library modules carry no `node:` import, so they work in a browser; the command-line tool does not.

During development, a sibling project can depend on this checkout by path (`"@bannister.us/krank": "file:../08-language-krank"`) or on a release tag once one is cut.

## Browser demo

`sources/browser/` is a zero-build demo page. `make demo` serves it at `http://127.0.0.1:8080/browser/`, loading `sources/krank.mjs` as a native ES module; the engine and renderer carry no `node:` import, so the same code runs in the browser. Only `sources/` is served, so the rest of the repository is not exposed.

## Publishing

`make publish` tags the current commit, pushes it, and publishes the package.

- `make publish-dry-run` runs the guards and prints the plan without changing anything.
- The version in `package.json` is the contract, so the tag is `v<version>`.
- `scripts/release-publish.sh` refuses a dirty working tree, a detached HEAD, an existing tag, an already-published version, missing npm authentication, or a failing test suite.
- It runs the test suite before tagging, so a failure leaves no tag and no publish.

A coding agent begins at `AGENTS.md`, the tool-neutral entry point. The full
mandatory load order is in `prompts/02-workflow.md` section 1:

- `prompts/01-contract.md` defines the interaction, authority, and safety rules.
- `prompts/02-workflow.md` defines the execution sequence for every task.
- `prompts/03-conventions.md` defines formatting and repository conventions.

The LLM must follow the workflow defined in `prompts/02-workflow.md` for every task.

Human contributors should begin by reading:

- `prompts/README.md`
- `documents/README.md`

All project features are defined in `prompts/features/` and implemented in `sources/`.

## Top-Level Map

The directories and their purposes are listed in `prompts/01-contract.md` section 7; this map names only the root files and the points that need explaining.

- `README.md` is the project overview.
- `AGENTS.md` is the coding-agent entry point; it points at `prompts/` and defines no rule.
- `TODO.md` tracks pending and completed project tasks.
- `documents/10-rule-notation.md` is the authoritative description of the notation and semantics.
- `sources/` holds the engine, renderer, and command-line tool.
- `evals/README.md` describes the behavioral evaluation cases, scored by hand.
- `Makefile` drives the build (`make build`), the tests (`make test`), and cleanup (`make clean`).

## Project Settings

- Automatic task commits: enabled (see `prompts/02-workflow.md` §7.1).

## Worked Example

The repository includes one worked example that exercises the whole workflow. It is
a static-site build inherited from the skeleton, kept so the vendored validator
tests have a complete project to run against; it is not part of the rules engine
and may be trimmed later.

- Feature: `prompts/features/01-site-build.md`
- Script: `scripts/site-build.sh` generates `site.out/` from `site.in/`.
- Tests: `tests/00-skeleton.sh` and `tests/01-site-build.sh`

Run `make test` to run the tests.

## Keeping Current with these Rules

- A project pins the shared rules with `rules.lock` and verifies them with
  `scripts/rules-check.sh`, which runs in `make test`. The vendored files are
  byte-identical to the tagged version; editing one is drift, not customization.
- Customize by extending: a project-specific rule goes in a local prompt file
  numbered after the shared ones, and an override quotes the rule it replaces so a
  later version can tell when the override has gone stale.
- Adopting a new version is a task: run `00-project-rules/tools/rules-vendor.sh`,
  review what changed, and record the outcome under `records/`.

## Canonical Files

The following filenames are canonical and must not be renamed or duplicated without an explicit task:

- `README.md`
- `AGENTS.md`
- `TODO.md`
- `Makefile`
- `package.json`
- `.gitignore`

Tool-specific root files (for example `.aider.conf.yml`, `.aiderignore`) are permitted when a file under `tools/` declares them; see `prompts/01-contract.md` section 7.

## License

MIT. See [LICENSE](LICENSE).
