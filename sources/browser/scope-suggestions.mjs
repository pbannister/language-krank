// scope-suggestions.mjs — browser-safe discovery of fact scopes that can feed rules.
// This module previews candidate scopes; review_check remains the only authority.

import { scope_stats, check_readiness } from "./check-summary.mjs";

function directory_label(directory) {
    return directory === "." || directory === "" ? "the repository root" : `${directory}/`;
}

function option_for(value, label, kind, target, files, rules) {
    const stats = scope_stats(files);
    const readiness = check_readiness(rules, files.flatMap((file) => file.entities ?? []));
    return {
        value,
        label,
        kind,
        target,
        file_count: stats.file_count,
        fact_count: stats.fact_count,
        types: stats.types,
        missing_types: readiness.missing_types,
        missing_fields: readiness.missing_fields,
        ready: readiness.ready,
    };
}

export function scope_options(files, rules) {
    const list = Array.isArray(files) ? files.filter((file) => file && typeof file.path === "string" && Array.isArray(file.entities)) : [];
    const by_directory = new Map();
    const options = [];
    for (const file of list) {
        options.push(option_for(`file:${file.path}`, file.path, "file", file.path, [file], rules));
        const directory = file.facts?.directory ?? ".";
        const group = by_directory.get(directory) ?? [];
        group.push(file);
        by_directory.set(directory, group);
    }
    for (const [directory, group] of [...by_directory].sort(([left], [right]) => left.localeCompare(right))) {
        options.push(option_for(`dir:${directory}`, `all files in ${directory_label(directory)}`, "dir", directory, group, rules));
    }
    return options;
}

export function rank_scope_suggestions(options, limit = 5) {
    const list = Array.isArray(options) ? options : [];
    const seen = new Set();
    const unique = [];
    for (const option of list) {
        if (!option || typeof option.value !== "string" || seen.has(option.value)) {
            continue;
        }
        seen.add(option.value);
        unique.push(option);
    }
    unique.sort((left, right) => {
        if (left.ready !== right.ready) {
            return left.ready ? -1 : 1;
        }
        const missing = (left.missing_types?.length ?? 0) - (right.missing_types?.length ?? 0);
        if (missing !== 0) {
            return missing;
        }
        const types = (right.types?.length ?? 0) - (left.types?.length ?? 0);
        if (types !== 0) {
            return types;
        }
        const files = (left.file_count ?? 0) - (right.file_count ?? 0);
        if (files !== 0) {
            return files;
        }
        return String(left.label ?? left.value).localeCompare(String(right.label ?? right.value));
    });
    const count = Number.isInteger(limit) && limit > 0 ? limit : 5;
    return unique.slice(0, count);
}

export function suggestion_label(option) {
    if (!option || typeof option.label !== "string") {
        return "Unavailable scope";
    }
    if (option.ready) {
        return `${option.label} — ready`;
    }
    const missing = Array.isArray(option.missing_types) ? option.missing_types : [];
    if (missing.length === 0) {
        return `${option.label} — cannot run`;
    }
    const shown = missing.slice(0, 3).join(", ");
    return `${option.label} — missing ${shown}${missing.length > 3 ? ` +${missing.length - 3}` : ""}`;
}

export function scope_comparison(current, best) {
    if (!current || !best) {
        return null;
    }
    const current_types = new Set(Array.isArray(current.types) ? current.types : []);
    const best_types = new Set(Array.isArray(best.types) ? best.types : []);
    const added = [...best_types].filter((type) => !current_types.has(type)).sort();
    const absent = [...current_types].filter((type) => !best_types.has(type)).sort();
    const best_missing = Array.isArray(best.missing_types) ? best.missing_types : [];
    return {
        current_ready: current.ready === true,
        best_ready: best.ready === true,
        added_types: added,
        absent_types: absent,
        best_missing_types: best_missing,
        fact_delta: (Number.isFinite(best.fact_count) ? best.fact_count : 0)
            - (Number.isFinite(current.fact_count) ? current.fact_count : 0),
        recommendation: best.ready
            ? "The suggested scope can run; the current scope may not."
            : "Neither scope can run completely; the suggestion has fewer missing fact types.",
    };
}
