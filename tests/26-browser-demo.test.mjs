// 26-browser-demo.test.mjs — node:test cases for the browser demo.
// Invoked by tests/26-browser-demo.sh.
//
// There is no headless browser here, so the test checks the wiring: the page
// loads the demo as a module, the demo imports the browser-safe barrel and no
// node: builtin, and the sample rule set runs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ruleset_run } from "../sources/krank.mjs";

const root = new URL("..", import.meta.url);

test("the demo sample is a valid rule set that runs", () => {
    const sample = JSON.parse(readFileSync(new URL("sources/browser/sample.json", root), "utf8"));
    const result = ruleset_run(sample);
    assert.ok(result.firings > 0, "the sample fired nothing");
    assert.ok(result.emitted.length > 0, "the sample emitted nothing");
});

test("the demo imports the barrel and no node: builtin", () => {
    const text = readFileSync(new URL("sources/browser/demo.mjs", root), "utf8");
    assert.match(text, /from "\.\.\/krank\.mjs"/);
    assert.ok(!/from\s+["']node:/.test(text), "demo.mjs imports a node: builtin");
    assert.ok(text.includes("ruleset_run"));
    assert.ok(text.includes("ruleset_render"));
});

test("the page loads the demo as a module", () => {
    const html = readFileSync(new URL("sources/browser/index.html", root), "utf8");
    assert.match(html, /<script type="module" src="\.\/demo\.mjs"><\/script>/);
});
