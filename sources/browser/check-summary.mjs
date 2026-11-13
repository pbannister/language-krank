// check-summary.mjs — browser-safe explanations of a check's scope and readiness.
//
// This module previews what a check can evaluate. It is deliberately
// conservative and mirrors the input checks in sources/compile-review.mjs:
// review_check remains the only authority on whether a check is recorded.

function number_of(value) {
    return Number.isFinite(value) ? value : 0;
}

function type_counts(facts) {
    const counts = new Map();
    for (const fact of Array.isArray(facts) ? facts : []) {
        if (fact && typeof fact.type === "string" && fact.type !== "") {
            counts.set(fact.type, (counts.get(fact.type) ?? 0) + 1);
        }
    }
    return counts;
}

// files are the catalog's file records: { path, entities: [fact, ...] }.
export function scope_stats(files) {
    const list = Array.isArray(files) ? files : [];
    const facts = list.flatMap((file) => Array.isArray(file?.entities) ? file.entities : []);
    const counts = type_counts(facts);
    const types = [...counts.keys()].sort();
    return {
        file_count: list.length,
        fact_count: facts.length,
        types,
        counts: Object.fromEntries(types.map((type) => [type, counts.get(type)])),
    };
}

function literal_type(pattern) {
    return typeof pattern?.type === "string" && pattern.type !== "" && !pattern.type.startsWith("$")
        ? pattern.type
        : null;
}

// Return one row per literal type with unique rule IDs. observation_required is
// true only for a positive fact condition, matching review_check's initial
// presence test; actions and negated/count conditions do not add that requirement.
export function required_fact_types(rules) {
    const rows = new Map();
    const add = (type, rule_id, observation_required) => {
        if (!rows.has(type)) {
            rows.set(type, { type, rule_ids: new Set(), observation_required: false });
        }
        const row = rows.get(type);
        row.rule_ids.add(rule_id);
        row.observation_required ||= observation_required;
    };
    for (const rule of Array.isArray(rules) ? rules : []) {
        const rule_id = typeof rule?.id === "string" ? rule.id : "?";
        for (const condition of Array.isArray(rule?.when) ? rule.when : []) {
            const pattern = condition?.fact ?? condition?.count?.fact;
            const type = literal_type(pattern);
            if (type) {
                add(type, rule_id, Boolean(condition?.fact && !condition.not));
            }
        }
        for (const action of Array.isArray(rule?.then) ? rule.then : []) {
            const pattern = action?.assert ?? action?.retract;
            const type = literal_type(pattern);
            if (type) {
                add(type, rule_id, false);
            }
        }
    }
    return [...rows.values()]
        .map((row) => ({ type: row.type, rule_ids: [...row.rule_ids].sort(), observation_required: row.observation_required }))
        .sort((left, right) => left.type.localeCompare(right.type));
}

function condition_patterns(rules) {
    return (Array.isArray(rules) ? rules : []).flatMap((rule) => (Array.isArray(rule?.when) ? rule.when : [])
        .map((condition) => condition?.fact ?? condition?.count?.fact)
        .filter(Boolean));
}

// check_readiness mirrors review_check's conservative input gates. It never
// evaluates rules or records a check; ready only means the core would receive a
// nonempty, relevant, field-complete fact snapshot.
export function check_readiness(rules, facts) {
    const observations = Array.isArray(facts) ? facts : [];
    const required = required_fact_types(rules);
    const missing_types = required
        .filter((row) => row.observation_required)
        .filter((row) => !observations.some((fact) => fact.type === row.type))
        .map((row) => row.type);
    const patterns = condition_patterns(rules);
    const missing_fields = [];
    for (const pattern of patterns) {
        const type = literal_type(pattern);
        if (!type) {
            continue;
        }
        for (const fact of observations.filter((item) => item.type === type)) {
            for (const field of Object.keys(pattern).filter((key) => key !== "type")) {
                if (!Object.hasOwn(fact, field) && !missing_fields.includes(`${type}.${field}`)) {
                    missing_fields.push(`${type}.${field}`);
                }
            }
        }
    }
    const relevant = patterns.length === 0 || patterns.some((pattern) => {
        const type = literal_type(pattern);
        return type !== null && observations.some((fact) => fact.type === type);
    });
    let reason = "";
    if (observations.length === 0) {
        reason = "The selected scope contains no observations.";
    } else if (missing_types.length > 0) {
        reason = `The selected scope lacks required fact types: ${missing_types.join(", ")}. Choose a broader or different scope.`;
    } else if (missing_fields.length > 0) {
        reason = `The selected scope lacks required fields: ${missing_fields.join(", ")}. Those observations are incomplete for these rules.`;
    } else if (!relevant) {
        reason = "The selected scope has no observations relevant to these rules.";
    }
    return {
        ready: reason === "",
        blocked: reason !== "",
        reason,
        missing_types,
        missing_fields,
        fact_count: observations.length,
    };
}

export function evaluation_summary(result) {
    const emitted = Array.isArray(result?.emitted) ? result.emitted : [];
    return {
        firings: number_of(result?.firings),
        emission_count: emitted.length,
        has_violations: emitted.length > 0,
        completed: true,
    };
}
