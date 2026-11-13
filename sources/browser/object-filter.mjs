// object-filter.mjs — browser-safe review filtering and counting.
//
// Rows carry `use` (the current accept/ignore choice) and `reviewed` (whether a
// human toggled that choice). An unreviewed row's `use` is only a model guess;
// review_counts keeps that default separate from a human decision.

function is_reviewed(row) {
    return row.reviewed === true;
}

export function filter_proposals(rows, query, mode, origin = "all") {
    const needle = String(query ?? "").trim().toLowerCase();
    const wanted_origin = origin ?? "all";
    return rows.filter((row) => {
        if (wanted_origin !== "all") {
            // A missing or unknown origin is not guessed. Only an explicit match
            // appears when the user narrows to registry or scan terms.
            if (wanted_origin !== "registry" && wanted_origin !== "scan") {
                return false;
            }
            if (row.origin !== wanted_origin) {
                return false;
            }
        }
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

export function review_breakdown(rows) {
    const breakdown = {
        registry: 0,
        scan: 0,
        unknown_origin: 0,
        by_kind: {},
    };
    for (const row of rows) {
        if (row.origin === "registry" || row.origin === "scan") {
            breakdown[row.origin] += 1;
        } else {
            breakdown.unknown_origin += 1;
        }
        const kind = String(row.kind ?? "unknown");
        const counts = breakdown.by_kind[kind] ?? { total: 0, unreviewed: 0 };
        counts.total += 1;
        if (!is_reviewed(row)) {
            counts.unreviewed += 1;
        }
        breakdown.by_kind[kind] = counts;
    }
    return breakdown;
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
