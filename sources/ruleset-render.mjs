// ruleset-render.mjs — render a rule set back into readable prose.
//
// This is step 2 of the round trip in documents/10-rule-notation.md. The output
// is deterministic, so the same rule set always renders to the same prose and a
// reviewer can compare it to the original intent.

import { is_operator, is_variable } from "./ruleset-run.mjs";

const OPERATOR_WORDS = {
    eq: "equal to",
    ne: "not equal to",
    lt: "less than",
    lte: "at most",
    gt: "greater than",
    gte: "at least",
    in: "in",
    prefix: "starting with",
};

function operand_render(operand) {
    if (is_variable(operand)) {
        return operand;
    }
    if (Array.isArray(operand)) {
        const items = operand.map((item) => (typeof item === "string" ? `"${item}"` : JSON.stringify(item)));
        return `[${items.join(", ")}]`;
    }
    if (typeof operand === "string") {
        return `"${operand}"`;
    }
    return JSON.stringify(operand);
}

// value_render renders a scalar, a $variable, or an operator phrase.
function value_render(value) {
    if (is_variable(value)) {
        return value;
    }
    if (is_operator(value)) {
        return Object.entries(value)
            .map(([operator, operand]) => `${OPERATOR_WORDS[operator]} ${operand_render(operand)}`)
            .join(" and ");
    }
    if (typeof value === "string") {
        return `"${value}"`;
    }
    return JSON.stringify(value);
}

// fact_noun is the noun a fact phrase leads with: its type, or "fact".
function fact_noun(fact) {
    return "type" in fact ? String(fact.type) : "fact";
}

// fact_article is the article ("a" or "an") that precedes a fact's noun.
function fact_article(fact) {
    return /^[aeiou]/i.test(fact_noun(fact)) ? "an" : "a";
}

// fact_phrase renders a fact or pattern as a noun phrase without an article.
export function fact_phrase(fact) {
    const keys = Object.keys(fact);
    if (keys.length === 0) {
        return "fact";
    }
    if ("type" in fact) {
        const rest = keys.filter((key) => key !== "type");
        if (rest.length === 0) {
            return String(fact.type);
        }
        const attributes = rest.map((key) => `${key} ${value_render(fact[key])}`).join(" and ");
        return `${fact.type} with ${attributes}`;
    }
    const attributes = keys.map((key) => `${key} ${value_render(fact[key])}`).join(" and ");
    return `fact with ${attributes}`;
}

// fact_render renders a fact or pattern with an article.
export function fact_render(fact) {
    return `${fact_article(fact)} ${fact_phrase(fact)}`;
}

export function condition_render(condition) {
    if (condition.count) {
        const { fact, at_least, at_most } = condition.count;
        const bounds = [];
        if (at_least !== undefined) {
            bounds.push(`at least ${at_least}`);
        }
        if (at_most !== undefined) {
            bounds.push(`at most ${at_most}`);
        }
        return `${bounds.join(" and ")} ${fact_phrase(fact)}`;
    }
    if (condition.not) {
        return `there is no ${fact_phrase(condition.fact)}`;
    }
    return `there is ${fact_render(condition.fact)}`;
}

export function action_render(action) {
    if ("assert" in action) {
        return `assert ${fact_render(action.assert)}`;
    }
    if ("retract" in action) {
        return `retract every fact matching ${fact_render(action.retract)}`;
    }
    if ("emit" in action) {
        return `emit ${value_render(action.emit)}`;
    }
    return "an unknown action";
}

export function rule_render(rule) {
    const priority = "priority" in rule ? ` (priority ${rule.priority})` : "";
    const when = rule.when.map(condition_render).join(" and ");
    const then = rule.then.map(action_render).join(", and ");
    return `Rule "${rule.id}"${priority}: when ${when}, then ${then}.`;
}

export function ruleset_render(ruleset) {
    const fact_lines = (ruleset.facts ?? []).map((fact) => `- ${fact_render(fact)}`);
    const rule_lines = (ruleset.rules ?? []).map(rule_render);
    const parts = [];
    if (fact_lines.length > 0) {
        parts.push(`Facts:\n${fact_lines.join("\n")}`);
    }
    if (rule_lines.length > 0) {
        parts.push(`Rules:\n${rule_lines.join("\n\n")}`);
    }
    return parts.join("\n\n");
}
