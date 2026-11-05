# Round Trip on Real Prose

This records one run of the three-step check in `documents/10-rule-notation.md`:

1. prose → rule set (a person, acting as the model),
2. rule set → prose (the renderer),
3. rendered prose compared to the original prose, sentence by sentence.

The source prose is five rules taken from `prompts/01-contract.md` and
`prompts/common/01-universal-rules.md`. The rule set is
`dataflow.in/round-trip.json`, and `tests/25-round-trip.*` keeps it honest.

## The fact model

The contract talks about tasks, file operations, outputs, and ambiguities, so the
rule set models those as facts:

- `change {task, verb}` — a change a task would make.
- `statement {task, verb}` — an operation the task explicitly states.
- `workflow {requires}` — an operation the workflow requires.
- `operation {path}` — an operation on a path.
- `guard {kind, path}` — a protected path, as input to the rules.
- `ambiguity {changes}` — what an ambiguity can change.
- `output {kind}` — a line the response produces.
- `task {id}` and `checklist {task, status}` — a task and its Definition-of-Done items.

## The five rules

### Rule 1 — `prompts/01-contract.md` section 3

**Original**

> A file may be modified only when the task states the operation, or when the
> workflow requires it as a consequence of executing the task.

**Rendered**

> Rule "refuse-unstated-change": when there is a change with task $t and verb $v
> and there is no statement with task $t and verb $v and there is no workflow
> with requires $v, then emit {"refused":{"verb":"$v","reason":"not stated by the
> task and not required by the workflow"}}.

**Verdict: core preserved, wording derived.** "Only when A or B" is encoded as
"refuse when not A and not B", which is the same predicate. Lost: the file (the
rule carries a verb, not a path), "as a consequence of executing the task" (the
workflow's reason is not modelled), and the modality — the original grants
permission, the rule emits a refusal. The rendered "there is no workflow with
requires $v" is grammatical but stilted.

### Rule 2 — `prompts/01-contract.md` section 7

**Original**

> A task may not authorize an operation on a protected path; the prompt validator
> refuses it.

**Rendered**

> Rule "refuse-protected-path": when there is an operation with path $p and there
> is a guard with kind "protected" and path $g and there is an operation with path
> starting with $g, then emit {"refused":{"path":"$p","reason":"protected path"}}.

**Verdict: faithful for prefixes; still lossy on the task link.** The guard names
the protected prefix (`logs/`), and the operation path is tested with the `prefix`
operator, so anything under it is refused. The `guard` fact supplies the judgement
"this path is protected", so the rule is only as good as that input. "The task
authorizes" is dropped: the operation fact is not tied to a task.

### Rule 3 — `prompts/common/01-universal-rules.md`, Clarification Rules

**Original**

> Ask only when the ambiguity can change the requested output, the authorized
> scope, or safety.

**Rendered**

> Rule "ask-on-material-ambiguity": when there is an ambiguity with changes in
> ["output", "scope", "safety"], then emit {"ask":{"because":"the ambiguity can
> change output, scope, or safety"}}.

**Verdict: close.** The three-way "or" becomes an `in` list, which is a clean
fit. "Only when" loses its exclusivity: the rule says when to ask, not that
nothing else may ask. "Can change" is a judgement carried by the `changes` fact,
not computed.

### Rule 4 — `prompts/01-contract.md` section 5

**Original**

> A single `VERIFICATION:` line is always permitted output, regardless of the
> requested format.

**Rendered**

> Rule "permit-verification-line": when there is an output with kind
> "verification", then emit {"permitted":"one verification line"}.

**Verdict: faithful for one line, silent on the rest.** "Single" is not enforced
(there is no cardinality), "regardless of the requested format" is dropped (no
format fact), and "always" is a claim about every run, where the rule only speaks
about the facts it is given.

### Rule 5 — `prompts/01-contract.md` section 3

**Original**

> A task is complete only when the Definition of Done in `prompts/02-workflow.md`
> is satisfied.

**Rendered**

> Rule "mark-complete": when there is a task with id $t and at least 1 checklist
> with task $t and there is no checklist with task $t and status "open", then emit
> {"complete":"$t"}.

**Verdict: the failure, fixed.** A negated existential alone is **vacuously
true**: a task with no checklist facts at all is emitted as complete, because
there is nothing open. The count condition supplies the missing cardinality: at
least one checklist must exist, and the negation then requires none of them open.
The fixture demonstrates all three cases: `t9` has an open item and is not
completed; `t10` has a done item and is; `t11` has no checklist and is not. The
link to the referenced document is still absent.

## What the round trip preserved

- Discrete, fact-shaped conditions: equality, membership, and prefix.
- Cross-fact correlation through a shared `$variable` ("the same task").
- Negation as failure ("not stated", "nothing open").
- Cardinality through a count condition ("at least one checklist").
- The action: an emitted refusal, question, permission, or completion.

## What it lost or could not express

- **Content matching.** "Keep secrets ... out of output" (section 8) needs a
  substring or regex operator; `prefix` covers paths, not content.
- **Temporal order.** "A DELTA applies to the immediately preceding assistant
  output" (section 6) needs a sequence; facts are an unordered set.
- **Procedural control.** "Produce the requested payload and stop" (section 5)
  describes what the response does, not what holds.
- **Modality and strength.** "Must", "may", "only when", and "always" become
  emitted verdicts; the rule set has no `strength` field to distinguish a MUST
  from a SHOULD, although the contract does.
- **References.** "The Definition of Done in `prompts/02-workflow.md`" names a
  document; krank has no notion of a referenced document.

## Verdict

The round trip is useful where a rule is discrete and fact-shaped: all five rules
kept their logical core, and the rendered prose is close enough to the original to
compare by reading. Two gaps the first pass found are closed: a `prefix` operator
for paths, and a count condition for cardinality, which removes the vacuous
completion. It still degrades where the rule turns on content, order, modality, or
a referenced document.

The remaining explicit gap is a **rule strength** field (`MUST`/`SHOULD`), because
the contract already distinguishes them and the formal form cannot.

## Reproduction

```sh
node sources/ruleset-command.mjs run dataflow.in/round-trip.json     # 5 firings
node sources/ruleset-command.mjs render dataflow.in/round-trip.json
```
