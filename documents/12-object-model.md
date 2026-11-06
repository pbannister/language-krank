# Object Model

This document names the objects, operations, and relations the prompt corpus talks
about, so a rule set can share one vocabulary instead of inventing facts per rule.
The machine-readable registry is `dataflow.in/object-model.json`; this document
explains it, maps it to the prompts, and states what the engine still cannot say.

The model is a candidate, not a commitment. A type is worth adding when a rule
needs it and an extractor can produce it; a type nobody checks is noise.

## Method

The model was derived from the corpus, not imposed on it:

- The headings of every file under `prompts/` name the domains: precedence,
  authority, tasks, features, episodes, records, capabilities, pages.
- The bullet verbs name operations: create, modify, delete, rename, inspect,
  host, run, verify, record, commit, tag, publish, delegate.
- The section fields name objects and their attributes: `TASK-FILES` rows are
  operations on paths; `EPISODE-ACCEPTANCE` is acceptance criteria; a record's
  commits cite hashes.
- The relation list follows the references: a task references a feature, a
  feature owns requirements, a requirement lives in a rule file, a test covers a
  requirement.

The result is one registry with three lists: `objects`, `operations`, `relations`.
Every entry names the source file and section it came from, so a disagreement is
traceable.

## Objects

Identity is the first field; relations are carried by the other fields (a task id,
a path, a session id). The registry lists the full fields; this table gives the
purpose and the identifying fields.

| Object | Purpose | Identity and key fields |
|---|---|---|
| `project` | The repository and its rules version | `id`, `rules_version`, `structure` |
| `rule_file` | An authoritative rule file and its precedence | `path`, `precedence`, `applies`, `kind` |
| `rule` | One rule, its strength, and its owner file | `id`, `file`, `strength`, `text` |
| `override` | A human instruction that replaces a rule for one task | `rule`, `task`, `instruction` |
| `feature` | A stable capability with requirements | `id`, `path`, `requirements`, `dependencies` |
| `requirement` | One testable requirement with an identifier | `id`, `feature`, `text`, `strength` |
| `task` | A bounded unit of authorized work | `id`, `state`, `files`, `verify`, `features` |
| `operation` | One file or host operation in a task's scope | `task`, `verb`, `path`, `authorized` |
| `path` | A file or directory, with its kind and flags | `path`, `kind`, `protected`, `generated` |
| `directory` | A required or declared directory | `path`, `purpose`, `required` |
| `host` | A live host or resource a task touches | `id`, `resource`, `kind` |
| `output` | The response representation a task requires | `task`, `format`, `files`, `verification_line` |
| `acceptance` | The human's decision on a task's claim | `task`, `requirements`, `decision` |
| `verification` | A command and its expected result | `task`, `command`, `expected`, `result` |
| `command` | A command the task authorizes | `text`, `authorized`, `scope` |
| `plan` | The ordered steps before implementation | `task`, `blocks` |
| `episode` | A reviewable unit with a goal and acceptance | `id`, `goal`, `acceptance`, `branch` |
| `phase` | A milestone grouping tasks | `id`, `episode`, `order`, `goal` |
| `todo_item` | A work item that can select the next task | `text`, `checked`, `phase` |
| `record` | An outcome, incident, or handoff record | `id`, `kind`, `session`, `commits` |
| `incident` | A record of a failure with root cause and lessons | `record`, `failure`, `root_cause`, `safeguards` |
| `commit` | A versioned change set | `hash`, `branch`, `message`, `files` |
| `branch` | A line of work | `name`, `head`, `protected` |
| `tag` | A name on a commit | `name`, `commit`, `version` |
| `version` | A build-time identity | `value`, `date`, `branch`, `hash`, `changes` |
| `release` | A published artifact | `tag`, `commit`, `version`, `assets` |
| `changelog` | The version history | `version`, `entries` |
| `lock` | A pinned dependency set with digests | `version`, `digests` |
| `test` | A check with a band and a tier | `path`, `band`, `tier`, `covers` |
| `log` | A generated log with a sortable prefix | `path`, `generated`, `prefix`, `session` |
| `document` | A human document, generated or authored | `path`, `generated`, `source` |
| `page` | A published project page | `path`, `generated`, `nav`, `dashboard` |
| `page_set` | The project's page list | `project`, `pages` |
| `nav` | One navigation entry | `page`, `href`, `label` |
| `dashboard` | The live-state page and the state it reads | `page`, `state` |
| `site_state` | A fetched live value | `key`, `value`, `fetched` |
| `agent` | A brain acting under an authority | `id`, `role`, `authority`, `boundary` |
| `sandbox` | A disposable execution hand | `id`, `reach`, `disposable` |
| `boundary` | The declared reach of a hand | `sandbox`, `paths`, `commands`, `hosts` |
| `credential` | A secret and where it lives | `id`, `location`, `reachable`, `scope` |
| `session` | The durable append-only log of a unit of work | `id`, `goal`, `log`, `events` |
| `goal` | A session's objective and state | `id`, `session`, `objective`, `state` |
| `delegation` | A dispatched delegate with a budget | `parent`, `child`, `depth`, `budget` |
| `failure` | A failed run, attributed to a layer | `session`, `layer`, `evidence`, `tool_call` |
| `layer` | Brain, harness, hand, credential, transport, provisioning | `name` |
| `stage` | A pipeline stage with one number | `number`, `feature`, `script`, `product` |
| `work_product` | A generated data file | `path`, `stage`, `parameters`, `provenance` |
| `dataset` | A raw input with a digest | `id`, `source`, `digest` |
| `provenance` | Where a product came from | `product`, `script`, `dataset`, `commit` |
| `ruleset` | A krank rule set | `id`, `rules`, `facts` |
| `rule_case` | One prose line mapped to a rule | `rule`, `original`, `verdict`, `suggestion` |
| `candidate` | A proposed compilation of one prompt | `prompt`, `ruleset`, `cases`, `explanation` |
| `check` | One engine run against facts | `ruleset`, `facts`, `firings`, `emitted` |
| `ambiguity` | An unknown that can change the result | `task`, `changes` |
| `assumption` | A stated guess for a harmless unknown | `task`, `text`, `labeled` |
| `delta` | A correction to the preceding output | `applies_to`, `fields` |
| `untrusted_content` | Data that is not an instruction | `source`, `kind` |
| `risk` | A risky change and its safeguard | `task`, `description`, `safeguard` |

## Operations

An operation is a verb with a subject and an object. The subject is who acts: the
agent, the human, a script, or the project. The object is from the list above.

| Operation | Subject | Object | Effect |
|---|---|---|---|
| authorize | task | operation | the operation is in scope |
| refuse / permit / ask | agent | operation / output / ambiguity | the engine's observable decision |
| create / modify / delete / rename / inspect | agent | path | the file state changes or is read |
| host | agent | host | live host state changes |
| run | agent | command | the command executes |
| verify | agent | verification | evidence is produced |
| test | agent | test | a test runs under its band and tier |
| record / commit / tag | agent | record / commit / tag | the outcome becomes durable |
| release / install | agent | release | the artifact is published or installed |
| delegate / dispatch | agent | delegation / task | a delegate acts under the dispatch |
| resume / emit_event | agent | session | the log resumes or grows |
| compile / render / reduce | agent | candidate / document | a prompt becomes rules, prose, or a shorter prompt |
| approve | human | candidate | the choice is recorded |
| accept | human | acceptance | the work is accepted |
| override | human | rule | the rule is replaced for the task |
| generate / derive | script | document / version | a document or a build identity is produced |
| pin / upgrade | project | lock | a dependency version moves |
| fetch | script | dataset | raw input is cached |
| sanitize | script | output | sensitive content is refused |
| declare | project | path | a path joins the structure |

The engine's own actions are `assert`, `retract`, and `emit`; the operations above
are the domain verbs a fact extractor observes, and most map to a fact plus an
emitted decision rather than to a new engine primitive.

## Relations

Relations are joins. In krank a join is two conditions that share a `$variable`:
the same task id, the same path, the same session. The cardinality is a design
statement, not an engine constraint.

| Relation | From → To | Cardinality |
|---|---|---|
| task authorizes operation | task → operation | one-to-many |
| operation targets path / host | operation → path, host | many-to-one |
| path belongs to directory | path → directory | many-to-one |
| directory belongs to project | directory → project | many-to-one |
| feature has requirement | feature → requirement | one-to-many |
| requirement defined in rule file | requirement → rule_file | many-to-one |
| task references feature | task → feature | many-to-many |
| task satisfies requirement | task → requirement | many-to-many |
| feature depends on feature | feature → feature | many-to-many |
| episode contains phase | episode → phase | one-to-many |
| phase contains task | phase → task | one-to-many |
| task produces commit / record | task → commit, record | one-to-many |
| record cites commit | record → commit | many-to-many |
| commit on branch | commit → branch | many-to-one |
| tag names commit | tag → commit | many-to-one |
| release names commit, carries version | release → commit, version | many-to-one |
| version describes commit | version → commit | many-to-one |
| test covers requirement | test → requirement | many-to-many |
| test writes log | test → log | one-to-many |
| log belongs to session | log → session | many-to-one |
| page in page set, has nav | page → page_set, nav | many-to-one, one-to-many |
| dashboard reads state | dashboard → site_state | one-to-many |
| document generated from source | document → source | many-to-one |
| session has goal | session → goal | one-to-one |
| delegation from/to agent, authorized by task | delegation → agent, task | many-to-one |
| boundary of sandbox | boundary → sandbox | one-to-one |
| credential held by | credential → host | many-to-one |
| failure attributed to layer | failure → layer | many-to-one |
| incident records failure, is record | incident → failure, record | one-to-many, one-to-one |
| stage produces work product | stage → work_product | one-to-many |
| work product has provenance | work_product → provenance | one-to-one |
| provenance names dataset | provenance → dataset | many-to-one |
| stage matches feature | stage → feature | many-to-one |
| ruleset contains rule | ruleset → rule | one-to-many |
| case maps rule | rule_case → rule | many-to-one |
| candidate compiles prompt, has ruleset | candidate → rule_file, ruleset | many-to-one, one-to-one |
| check runs ruleset | check → ruleset | many-to-one |
| override replaces rule | override → rule | many-to-one |
| ambiguity / assumption of task | ambiguity, assumption → task | many-to-one |
| delta applies to output | delta → output | many-to-one |
| todo item selects task | todo_item → task | one-to-one |
| risk of task | risk → task | many-to-one |

## Fact vocabulary

The registry's objects become fact `type`s; fields become keys; relations become
shared id fields. The types already used by the round-trip fixture are in the
registry (`task`, `operation`, `guard`, `change`, `statement`, `workflow`,
`ambiguity`, `output`, `checklist`, `file`), so a new rule can join an existing
fact instead of inventing a parallel one.

A worked join:

```json
{"type": "task", "id": "t1"}
{"type": "operation", "task": "t1", "verb": "modify", "path": "sources/a.mjs"}
{"type": "feature", "id": "f1", "path": "prompts/features/03-rules-engine.md"}
{"type": "requirement", "id": "KRANK-R010", "feature": "f1"}
```

```json
{"id": "refuse-unfeatured-change",
 "when": [
   {"fact": {"type": "operation", "task": "$t", "verb": "$v", "path": "$p"}},
   {"fact": {"type": "task", "id": "$t"}},
   {"fact": {"type": "requirement", "id": "$r", "feature": "$f"}},
   {"fact": {"type": "task", "id": "$t", "features": "$f"}, "not": true}
 ],
 "then": [{"emit": {"refused": {"path": "$p", "reason": "no referenced feature licenses it"}}}]}
```

The rule joins four facts by `$t` and `$f`. No new operator is needed; the
engine's binding and negation already express it.

The compile families added these extractor-fed types to the registry:
`task_section`, `task_op_line`, `task_file_row`, `task_verify`, `task_feature`,
`task_acceptance`, `task_scope`, `feature_section`, `feature_dependency`,
`test_tier`, and `privacy`. They are the vocabulary for the task, feature, and
workflow extractors; the rules that use them are written, but no extractor
produces the facts yet.

## Coverage map

Which prompts speak in which objects. This is the map a compile pass follows: a
file whose objects have no extractor cannot be compiled, whatever its notation.

| Prompt file | Objects and operations |
|---|---|
| `01-contract.md` | rule_file, rule, precedence, override, task, operation, path, output, delta, untrusted_content |
| `02-workflow.md` | task, plan, test, verification, record, commit, acceptance, session |
| `03-conventions.md` | path, directory, log, document, formatting |
| `common/01-universal-rules.md` | ambiguity, assumption, risk, untrusted_content, scope |
| `common/03-glossary.md` | terms only; no rule |
| `capabilities/01` | document, work_product, provenance |
| `capabilities/02` | version, commit, branch, tag |
| `capabilities/03` | stage, work_product, dataset, provenance |
| `capabilities/04` | release, tag, version, asset, checksum |
| `capabilities/05` | lock, dataset |
| `capabilities/06` | agent, sandbox, boundary, credential |
| `capabilities/07` | session, goal, log |
| `capabilities/08` | agent, delegation, task |
| `capabilities/09` | failure, layer, session, incident |
| `features/*` | feature, requirement, acceptance |
| `episodes/*` | episode, phase, task, branch |
| `how-to-write-*` | the artifact's fields |
| `records/README.md` | record, incident, commit, session |
| `tests/README.md` | test, band, log, requirement |

## What the engine cannot say yet

- **Content**: "keep secrets out of output" needs a substring or regex, not a
  path prefix. A `contains` operator covers the common case.
- **Order**: "a DELTA applies to the immediately preceding output" needs a
  sequence; facts are an unordered set.
- **Transitive closure**: feature dependencies are a graph. The engine can assert
  the closure rule by rule, but a cycle is a defect it cannot detect without a
  visited set.
- **References**: "the Definition of Done in `prompts/02-workflow.md`" is a
  pointer. The model can carry a `reference` fact plus the referenced file's
  facts, but the engine does not load documents.
- **Strength**: MUST and SHOULD are data on `rule` and `requirement`; a rule set
  can refuse a SHOULD if it reads the field, but the engine has no built-in
  notion of strength.
- **Judgment**: "clear", "faithful", "authorized", "acceptable" are human
  decisions; they stay as prose or as evaluations, not as rules.

## Next steps

1. **Extractors.** One extractor per object family: task, feature, episode,
   record, page, version, release, boundary, failure. A type without an extractor
   is a vocabulary entry, not a check.
2. **Classify before compiling.** For every bullet: object/operation/relation,
   or `human`. The classification is the coverage plan.
3. **Compile the validator's checks.** It already speaks these objects
   (task sections, feature ids, references, protected paths); compiling them
   proves the model on the largest existing rule family.
4. **Grow the registry, not the engine.** Add `contains` and order only when a
   repeated family cannot be expressed; each needs a rule family that fails
   without it.
5. **Keep the registry honest.** A type that no rule uses and no extractor
   produces is a candidate for deletion; a check that no type supports is a
   candidate for prose.
