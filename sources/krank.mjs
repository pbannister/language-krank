// krank.mjs — the public library surface.
//
// This barrel re-exports the browser-safe modules only. The command-line tool
// (ruleset-command.mjs) is deliberately absent, because it imports node:fs and
// would break a browser import of this package.

export {
  keys_sort,
  fact_key,
  is_match,
  is_variable,
  variable_name,
  is_operator,
  ruleset_run,
} from "./ruleset-run.mjs";
export {
  fact_phrase,
  fact_render,
  condition_render,
  action_render,
  rule_render,
  ruleset_render,
} from "./ruleset-render.mjs";
