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

## Core contract

The studio core and its surfaces share a frozen, versioned contract:
`sources/studio-contract.mjs`, exported as `@bannister.us/krank/contract`.
It defines validators for the object model, catalog, fact bundle, compile
request/response, `prompts.out/manifest.json`, and `krank check` output.
Validators are pure and fail closed.

Inspect it with `curl http://127.0.0.1:8090/contract` or `npx krank contract`.
A breaking shape change bumps `CORE_CONTRACT_VERSION` and updates every surface;
the versioning and artifact table are in `documents/18-core-contract.md`.

## Browser demo

`sources/browser/` holds two zero-build pages that load `sources/krank.mjs` as a native ES module; the engine and renderer carry no `node:` import, so the same code runs in the browser.

- `index.html` is the **prompt studio**, a local tool: a step rail with one panel per step — prompt (editable, with its file history), objects (propose, accept or ignore each guess, counts), candidates (one or more rule sets, each with an explanation and expandable rules and cases), rules (a readable rule list with the raw JSON collapsed), rendered prose, comparison with a hint per case and the uncovered lines, reduced prompt with its diff, check with an emission summary, approve with the choice and artifact cards, and build (the reduced prompts and rule sets in `prompts.out/`, with links). `make studio` builds it into `dataflow.out/studio/` and serves it on `127.0.0.1` (the server sends `text/javascript` for `.mjs`). It is not published: the homelab strips a project-authored `<nav>`, which the step rail needs. Editing the prompt text is a page-local draft: the file is never written, the edit note says so, and the text can be downloaded. **Revise the prompt** on the comparison and approve steps returns to step 1, closing the review loop, and step 7 rebuilds `prompts.out/` in place.
- `playground.html` edits a single rule set and runs it. `make demo` serves it locally from `sources/`.

The compile is recorded: `scripts/site-catalog.mjs` assembles the compiled rule sets and the prompt text, and `scripts/site-facts.mjs` extracts the facts the check runs against — file properties, plus task sections and operation lines, feature requirements, and test tiers. `make site` publishes the playground with the project pages via `scripts/site-demo.sh` (library modules at the project root), and `site.in/pages.nav` lists it in the nav. The npm package does not include the browser pages; `package.json`'s `files` lists the library modules only.

**The object model cycle.** `dataflow.in/object-model.json` now carries provenance for every object, operation, and relation: evidence, rationale, and a confirmed status. Its `proposals` array keeps every excluded guess with its reason, so a later pass does not re-propose it. The studio's **Objects** step splits the review by kind; each row carries a tri-state checkbox that accepts (checked) or ignores (unchecked) the term, stays marked unreviewed until you toggle it, and shows the evidence and rationale together; the filename in an evidence line opens the cited file in a viewer overlay with its section highlighted, and pushes a history entry so the browser back arrow closes it without losing the review state. The **Status** tab shows when the file last changed and was scanned, the scan result counts, and the **Scan file** button; **About** explains the cycle. **Scan file** posts the prompt to `/propose`, which runs the proposal task through the model and returns pending proposals. The compile task names only the confirmed objects, and the studio refuses a candidate whose fact type is not a confirmed object. The task that defines the proposal extraction is `prompts/tasks/03-propose-object-model.md`.

**Generating candidates.** The studio's **Generate candidates** button posts the selected prompt to the studio server's `POST /compile`. The server runs `scripts/compile-with-harness.mjs`, which runs the task through the DeepSeek Harness headless profile, and validates the returned rules with the engine before replying. The server holds no model credential; the Harness owns the provider. The headless profile still needs its own credential: export `DEEPSEEK_API_KEY` before `make studio`, because the key the web Models page stores is not visible to a separate process. Set `DSH_BIN` if `dsh` is not on `PATH`, and `STUDIO_COMPILER_SCRIPT` to point at a different backend.

**Model time limit.** Each extraction, proposal, or explanation pass has a 15-minute wall-clock limit by default.
Reasoning progress does not reset that limit.
Set `STUDIO_MODEL_TIMEOUT_SECONDS` to a positive whole number of seconds before starting the studio, for example `STUDIO_MODEL_TIMEOUT_SECONDS=1800 make studio` for 30 minutes per pass.
Restart an already-running studio server to apply either a code update or a changed setting; refreshing the browser alone does not replace the server process.
Extraction and explanations have separate budgets, so the complete review may take longer than one pass.
A timed-out explanation preserves the validated rules with an explanation-unavailable notice.
On POSIX, reaching the deadline stops the backend process group, including its Harness child, rather than leaving the model running after its wrapper exits.

**In the Harness.** `sources/harness/krank-studio/` is a Harness client plugin that adds a **Krank** action to the conversation session header and opens the local studio. Install it into the web profile with `dsh plugin --profile web add -w sources/harness/krank-studio`, then reload the page. It is a launcher, not a second copy of the studio, and it is never published.

## Requirement review and safe reduction

The studio now separates finding requirements, compiling executable checks, explaining those checks, and human approval.
Generation inventories obligations, prohibitions, permissions, prerequisites, exceptions, and measurable constraints rather than discarding process or modal language.
Each requirement is classified as **executable**, **needs facts**, **needs clarification**, or **human judgment**.
Missing capabilities remain visible; a candidate with no executable rules is still useful review material.
The declared extractor contract is in `sources/compile-review.mjs`, with a revision derived from the extractor and object registry.
A registered noun alone does not mean that observations of it exist.

The Rules tab presents requirement cards with source quotations and reasons.
A separate model call explains validated rules using their fact definitions, without receiving the original prose or extraction rationale.
The explanation is a review aid, not a proof of equivalence.
Expand a card to see the exact deterministic interpretation and raw rules.
If explanation generation fails, valid rules remain available and the card explicitly reports the failure.
The library renderer and its public API remain deterministic and unchanged.

Run a check against a relevant file or directory, then approve or reject requirements individually.
Approval acknowledges every clause and exception on the cited line, the interpretation, its limitations, and the recorded fact scope.
A successful evaluation may emit violations; evaluation and project conformance are different things.
Changing source text, rule content, coverage accounting, the fact contract, explanations, or check evidence invalidates approval.
Checks on empty, unrelated, or incomplete fact observations cannot authorize reduction.
Source edits during generation cause the stale response to be discarded.

Download the **complete compile and review artifact**, not just the rule set, to preserve decisions.
Save that JSON under `dataflow.in/compile/` yourself, then rebuild the studio or run `make prompts`.
The studio does not overwrite authored files.
A page-local source edit must also be saved to its prompt file before the build can reuse the review.
Existing compile entries remain readable, but missing review metadata is unreviewed, not implicitly approved.
The top-level `approved` field selects a candidate; it does not approve its requirements.

Only exact source lines whose entire identified requirement content is executable, checked, and explicitly approved are eligible for removal.
Partially covered lines, headings, and context stay intact.
Repeated text is distinguished by its line number; substring matches never authorize deletion.
The studio, output builder, and coverage report use the same review core.
Generated manifests distinguish identified requirements, executable requirements, approvals, and removable lines.
These counts describe the recorded reading, not proven extraction recall.
A historical check does not install future enforcement: later iterations must load the saved rules and supply suitable facts when checking their work.

### Review artifact contract

A compile entry retains `source`, `approved` (candidate selection), and `candidates`.
Each candidate retains its existing `id`, `title`, `rules`, and compatibility `cases`, plus optional `review` metadata:

- `version`, `source`, `text`, and `contract` bind the review to the full source and extractor capabilities.
- `requirements` contain unique IDs, 1-based `line` locations, exact clause `quote` strings, titles, classifications, reasons, missing facts, and rule IDs.
- `passages` account for every nonblank line once, using its full exact quote, a `requirements` or `context` kind, and requirement IDs.
- `explanations` bind model-written titles, explanations, and limitations to the validated interpretation; failures are recorded separately.
- `check` records the evaluated rules, fact scope, fact snapshot, and result.
- `approvals` record individual decisions and acknowledgement of coverage and limitations.

Bindings use canonical JSON snapshots for exact comparison in both Node and the browser.
They are not signatures or an authorization security boundary; authored review artifacts remain human-controlled project inputs.
The current contract deliberately rejects unsupported fields and invented initial facts rather than guessing new extractors.
Runtime marker capabilities remain explicit fact gaps in this first increment.

Portable tests use a fake compiler and authored fixtures.
They do not measure real-model recall, explanation fidelity, or readability.
`evals/08-compile-review.md` defines the separately authorized baseline comparison and human scoring; live evaluation and human acceptance remain pending.

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
