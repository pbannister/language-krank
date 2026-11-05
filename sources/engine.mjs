// engine.mjs — a small, readable forward-chaining production-rule interpreter.
//
// A rule set is a JSON document: { facts: [FACT...], rules: [RULE...] }.
// The notation and semantics are defined in documents/10-rule-notation.md.
//
// The engine is deterministic: rules fire in document order, a rule binding
// fires at most once, and assert/retract change the fact set for later scans.

// sortKeys returns a deep copy with object keys sorted, so equal facts with
// different key order produce the same key.
export function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

// factKey is the canonical identity of a fact: two facts are the same fact when
// their keys and values are equal, regardless of key order.
export function factKey(fact) {
  return JSON.stringify(sortKeys(fact));
}

// matches reports whether fact satisfies pattern by subset equality: every key
// in the pattern has an equal value in the fact.
export function matches(fact, pattern) {
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
    if (condition.not && facts.some((fact) => matches(fact, condition.fact))) {
      return;
    }
  }

  const positive = rule.when.filter((condition) => !condition.not);
  const matchesPer = positive.map((condition) =>
    facts.filter((fact) => matches(fact, condition.fact)),
  );
  for (const list of matchesPer) {
    if (list.length === 0) {
      return;
    }
  }

  const indexes = new Array(matchesPer.length).fill(0);
  for (;;) {
    yield matchesPer.map((list, i) => list[indexes[i]]);
    let column = matchesPer.length - 1;
    for (;;) {
      if (column < 0) {
        return;
      }
      indexes[column] += 1;
      if (indexes[column] < matchesPer[column].length) {
        break;
      }
      indexes[column] = 0;
      column -= 1;
    }
  }
}

function assertShape(rule) {
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

// run evaluates a rule set and returns { facts, emitted, trace, firings }.
// options.maxFirings caps the number of firings (default 10000) so a rule set
// that never reaches a fixpoint fails with an error instead of running forever.
export function run(ruleset, options = {}) {
  const maxFirings = options.maxFirings ?? 10000;
  let facts = Array.isArray(ruleset.facts) ? ruleset.facts.map((fact) => ({ ...fact })) : [];
  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];

  for (const rule of rules) {
    assertShape(rule);
  }

  const assertFact = (fact) => {
    const key = factKey(fact);
    if (facts.some((existing) => factKey(existing) === key)) {
      return false;
    }
    facts.push({ ...fact });
    return true;
  };

  const retractFact = (pattern) => {
    const before = facts.length;
    facts = facts.filter((fact) => !matches(fact, pattern));
    return before - facts.length;
  };

  const fired = new Set();
  const emitted = [];
  const trace = [];
  let firings = 0;

  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      let firedAny = false;
      for (const binding of bindings(rule, facts)) {
        const key = rule.id + "|" + binding.map(factKey).sort().join(",");
        if (fired.has(key)) {
          continue;
        }
        fired.add(key);
        firings += 1;
        if (firings > maxFirings) {
          throw new Error(`rule engine did not reach a fixpoint within ${maxFirings} firings`);
        }

        const entry = { rule: rule.id, matched: binding.map((fact) => ({ ...fact })), effects: [] };
        for (const action of rule.then) {
          if ("assert" in action) {
            const added = assertFact(action.assert);
            entry.effects.push(`assert ${factKey(action.assert)}${added ? "" : " (already present)"}`);
          } else if ("retract" in action) {
            const removed = retractFact(action.retract);
            entry.effects.push(`retract ${removed} fact(s) matching ${JSON.stringify(action.retract)}`);
          } else if ("emit" in action) {
            emitted.push(action.emit);
            entry.effects.push(`emit ${JSON.stringify(action.emit)}`);
          } else {
            throw new Error(`rule "${rule.id}" has an action with no assert, retract, or emit`);
          }
        }
        trace.push(entry);
        firedAny = true;
        break;
      }
      if (firedAny) {
        changed = true;
        break;
      }
    }
  }

  return { facts, emitted, trace, firings };
}
