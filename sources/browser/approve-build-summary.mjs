// approve-build-summary.mjs — presentation-only readiness and freshness facts.
//
// Eligibility for prose removal comes from review_report. These helpers translate
// that result into reviewable checks and compare generated output to current input;
// they never grant approval or change a build decision.

function is_legacy(candidate, report) {
    return !candidate?.review || !Array.isArray(candidate.review.requirements) || (report?.reasons?.length ?? 0) > 0;
}

export function approval_checklist(candidate, report, edited) {
    const legacy = is_legacy(candidate, report);
    const requirements = Array.isArray(report?.requirements) ? report.requirements : [];
    const decided = requirements.filter((item) => item.decision !== "unreviewed").length;
    const all_decided = requirements.length > 0 && decided === requirements.length;
    const checked = Boolean(report?.check_scope);
    const removable = Array.isArray(report?.removed) ? report.removed.length : 0;
    return [
        {
            id: "candidate",
            label: "A reading is selected",
            state: candidate ? "done" : "blocked",
            detail: candidate ? `${candidate.title} (${candidate.id})` : "Generate candidates and choose a reading.",
            target: "candidates",
        },
        {
            id: "review",
            label: "Requirement-level review exists",
            state: legacy ? "blocked" : "done",
            detail: legacy ? "This recorded reading is legacy or invalid; no line can be approved for removal." : `${requirements.length} identified requirement(s).`,
            target: "prompt",
        },
        {
            id: "source",
            label: "Source accounting is valid",
            state: legacy ? "blocked" : "done",
            detail: legacy ? "Regenerate to account for every source line and clause." : "Every nonblank source line is accounted for.",
            target: "candidates",
        },
        {
            id: "decisions",
            label: "Requirements have human decisions",
            state: all_decided ? "done" : requirements.length ? "warning" : "blocked",
            detail: requirements.length ? `${decided} of ${requirements.length} decided; zero reviewed is not approval.` : "No requirement decisions are available.",
            target: "rules",
        },
        {
            id: "check",
            label: "A current check is recorded",
            state: checked ? "done" : "blocked",
            detail: checked ? `Checked scope: ${report.check_scope}. This is evidence, not approval.` : "Run the rules against a supported fact scope.",
            target: "check",
        },
        {
            id: "edit",
            label: "The reviewed text is applied",
            state: edited ? "blocked" : "done",
            detail: edited ? "Apply the edited prompt and review the new text." : "The page draft matches the reviewed source.",
            target: "prompt",
        },
        {
            id: "reduction",
            label: "Prose is safe to reduce",
            state: removable > 0 ? "done" : "warning",
            detail: removable > 0 ? `${removable} exact source line(s) are removable.` : "Nothing is removable yet; the complete review artifact is still the record.",
            target: "rules",
        },
    ];
}

export function artifact_state(report, legacy) {
    const removed = Array.isArray(report?.removed) ? report.removed.length : 0;
    const reduced = !legacy && removed > 0;
    return {
        complete: true,
        rules: true,
        reduced,
        reduced_reason: legacy
            ? "Requirement-level review is unavailable, so no reduced prompt exists."
            : reduced ? `${removed} approved line(s) are removable.` : "No line is currently eligible for removal.",
    };
}

export function build_freshness(manifest_entry, catalog_entry) {
    if (!manifest_entry || !catalog_entry) {
        return { state: "missing", reason: "The built or current prompt record is missing." };
    }
    if (!manifest_entry.source_sha256 || !catalog_entry.source_sha256) {
        return { state: "missing", reason: "A source digest is missing, so freshness cannot be established." };
    }
    if (manifest_entry.source_sha256 !== catalog_entry.source_sha256) {
        return { state: "stale", reason: "The prompt source changed after this build." };
    }
    const selected = catalog_entry.approved ?? catalog_entry.candidates?.[0]?.id;
    if (manifest_entry.candidate !== selected) {
        return { state: "stale", reason: "The selected reading differs from the one built." };
    }
    return { state: "fresh", reason: "Built from the current source and selected reading." };
}

export function build_coverage_text(coverage) {
    if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) {
        return "Coverage unavailable (no build metadata)";
    }
    const removed = Array.isArray(coverage.removed) ? coverage.removed.length : 0;
    const removable = `${removed} removable line(s)`;
    if (!Array.isArray(coverage.reasons)) {
        return `Requirement review unavailable (missing or invalid coverage metadata)${removed ? ` · ${removable}` : ""}`;
    }
    if (coverage.reasons.length > 0) {
        return `Requirement review unavailable (legacy or stale)${removed ? ` · ${removable}` : ""}`;
    }
    if (!Number.isInteger(coverage.identified) || !Number.isInteger(coverage.approved)) {
        return `Coverage unavailable (invalid requirement counts)${removed ? ` · ${removable}` : ""}`;
    }
    return `${coverage.identified} identified · ${coverage.approved} approved · ${removable}`;
}

export function build_totals(manifest) {
    const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
    let with_removable = 0;
    let removable = 0;
    for (const item of entries) {
        const count = Array.isArray(item?.coverage?.removed) ? item.coverage.removed.length : 0;
        removable += count;
        if (count > 0) {
            with_removable += 1;
        }
    }
    return {
        entries: entries.length,
        with_removable,
        removable,
        generated_at: typeof manifest?.generated_at === "string" ? manifest.generated_at : "",
    };
}
