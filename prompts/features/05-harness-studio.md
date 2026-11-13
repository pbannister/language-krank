# Feature: Harness Studio

## Purpose

The prompt studio is a local tool. This feature puts it one action away inside the
DeepSeek Harness: a client plugin adds a **Krank** action to the conversation
session header, and the action opens the local studio.

The plugin is a host, not a second copy of the studio: it embeds the standalone
renderer in a full-viewport dialog, keeps the iframe mounted when hidden, and
offers a new-tab fallback. The studio keeps its own state, downloads, and diff
view. The plugin is installed into the user's Harness web profile; it is never
published to npm.

## Requirements

- `HARNESS-STUDIO-R001` — The plugin must be a package under `sources/harness/krank-studio/`, declaring `dsh.bundle.patch` and `dsh.client.inject`.
- `HARNESS-STUDIO-R002` — Its client entry must register into `conversation.session.header.actions` and open `http://127.0.0.1:8090/browser/index.html`, the address `make studio` serves, in an embedded dialog with a new-tab fallback.
- `HARNESS-STUDIO-R003` — The host half must be empty: the plugin adds no service and holds no credential.
- `HARNESS-STUDIO-R004` — The package must not be in the npm package's `files` list, and the plugin must not be published.
- `HARNESS-STUDIO-R005` — The README must give install, reload, and remove commands, including a fallback launcher path when `dsh` is not on `PATH`.
- `HARNESS-STUDIO-R006` — The action's visible label must be `Krank`, so the header names the tool rather than the page it opens.
- `HARNESS-STUDIO-R007` — The embedded panel must be a modal dialog with an iframe titled `Krank prompt studio`, Close control, Escape dismissal, and focus returned to the header action; closing must hide rather than unmount the iframe so page-local studio state survives reopening.

## Behavior

- `make studio` serves the studio; the plugin's action opens it.
- `dsh plugin --profile web add -w sources/harness/krank-studio` installs the bundle; the profile's `dsh.profile.bundles` gains `dsh-krank-studio`.
- Reloading the Harness page shows the **Krank** action in the session header; it opens the panel over the conversation.
- Escape or Close hides the panel; reopening preserves the studio page state. **Open in new tab** remains available.

## Dependencies

- `04-browser-demo.md` — the local studio the action opens.
