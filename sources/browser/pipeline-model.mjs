// pipeline-model.mjs — browser-safe description of the studio's processing pipeline.
// The pipeline is explanatory: it never approves, saves, or evaluates anything.

export const PIPELINE_STAGES = [
    { step: "prompt", label: "Prompt", artifact: "prose" },
    { step: "objects", label: "Objects", artifact: "terms" },
    { step: "candidates", label: "Candidates", artifact: "readings" },
    { step: "rules", label: "Rules", artifact: "requirements" },
    { step: "check", label: "Check", artifact: "evidence" },
    { step: "approve", label: "Approve", artifact: "record" },
    { step: "build", label: "Build", artifact: "prompts.out" },
];

export const PIPELINE_DETAILS = {
    prompt: {
        title: "Prose becomes a working draft",
        consumes: "A human-authored prompt file",
        produces: "An editable page-local draft and candidate readings",
        caution: "Generating reads the current text. It does not save the draft or approve anything.",
        flow: [
            { label: "Prompt file", artifact: "source" },
            { label: "Draft", artifact: "editable text" },
            { label: "Generate", artifact: "candidate readings" },
        ],
    },
    objects: {
        title: "Prose yields reviewable vocabulary",
        consumes: "The current prompt text",
        produces: "Object, operation, and relation proposals with evidence",
        caution: "Scanning is not rule generation. Reviewed terms do not update the confirmed registry automatically.",
        flow: [
            { label: "Prompt", artifact: "prose" },
            { label: "Scan", artifact: "proposals" },
            { label: "Human review", artifact: "accept or ignore" },
            { label: "Registry", artifact: "separate step" },
        ],
    },
    candidates: {
        title: "A reading becomes formal rules",
        consumes: "The prompt and its vocabulary",
        produces: "Candidate rule sets with quoted source coverage",
        caution: "Choosing a reading changes what is reviewed. It is not requirement approval.",
        flow: [
            { label: "Prompt", artifact: "prose" },
            { label: "Compiler", artifact: "rule set" },
            { label: "Readings", artifact: "alternatives" },
            { label: "Current choice", artifact: "not approval" },
        ],
    },
    rules: {
        title: "Rules become reviewable requirements",
        consumes: "The selected candidate rule set",
        produces: "Requirement cards, decisions, and removal eligibility",
        caution: "A line is eligible only after its clauses are reviewed, checked, and approved. This step does not edit prose.",
        flow: [
            { label: "Rules", artifact: "formal checks" },
            { label: "Requirements", artifact: "clauses" },
            { label: "Review + check", artifact: "evidence" },
            { label: "Eligibility", artifact: "approval + scope" },
        ],
    },
    check: {
        title: "Rules meet a fact snapshot",
        consumes: "The selected rules and a project fact scope",
        produces: "Scoped evaluation evidence and emitted findings",
        caution: "A completed check is evidence for that scope only. It is not a pass, conformance proof, or approval.",
        flow: [
            { label: "Rules", artifact: "deterministic" },
            { label: "Fact snapshot", artifact: "selected scope" },
            { label: "Evaluate", artifact: "firings" },
            { label: "Evidence", artifact: "scope only" },
        ],
    },
    approve: {
        title: "Review evidence becomes a record",
        consumes: "Requirement decisions and a current check",
        produces: "A complete compile-and-review artifact",
        caution: "Downloading writes nothing into the repository. Saving the rule set alone does not preserve approval.",
        flow: [
            { label: "Decisions", artifact: "human" },
            { label: "Check", artifact: "scoped" },
            { label: "Artifact", artifact: "complete record" },
            { label: "Repository", artifact: "you save it" },
        ],
    },
    build: {
        title: "Recorded selections become generated output",
        consumes: "Compile entries and the prompt files",
        produces: "prompts.out/ with rules and reduced prose",
        caution: "A fresh build is not enforcement. Later work must supply facts and run the saved rules.",
        flow: [
            { label: "Artifact", artifact: "recorded" },
            { label: "Build", artifact: "prompts.out" },
            { label: "Reduced prose", artifact: "not proof" },
            { label: "Later run", artifact: "facts + rules" },
        ],
    },
};

export function pipeline_stage(step) {
    return PIPELINE_STAGES.find((stage) => stage.step === step) ?? PIPELINE_STAGES[0];
}

function prompt_detail(context) {
    const base = PIPELINE_DETAILS.prompt;
    const source = typeof context.source === "string" && context.source !== "" ? context.source : "prompt file";
    const count = Number.isFinite(context.candidate_count) ? context.candidate_count : 0;
    const current = typeof context.current_candidate === "string" && context.current_candidate !== ""
        ? context.current_candidate
        : null;
    const draft_state = ["matches_file", "applied_draft", "unsaved_edit"].includes(context.draft_state)
        ? context.draft_state
        : "matches_file";
    const draft_label = draft_state === "unsaved_edit"
        ? "unsaved edit"
        : draft_state === "applied_draft" ? "applied draft" : "matches file";
    const caution = draft_state === "unsaved_edit"
        ? "Generate uses the unsaved text, but the prompt file is unchanged. Nothing is saved or approved."
        : draft_state === "applied_draft"
            ? "The applied draft is page-local. It is used for generation, but it is not written to the file or approved."
            : base.caution;
    return {
        ...base,
        consumes: `A human-authored prompt file: ${source}`,
        produces: `${count} candidate reading${count === 1 ? "" : "s"}${current ? `; current choice ${current}` : ""}`,
        caution,
        flow: [
            { label: source, artifact: "source" },
            { label: "Draft", artifact: draft_label },
            { label: "Generate", artifact: `${count} reading${count === 1 ? "" : "s"}` },
        ],
    };
}

function objects_detail(context) {
    const base = PIPELINE_DETAILS.objects;
    const counts = context.objects ?? {};
    const total = Number.isFinite(counts.total) ? counts.total : 0;
    const reviewed = Number.isFinite(counts.reviewed) ? counts.reviewed : 0;
    const unreviewed = Number.isFinite(counts.unreviewed) ? counts.unreviewed : 0;
    const origins = context.object_origins ?? {};
    const registry = Number.isFinite(origins.registry) ? origins.registry : 0;
    const scan = Number.isFinite(origins.scan) ? origins.scan : 0;
    return {
        ...base,
        produces: `${total} proposal${total === 1 ? "" : "s"}; ${reviewed} reviewed and ${unreviewed} unreviewed`,
        caution: unreviewed > 0
            ? `${unreviewed} suggestion${unreviewed === 1 ? "" : "s"} remain unreviewed. Scan proposals do not update the confirmed registry.`
            : base.caution,
        flow: [
            { label: "Prompt", artifact: "prose" },
            { label: "Scan", artifact: `${scan} new proposals` },
            { label: "Human review", artifact: `${reviewed} of ${total} reviewed` },
            { label: "Registry", artifact: `${registry} registry terms; separate update` },
        ],
    };
}

function candidates_detail(context) {
    const base = PIPELINE_DETAILS.candidates;
    const count = Number.isFinite(context.candidate_count) ? context.candidate_count : 0;
    const rules = Number.isFinite(context.current_rule_count) ? context.current_rule_count : 0;
    const current = typeof context.current_candidate === "string" && context.current_candidate !== ""
        ? context.current_candidate
        : null;
    return {
        ...base,
        produces: `${count} candidate reading${count === 1 ? "" : "s"}${current ? `; current choice ${current} with ${rules} rule${rules === 1 ? "" : "s"}` : ""}`,
        caution: current
            ? "The current choice determines what Rules and Check evaluate. Choosing a reading is still not requirement approval."
            : base.caution,
        flow: [
            { label: "Prompt", artifact: "prose" },
            { label: "Compiler", artifact: `${count} reading${count === 1 ? "" : "s"}` },
            { label: "Current choice", artifact: current ?? "none" },
            { label: "Rules review", artifact: `${rules} formal checks` },
        ],
    };
}

function rules_detail(context) {
    const base = PIPELINE_DETAILS.rules;
    const report = context.report ?? {};
    const identified = Number.isFinite(report.identified) ? report.identified : 0;
    const approved = Number.isFinite(report.approved) ? report.approved : 0;
    const unreviewed = Array.isArray(report.requirements)
        ? report.requirements.filter((item) => (item.decision ?? "unreviewed") === "unreviewed").length : 0;
    const removable = Array.isArray(report.removed) ? report.removed.length : 0;
    const rules = Number.isFinite(context.current_rule_count) ? context.current_rule_count : 0;
    return {
        ...base,
        produces: `${identified} requirement${identified === 1 ? "" : "s"}; ${approved} approved and ${unreviewed} unreviewed; ${removable} removable line${removable === 1 ? "" : "s"}`,
        caution: unreviewed > 0
            ? `${unreviewed} requirement decision${unreviewed === 1 ? "" : "s"} ${unreviewed === 1 ? "remains" : "remain"}. No prose is removed until every clause on a line is eligible.`
            : base.caution,
        flow: [
            { label: "Rules", artifact: `${rules} formal checks` },
            { label: "Requirements", artifact: `${identified} identified` },
            { label: "Review + check", artifact: `${approved} approved, ${unreviewed} open` },
            { label: "Eligibility", artifact: `${removable} removable line${removable === 1 ? "" : "s"}` },
        ],
    };
}

function check_detail(context) {
    const base = PIPELINE_DETAILS.check;
    const facts = Number.isFinite(context.scope_fact_count) ? context.scope_fact_count : 0;
    const scope = typeof context.scope_label === "string" && context.scope_label !== "" ? context.scope_label : "selected scope";
    const ready = context.scope_ready === true;
    const recorded = typeof context.check_scope === "string" && context.check_scope !== "";
    return {
        ...base,
        consumes: `The selected rules and ${facts} observation${facts === 1 ? "" : "s"} from ${scope}`,
        produces: recorded ? `Recorded evidence for ${context.check_scope}` : "A scoped evaluation, or an explicit reason it cannot run",
        caution: ready
            ? "This check covers only the selected facts. It is not a pass, conformance proof, or approval."
            : "The selected scope cannot currently supply everything these rules need. Choosing another scope does not approve anything.",
        flow: [
            { label: "Rules", artifact: "deterministic" },
            { label: "Fact scope", artifact: `${facts} observations` },
            { label: "Evaluate", artifact: ready ? "ready" : "blocked" },
            { label: "Evidence", artifact: recorded ? "recorded" : "not yet" },
        ],
    };
}

export function pipeline_detail(step, context = {}) {
    if (step === "prompt") {
        return prompt_detail(context ?? {});
    }
    if (step === "objects") {
        return objects_detail(context ?? {});
    }
    if (step === "candidates") {
        return candidates_detail(context ?? {});
    }
    if (step === "rules") {
        return rules_detail(context ?? {});
    }
    if (step === "check") {
        return check_detail(context ?? {});
    }
    return PIPELINE_DETAILS[step] ?? PIPELINE_DETAILS.prompt;
}

export function pipeline_track(status_rows, current_step) {
    const rows = Array.isArray(status_rows) ? status_rows : [];
    const current = typeof current_step === "string" && PIPELINE_STAGES.some((stage) => stage.step === current_step)
        ? current_step
        : "prompt";
    return PIPELINE_STAGES.map((stage) => {
        const status = rows.find((row) => row?.step === stage.step);
        return {
            ...stage,
            state: typeof status?.state === "string" ? status.state : "optional",
            detail: typeof status?.detail === "string" ? status.detail : "",
            current: stage.step === current,
        };
    });
}
