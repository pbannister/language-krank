# Record: object-model cycle handoff — 2026-11-07

> Written so a fresh session can resume without this conversation's memory.

## The aim

Make the object model overt and reviewable. Today
`dataflow.in/object-model.json` is asserted with no provenance, so the human
cannot see why a noun became an object or why another did not. The model guesses
which nouns to keep and which to drop; the guess is usually right but not
always, and that is exactly where human judgment belongs. The plan is
`documents/17-object-model-cycle.md`.

## Current state (verified 2026-11-07)

- krank is a production-rules engine plus a renderer for a prose round trip; the
  studio (local, `make studio`) drives the interaction cycle.
- `dataflow.in/object-model.json` holds 79 objects, 35 operations, 51 relations,
  with no evidence or rationale per entry.
- 13 prompt families are compiled; the comparison in `prompts.out/<slug>/`
  names what each rule captured and what it did not.
- The object model and the rule extraction are not yet linked in the UI: rules
  are extracted without surfacing which confirmed objects they assume.

## Next tasks (in order)

1. Add provenance to the object model (evidence, rationale, status, source).
2. Write the "propose the object model" extraction task (lists every noun/verb
   with an overt include/exclude guess and a reason).
3. Add a studio step between Prompt and Candidates: propose, then agree/reject
   each guess with its evidence and rationale, and a confirmed/pending/rejected
   count.
4. Add the gate: provenance is required, and rule extraction uses only the
   confirmed objects.
5. Re-propose the existing 79 objects with evidence, so none is un-reviewed.

## Commits (this session)

- `ee9cdd4` record: update the round-trip handoff to 13 compiled families
- `a7bc41e` feat: compile the five capability-artifact families
- `0305135` feat: render prose from rules and write a per-prompt comparison
