// render.mjs — render a rule set back into readable prose.
//
// This is step 2 of the round trip in documents/10-rule-notation.md. The output
// is deterministic, so the same rule set always renders to the same prose and a
// reviewer can compare it to the original intent.

function renderValue(value) {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  return JSON.stringify(value);
}

// headNoun is the noun a fact phrase leads with: its type, or "fact".
function headNoun(fact) {
  return "type" in fact ? String(fact.type) : "fact";
}

function articleFor(fact) {
  return /^[aeiou]/i.test(headNoun(fact)) ? "an" : "a";
}

// bareFact renders a fact or pattern as a noun phrase without an article.
export function bareFact(fact) {
  const keys = Object.keys(fact);
  if (keys.length === 0) {
    return "fact";
  }
  if ("type" in fact) {
    const rest = keys.filter((key) => key !== "type");
    if (rest.length === 0) {
      return String(fact.type);
    }
    const attributes = rest.map((key) => `${key} ${renderValue(fact[key])}`).join(" and ");
    return `${fact.type} with ${attributes}`;
  }
  const attributes = keys.map((key) => `${key} ${renderValue(fact[key])}`).join(" and ");
  return `fact with ${attributes}`;
}

// renderFact renders a fact or pattern with an article.
export function renderFact(fact) {
  return `${articleFor(fact)} ${bareFact(fact)}`;
}

export function renderCondition(condition) {
  if (condition.not) {
    return `there is no ${bareFact(condition.fact)}`;
  }
  return `there is ${renderFact(condition.fact)}`;
}

export function renderAction(action) {
  if ("assert" in action) {
    return `assert ${renderFact(action.assert)}`;
  }
  if ("retract" in action) {
    return `retract every fact matching ${renderFact(action.retract)}`;
  }
  if ("emit" in action) {
    return `emit ${renderValue(action.emit)}`;
  }
  return "an unknown action";
}

export function renderRule(rule) {
  const when = rule.when.map(renderCondition).join(" and ");
  const then = rule.then.map(renderAction).join(", and ");
  return `Rule "${rule.id}": when ${when}, then ${then}.`;
}

export function renderRuleset(ruleset) {
  const factLines = (ruleset.facts ?? []).map((fact) => `- ${renderFact(fact)}`);
  const ruleLines = (ruleset.rules ?? []).map(renderRule);
  const parts = [];
  if (factLines.length > 0) {
    parts.push(`Facts:\n${factLines.join("\n")}`);
  }
  if (ruleLines.length > 0) {
    parts.push(`Rules:\n${ruleLines.join("\n\n")}`);
  }
  return parts.join("\n\n");
}
