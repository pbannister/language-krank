// candidate-diff.mjs — compare the formal rules of two candidate readings.
//
// A coverage comparison says which prose lines a reading cites. This helper
// compares the rule structures themselves, without ranking either reading.

function canonical_value(value) {
    if (Array.isArray(value)) {
        return `[${value.map(canonical_value).join(",")}]`;
    }
    if (value !== null && typeof value === "object") {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical_value(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}

function rule_map(candidate, label, errors) {
    const rules = candidate?.rules?.rules;
    if (!Array.isArray(rules)) {
        errors.push(`${label} has no rules array`);
        return new Map();
    }
    const map = new Map();
    for (const [index, rule] of rules.entries()) {
        if (rule === null || typeof rule !== "object" || Array.isArray(rule)) {
            errors.push(`${label} rule ${index + 1} is not an object`);
            continue;
        }
        if (typeof rule.id !== "string" || rule.id === "") {
            errors.push(`${label} rule ${index + 1} has no id`);
            continue;
        }
        if (map.has(rule.id)) {
            errors.push(`${label} repeats rule id ${rule.id}`);
            continue;
        }
        map.set(rule.id, rule);
    }
    return map;
}

// A malformed rule set cannot support a trustworthy structural comparison.
// Return an empty, invalid diff so the UI can say so rather than guess.
export function rule_diff(candidate, current) {
    const errors = [];
    const this_rules = rule_map(candidate, "This reading", errors);
    const current_rules = rule_map(current, "Current choice", errors);
    if (errors.length > 0) {
        return {
            valid: false,
            errors,
            shared: [],
            only_this: [],
            only_current: [],
            changed: [],
            order_changed: false,
            identical: false,
        };
    }
    const shared = [];
    const only_this = [];
    const only_current = [];
    const changed = [];
    for (const [id, rule] of this_rules) {
        if (!current_rules.has(id)) {
            only_this.push(id);
            continue;
        }
        shared.push(id);
        if (canonical_value(rule) !== canonical_value(current_rules.get(id))) {
            changed.push(id);
        }
    }
    for (const id of current_rules.keys()) {
        if (!this_rules.has(id)) {
            only_current.push(id);
        }
    }
    const this_shared_order = [...this_rules.keys()].filter((id) => current_rules.has(id));
    const current_shared_order = [...current_rules.keys()].filter((id) => this_rules.has(id));
    const order_changed = this_shared_order.some((id, index) => id !== current_shared_order[index]);
    return {
        valid: true,
        errors: [],
        shared,
        only_this,
        only_current,
        changed,
        order_changed,
        identical: only_this.length === 0 && only_current.length === 0
            && changed.length === 0 && !order_changed,
    };
}

export function rule_field_changes(candidate, current) {
    const errors = [];
    const this_rules = rule_map(candidate, "This reading", errors);
    const current_rules = rule_map(current, "Current choice", errors);
    if (errors.length > 0) {
        return [];
    }
    const changes = [];
    for (const [id, rule] of this_rules) {
        if (!current_rules.has(id)) {
            continue;
        }
        const other = current_rules.get(id);
        if (canonical_value(rule) === canonical_value(other)) {
            continue;
        }
        const fields = [];
        if (canonical_value(rule.when) !== canonical_value(other.when)) {
            fields.push("conditions");
        }
        if (canonical_value(rule.then) !== canonical_value(other.then)) {
            fields.push("actions");
        }
        if (canonical_value(rule.priority) !== canonical_value(other.priority)) {
            fields.push("priority");
        }
        const known = new Set(["id", "when", "then", "priority"]);
        if (Object.keys(rule).some((key) => !known.has(key)) || Object.keys(other).some((key) => !known.has(key))) {
            fields.push("other fields");
        }
        changes.push({ id, fields: fields.length > 0 ? fields : ["definition"] });
    }
    return changes;
}

function sorted_value(value) {
    if (Array.isArray(value)) {
        return value.map(sorted_value);
    }
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted_value(value[key])]));
    }
    return value;
}

export function rule_change_examples(candidate, current) {
    const errors = [];
    const this_rules = rule_map(candidate, "This reading", errors);
    const current_rules = rule_map(current, "Current choice", errors);
    if (errors.length > 0) {
        return [];
    }
    return rule_field_changes(candidate, current).map((change) => ({
        ...change,
        before: JSON.stringify(sorted_value(current_rules.get(change.id)), null, 2),
        after: JSON.stringify(sorted_value(this_rules.get(change.id)), null, 2),
    }));
}

export function display_order(candidates, current_id) {
    const list = Array.isArray(candidates) ? candidates : [];
    const current = list.find((item) => item?.id === current_id);
    if (!current) {
        return [...list];
    }
    return [current, ...list.filter((item) => item !== current)];
}

export function rule_diff_summary(diff) {
    if (!diff.valid) {
        return "Rules cannot be compared safely";
    }
    if (diff.identical) {
        return "Same rules";
    }
    const parts = [`${diff.shared.length} shared`];
    if (diff.only_this.length > 0) parts.push(`${diff.only_this.length} only here`);
    if (diff.only_current.length > 0) parts.push(`${diff.only_current.length} only current`);
    if (diff.changed.length > 0) parts.push(`${diff.changed.length} changed`);
    if (diff.order_changed) parts.push("order differs");
    return parts.join(" · ");
}
