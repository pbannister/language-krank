# Feature: Browser Demo

## Purpose

The project publishes a zero-build browser demo of the rules engine. It runs the
same `sources/krank.mjs` the npm package exports, so a reader can try the engine
without installing anything. The demo is part of the published project pages and
is not part of the npm package.

## Requirements

- `BROWSER-DEMO-R001` — The demo must live in `sources/browser/` and load `sources/krank.mjs` as a native ES module, with no build step.
- `BROWSER-DEMO-R002` — `make demo` must serve the demo locally over HTTP from `sources/`, and refuse to start when `python3` is absent.
- `BROWSER-DEMO-R003` — `make site` must publish the demo into `site.out/browser/`, with the library modules it imports at the project root, and list `browser/index.html` in `site.in/pages.nav`.
- `BROWSER-DEMO-R004` — The published demo page must carry the generated marker and the `<!-- HOMELAB-NAV -->` marker, so the homelab injects the shared navigation.
- `BROWSER-DEMO-R005` — The npm package must not include the demo; `package.json`'s `files` lists the library modules only.

## Behavior

- `make demo` prints the local URL and serves `sources/` on `127.0.0.1`.
- `make site` produces `site.out/browser/index.html`, `demo.mjs`, and `sample.json`, plus `site.out/krank.mjs` and the two modules it imports.
- The homelab publishes the pages under `.../projects/<id>/browser/index.html` and injects the one navigation bar at the page's depth.

## Dependencies

- `02-project-pages.md` — the demo is published as one of the project's pages.
