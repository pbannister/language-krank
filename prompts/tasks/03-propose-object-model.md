# Task: Propose the Object Model

## TASK-DESCRIPTION

- Inspect: `dataflow.in/object-model.json`
- Inspect: `documents/17-object-model-cycle.md`

Read one prompt file and propose the object model it implies.

List every noun as an object proposal and every verb applied to a noun as an operation proposal.
Give each proposal an overt `include` or `exclude` guess and a reason.
Cite the line that motivates the proposal.
Keep every excluded term: a "not an object" guess is exactly what the human must agree to.
Do not add, remove, or change a registry entry; the human promotes a confirmation into `dataflow.in/object-model.json` as a separate, explicit step.
Do not propose a term the model already carries, in any status.

## TASK-OUTPUT

Answer with one JSON object and nothing else, no prose and no code fence:

```json
{
    "proposals": [
        {
            "term": "task",
            "kind": "object",
            "guess": "include",
            "status": "proposed",
            "evidence": "A task is the unit of work (prompts/01-contract.md 3).",
            "rationale": "A task has state and is the subject of operations; it must be an object.",
            "source": "prompts/01-contract.md"
        }
    ]
}
```

- `kind` is `object`, `operation`, or `relation`.
- An operation proposal carries a `subject` naming the object the verb applies to.
- `guess` is the model's default; `status` is always `proposed`.
- `evidence` quotes or names the motivating line; `rationale` states why the term is or is not an object.
- `source` is the repository-relative file the line comes from.

End with the `VERIFICATION:` line.

## TASK-CONTEXT

The target prompt is the one named by the dispatching task.
The current registry is `dataflow.in/object-model.json`; its `proposals` array already holds the reviewed exclusions.

## TASK-FILES

| Operation | Path |
|---|---|
| inspect | `dataflow.in/object-model.json` |
| inspect | `documents/17-object-model-cycle.md` |

## TASK-VERIFY

- Run: `node --test tests/30-object-model.test.mjs` from the repository root.
- Expected: exit status 0 with every test passing.

OUTPUT: one JSON object with a `proposals` array and no prose, then the `VERIFICATION:` line.
