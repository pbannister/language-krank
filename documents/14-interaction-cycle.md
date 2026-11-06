# Interaction Cycle

The loop that turns prose into checked rules, and the interface that drives it.
This document places the loop, the shared core, and the three candidate
surfaces, so the TODO and the requirements have one home.

## The cycle

1. The human writes or edits prose in `prompts/`.
2. The model proposes object-model additions under `## Suggestions` (batched, not applied).
3. The human promotes the suggestions into `dataflow.in/object-model.json`.
4. The model proposes rule candidates; the human approves one.
5. `make prompts` generates `prompts.out/` (markers, reduced prose, rules).
6. The human compares `prompts.out/` with `prompts/`; the coverage gate checks the mapping.
7. A line that cannot be expressed becomes a hint; the human revises `prompts/` (back to step 1).
8. The model works from `prompts.out/` and proves conformance with `krank check`.

## The shared core

One core, three surfaces. The core owns the model and the check:

- the object model: `dataflow.in/object-model.json`;
- the compile: `scripts/site-catalog.mjs` and `scripts/site-facts.mjs`;
- the generation: `POST /compile` on `scripts/studio-serve.mjs`, backed by
  `scripts/compile-with-harness.mjs`;
- the output: `scripts/prompts-build.mjs` into `prompts.out/`;
- the check: `krank check`.

A surface does not reimplement any of this. It renders the same data contract —
the catalog JSON, the `prompts.out/` tree, and the `/compile` request and
response — and sends the same request.

## The surfaces

1. **Harness extension** — first. The model lives in the Harness, so generation is
   a session message; the plugin grows from the launcher into a panel that hosts
   the web renderer and calls `/compile`.
2. **Standalone web** — keep. The studio is the reference renderer and the thing
   the Harness hosts; it stays testable without the Harness.
3. **VSCode extension** — last, optional. Worth it only after the core is a
   versioned library with a stable CLI/HTTP contract, so the extension is a thin
   webview shell over the same renderer.

## Decision

- Freeze the core as a library and its HTTP/CLI contract first.
- Grow the Harness plugin to a panel that embeds the web renderer.
- Add VSCode only when the contract is frozen and the web renderer is reusable.
