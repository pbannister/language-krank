// candidate-summary.mjs — shared candidate statistics for the studio.
//
// A case quotes one prompt line. The number of cases is not the number of
// distinct source lines, and a candidate may quote lines from another prompt.
// These helpers keep those facts separate so the UI cannot overstate coverage.

function case_source(case_item, source) {
    return case_item.source ?? source;
}

function source_lines_of(candidate, source) {
    const lines = new Set();
    for (const case_item of candidate?.cases ?? []) {
        if (case_source(case_item, source) === source && typeof case_item.original === "string" && case_item.original !== "") {
            lines.add(case_item.original);
        }
    }
    return lines;
}

export function candidate_stats(candidate, source) {
    const cases = Array.isArray(candidate?.cases) ? candidate.cases : [];
    const lines = source_lines_of(candidate, source);
    const cross_file_cases = cases.filter((case_item) => case_source(case_item, source) !== source).length;
    return {
        rule_count: Array.isArray(candidate?.rules?.rules) ? candidate.rules.rules.length : 0,
        case_count: cases.length,
        source_lines: lines.size,
        source_files: lines.size === 0 ? 0 : 1,
        cross_file_cases,
    };
}

export function coverage_delta(candidate, current, source) {
    const this_lines = source_lines_of(candidate, source);
    const current_lines = source_lines_of(current, source);
    const shared = [...this_lines].filter((line) => current_lines.has(line));
    const only_this = [...this_lines].filter((line) => !current_lines.has(line));
    const only_current = [...current_lines].filter((line) => !this_lines.has(line));
    return {
        shared: shared.length,
        only_this: only_this.length,
        only_current: only_current.length,
        examples: {
            shared: shared.slice(0, 3),
            only_this: only_this.slice(0, 3),
            only_current: only_current.slice(0, 3),
        },
    };
}
