// review-queue.mjs — browser-safe summaries and filtering for requirement review.
//
// This module reads the report returned by review_report() and the candidate's
// requirement records. It never changes a decision or decides eligibility; the
// shared review core remains the only authority for what can be approved or
// removed.

function report_rows(report) {
    return Array.isArray(report?.requirements) ? report.requirements : [];
}

function count_of(value) {
    return Number.isFinite(value) ? value : 0;
}

export function review_progress(report) {
    const rows = report_rows(report);
    const identified = count_of(report?.identified ?? rows.length);
    const executable = count_of(report?.executable);
    let approved = 0;
    let rejected = 0;
    let unreviewed = 0;
    let eligible = 0;
    for (const row of rows) {
        if (row.decision === "approved") {
            approved += 1;
        } else if (row.decision === "rejected") {
            rejected += 1;
        } else {
            unreviewed += 1;
        }
        if (row.eligible === true) {
            eligible += 1;
        }
    }
    const check_scope = typeof report?.check_scope === "string" && report.check_scope !== "";
    return {
        identified,
        executable,
        approved,
        rejected,
        unreviewed,
        eligible,
        non_executable: Math.max(0, identified - executable),
        blocked: Math.max(0, executable - eligible),
        needs_check: check_scope ? 0 : executable,
        removable_lines: Array.isArray(report?.removed) ? report.removed.length : 0,
        decided: approved + rejected,
        all_reviewed: identified > 0 && unreviewed === 0,
        has_check: check_scope,
    };
}

function searchable_text(requirement, row, explanation) {
    return [
        requirement.id,
        requirement.title,
        requirement.line,
        requirement.quote,
        requirement.status,
        requirement.reason,
        ...(Array.isArray(requirement.missing_facts) ? requirement.missing_facts : []),
        explanation?.title,
        explanation?.text,
        explanation?.limitations,
        row?.decision,
        row?.reason,
    ]
        .filter((value) => value !== undefined && value !== null)
        .join(" ")
        .toLowerCase();
}

export function filter_requirements(requirements, report, query, mode, explanation_of) {
    const rows = new Map(report_rows(report).map((row) => [row.id, row]));
    const needle = String(query ?? "").trim().toLowerCase();
    return (Array.isArray(requirements) ? requirements : []).filter((requirement) => {
        const row = rows.get(requirement.id);
        const decision = row?.decision ?? "unreviewed";
        if (mode === "needs_review" && decision !== "unreviewed") {
            return false;
        }
        if (mode === "approved" && decision !== "approved") {
            return false;
        }
        if (mode === "rejected" && decision !== "rejected") {
            return false;
        }
        if (mode === "non_executable" && requirement.status === "executable") {
            return false;
        }
        if (needle === "") {
            return true;
        }
        const explanation = typeof explanation_of === "function" ? explanation_of(requirement) : requirement.explanation;
        return searchable_text(requirement, row, explanation).includes(needle);
    });
}
