// decision-summary.mjs — browser-safe Markdown export of recorded review decisions.

function cell(value) {
    return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function decision_summary(candidate, report, source) {
    const requirements = Array.isArray(candidate?.review?.requirements) ? candidate.review.requirements : [];
    const rows = new Map((Array.isArray(report?.requirements) ? report.requirements : []).map((row) => [row.id, row]));
    const lines = [
        `# Decision summary: ${source}`,
        "",
        `- Candidate: ${candidate?.id ?? "none"}`,
        `- Requirements identified: ${report?.identified ?? 0}`,
        `- Executable: ${report?.executable ?? 0}`,
        `- Approved: ${report?.approved ?? 0}`,
        `- Removable lines: ${Array.isArray(report?.removed) ? report.removed.length : 0}`,
        `- Check scope: ${report?.check_scope ?? "none"}`,
        "",
        "| Requirement | Line | Status | Decision | Eligible | Reason |",
        "|---|---:|---|---|---|---|",
    ];
    if (requirements.length === 0) {
        lines.push("| _(no requirement-level review recorded)_ |  |  |  |  |  |");
    } else {
        for (const requirement of requirements) {
            const row = rows.get(requirement.id);
            lines.push(`| ${cell(requirement.id)} | ${requirement.line ?? ""} | ${cell(requirement.status)} | ${cell(row?.decision ?? "unreviewed")} | ${row?.eligible ? "yes" : "no"} | ${cell(row?.reason ?? requirement.reason)} |`);
        }
    }
    lines.push("", "This summary records human decisions and scoped evidence. It is not an approval of untested behavior, a conformance proof, or a guarantee of future enforcement.");
    if (Array.isArray(report?.reasons) && report.reasons.length > 0) {
        lines.push("", "## Unavailable review evidence", "", ...report.reasons.map((reason) => `- ${reason}`));
    }
    return `${lines.join("\n")}\n`;
}
