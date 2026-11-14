# dsh-krank-studio

A DeepSeek Harness client plugin: a **Krank** action in the conversation session
header opens the local prompt studio in a full-viewport dialog over the Harness.

The plugin is a host, not a reimplementation: the studio is the page `make studio`
serves. The dialog embeds that page in an iframe, keeps it mounted when closed so
page-local review state survives reopening, and offers **Open in new tab** as a
fallback. The studio keeps its own downloads and diff view.

## Run

```sh
# 1. Build and serve the studio (in the krank project).
cd ~/work/08-language-krank
make studio          # builds dataflow.out/studio and serves 127.0.0.1:8090

# 2. Install this plugin into the Harness web profile.
dsh plugin --profile web add ~/work/08-language-krank/sources/harness/krank-studio

# 3. Reload the Harness page. A "Krank" action appears in the session header.
#    It opens the embedded panel; Escape or Close hides it without losing the
#    studio page state.
```

If `dsh` is not on `PATH`, use the launcher of the running installation, for
example:

```sh
node ~/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh/lib/bin.js \
    plugin --profile web add ~/work/08-language-krank/sources/harness/krank-studio
```

## Verify the mounted panel

With the isolated Harness instance running and `make studio` serving port 8090:

```sh
node scripts/harness-panel-check.mjs \
    'http://127.0.0.1:3081/?token=<printed-token>'
```

The check opens a real session, clicks **Krank**, verifies the dialog and iframe,
closes and reopens the panel to confirm the iframe is retained, and verifies
Escape dismissal. It writes a screenshot to `dataflow.out/ui-audit/`.

The installed DSH package ships no Vitest or DOM test environment, so this browser
mount check replaces the component-test step in the TODO.

## How it loads

The Harness Web Client loads a client entry through `window.__ModuleLoader__`;
`lib/client.js` uses that wrapper directly, so the plugin needs no separate build.
It registers into `conversation.session.header.actions`, a list slot declared by
`@deepseek-ai/dsh-client-ui-conversation`, which is why that package is named under
`dsh.client.inject` in `package.json`. The panel portals to the document body and
uses an iframe, so the header's clipped action slot cannot constrain the studio.
The host half (`lib/index.js`) is empty.

## Remove

```sh
dsh plugin --profile web remove dsh-krank-studio
```

Then reload the page.
