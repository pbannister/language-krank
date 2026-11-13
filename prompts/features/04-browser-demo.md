# Feature: Browser Demo

## Purpose

The project publishes a zero-build playground of the rules engine. It runs the
same `sources/krank.mjs` the npm package exports, so a reader can try the engine
without installing anything. The playground is part of the published project
pages and is not part of the npm package.

The **prompt studio** is a separate, **local** tool: a step-by-step interface for
reviewing compiled candidates, hints, and reduced prompts. It needs the compile
catalog, it is interactive, and the homelab strips a project-authored `<nav>`
(the studio's step rail), so it is not published. `make studio` builds and serves
it on `127.0.0.1`.

## Requirements

- `BROWSER-DEMO-R001` — The browser pages must live in `sources/browser/` and load `sources/krank.mjs` as a native ES module, with no build step.
- `BROWSER-DEMO-R002` — `make demo` must serve the playground locally over HTTP from `sources/`, and refuse to start when `python3` is absent.
- `BROWSER-DEMO-R003` — `make studio` must build the local studio with `scripts/studio-build.sh` and serve it with `scripts/studio-serve.mjs` on `127.0.0.1`; the server must send `text/javascript` for `.mjs` and must not be published.
- `BROWSER-DEMO-R004` — `make site` must publish the playground into `site.out/browser/`, with the library modules it imports at the project root, and list `browser/playground.html` in `site.in/pages.nav`; the studio page, its modules, and its catalog must not be published.
- `BROWSER-DEMO-R005` — The published playground must carry the generated marker and the `<!-- HOMELAB-NAV -->` marker, so the homelab injects the shared navigation.
- `BROWSER-DEMO-R006` — The npm package must not include the browser pages; `package.json`'s `files` lists the library modules only.
- `BROWSER-DEMO-R007` — The studio must present a step rail with one panel per step (prompt, candidates, rules, prose, comparison, reduced prompt, check, approve); selecting a step shows its panel.
- `BROWSER-DEMO-R008` — The prompt panel must list every prompt file under `prompts/`, show its text in an editable area, and recompute the reduced prompt, the diff, and whether each covered line is still present from the edited text; an edit must not change the recorded compile.
- `BROWSER-DEMO-R009` — A prompt may have more than one candidate rule set; each candidate carries a title and an explanation, and choosing one updates every later panel.
- `BROWSER-DEMO-R010` — Each case may carry a `suggestion`, a hint for how to rewrite the prose so it compiles more faithfully; the comparison shows it.
- `BROWSER-DEMO-R011` — Each extracted requirement must identify its exact source line and clause quotation, and every nonblank line must be accounted for as requirements or context; a quotation or legacy case alone must not authorize removal, and cross-file cases must not remove selected-source text.
- `BROWSER-DEMO-R012` — The page must show the line-by-line difference between the original and the reduced prompt, and must mark a covered line the edit broke.
- `BROWSER-DEMO-R013` — The check panel must run the chosen candidate's rules against facts extracted from a chosen project file or directory, showing the engine's firings and emissions.
- `BROWSER-DEMO-R014` — The approve panel must summarize the prompt, the chosen candidate, the rule and case counts, whether the prompt was edited, and the last check; it must offer the rule set and the reduced prompt as downloads, and write nothing.
- `BROWSER-DEMO-R015` — A prompt with no candidate must be listed and marked, and the page must say so rather than render an empty rule set; it must not claim a compile it does not have.
- `BROWSER-DEMO-R016` — The compile catalog and the file facts must be generated from the repository at build time (`scripts/site-catalog.mjs`, `scripts/site-facts.mjs`); the studio page must not read the repository, and the compile itself is recorded, not run by the page.
- `BROWSER-DEMO-R017` — The studio server must accept `POST /compile` with `{source, text}`, run the compile through a separate backend that holds the model credential, validate the returned candidates with the engine, and return `{candidates}` or an error; the server itself must hold no credential.

- `BROWSER-DEMO-R018` — The compile must inventory independent obligations, prohibitions, permissions, prerequisites, exceptions, and measurable constraints, classifying each as executable, needs facts, needs clarification, or human judgment; unresolved requirements must retain their rationale and explicit missing observations rather than inventing facts, and a result with no executable rules must remain reviewable.
- `BROWSER-DEMO-R019` — Executable requirements must use fields supported by the versioned extractor contract, have valid rule links and unique identifiers, and introduce no initial observations; the server must reject invalid source locations, incomplete source accounting, invalid classifications, and dangling links before explaining rules.
- `BROWSER-DEMO-R020` — Human explanations must be generated in a separate pass using validated rules and fact definitions, without the original source or extraction rationale; review cards must show the source, classification, explanation, limitations, and expandable deterministic interpretation and raw rules, with an explicit fallback when an explanation is unavailable.
- `BROWSER-DEMO-R021` — Approval and rejection must be explicit per-requirement human decisions, including review of all clauses, exceptions, limitations, and the evaluated scope; source, rule, requirement-accounting, fact-contract, explanation, or check changes must invalidate affected approvals, and stale asynchronous compile responses must not replace current drafts.
- `BROWSER-DEMO-R022` — A downloadable compile artifact must preserve requirement accounting, explanation provenance, check scope and fact snapshot, and individual decisions; the studio must not write authored files, and loaded legacy artifacts without this evidence must remain unreviewed.
- `BROWSER-DEMO-R023` — A check must record the exact evaluated rules and nonempty fact scope, reject irrelevant or incomplete observations, and distinguish successful evaluation from semantic completeness, project conformance, and future enforcement.

## Behavior

- `make demo` prints the local URL and serves `sources/` on `127.0.0.1`.
- `make studio` writes `dataflow.out/studio/` and serves it on `127.0.0.1`, printing the studio and playground URLs.
- `make site` produces `site.out/browser/playground.html` (edit and run), its script and sample, and `site.out/krank.mjs` plus the two modules it imports.
- The homelab publishes the playground under `.../projects/<id>/browser/playground.html` and injects the one navigation bar at the page's depth.

## Dependencies

- `02-project-pages.md` — the playground is published as one of the project's pages.
