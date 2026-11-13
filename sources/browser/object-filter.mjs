// object-filter.mjs — browser-safe review filtering and counting.
//
// Rows carry `use` (the current accept/ignore choice) and `reviewed` (whether a
// human toggled that choice). An unreviewed row's `use` is only a model guess;
// review_counts keeps that default separate from a human decision.

function is_reviewed(row) {
    return row.reviewed === true;
}

export function filter_proposals(rows, query, mode) {
    const needle = String(query ?? "").trim().toLowerCase();
    return rows.filter((row) => {
        if (mode === "unreviewed" && is_reviewed(row)) {
            return false;
        }
        if (mode === "accepted" && !(is_reviewed(row) && row.use === "accept")) {
            return false;
        }
        if (mode === "ignored" && !(is_reviewed(row) && row.use === "ignore")) {
            return false;
        }
        if (needle === "") {
            return true;
        }
        const haystack = [row.term, row.kind, row.evidence, row.rationale]
            .filter((value) => value !== undefined && value !== null)
            .join(" ")
            .toLowerCase();
        return haystack.includes(needle);
    });
}

export function review_counts(rows) {
    const counts = {
        total: rows.length,
        reviewed: 0,
        unreviewed: 0,
        accepted: 0,
        ignored: 0,
        default_include: 0,
        default_exclude: 0,
    };
    for (const row of rows) {
        if (is_reviewed(row)) {
            counts.reviewed += 1;
            if (row.use === "accept") {
                counts.accepted += 1;
            } else {
                counts.ignored += 1;
            }
        } else {
            counts.unreviewed += 1;
            if (row.use === "accept") {
                counts.default_include += 1;
            } else {
                counts.default_exclude += 1;
            }
        }
    }
    return counts;
}
