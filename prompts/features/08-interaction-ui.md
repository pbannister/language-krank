# Feature: Interaction UI

## Purpose

The interface that drives the interaction cycle: writing prose, reviewing object
and rule suggestions, approving, generating `prompts.out/`, and checking. One
core, three surfaces.

## Requirements

- `UI-R001` — The cycle's logic must live in the core (the object model, the catalog and extractors, `prompts-build`, `krank check`, and the `/compile` endpoint); no surface may reimplement it.
- `UI-R002` — The surfaces share one data contract: the catalog JSON, the `prompts.out/` tree, and the `/compile` request and response.
- `UI-R003` — The Harness extension must grow the Krank action into a panel that renders the cycle and calls `/compile`; the standalone web remains the embedded renderer.
- `UI-R004` — The standalone web (`make studio`) must stay the reference renderer and pass the coverage gate (`tests/31-prompts-build`) without the Harness.
- `UI-R005` — A VSCode extension, if built, must be a thin webview over the same contract and the same web renderer.
- `UI-R006` — The shared contract must be a browser-safe, versioned module covering the object model, catalog, fact bundle, compile request/response, `prompts.out/` manifest, and check result; validators must be pure and fail closed.
- `UI-R007` — The contract must be exposed as `GET /contract` on the studio server and as `krank contract`; a breaking shape change must bump the contract version and update every surface.

## Behavior

- The Harness panel hosts the web renderer; generation is a session-backed call.
- The web renderer reads `prompts.out/` and the catalog, and shows the same steps the cycle names.

## Dependencies

- `07-prompts-output.md` — the generated formal form the cycle produces.
- `06-fact-extractors.md` — the facts the check uses.
