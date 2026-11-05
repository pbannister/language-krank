// 26-browser-demo.test.mjs — node:test cases for the browser demo.
// Invoked by tests/26-browser-demo.sh.
//
// There is no headless browser here, so the test checks the wiring: each page
// loads its module, each module imports the browser-safe barrel and no node:
// builtin, and the build-time data (the compile catalog and the file facts) is
// valid and drives the engine. The check workflow is exercised end to end: the
// Conventions rules must report the template's 2-space indent.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ruleset_render, ruleset_run } from "../sources/krank.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");
const build = (script) => JSON.parse(execFileSync(process.execPath, [`${root}scripts/${script}`], {
    cwd: root,
    encoding: "utf8",
}));

test("the playground sample is a valid rule set that runs", () => {
    const sample = JSON.parse(read("sources/browser/sample.json"));
    const result = ruleset_run(sample);
    assert.ok(result.firings > 0, "the sample fired nothing");
    assert.ok(result.emitted.length > 0, "the sample emitted nothing");
});

test("every demo module imports the barrel and no node: builtin", () => {
    for (const rel of ["sources/browser/demo.mjs", "sources/browser/catalog.mjs"]) {
        const text = read(rel);
        assert.match(text, /from "\.\.\/krank\.mjs"/, `${rel} does not import the barrel`);
        assert.ok(!/from\s+["']node:/.test(text), `${rel} imports a node: builtin`);
    }
});

test("each page loads its module", () => {
    assert.match(read("sources/browser/index.html"), /src="\.\/catalog\.mjs"/);
    assert.match(read("sources/browser/playground.html"), /src="\.\/demo\.mjs"/);
});

test("the compile page carries the compile and check sections", () => {
    const html = read("sources/browser/index.html");
    for (const id of ["prompt", "rules", "rendered", "comparison", "reduced", "download", "scope", "run", "output"]) {
        assert.ok(html.includes(`id="${id}"`), `the page has no #${id}`);
    }
});

test("the catalog renders every rule and its prose is in the source", () => {
    const catalog = build("site-catalog.mjs");
    assert.ok(catalog.entries.length >= 2, "the catalog has too few entries");
    for (const entry of catalog.entries) {
        assert.ok(entry.markdown.length > 0, `${entry.id} has no prompt text`);
        assert.ok(entry.rules.rules.length > 0, `${entry.id} has no rules`);
        const prose = ruleset_render(entry.rules);
        for (const item of entry.cases) {
            assert.ok(prose.includes(`Rule "${item.rule}"`), `${entry.id}: ${item.rule} is not rendered`);
            if ((item.source ?? entry.source) === entry.source) {
                assert.ok(
                    entry.markdown.includes(item.original),
                    `${entry.id}: the source does not contain "${item.original}"`,
                );
            }
        }
    }
});

test("the file facts cover the library, and a clean file has no finding", () => {
    const catalog = build("site-catalog.mjs");
    const facts = build("site-facts.mjs");
    assert.ok(facts.files.some((file) => file.path === "sources/krank.mjs"));
    assert.ok(facts.files.every((file) => file.facts.path === file.path));

    const conventions = catalog.entries.find((entry) => entry.id === "conventions");
    const clean = facts.files.find((file) => file.path === "sources/krank.mjs");
    const result = ruleset_run({ facts: [{ type: "file", ...clean.facts }], rules: conventions.rules.rules });
    assert.equal(result.emitted.length, 0, "a conforming file produced a finding");
});

test("the conventions rules report the template's 2-space indent", () => {
    const catalog = build("site-catalog.mjs");
    const facts = build("site-facts.mjs");
    const conventions = catalog.entries.find((entry) => entry.id === "conventions");
    const template = facts.files.find((file) => file.path === "site.in/template.html");
    assert.equal(template.facts.indent_unit, 2);
    const result = ruleset_run({ facts: [{ type: "file", ...template.facts }], rules: conventions.rules.rules });
    assert.ok(result.emitted.some((item) => item.violation === "indent"), "the indent rule did not fire");
});
