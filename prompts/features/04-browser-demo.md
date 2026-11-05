# Feature: Browser Demo

## Purpose

The project publishes a zero-build browser demo of the rules engine. It runs the
same `sources/krank.mjs` the npm package exports, so a reader can try the engine
without installing anything. The demo is part of the published project pages and
is not part of the npm package.

## Requirements

- `BROWSER-DEMO-R001` — The demo must live in `sources/browser/` and load `sources/krank.mjs` as a native ES module, with no build step.
- `BROWSER-DEMO-R002` — `make demo` must serve the demo locally over HTTP from `sources/`, and refuse to start when `python3` is absent.
- `BROWSER-DEMO-R003` — `make site` must publish the demo into `site.out/browser/`, with the library modules it imports at the project root, and list `browser/index.html` and `browser/playground.html` in `site.in/pages.nav`.
- `BROWSER-DEMO-R004` — Each published demo page must carry the generated marker and the `<!-- HOMELAB-NAV -->` marker, so the homelab injects the shared navigation.
- `BROWSER-DEMO-R005` — The npm package must not include the demo; `package.json`'s `files` lists the library modules only.
- `BROWSER-DEMO-R006` — The index page is the studio: a step rail with one panel per step (prompt, candidates, rules, prose, comparison, reduced prompt, check, approve); selecting a step shows its panel.
- `BROWSER-DEMO-R007` — The prompt panel must list every prompt file under `prompts/`, show its text in an editable area, and recompute the reduced prompt, the diff, and whether each covered line is still present from the edited text; an edit must not change the recorded compile.
- `BROWSER-DEMO-R008` — A prompt may have more than one candidate rule set; each candidate carries a title and an explanation, and choosing one updates every later panel.
- `BROWSER-DEMO-R009` — Each case may carry a `suggestion`, a hint for how to rewrite the prose so it compiles more faithfully; the comparison shows it.
- `BROWSER-DEMO-R010` — Every case that claims a line of the selected prompt must quote text the prompt contains, so the reduced prompt removes it; a case drawn from another file names its `source` and is left in place.
- `BROWSER-DEMO-R011` — The page must show the line-by-line difference between the original and the reduced prompt, and must mark a covered line the edit broke.
- `BROWSER-DEMO-R012` — The check panel must run the chosen candidate's rules against facts extracted from a chosen project file or directory, showing the engine's firings and emissions.
- `BROWSER-DEMO-R013` — The approve panel must summarize the prompt, the chosen candidate, the rule and case counts, whether the prompt was edited, and the last check; it must offer the rule set and the reduced prompt as downloads, and write nothing.
- `BROWSER-DEMO-R014` — A prompt with no candidate must be listed and marked, and the page must say so rather than render an empty rule set; it must not claim a compile it does not have.
- `BROWSER-DEMO-R015` — The compile catalog and the file facts must be generated from the repository at build time (`scripts/site-catalog.mjs`, `scripts/site-facts.mjs`); the published page must not read the repository, and the compile itself is recorded, not run by the page.

## Behavior

- `make demo` prints the local URL and serves `sources/` on `127.0.0.1` (the catalog and facts builders are not needed for the playground, which uses its own sample).
- `make site` produces `site.out/browser/index.html` (the studio), `playground.html` (edit and run a single rule set), their scripts and data, the generated `catalog.json` and `files.json`, and `site.out/krank.mjs` plus the two modules it imports.
- The homelab publishes the pages under `.../projects/<id>/browser/` and injects the one navigation bar at each page's depth.

## Dependencies

- `02-project-pages.md` — the demo is published as one of the project's pages.
