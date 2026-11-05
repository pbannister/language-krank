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
- `BROWSER-DEMO-R006` — The index page must show, in order: the original prose (the loading prompt), the compiled rule set, the rules rendered back to prose, the comparison of original and rendered prose with a verdict, and the engine's result on a sample fact set.
- `BROWSER-DEMO-R007` — The comparison data must name a rule in the fixture `dataflow.in/round-trip.json`, and the page must render that rule's prose line; a case that names no rule is a defect.

## Behavior

- `make demo` prints the local URL and serves `sources/` on `127.0.0.1`.
- `make site` produces `site.out/browser/index.html` (the round trip), `playground.html` (edit and run), their scripts and data, and `site.out/krank.mjs` plus the two modules it imports.
- The homelab publishes the pages under `.../projects/<id>/browser/` and injects the one navigation bar at each page's depth.

## Dependencies

- `02-project-pages.md` — the demo is published as one of the project's pages.
