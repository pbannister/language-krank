// 26-browser-demo.test.mjs — node:test cases for the browser demo.
// Invoked by tests/26-browser-demo.sh.
//
// There is no headless browser here, so the test checks the wiring: each page
// loads its module, each module imports the browser-safe barrel and no node:
// builtin, and the demo data (the playground sample and the round-trip cases)
// is valid and runs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ruleset_render, ruleset_run } from "../sources/krank.mjs";

const root = new URL("..", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");

test("the playground sample is a valid rule set that runs", () => {
    const sample = JSON.parse(read("sources/browser/sample.json"));
    const result = ruleset_run(sample);
    assert.ok(result.firings > 0, "the sample fired nothing");
    assert.ok(result.emitted.length > 0, "the sample emitted nothing");
});

test("every demo module imports the barrel and no node: builtin", () => {
    for (const rel of ["sources/browser/demo.mjs", "sources/browser/round-trip.mjs"]) {
        const text = read(rel);
        assert.match(text, /from "\.\.\/krank\.mjs"/, `${rel} does not import the barrel`);
        assert.ok(!/from\s+["']node:/.test(text), `${rel} imports a node: builtin`);
    }
});

test("each page loads its module", () => {
    assert.match(
        read("sources/browser/index.html"),
        /<script type="module" src="\.\/round-trip\.mjs"><\/script>/,
    );
    assert.match(
        read("sources/browser/playground.html"),
        /<script type="module" src="\.\/demo\.mjs"><\/script>/,
    );
});

test("the round-trip page shows the requested sections", () => {
    const html = read("sources/browser/index.html");
    for (const id of ["original", "rules", "rendered", "comparison", "result"]) {
        assert.ok(html.includes(`id="${id}"`), `the page has no #${id}`);
    }
});

test("every comparison case names a rule that renders and runs", () => {
    const ruleset = JSON.parse(read("dataflow.in/round-trip.json"));
    const bundle = JSON.parse(read("sources/browser/cases.json"));
    const ids = new Set(ruleset.rules.map((rule) => rule.id));
    const prose = ruleset_render(ruleset);
    assert.ok(bundle.cases.length > 0, "the bundle has no cases");
    for (const item of bundle.cases) {
        assert.ok(ids.has(item.rule), `case rule ${item.rule} is not in the rule set`);
        assert.ok(prose.includes(`Rule "${item.rule}"`), `case rule ${item.rule} has no rendered line`);
        assert.ok(item.original.length > 0, `case ${item.rule} has no original prose`);
        assert.ok(item.verdict.length > 0, `case ${item.rule} has no verdict`);
        assert.ok(item.note.length > 0, `case ${item.rule} has no note`);
    }
});
