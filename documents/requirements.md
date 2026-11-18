# What is needed to run Krank

**Running `krank` itself requires only Node.js 18+ and no npm packages.** 

The LLM is needed only for the studio’s **Generate candidates** and **Propose objects** actions.

| Use | Requirements |
|---|---|
| `krank run`, `render`, `check`, `contract` | Node.js ≥18; no runtime dependencies; no network |
| Importing the library | A modern ES-module runtime; no dependencies |
| Installing from the GitHub release | `npm` and network access at install time |
| Serving the studio | Node.js + a browser; `make`/POSIX shell optional |
| `make prompts` | Node.js only; works from already-compiled candidates |
| Generate candidates / propose objects | All studio requirements **plus** DSH, a configured model credential, and network access to the model provider |
| Harness panel | The standalone studio server must also be running |

The package declares only `node >=18` and no `dependencies` or peer dependencies in [package.json](08-language-krank/package.json#L34).

## LLM-backed compile path

The studio’s compile button calls `scripts/compile-with-harness.mjs`, which launches DSH’s **headless** profile. 
It needs:

1. **The Harness CLI** — resolved from:
   - `DSH_BIN`, if set;
   - an installed `@deepseek-ai/dsh` under `~/.npm/_npx`;
   - otherwise `dsh` on `PATH`.
2. **A Harness profile** — `DSH_PROFILE`, default `headless`.
3. **A provider credential in the studio server’s environment** — for the default profile, `DEEPSEEK_API_KEY`.
4. **Network access** to the model provider.
5. Optionally `STUDIO_COMPILER_SCRIPT` to replace the default compiler backend.

```sh
export DEEPSEEK_API_KEY='...'
make studio
```

The key stored in the Harness web Models page is **not** visible to the separate headless process; it must be exported before starting `make studio`. 
This is documented in [README.md](08-language-krank/README.md#L56) and [compile-with-harness.mjs](08-language-krank/scripts/compile-with-harness.mjs#L12-L23).

The studio server itself holds no credential; it passes its environment to the compiler child process. 
It can start without a key, but compile/propose will fail with a missing-credential error.

## Important packaging detail

The GitHub/npm tarball contains the **CLI and library only**. 
It does not contain `scripts/studio-serve.mjs`, the browser studio, or the Harness plugin. 
To run the studio, use a repository checkout and `make studio`; to run the Harness panel, also install the plugin from the checkout. 
See [studio-serve.mjs](08-language-krank/scripts/studio-serve.js#L17-L24) and the compiler invocation.
