// ruleset-run.mjs — a small, readable forward-chaining production-rule interpreter.
//
// A rule set is a JSON document: { facts: [FACT...], rules: [RULE...] }.
// The notation and semantics are defined in documents/10-rule-notation.md.
//
// The engine is deterministic: rules fire in document order, a rule binding
// fires at most once, and assert/retract change the fact set for later scans.

const OPERATORS = new Set(["eq", "ne", "lt", "lte", "gt", "gte", "in"]);
const VARIABLE_PATTERN = /^\$[A-Za-z_][A-Za-z0-9_]*$/;

// is_variable reports whether a value is a variable reference such as "$name".
export function is_variable(value) {
  return typeof value === "string" && VARIABLE_PATTERN.test(value);
}

// variable_name returns the name of a variable reference, without the "$".
export function variable_name(value) {
  return value.slice(1);
}

// is_operator reports whether a value is an operator object: a non-empty,
// non-array object whose keys are all known operators.
export function is_operator(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => OPERATORS.has(key));
}

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
// in the pattern has an equal value in the fact. It does not bind variables or
// evaluate operators; the engine matches patterns with its own matcher.
export function is_match(fact, pattern) {
  for (const key of Object.keys(pattern)) {
    if (!Object.is(fact[key], pattern[key])) {
      return false;
    }
  }
  return true;
}

function is_number(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// resolve_operand returns the value of an operand: a $variable is looked up in
// the bindings, and any other value is returned as-is.
function resolve_operand(operand, bindings) {
  if (is_variable(operand)) {
    const name = variable_name(operand);
    if (!(name in bindings)) {
      throw new Error(`unbound variable ${operand} used as an operand`);
    }
    return bindings[name];
  }
  return operand;
}

// test_operator reports whether actual satisfies one operator expression.
function test_operator(operator, operand, actual, bindings) {
  if (operator === "in") {
    const list = resolve_operand(operand, bindings);
    if (!Array.isArray(list)) {
      throw new Error('the "in" operand must be an array or a $variable bound to one');
    }
    return list.some((item) => Object.is(item, actual));
  }
  const expected = resolve_operand(operand, bindings);
  switch (operator) {
    case "eq":
      return Object.is(actual, expected);
    case "ne":
      return !Object.is(actual, expected);
    case "lt":
      return is_number(actual) && is_number(expected) && actual < expected;
    case "lte":
      return is_number(actual) && is_number(expected) && actual <= expected;
    case "gt":
      return is_number(actual) && is_number(expected) && actual > expected;
    case "gte":
      return is_number(actual) && is_number(expected) && actual >= expected;
    default:
      throw new Error(`unknown operator: ${operator}`);
  }
}

// unify matches a pattern against a fact, extending the bindings. It returns the
// extended bindings, or null when the fact does not match. When allow_new is
// false (a negated condition), a pattern variable that is not already bound
// fails the match rather than binding.
function unify(pattern, fact, bindings, allow_new) {
  const extended = { ...bindings };
  for (const key of Object.keys(pattern)) {
    if (!(key in fact)) {
      return null;
    }
    const spec = pattern[key];
    const actual = fact[key];
    if (is_variable(spec)) {
      const name = variable_name(spec);
      if (name in extended) {
        if (!Object.is(extended[name], actual)) {
          return null;
        }
      } else if (allow_new) {
        extended[name] = actual;
      } else {
        return null;
      }
      continue;
    }
    if (is_operator(spec)) {
      for (const [operator, operand] of Object.entries(spec)) {
        if (!test_operator(operator, operand, actual, extended)) {
          return null;
        }
      }
      continue;
    }
    if (spec !== null && typeof spec === "object") {
      throw new Error(`a pattern value must be a scalar, a $variable, or an operator: ${JSON.stringify(spec)}`);
    }
    if (!Object.is(actual, spec)) {
      return null;
    }
  }
  return extended;
}

// bindings yields every match of the rule's conditions, in canonical order.
// A binding carries the matched facts and the variable assignments.
function* bindings(rule, facts) {
  yield* extend_conditions(rule.when, 0, facts, { matched: [], vars: {} });
}

function* extend_conditions(conditions, index, facts, state) {
  if (index === conditions.length) {
    yield { facts: state.matched, vars: state.vars };
    return;
  }
  const condition = conditions[index];
  if (condition.not) {
    for (const fact of facts) {
      if (unify(condition.fact, fact, state.vars, false) !== null) {
        return;
      }
    }
    yield* extend_conditions(conditions, index + 1, facts, state);
    return;
  }
  for (const fact of facts) {
    const extended = unify(condition.fact, fact, state.vars, true);
    if (extended !== null) {
      yield* extend_conditions(conditions, index + 1, facts, {
        matched: [...state.matched, fact],
        vars: extended,
      });
    }
  }
}

// scan_pattern checks a pattern and records the variables it binds.
function scan_pattern(rule_id, pattern, is_negated, bound) {
  for (const spec of Object.values(pattern)) {
    if (is_variable(spec)) {
      const name = variable_name(spec);
      if (bound.has(name)) {
        continue;
      }
      if (is_negated) {
        throw new Error(`rule "${rule_id}": a negated condition may not bind a new variable ${spec}`);
      }
      bound.add(name);
      continue;
    }
    if (is_operator(spec)) {
      for (const [operator, operand] of Object.entries(spec)) {
        scan_operand(rule_id, operator, operand, bound);
      }
      continue;
    }
    if (spec !== null && typeof spec === "object") {
      throw new Error(`rule "${rule_id}": a pattern value must be a scalar, a $variable, or an operator: ${JSON.stringify(spec)}`);
    }
  }
}

function scan_operand(rule_id, operator, operand, bound) {
  if (is_variable(operand)) {
    const name = variable_name(operand);
    if (!bound.has(name)) {
      throw new Error(`rule "${rule_id}": unbound variable ${operand} in an "${operator}" operand`);
    }
    return;
  }
  if (operator === "in") {
    if (!Array.isArray(operand)) {
      throw new Error(`rule "${rule_id}": the "in" operand must be an array or a bound $variable`);
    }
    for (const item of operand) {
      if (item !== null && typeof item === "object") {
        throw new Error(`rule "${rule_id}": an "in" list must contain only scalars`);
      }
    }
    return;
  }
  if (operand !== null && typeof operand === "object") {
    throw new Error(`rule "${rule_id}": an "${operator}" operand must be a scalar or a $variable`);
  }
}

function scan_action(rule_id, action, bound) {
  if (action === null || typeof action !== "object" || Array.isArray(action)) {
    throw new Error(`rule "${rule_id}": every action must be an object`);
  }
  const keys = Object.keys(action);
  if (keys.length !== 1) {
    throw new Error(`rule "${rule_id}": every action must have exactly one of assert, retract, emit`);
  }
  const kind = keys[0];
  const template = action[kind];
  if (kind === "assert" || kind === "retract") {
    if (template === null || typeof template !== "object" || Array.isArray(template)) {
      throw new Error(`rule "${rule_id}": "${kind}" needs a fact object`);
    }
    for (const value of Object.values(template)) {
      if (is_variable(value)) {
        const name = variable_name(value);
        if (!bound.has(name)) {
          throw new Error(`rule "${rule_id}": unbound variable ${value} in a "${kind}" action`);
        }
      } else if (value !== null && typeof value === "object") {
        throw new Error(`rule "${rule_id}": a "${kind}" fact value must be a scalar or a $variable`);
      }
    }
  } else if (kind === "emit") {
    scan_emit(rule_id, template, bound);
  } else {
    throw new Error(`rule "${rule_id}" has an action with no assert, retract, or emit`);
  }
}

function scan_emit(rule_id, value, bound) {
  if (is_variable(value)) {
    const name = variable_name(value);
    if (!bound.has(name)) {
      throw new Error(`rule "${rule_id}": unbound variable ${value} in an "emit" action`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      scan_emit(rule_id, item, bound);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) {
      scan_emit(rule_id, item, bound);
    }
  }
}

// rule_validate checks a rule's shape and its variable usage before matching,
// so a bad rule fails with a precise message rather than a silent no-match.
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
  const bound = new Set();
  for (const condition of rule.when) {
    if (
      condition === null ||
      typeof condition !== "object" ||
      Array.isArray(condition) ||
      condition.fact === null ||
      typeof condition.fact !== "object" ||
      Array.isArray(condition.fact)
    ) {
      throw new Error(`rule "${rule.id}": every condition needs a "fact" object pattern`);
    }
    scan_pattern(rule.id, condition.fact, condition.not === true, bound);
  }
  for (const action of rule.then) {
    scan_action(rule.id, action, bound);
  }
}

// substitute replaces every $variable in a template with its bound value.
function substitute(value, bindings) {
  if (is_variable(value)) {
    const name = variable_name(value);
    if (!(name in bindings)) {
      throw new Error(`unbound variable ${value}`);
    }
    return bindings[name];
  }
  if (Array.isArray(value)) {
    return value.map((item) => substitute(item, bindings));
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = substitute(item, bindings);
    }
    return out;
  }
  return value;
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
        const key =
          rule.id +
          "|" +
          binding.facts.map(fact_key).sort().join(",") +
          "|" +
          JSON.stringify(keys_sort(binding.vars));
        if (fired_bindings.has(key)) {
          continue;
        }
        fired_bindings.add(key);
        firings += 1;
        if (firings > firings_max) {
          throw new Error(`rule engine did not reach a fixpoint within ${firings_max} firings`);
        }

        const entry = {
          rule: rule.id,
          matched: binding.facts.map((fact) => ({ ...fact })),
          vars: { ...binding.vars },
          effects: [],
        };
        for (const action of rule.then) {
          if ("assert" in action) {
            const fact = substitute(action.assert, binding.vars);
            const added = fact_assert(fact);
            entry.effects.push(`assert ${fact_key(fact)}${added ? "" : " (already present)"}`);
          } else if ("retract" in action) {
            const pattern = substitute(action.retract, binding.vars);
            const removed = fact_retract(pattern);
            entry.effects.push(`retract ${removed} fact(s) matching ${JSON.stringify(pattern)}`);
          } else if ("emit" in action) {
            const value = substitute(action.emit, binding.vars);
            emitted.push(value);
            entry.effects.push(`emit ${JSON.stringify(value)}`);
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
