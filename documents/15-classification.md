# Prompt Classification (first pass)

The coverage report counts bullets; this document classifies them, so the next
compiles are a plan rather than a mystery. A prompt file is one of:

- **rule-dense** — many bullets are discrete and fact-shaped; compile next.
- **fact-gated** — the rules are clear but the facts need an extractor or a marker.
- **human** — judgment, modality, or a reference; stays prose.

| File | Class | Next |
|---|---|---|
| `01-contract.md` | rule-dense + human | more file, output, and hygiene rules (some compiled) |
| `02-workflow.md` | rule-dense + fact-gated | task state, tests, records, commits (some compiled) |
| `03-conventions.md` | rule-dense | naming and placement rules (some compiled) |
| `common/01-universal-rules.md` | rule-dense | scope and risk (some compiled) |
| `common/03-glossary.md` | descriptive | none |
| `capabilities/01`–`05` | fact-gated | version, release, pin, data rules |
| `capabilities/06`–`09` | fact-gated, marker-fed | boundary, session, delegation, failure |
| `flavors/01-semantic-sort-naming.md` | rule-dense | filename rules (some compiled) |
| `flavors/02-cpp-conventions.md` | rule-dense, language-scoped | C++ conventions |
| `how-to-write-tasks.md` | rule-dense | compiled |
| `how-to-write-features.md` | rule-dense | compiled |
| `how-to-write-episodes.md` | rule-dense | compiled |
| `how-to-write-research.md` | rule-dense | research and decision records |
| `episodes/*` | rule-dense, extractor exists | episode sections |
| `features/*` | rule-dense | requirement identifiers |
| `tasks/*` | work orders, not rules | none |

## Next three compiles

1. **Research** (`how-to-write-research.md`) — one criteria file, one study per
   candidate, evidence rules, the synthesis, and the decision record.
2. **Capabilities, artifacts** (`02` version, `04` release, `05` pin) — the
   version shape, the release gate, the pin; facts come from git and files.
3. **Capabilities, execution** (`06` boundary, `07` session, `09` failure) — the
   marker-fed families, once `prompts.out/` carries `## KRANK facts`.

## The marker-fed gap

The execution objects (session, goal, failure, boundary, credential, delegation)
have no file source; they are the `## KRANK facts` markers. Until `prompts.out/`
carries them, their types stay in the registry but are unused, which
`make object-model` reports as "by neither".
