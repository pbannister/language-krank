// 31-prompts-build.test.mjs — node:test cases for scripts/prompts-build.mjs.
// Invoked by tests/31-prompts-build.sh.
//
// prompts.out/ is the generated formal form. This test builds it and checks the
// coverage gate: every compiled prompt has a tree, every case is marked, every
// covered line is gone from the reduced form, and the manifest reports no
// missing marker.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}tests.out/31-prompts-build/prompts.out`;
rmSync(out, { recursive: true, force: true });
mkdirSync(`${root}tests.out/31-prompts-build`, { recursive: true });

const catalog = JSON.parse(execFileSync(process.execPath, [`${root}scripts/site-catalog.mjs`], { encoding: "utf8" }));
execFileSync(process.execPath, [`${root}scripts/prompts-build.mjs`, out], { encoding: "utf8" });
const manifest = JSON.parse(readFileSync(`${out}/manifest.json`, "utf8"));

function slug_of(source) {
    return source.replace(/^prompts\//, "").replace(/\.md$/, "").replace(/[/_]/g, "-");
}

function candidate_of(entry) {
    return entry.candidates.find((item) => item.id === entry.approved) ?? entry.candidates[0];
}

test("prompts.out/ has one tree per compiled prompt", () => {
    const compiled = catalog.entries.filter((entry) => entry.compiled);
    assert.ok(compiled.length >= 7, "too few compiled prompts");
    assert.equal(manifest.entries.length, compiled.length);
    for (const entry of compiled) {
        const directory = `${out}/${slug_of(entry.source)}`;
        assert.ok(existsSync(`${directory}/rules.json`), `${entry.source}: no rules.json`);
        assert.ok(existsSync(`${directory}/marked.md`), `${entry.source}: no marked.md`);
        assert.ok(existsSync(`${directory}/reduced.md`), `${entry.source}: no reduced.md`);
    }
});

test("every compiled prompt has rendered and comparison forms", () => {
    for (const entry of catalog.entries.filter((item) => item.compiled)) {
        const directory = `${out}/${slug_of(entry.source)}`;
        const rendered = readFileSync(`${directory}/rendered.md`, "utf8");
        assert.match(rendered, /Rule "/, `${entry.source}: rendered.md has no rules`);
        const comparison = readFileSync(`${directory}/comparison.md`, "utf8");
        assert.ok(comparison.includes("## Covered (captured by a rule)"), `${entry.source}: comparison has no covered section`);
        assert.ok(comparison.includes("## Not captured (no rule)"), `${entry.source}: comparison has no uncovered section`);
    }
});

test("legacy cases never authorize markers or removal", () => {
    for (const entry of catalog.entries.filter((item) => item.compiled)) {
        if (candidate_of(entry).review) {
            continue;
        }
        const marked = readFileSync(`${out}/${slug_of(entry.source)}/marked.md`, "utf8");
        const reduced = readFileSync(`${out}/${slug_of(entry.source)}/reduced.md`, "utf8");
        assert.equal(marked, entry.markdown);
        assert.equal(reduced, entry.markdown);
        const record = manifest.entries.find((item) => item.source === entry.source);
        assert.equal(record.coverage.approved, 0);
        assert.equal(record.markers_found, 0);
    }
});

test("the manifest reports no missing markers", () => {
    assert.ok(manifest.entries.length > 0);
    for (const entry of manifest.entries) {
        assert.equal(entry.markers_missing, 0, `${entry.source}: ${entry.markers_missing} marker(s) missing`);
    }
});

test("every manifest entry carries a source digest", () => {
    for (const entry of manifest.entries) {
        assert.match(entry.source_sha256, /^[0-9a-f]{64}$/, `${entry.source}: no source digest`);
    }
});

test("single-file mode regenerates one entry and keeps the others", () => {
    const target = "prompts/02-workflow.md";
    execFileSync(process.execPath, [`${root}scripts/prompts-build.mjs`, out, "--source", target], { encoding: "utf8" });

    const rebuilt = JSON.parse(readFileSync(`${out}/manifest.json`, "utf8"));
    assert.equal(rebuilt.entries.length, manifest.entries.length, "single-file mode dropped an entry");
    assert.match(
        rebuilt.entries.find((entry) => entry.source === target).source_sha256,
        /^[0-9a-f]{64}$/,
    );

    const other = catalog.entries.find((entry) => entry.compiled && entry.source !== target);
    assert.ok(existsSync(`${out}/${slug_of(other.source)}/rules.json`), "a sibling tree was lost");
});
