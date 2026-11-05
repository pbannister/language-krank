#!/usr/bin/env node
// ruleset-command.mjs — run or render a rule set from a file.
//
// Usage:
//   node sources/ruleset-command.mjs run    <ruleset.json>
//   node sources/ruleset-command.mjs render <ruleset.json>
//
// The tool never prompts: it takes everything from its arguments, fails closed
// on a missing file or invalid input, and exits nonzero on error.

import { readFileSync } from "node:fs";
import { ruleset_run } from "./ruleset-run.mjs";
import { ruleset_render } from "./ruleset-render.mjs";

function usage() {
  return "usage: node sources/ruleset-command.mjs run <ruleset.json> | render <ruleset.json>";
}

function fail(message) {
  console.error(`krank: ${message}`);
  process.exit(1);
}

const [command, file] = process.argv.slice(2);
if (!command || !file) {
  console.error(usage());
  process.exit(2);
}

let text;
try {
  text = readFileSync(file, "utf8");
} catch (error) {
  fail(`cannot read ${file}: ${error.message}`);
}

let ruleset;
try {
  ruleset = JSON.parse(text);
} catch (error) {
  fail(`${file} is not valid JSON: ${error.message}`);
}

if (command === "run") {
  try {
    const result = ruleset_run(ruleset);
    process.stdout.write(
      `${JSON.stringify({ facts: result.facts, emitted: result.emitted, firings: result.firings }, null, 2)}\n`,
    );
  } catch (error) {
    fail(error.message);
  }
} else if (command === "render") {
  process.stdout.write(`${ruleset_render(ruleset)}\n`);
} else {
  console.error(usage());
  process.exit(2);
}
