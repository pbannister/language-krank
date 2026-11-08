# Project Overview

This repository holds **krank**, a small production-rules engine whose notation an
LLM can emit reliably, plus the round-trip renderer used to check a translation.

A human writes intent in prose. A model translates the prose into a rigorous,
exact form — the object model and the rule set. The engine evaluates the rule set
deterministically and forward, the renderer writes it back into prose, and the
human compares the two to verify and elaborate the captured intent before the
rules are used. The aim is the general pattern the project skeleton records as
"Intent, exactness, iteration", instantiated here.

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
- Run the tool without installing: `npx krank run ruleset.json`, `npx krank render ruleset.json`, or `npx krank check ruleset.json facts.json` to supply facts and read the engine's decision (`--fail-on-emit` makes any emission exit nonzero, so it can gate a check).
- In a browser, import the modules directly from a served URL, for example `import { ruleset_run } from "https://host/krank/sources/ruleset-run.mjs"`. The barrel and the two library modules carry no `node:` import, so they work in a browser; the command-line tool does not.

During development, a sibling project can depend on this checkout by path (`"@bannister.us/krank": "file:../08-language-krank"`) or on a release tag once one is cut.

## Browser demo

`sources/browser/` holds two zero-build pages that load `sources/krank.mjs` as a native ES module; the engine and renderer carry no `node:` import, so the same code runs in the browser.

- `index.html` is the **prompt studio**, a local tool: a step rail with one panel per step — prompt (editable, with its file history), objects (propose, accept or ignore each guess, counts), candidates (one or more rule sets, each with an explanation and expandable rules and cases), rules, rendered prose, comparison with a hint per case, reduced prompt with its diff, check, and approve. `make studio` builds it into `dataflow.out/studio/` and serves it on `127.0.0.1` (the server sends `text/javascript` for `.mjs`). It is not published: the homelab strips a project-authored `<nav>`, which the step rail needs. Editing the prompt text is a page-local draft: the file is never written, the edit note says so, and the text can be downloaded.
- `playground.html` edits a single rule set and runs it. `make demo` serves it locally from `sources/`.

The compile is recorded: `scripts/site-catalog.mjs` assembles the compiled rule sets and the prompt text, and `scripts/site-facts.mjs` extracts the facts the check runs against — file properties, plus task sections and operation lines, feature requirements, and test tiers. `make site` publishes the playground with the project pages via `scripts/site-demo.sh` (library modules at the project root), and `site.in/pages.nav` lists it in the nav. The npm package does not include the browser pages; `package.json`'s `files` lists the library modules only.

**The object model cycle.** `dataflow.in/object-model.json` now carries provenance for every object, operation, and relation: evidence, rationale, and a confirmed status. Its `proposals` array keeps every excluded guess with its reason, so a later pass does not re-propose it. The studio's **Objects** step splits the review by kind; each row carries a tri-state checkbox that accepts (checked) or ignores (unchecked) the term, stays marked unreviewed until you toggle it, and shows the evidence and rationale together; the filename in an evidence line opens the cited file in a viewer overlay with its section highlighted, and pushes a history entry so the browser back arrow closes it without losing the review state. The **Status** tab shows when the file last changed and was scanned, the scan result counts, and the **Scan file** button; **About** explains the cycle. **Scan file** posts the prompt to `/propose`, which runs the proposal task through the model and returns pending proposals. The compile task names only the confirmed objects, and the studio refuses a candidate whose fact type is not a confirmed object. The task that defines the proposal extraction is `prompts/tasks/03-propose-object-model.md`.

**Generating candidates.** The studio's **Generate candidates** button posts the selected prompt to the studio server's `POST /compile`. The server runs `scripts/compile-with-harness.mjs`, which runs the task through the DeepSeek Harness headless profile, and validates the returned rules with the engine before replying. The server holds no model credential; the Harness owns the provider. The headless profile still needs its own credential: export `DEEPSEEK_API_KEY` before `make studio`, because the key the web Models page stores is not visible to a separate process. Set `DSH_BIN` if `dsh` is not on `PATH`, and `STUDIO_COMPILER_SCRIPT` to point at a different backend.

**In the Harness.** `sources/harness/krank-studio/` is a Harness client plugin that adds a **Studio** action to the conversation session header and opens the local studio. Install it into the web profile with `dsh plugin --profile web add -w sources/harness/krank-studio`, then reload the page. It is a launcher, not a second copy of the studio, and it is never published.

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
