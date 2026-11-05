// ruleset-run.mjs — a small, readable forward-chaining production-rule interpreter.
//
// A rule set is a JSON document: { facts: [FACT...], rules: [RULE...] }.
// The notation and semantics are defined in documents/10-rule-notation.md.
//
// The engine is deterministic: rules fire in document order, a rule binding
// fires at most once, and assert/retract change the fact set for later scans.

// keys_sort returns a deep copy with object keys sorted, so equal facts with
// different key order produce the same key.
export function keys_sort(value) {
  if (Array.isArray(value)) {
    return value.map(keys_sort);
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = keys_sort(value[key]);
    }
    return out;
  }
  return value;
}

// fact_key is the canonical identity of a fact: two facts are the same fact when
// their keys and values are equal, regardless of key order.
export function fact_key(fact) {
  return JSON.stringify(keys_sort(fact));
}

// is_match reports whether fact satisfies pattern by subset equality: every key
// in the pattern has an equal value in the fact.
export function is_match(fact, pattern) {
  for (const key of Object.keys(pattern)) {
    if (!Object.is(fact[key], pattern[key])) {
      return false;
    }
  }
  return true;
}

// bindings yields every way the rule's conditions hold, in canonical order.
// A binding is the list of facts satisfying each positive condition in order.
// Negative conditions are checked first: if any negative condition has a match,
// the rule has no binding at all.
function* bindings(rule, facts) {
  for (const condition of rule.when) {
    if (condition.not && facts.some((fact) => is_match(fact, condition.fact))) {
      return;
    }
  }

  const positive = rule.when.filter((condition) => !condition.not);
  const condition_matches = positive.map((condition) =>
    facts.filter((fact) => is_match(fact, condition.fact)),
  );
  for (const list of condition_matches) {
    if (list.length === 0) {
      return;
    }
  }

  const indexes = new Array(condition_matches.length).fill(0);
  for (;;) {
    yield condition_matches.map((list, i) => list[indexes[i]]);
    let column = condition_matches.length - 1;
    for (;;) {
      if (column < 0) {
        return;
      }
      indexes[column] += 1;
      if (indexes[column] < condition_matches[column].length) {
        break;
      }
      indexes[column] = 0;
      column -= 1;
    }
  }
}

// rule_validate checks that a rule has the required shape: a string id, and
// `when` and `then` arrays.
function rule_validate(rule) {
  if (typeof rule.id !== "string" || rule.id === "") {
    throw new Error("every rule needs a non-empty string id");
  }
  if (!Array.isArray(rule.when)) {
    throw new Error(`rule "${rule.id}" needs a "when" array`);
  }
  if (!Array.isArray(rule.then)) {
    throw new Error(`rule "${rule.id}" needs a "then" array`);
  }
}

// ruleset_run evaluates a rule set and returns { facts, emitted, trace, firings }.
// options.firings_max caps the number of firings (default 10000) so a rule set
// that never reaches a fixpoint fails with an error instead of running forever.
export function ruleset_run(ruleset, options = {}) {
  const firings_max = options.firings_max ?? 10000;
  let facts = Array.isArray(ruleset.facts) ? ruleset.facts.map((fact) => ({ ...fact })) : [];
  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];

  for (const rule of rules) {
    rule_validate(rule);
  }

  const fact_assert = (fact) => {
    const key = fact_key(fact);
    if (facts.some((existing) => fact_key(existing) === key)) {
      return false;
    }
    facts.push({ ...fact });
    return true;
  };

  const fact_retract = (pattern) => {
    const before = facts.length;
    facts = facts.filter((fact) => !is_match(fact, pattern));
    return before - facts.length;
  };

  const fired_bindings = new Set();
  const emitted = [];
  const trace = [];
  let firings = 0;

  let is_changed = true;
  while (is_changed) {
    is_changed = false;
    for (const rule of rules) {
      let is_fired = false;
      for (const binding of bindings(rule, facts)) {
        const key = rule.id + "|" + binding.map(fact_key).sort().join(",");
        if (fired_bindings.has(key)) {
          continue;
        }
        fired_bindings.add(key);
        firings += 1;
        if (firings > firings_max) {
          throw new Error(`rule engine did not reach a fixpoint within ${firings_max} firings`);
        }

        const entry = { rule: rule.id, matched: binding.map((fact) => ({ ...fact })), effects: [] };
        for (const action of rule.then) {
          if ("assert" in action) {
            const added = fact_assert(action.assert);
            entry.effects.push(`assert ${fact_key(action.assert)}${added ? "" : " (already present)"}`);
          } else if ("retract" in action) {
            const removed = fact_retract(action.retract);
            entry.effects.push(`retract ${removed} fact(s) matching ${JSON.stringify(action.retract)}`);
          } else if ("emit" in action) {
            emitted.push(action.emit);
            entry.effects.push(`emit ${JSON.stringify(action.emit)}`);
          } else {
            throw new Error(`rule "${rule.id}" has an action with no assert, retract, or emit`);
          }
        }
        trace.push(entry);
        is_fired = true;
        break;
      }
      if (is_fired) {
        is_changed = true;
        break;
      }
    }
  }

  return { facts, emitted, trace, firings };
}
