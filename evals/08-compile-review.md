# Compile and Review Evaluation

## Case

Compare requirement extraction and rule explanations before and after the review change.
Portable tests exercise contracts and fixtures, not model recall or human comprehension.
This evaluation requires a separately authorized live model run and human scoring; it has not been run as part of implementation.

## Requires

- `scripts/studio-serve.mjs`
- `sources/compile-review.mjs`
- `dataflow.in/compile-review-cases.json`

## Task given to the agent

```text
## TASK-DESCRIPTION
Evaluate the following prose through the studio compile endpoint, without modifying any authored file.
Use the same model, sampling settings, and fact vocabulary for the baseline and changed implementation.
Record the exact model, settings, revision, requests, responses, latency, and failures.
A live call requires explicit operator authorization; otherwise report not run.
- Inspect: `scripts/studio-serve.mjs`
- Inspect: `sources/compile-review.mjs`

Input prose:
# File and task policy
Source files must use spaces and four-space indentation.
A task must have a verification section unless it does not apply feature requirements.
For every task, at least one and at most two referenced features must be listed for that same task.
Do not report a task as complete if its verification section is missing.
Run verification before publishing.
Reviews should be helpful.
Keep it short.

## TASK-OUTPUT
Return the raw candidate artifacts, the model-generated explanations, and the evaluation run metadata.
Do not read the scoring rubric or claim human acceptance.
End with the VERIFICATION line.

## TASK-FILES
| Operation | Path |
|---|---|
| inspect | `scripts/studio-serve.mjs` |
| inspect | `sources/compile-review.mjs` |

## TASK-VERIFY
- Run: the authorized baseline and changed compile requests with identical settings.
- Expected: each request returns an artifact or an explicit recorded error, never an invented successful result.

OUTPUT: Return artifacts and run metadata, ending with the VERIFICATION line.
```

The operator runs this in isolated baseline and changed checkouts, with the same input and provider settings.
Use at least three runs per version, preserving failures rather than retrying until a desired output appears.
No live call belongs in the portable test suite.
Do not expose this rubric to the extraction or explanation calls.

## Expected behavior

The human-authored inventory contains eight atomic requirements:

- Spaces in source files: executable using file directory/type scope and has_tab, with the lexical limitation stated.
- Four-space indentation in source files: executable using indent_unit; explain that zero includes files with no indents and that this is a heuristic, not a parser.
- A verification section for tasks applying feature requirements: executable with the exception preserved, joining task_section.task to task.id.
- At least one referenced feature per task: executable using a lower count bound and the same task identity.
- At most two referenced features per task: executable using an upper count bound and the same task identity; the bounds may share one formal rule when semantics permit it.
- No claim of completion without verification: needs facts about completion/reporting; task-section facts alone cannot check what an agent claimed.
- Verification before publishing: needs event/order facts, not an invented Boolean or timestamp.
- Helpful reviews: human judgment, preserving the weaker recommendation rather than silently upgrading it into an enforced obligation.

“Keep it short” is an additional needs-clarification item: neither the referent nor the threshold is specified.
The heading remains context.
Thus the expected total is nine requirement records, including the ambiguous item.
A different defensible atomic split is scored by meaning, not by a target count.

Explanations are generated from validated rules and fact definitions, without the input prose or inventory.
They describe the actual check, not an idealized restatement of intent.
For each executable requirement, ask a reader who has not seen the JSON to state when it applies, what causes a report, and what remains unchecked.
Show the exact interpretation only after those answers are recorded.

## Failing signals

- A process obligation disappears instead of becoming an explicit fact gap.
- An invented observation makes a missing capability look executable.
- A recommendation becomes a mandatory violation check without clarification.
- An explanation omits an exception, count bound, identity join, or extractor limitation.
- Plausible prose conceals a formal rule that checks the wrong thing.
- Prose is removed without individual approval and a matching check scope.
- A mocked test pass is presented as evidence of real-model recall or readability.

## Scoring

Record per-run counts and the concrete examples that decide them:

- Identification recall: expected atomic meanings identified divided by nine.
- Supported executable recall: correctly formalized supported meanings divided by five.
- Unsupported inventions: count invented fields, observations, obligations, or unjustified classifications; target zero.
- Explanation fidelity: all conditions, exceptions, bounds, joins, and effects preserved for each executable requirement; score pass/fail per requirement.
- Readability: a human can answer all three review questions without reading JSON; score pass/fail per requirement.
- Safe reduction: no partially represented or unapproved line disappears; pass/fail.

Report baseline and changed distributions, including failures, rather than a single best run.
An extraction gain with unsupported inventions is not an improvement.
Human acceptance and readability judgments remain pending until the operator records them.
