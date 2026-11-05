// 26-browser-demo.test.mjs — node:test cases for the browser studio.
// Invoked by tests/26-browser-demo.sh.
//
// There is no headless browser here, so the test checks the wiring: each page
// loads its module, each module imports the browser-safe barrel and no node:
// builtin, the build-time data offers the candidate choice, the diff is correct,
// and the check command drives the engine. The check workflow is exercised end
// to end.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ruleset_render, ruleset_run } from "../sources/krank.mjs";
import { diff_lines } from "../sources/browser/prompt-diff.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");
const build = (script) => JSON.parse(execFileSync(process.execPath, [`${root}scripts/${script}`], {
    cwd: root,
    encoding: "utf8",
}));

function prompt_files(directory, files = []) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = `${directory}/${entry.name}`;
        if (entry.isDirectory()) {
            prompt_files(full, files);
        } else if (entry.name.endsWith(".md")) {
            files.push(relative(root, full));
        }
    }
    return files;
}

function candidates(catalog, id) {
    for (const entry of catalog.entries) {
        for (const candidate of entry.candidates) {
            if (candidate.id === id) {
                return candidate;
            }
        }
    }
    return undefined;
}

test("the playground sample is a valid rule set that runs", () => {
    const sample = JSON.parse(read("sources/browser/sample.json"));
    const result = ruleset_run(sample);
    assert.ok(result.firings > 0, "the sample fired nothing");
    assert.ok(result.emitted.length > 0, "the sample emitted nothing");
});

test("every demo module imports the barrel and no node: builtin", () => {
    for (const rel of ["sources/browser/demo.mjs", "sources/browser/studio.mjs"]) {
        const text = read(rel);
        assert.match(text, /from "\.\.\/krank\.mjs"/, `${rel} does not import the barrel`);
        assert.ok(!/from\s+["']node:/.test(text), `${rel} imports a node: builtin`);
    }
});

test("each page loads its module", () => {
    assert.match(read("sources/browser/index.html"), /src="\.\/studio\.mjs"/);
    assert.match(read("sources/browser/playground.html"), /src="\.\/demo\.mjs"/);
});

test("the studio page carries the step rail and its panels", () => {
    const html = read("sources/browser/index.html");
    for (const step of ["prompt", "candidates", "rules", "prose", "compare", "reduced", "check", "approve"]) {
        assert.ok(html.includes(`data-step="${step}"`), `the rail has no ${step}`);
        assert.ok(html.includes(`data-panel="${step}"`), `no panel for ${step}`);
    }
    for (const id of ["source", "candidates", "rules", "prose", "comparison", "reduced", "diff", "scope", "run", "check-output", "approve"]) {
        assert.ok(html.includes(`id="${id}"`), `the page has no #${id}`);
    }
});

test("the catalog lists every prompt file and offers a candidate choice", () => {
    const catalog = build("site-catalog.mjs");
    const sources = new Set(catalog.entries.map((entry) => entry.source));
    for (const source of prompt_files(`${root}prompts`)) {
        assert.ok(sources.has(source), `${source} is missing from the catalog`);
    }
    assert.ok(catalog.entries.some((entry) => entry.compiled), "no prompt is compiled");
    assert.ok(catalog.entries.some((entry) => !entry.compiled), "every prompt claims a compile");
    assert.ok(catalog.entries.some((entry) => entry.candidates.length >= 2), "no prompt offers a choice");
});

test("every candidate renders its rules and its prose is in the source", () => {
    const catalog = build("site-catalog.mjs");
    for (const entry of catalog.entries.filter((item) => item.compiled)) {
        assert.ok(entry.markdown.length > 0, `${entry.source} has no prompt text`);
        for (const candidate of entry.candidates) {
            assert.ok(candidate.rules.rules.length > 0, `${candidate.id} has no rules`);
            const prose = ruleset_render(candidate.rules);
            for (const item of candidate.cases) {
                assert.ok(prose.includes(`Rule "${item.rule}"`), `${candidate.id}: ${item.rule} is not rendered`);
                if ((item.source ?? entry.source) === entry.source) {
                    assert.ok(
                        entry.markdown.includes(item.original),
                        `${candidate.id}: the source does not contain "${item.original}"`,
                    );
                }
            }
        }
    }
});

test("the line diff reports removals and additions", () => {
    assert.deepEqual(
        diff_lines("a\nb\nc", "a\nc").map((row) => `${row.kind}:${row.text}`),
        ["same:a", "remove:b", "same:c"],
    );
    assert.deepEqual(
        diff_lines("a\nc", "a\nb\nc").map((row) => `${row.kind}:${row.text}`),
        ["same:a", "add:b", "same:c"],
    );
});

test("the check command drives the engine", () => {
    const script = `${root}sources/ruleset-command.mjs`;
    const ruleset = `${root}dataflow.in/round-trip.json`;
    const result = JSON.parse(execFileSync(process.execPath, [script, "check", ruleset], { encoding: "utf8" }));
    assert.equal(result.firings, 5);
    assert.equal(result.emitted.length, 5);
    assert.throws(
        () => execFileSync(process.execPath, [script, "check", ruleset, "--fail-on-emit"], { stdio: "pipe" }),
        /Command failed/,
    );
});

test("the conventions candidate reports a 2-space indentation unit", () => {
    const catalog = build("site-catalog.mjs");
    const conventions = candidates(catalog, "conventions");
    const result = ruleset_run({
        facts: [{ type: "file", path: "sample.mjs", extension: ".mjs", indent_unit: 2, has_tab: false }],
        rules: conventions.rules.rules,
    });
    assert.ok(result.emitted.some((item) => item.violation === "indent"), "the indent rule did not fire");
});

test("the file facts cover the library, and a clean file has no finding", () => {
    const catalog = build("site-catalog.mjs");
    const facts = build("site-facts.mjs");
    assert.ok(facts.files.some((file) => file.path === "sources/krank.mjs"));
    assert.ok(facts.files.every((file) => file.facts.path === file.path));

    const conventions = candidates(catalog, "conventions");
    const clean = facts.files.find((file) => file.path === "sources/krank.mjs");
    const result = ruleset_run({ facts: [{ type: "file", ...clean.facts }], rules: conventions.rules.rules });
    assert.equal(result.emitted.length, 0, "a conforming file produced a finding");
});
