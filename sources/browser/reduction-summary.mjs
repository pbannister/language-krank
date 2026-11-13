// reduction-summary.mjs — browser-safe explanations of reduction readiness.
//
// This module consumes review_report(); it never computes eligibility, approves
// anything, or removes prose. `report.removed` and `report.requirements[].eligible`
// remain the only authority for what the review core permits.

function report_rows(report) {
    return Array.isArray(report?.requirements) ? report.requirements : [];
}

function report_reasons(report) {
    return Array.isArray(report?.reasons) ? report.reasons.filter((reason) => typeof reason === "string" && reason !== "") : [];
}

function number_of(value) {
    return Number.isFinite(value) ? value : 0;
}

function nonblank_lines(text) {
    return String(text ?? "").split("\n").map((line, index) => ({ line: index + 1, text: line }))
        .filter((item) => item.text.trim() !== "");
}

function unavailable(report) {
    return report == null || report_reasons(report).length > 0;
}

function legacy_report(report) {
    const rows = report_rows(report);
    const reasons = report_reasons(report);
    return report == null
        || (reasons.length > 0 && rows.length === 0 && number_of(report.identified) === 0 && number_of(report.executable) === 0);
}

export function reduction_summary(report, text) {
    const lines = nonblank_lines(text);
    const rows = report_rows(report);
    const reasons = report_reasons(report);
    const legacy = legacy_report(report);
    const available = !unavailable(report);
    const removed = [...new Set(Array.isArray(report?.removed) ? report.removed : [])]
        .filter((line) => Number.isInteger(line) && lines.some((item) => item.line === line));
    const identified = number_of(report?.identified ?? rows.length);
    const executable = number_of(report?.executable);
    const decisions = { approved: 0, rejected: 0, unreviewed: 0 };
    for (const row of rows) {
        if (row.decision === "approved") {
            decisions.approved += 1;
        } else if (row.decision === "rejected") {
            decisions.rejected += 1;
        } else {
            decisions.unreviewed += 1;
        }
    }
    const check_scope = typeof report?.check_scope === "string" && report.check_scope !== "";
    const blockers = [];
    if (!report) {
        blockers.push({ key: "unavailable", label: "No review artifact is available; regenerate candidates.", count: 1 });
    } else if (reasons.length > 0) {
        blockers.push({ key: "stale", label: `Review metadata is unavailable or stale: ${reasons.join(" ")}`, count: 1 });
    } else {
        if (identified === 0) {
            blockers.push({ key: "no_requirements", label: "No requirements were identified for this reading.", count: 1 });
        }
        if (decisions.unreviewed > 0) {
            blockers.push({ key: "unreviewed", label: "Requirements still need a decision in Rules.", count: decisions.unreviewed });
        }
        if (decisions.rejected > 0) {
            blockers.push({ key: "rejected", label: "Rejected requirements keep their source lines.", count: decisions.rejected });
        }
        if (identified - executable > 0) {
            blockers.push({ key: "non_executable", label: "Non-executable requirements keep their source lines.", count: identified - executable });
        }
        if (!check_scope && executable > 0) {
            blockers.push({ key: "needs_check", label: "Executable requirements need a current check on a supported scope.", count: executable });
        }
    }
    let readiness;
    if (legacy) {
        readiness = "legacy";
    } else if (!available || removed.length === 0) {
        readiness = "blocked";
    } else if (blockers.length > 0) {
        readiness = "partial";
    } else {
        readiness = "ready";
    }
    return {
        readiness,
        available,
        legacy,
        total_nonblank: lines.length,
        removable: removed.length,
        retained: Math.max(0, lines.length - removed.length),
        removed_lines: removed,
        blockers,
        identified,
        executable,
        decisions,
        check_scope: check_scope ? report.check_scope : null,
    };
}

// line_status_rows classifies every nonblank source line for the comparison
// navigator. It reuses the report's decisions and eligibility flags.
export function line_status_rows(text, report, requirements) {
    const lines = nonblank_lines(text);
    const removed = new Set(Array.isArray(report?.removed) ? report.removed : []);
    const rows_by_id = new Map(report_rows(report).map((row) => [row.id, row]));
    const requirements_by_line = new Map();
    for (const requirement of Array.isArray(requirements) ? requirements : []) {
        const list = requirements_by_line.get(requirement?.line) ?? [];
        list.push(requirement);
        requirements_by_line.set(requirement?.line, list);
    }
    return lines.map((item) => {
        const on_line = requirements_by_line.get(item.line) ?? [];
        if (removed.has(item.line)) {
            return {
                line: item.line, text: item.text, state: "removable", category: "removable",
                reason: "Eligible for removal under the recorded review and check scope.",
                requirement_ids: on_line.map((requirement) => requirement.id),
            };
        }
        let category = "context";
        let reason = "Context line: no extracted requirement.";
        if (legacy_report(report)) {
            category = "legacy";
            reason = retained_reason(report, item.line, requirements);
        } else if (unavailable(report)) {
            category = "unavailable";
            reason = retained_reason(report, item.line, requirements);
        } else if (on_line.length > 0) {
            if (on_line.some((requirement) => (rows_by_id.get(requirement.id)?.decision ?? "unreviewed") === "unreviewed")) {
                category = "needs_decision";
            } else if (on_line.some((requirement) => rows_by_id.get(requirement.id)?.decision === "rejected")) {
                category = "rejected";
            } else if (on_line.some((requirement) => requirement.status !== "executable")) {
                category = "non_executable";
            } else if (on_line.some((requirement) => rows_by_id.get(requirement.id)?.eligible !== true)) {
                category = "needs_check";
            } else {
                category = "other";
            }
            reason = retained_reason(report, item.line, requirements);
        }
        return {
            line: item.line, text: item.text, state: "retained", category, reason,
            requirement_ids: on_line.map((requirement) => requirement.id),
        };
    });
}

export function filter_line_status(rows, mode) {
    const list = Array.isArray(rows) ? rows : [];
    if (mode === "removable") {
        return list.filter((row) => row.state === "removable");
    }
    if (mode === "retained") {
        return list.filter((row) => row.state === "retained");
    }
    if (mode === "context") {
        return list.filter((row) => row.category === "context");
    }
    if (mode === "attention") {
        return list.filter((row) => row.state === "removable" || row.category !== "context");
    }
    return [...list];
}

export function line_status_counts(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const counts = { total: list.length, removable: 0, retained: 0, by_category: {} };
    for (const row of list) {
        if (row.state === "removable") {
            counts.removable += 1;
        } else {
            counts.retained += 1;
        }
        counts.by_category[row.category] = (counts.by_category[row.category] ?? 0) + 1;
    }
    return counts;
}

// retained_reason explains why a particular nonblank line is still present. It
// uses the report's decision/eligibility rows; it does not re-evaluate a rule.
export function retained_reason(report, line_number, requirements) {
    if (legacy_report(report)) {
        return report == null
            ? "No review artifact is available; regenerate candidates."
            : "No requirement-level review is recorded for this reading.";
    }
    if (unavailable(report)) {
        return `Review unavailable: ${report_reasons(report).join(" ")}`;
    }
    const on_line = (Array.isArray(requirements) ? requirements : [])
        .filter((requirement) => requirement?.line === line_number);
    if (on_line.length === 0) {
        return "Context line: no extracted requirement.";
    }
    const rows = new Map(report_rows(report).map((row) => [row.id, row]));
    if (on_line.some((requirement) => (rows.get(requirement.id)?.decision ?? "unreviewed") === "unreviewed")) {
        return "Needs a decision in Rules.";
    }
    if (on_line.some((requirement) => rows.get(requirement.id)?.decision === "rejected")) {
        return "Rejected in review; retained.";
    }
    const retained = on_line.filter((requirement) => requirement.status !== "executable");
    if (retained.length > 0) {
        return `Retained non-executable requirement (${retained.map((requirement) => requirement.status).join(", ")}).`;
    }
    const ineligible = on_line.filter((requirement) => rows.get(requirement.id)?.eligible !== true);
    if (ineligible.length > 0) {
        return report?.check_scope
            ? "Not eligible for removal under the recorded check."
            : "Needs a current check on a supported scope.";
    }
    return "Not fully accounted as a removable requirement line.";
}
