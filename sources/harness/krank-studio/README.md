# dsh-krank-studio

A DeepSeek Harness client plugin: a **Studio** action in the conversation session
header opens the local prompt studio.

The plugin is a launcher, not a reimplementation: the studio is the page
`make studio` serves. The action opens it in a browser tab, so the studio keeps
its own state, downloads, and diff view.

## Run

```sh
# 1. Build and serve the studio (in the krank project).
cd ~/work/08-language-krank
make studio          # builds dataflow.out/studio and serves 127.0.0.1:8090

# 2. Install this plugin into the Harness web profile.
dsh plugin --profile web add ~/work/08-language-krank/sources/harness/krank-studio

# 3. Reload the Harness page. A "Studio" action appears in the session header.
```

If `dsh` is not on `PATH`, use the launcher of the running installation, for
example:

```sh
node ~/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh/lib/bin.js \
    plugin --profile web add ~/work/08-language-krank/sources/harness/krank-studio
```

## How it loads

The Harness Web Client loads a client entry through `window.__ModuleLoader__`;
`lib/client.js` uses that wrapper directly, so the plugin needs no separate build.
It registers into `conversation.session.header.actions`, a list slot declared by
`@deepseek-ai/dsh-client-ui-conversation`, which is why that package is named under
`dsh.client.inject` in `package.json`. The host half (`lib/index.js`) is empty.

## Remove

```sh
dsh plugin --profile web remove dsh-krank-studio
```

Then reload the page.
