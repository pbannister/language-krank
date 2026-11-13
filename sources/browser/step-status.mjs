// step-status.mjs — browser-safe readiness labels for the seven studio steps.
// The labels summarize recorded evidence; they do not grant approval.

const STEPS = [
    { step: "prompt", title: "Step 1: Prompt" },
    { step: "objects", title: "Step 2: Objects" },
    { step: "candidates", title: "Step 3: Candidates" },
    { step: "rules", title: "Step 4: Rules" },
    { step: "check", title: "Step 5: Check" },
    { step: "approve", title: "Step 6: Approve" },
    { step: "build", title: "Step 7: Build and use" },
];

function state_row(step, state, detail) {
    const meta = STEPS.find((item) => item.step === step);
    return { step, title: meta.title, state, detail };
}

export function step_statuses(input = {}) {
    const { candidate, report, objects, edited, build } = input ?? {};
    const rows = [];
    const object_counts = objects ?? {};
    const total_objects = Number.isFinite(object_counts.total) ? object_counts.total : 0;
    const unreviewed_objects = Number.isFinite(object_counts.unreviewed) ? object_counts.unreviewed : 0;
    const reviewed_objects = Number.isFinite(object_counts.reviewed) ? object_counts.reviewed : 0;

    rows.push(state_row("prompt",
        edited ? "attention" : "ready",
        edited ? "A page-local draft differs from the file." : "The draft matches the prompt file."));

    if (total_objects === 0) {
        rows.push(state_row("objects", "optional", "No object suggestions are available; this step is optional."));
    } else if (unreviewed_objects > 0) {
        rows.push(state_row("objects", "attention", `${reviewed_objects} of ${total_objects} object suggestions reviewed.`));
    } else {
        rows.push(state_row("objects", "done", `${total_objects} object suggestions reviewed.`));
    }

    rows.push(candidate
        ? state_row("candidates", "done", `Reading selected: ${candidate.id}. Selection is not approval.`)
        : state_row("candidates", "blocked", "Generate and select a reading."));

    const requirements = Array.isArray(report?.requirements) ? report.requirements : [];
    const unreviewed = requirements.filter((item) => (item.decision ?? "unreviewed") === "unreviewed").length;
    if (!candidate?.review || (Array.isArray(report?.reasons) && report.reasons.length > 0)) {
        rows.push(state_row("rules", "blocked", "No current requirement-level review exists."));
    } else if (unreviewed > 0) {
        rows.push(state_row("rules", "attention", `${unreviewed} requirement decision(s) remain.`));
    } else {
        rows.push(state_row("rules", "done", "Every requirement has a decision."));
    }

    if (report?.check_scope) {
        rows.push(state_row("check", "done", `Current check scope: ${report.check_scope}.`));
    } else if (Number(report?.executable) > 0) {
        rows.push(state_row("check", "blocked", "Executable requirements need a current check."));
    } else {
        rows.push(state_row("check", "optional", "No executable requirement needs a check."));
    }

    const approve_blocked = !candidate?.review || (Array.isArray(report?.reasons) && report.reasons.length > 0);
    const approve_attention = unreviewed > 0 || !report?.check_scope;
    rows.push(approve_blocked
        ? state_row("approve", "blocked", "Requirement review is unavailable.")
        : approve_attention
            ? state_row("approve", "attention", "Review decisions or a current check are still missing.")
            : state_row("approve", "done", "The review record is ready to download; downloading writes nothing."));

    const build_state = build?.freshness;
    if (!build?.present) {
        rows.push(state_row("build", "blocked", "prompts.out/ has not been built yet."));
    } else if (build_state !== "fresh") {
        rows.push(state_row("build", "attention", `Build output is ${build_state ?? "not fresh"}.`));
    } else {
        rows.push(state_row("build", "done", "The current reading is built and fresh."));
    }
    return rows;
}

export function next_recommended_step(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return list.find((row) => row.state === "blocked")
        ?? list.find((row) => row.state === "attention")
        ?? null;
}
