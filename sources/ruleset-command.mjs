#!/usr/bin/env node
// ruleset-command.mjs — run, render, or check a rule set from files.
//
// Usage:
//   node sources/ruleset-command.mjs run    <ruleset.json>
//   node sources/ruleset-command.mjs render <ruleset.json>
//   node sources/ruleset-command.mjs check  <ruleset.json> [facts.json] [--fail-on-emit]
//
// `check` is the conformance entry point: the model (or a test) supplies the
// facts, the engine supplies the decision. The rules never enter the prompt; the
// model digests the emitted result. With --fail-on-emit, any emission makes the
// command exit nonzero, so it can gate a check.
//
// The tool never prompts: it takes everything from its arguments, fails closed
// on a missing file or invalid input, and exits nonzero on error.

import { readFileSync } from "node:fs";
import { ruleset_run } from "./ruleset-run.mjs";
import { ruleset_render } from "./ruleset-render.mjs";

function usage() {
    return [
        "usage:",
        "  node sources/ruleset-command.mjs run    <ruleset.json>",
        "  node sources/ruleset-command.mjs render <ruleset.json>",
        "  node sources/ruleset-command.mjs check  <ruleset.json> [facts.json] [--fail-on-emit]",
    ].join("\n");
}

function fail(message) {
    console.error(`krank: ${message}`);
    process.exit(1);
}

function read_json(file) {
    let text;
    try {
        text = readFileSync(file, "utf8");
    } catch (error) {
        fail(`cannot read ${file}: ${error.message}`);
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        fail(`${file} is not valid JSON: ${error.message}`);
    }
}

function facts_of(file) {
    const data = read_json(file);
    if (Array.isArray(data)) {
        return data;
    }
    if (Array.isArray(data.facts)) {
        return data.facts;
    }
    fail(`${file} must hold an array of facts or an object with a facts array`);
}

const args = process.argv.slice(2);
const command = args[0];
const positional = args.slice(1).filter((arg) => !arg.startsWith("--"));
const flags = new Set(args.slice(1).filter((arg) => arg.startsWith("--")));

if (!command || positional.length === 0) {
    console.error(usage());
    process.exit(2);
}

const ruleset = read_json(positional[0]);

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
} else if (command === "check") {
    const facts = positional[1] ? facts_of(positional[1]) : ruleset.facts;
    let result;
    try {
        result = ruleset_run({ facts, rules: ruleset.rules });
    } catch (error) {
        fail(error.message);
    }
    process.stdout.write(`${JSON.stringify({ firings: result.firings, emitted: result.emitted }, null, 2)}\n`);
    if (flags.has("--fail-on-emit") && result.emitted.length > 0) {
        process.exit(1);
    }
} else {
    console.error(usage());
    process.exit(2);
}
