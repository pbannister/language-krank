# Core Contract

The studio core and its surfaces share one versioned data contract. The
browser-safe module is `sources/studio-contract.mjs`; it has no Node imports and
is exported as `@bannister.us/krank/contract`.

## Version

- Name: `krank-studio-core`
- Version: `1`
- Stability: frozen
- A breaking shape change bumps `CORE_CONTRACT_VERSION` and updates every
  surface. An additive optional field does not bump it.

## Artifacts

| Artifact | Producer | Shape |
|---|---|---|
| `object_model` | `dataflow.in/object-model.json` | `objects`, `operations`, `relations`, `proposals` arrays |
| `catalog` | `scripts/site-catalog.mjs` | `entries`, `fact_contract`; each candidate has `id`, `title`, `rules`, `cases` |
| `fact_bundle` | `scripts/site-facts.mjs` | `directories`, `files`; each file has `path`, `facts`, `entities`, and a first `file` fact |
| `compile_request` | `POST /compile` | `{source, text}` |
| `compile_response` | `POST /compile` | `{candidates}` with at least one valid candidate |
| `prompts_manifest` | `scripts/prompts-build.mjs` | `generated_by`, `generated_at`, `entries` with SHA-256 digests and marker/coverage data |
| `check_result` | `krank check` | `{firings, emitted}` |

## Access

```sh
curl -s http://127.0.0.1:8090/contract
npx krank contract
```

The studio server exposes `GET /contract` as
`{ok: true, contract: <document>}`. The CLI prints the contract document as JSON.
Validators return `{ok, errors}` and never mutate their input; producers call
`assert_artifact` before writing a manifest, catalog, or fact bundle.

## Change Discipline

- A surface reads the artifact shape, not an implementation module.
- A changed shape is a contract change, not a local edit.
- Producers fail closed when their output violates the contract; a surface must
  not guess around an invalid artifact.
- The contract is versioned before adding another surface.
