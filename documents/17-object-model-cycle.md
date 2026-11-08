# Object-Model Cycle

## The problem

The object model (`dataflow.in/object-model.json`) is asserted, not explained. A
reader cannot see why one noun became an object, why another did not, or which
prompt line motivated the choice. In the extreme, every noun is a candidate
object and every verb applied to a noun a candidate operation; the model guesses
which to keep, and the guess is usually right but not always. The guess must be
overt and reviewable, because the model is exactly where human judgment is
needed.

## The cycle

1. **Propose.** Read a prompt (or the corpus). For every noun, propose an object
   with a guess — include or exclude — and a reason. For every verb applied to a
   noun, propose an operation. Cite the line that motivates each.
2. **Review.** The human sees each proposal with its evidence and reason, and
   agrees or overrides. The override is the human judgment the model cannot
   supply.
3. **Apply.** Confirmed objects and operations become the registry; rejected
   guesses are kept so a later pass does not re-propose them.
4. **Use.** Rule extraction reads only the confirmed objects: a rule whose fact
   type is not a confirmed object is flagged, not silently accepted.
5. **Repeat.** A new prompt proposes against the current registry, so the model
   grows one reviewed increment at a time.

This is the `## Suggestions` workflow in `TODO.md`, made a first-class, overt
step instead of a side note.

## The proposal shape (overt)

```json
{
    "term": "task",
    "kind": "object",
    "guess": "include",
    "status": "proposed",
    "evidence": "A task is the unit of work (prompts/01-contract.md section 3)",
    "rationale": "A task has state and is the subject of operations; it must be an object.",
    "source": "prompts/01-contract.md"
}
```

- `guess` is the model's default (include or exclude); `status` is the human's
  decision (proposed, confirmed, rejected).
- Excluded nouns are listed, not dropped: the model's "not an object" guesses are
  exactly the ones that need human agreement, so they are kept with a reason.
- Operations carry a subject object, so a verb is judged against the noun it
  applies to, not in isolation.

## The UI step

A new studio step between Prompt and Candidates:

- A "Propose objects" button that runs the extraction for the current prompt.
- A list of proposals grouped by status, each row showing the term, the guess,
  the evidence, the rationale, and **Agree** / **Reject** (Agree confirms the
  guess; Reject flips it).
- A running count: `N confirmed · M pending · K rejected`.

## The gate

- `make test` requires every registry object to carry provenance (evidence,
  rationale, status `confirmed`) and every rejected guess to be kept with its
  reason.
- The compile prompt names only the confirmed objects, and the candidate
  validator flags a rule whose fact type is not confirmed.

## Implementation order

1. Add provenance to the object model (evidence, rationale, status, source).
2. Write the "propose the object model" extraction task.
3. Add the studio step (list, propose, agree/reject, count).
4. Add the gate (provenance required; rules use confirmed objects only).
5. Re-propose the existing 79 objects with evidence, so none is un-reviewed.
