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

export function pipeline_detail(step, context = {}) {
    if (step === "prompt") {
        return prompt_detail(context ?? {});
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
