// Portable review contract tests; expected prose and removal positions are authored independently.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
    fact_contract, review_validate, review_initialize, review_check, review_decide,
    review_report, review_reduce, review_selection, explanation_task, explanation_accept, explanation_current,
} from "../sources/compile-review.mjs";

const fixture = JSON.parse(readFileSync(new URL("../dataflow.in/compile-review-cases.json", import.meta.url), "utf8"));
const contract = fact_contract("extractor-v1");
const facts = [{ type: "file", path: "sample.mjs", has_tab: false, indent_unit: 4 }];
function candidate_new() {
    const candidate = { id: "example", title: "File policy", rules: structuredClone(fixture.rules), cases: [], review: {
        requirements: structuredClone(fixture.requirements), passages: structuredClone(fixture.passages),
    } };
    return review_initialize(candidate, fixture.source, fixture.text, contract);
}
function approve(candidate) {
    review_check(candidate, fixture.source, fixture.text, contract, "file:sample.mjs", facts);
    review_decide(candidate, "spaces", "approved", fixture.source, fixture.text, contract);
    review_decide(candidate, "indent", "approved", fixture.source, fixture.text, contract);
}

test("compound clauses have separate statuses; legacy and unapproved prose stays intact", () => {
    const candidate = candidate_new();
    assert.equal(review_report(candidate, fixture.source, fixture.text, contract).identified, 4);
    assert.equal(review_report(candidate, fixture.source, fixture.text, contract).executable, 2);
    assert.equal(review_reduce(candidate, fixture.source, fixture.text, contract).text, fixture.text);
    delete candidate.review;
    assert.equal(review_reduce(candidate, fixture.source, fixture.text, contract).text, fixture.text);
});

test("only fully approved exact line is removed, not its repeated occurrence or heading", () => {
    const candidate = candidate_new();
    review_check(candidate, fixture.source, fixture.text, contract, "file:sample.mjs", facts);
    review_decide(candidate, "spaces", "approved", fixture.source, fixture.text, contract);
    assert.equal(review_reduce(candidate, fixture.source, fixture.text, contract).text, fixture.text);
    review_decide(candidate, "indent", "approved", fixture.source, fixture.text, contract);
    const result = review_reduce(candidate, fixture.source, fixture.text, contract);
    assert.deepEqual(result.removed, [2]);
    assert.ok(result.text.startsWith("# File policy\nFiles must use spaces and four-space indentation.\nReviews must be helpful.\n"));
    assert.equal(review_report(candidate, fixture.source, fixture.text, contract).approved, 2);
    assert.deepEqual(review_reduce(JSON.parse(JSON.stringify(candidate)), fixture.source, fixture.text, contract), result);
});

test("source, rule, contract, coverage and check edits invalidate approval", () => {
    for (const change of [
        (candidate) => { candidate.rules.rules[0].then[0].emit = "Changed"; },
        (candidate) => { candidate.review.requirements[0].reason = "Changed"; },
        (candidate) => { candidate.review.check.scope = "file:other.mjs"; },
        (candidate) => { candidate.review.check.facts[0].has_tab = true; },
    ]) {
        const candidate = candidate_new();
        approve(candidate);
        change(candidate);
        assert.deepEqual(review_reduce(candidate, fixture.source, fixture.text, contract).removed, []);
    }
    const candidate = candidate_new();
    approve(candidate);
    assert.deepEqual(review_reduce(candidate, fixture.source, `Extra\n${fixture.text}`, contract).removed, []);
    assert.deepEqual(review_reduce(candidate, "prompts/other.md", fixture.text, contract).removed, []);
    assert.deepEqual(review_reduce(candidate, fixture.source, fixture.text, fact_contract("extractor-v2")).removed, []);
});

test("malformed references, invented fields and incomplete passage accounting are refused", () => {
    for (const change of [
        (candidate) => { candidate.review.requirements[0].line = 100; },
        (candidate) => { candidate.review.requirements[0].quote = "absent"; },
        (candidate) => { candidate.review.requirements[0].rules = ["absent"]; },
        (candidate) => { candidate.review.requirements[1].id = "spaces"; },
        (candidate) => { candidate.review.passages.pop(); },
        (candidate) => { candidate.review.passages[1].requirements = ["spaces"]; },
        (candidate) => { candidate.review.requirements[0].status = "guessed"; },
        (candidate) => { candidate.review.requirements[0].reason = ""; },
        (candidate) => { candidate.rules.rules[0].when[0].fact.invented = true; },
        (candidate) => { candidate.rules.facts.push({ type: "file", has_tab: true }); },
        (candidate) => { candidate.rules.rules.push(structuredClone(candidate.rules.rules[0])); },
    ]) {
        const candidate = candidate_new();
        change(candidate);
        assert.throws(() => review_validate(candidate, fixture.source, fixture.text, contract));
    }
});

test("zero executable rules and explicit missing facts remain reviewable", () => {
    const candidate = candidate_new();
    candidate.rules.rules = [];
    for (const requirement of candidate.review.requirements) {
        requirement.status = "needs_facts";
        requirement.missing_facts = ["A review-quality observation"];
        requirement.rules = [];
    }
    assert.doesNotThrow(() => review_validate(candidate, fixture.source, fixture.text, contract));
    assert.deepEqual(review_reduce(candidate, fixture.source, fixture.text, contract).removed, []);
});

test("checks bind scope and actual rules; approvals cannot substitute for checks", () => {
    const candidate = candidate_new();
    assert.throws(() => review_decide(candidate, "spaces", "approved", fixture.source, fixture.text, contract));
    assert.throws(() => review_check(candidate, fixture.source, fixture.text, contract, "", facts));
    approve(candidate);
    review_check(candidate, fixture.source, fixture.text, contract, "file:other.mjs", facts);
    assert.deepEqual(review_reduce(candidate, fixture.source, fixture.text, contract).removed, []);
    review_decide(candidate, "spaces", "rejected", fixture.source, fixture.text, contract);
    assert.deepEqual(review_reduce(candidate, fixture.source, fixture.text, contract).removed, []);
});

test("explanations receive rules and definitions, not source or extraction prose", () => {
    const candidate = candidate_new();
    const task = explanation_task(candidate, contract);
    assert.ok(task.includes('"has_tab"'));
    assert.ok(task.includes('"indent_unit"'));
    assert.ok(!task.includes(fixture.text));
    assert.ok(!task.includes(fixture.requirements[0].reason));
    assert.ok(!task.includes("Reviews must be helpful"));
    explanation_accept(candidate, { explanations: [
        { id: "spaces", title: "Use spaces", text: "Report a violation when a file contains a tab.", limitations: "Does not check visual alignment." },
        { id: "indent", title: "Four-space indentation", text: "Report a violation when the indentation unit is not four.", limitations: "An unindented file has unit zero." },
    ] }, fixture.source, fixture.text, contract);
    assert.ok(explanation_current(candidate, "spaces", fixture.source, fixture.text, contract));
    assert.equal(explanation_current(candidate, "spaces", fixture.source, `${fixture.text}Extra`, contract), null);
    candidate.rules.rules[0].when[0].fact.has_tab = false;
    assert.equal(explanation_current(candidate, "spaces", fixture.source, fixture.text, contract), null);
});

test("empty, irrelevant and incomplete observed facts cannot authorize reduction", () => {
    const candidate = candidate_new();
    for (const observations of [[], [{ type: "task", id: "unrelated" }], [{ type: "file", path: "missing-fields" }]]) {
        assert.throws(() => review_check(candidate, fixture.source, fixture.text, contract, "file:sample.mjs", observations));
    }
});

test("failed rechecks clear previous approval evidence", () => {
    const candidate = candidate_new();
    approve(candidate);
    assert.throws(() => review_check(candidate, fixture.source, fixture.text, contract, "file:sample.mjs", []));
    assert.deepEqual(review_reduce(candidate, fixture.source, fixture.text, contract).removed, []);
});

test("missing and unknown candidate selections never select an approved fallback", () => {
    const candidate = candidate_new();
    approve(candidate);
    for (const approved of [undefined, "missing"]) {
        const selected = review_selection({ candidates: [candidate], approved });
        assert.deepEqual(review_reduce(selected, fixture.source, fixture.text, contract).removed, []);
    }
    assert.deepEqual(review_reduce(review_selection({ candidates: [candidate], approved: candidate.id }), fixture.source, fixture.text, contract).removed, [2]);
});

test("CRLF, final newlines and Unicode in retained context remain byte-identical", () => {
    const text = "# Café\r\nNo tabs.\r\nKeep this context.";
    const candidate = { id: "crlf", title: "CRLF", rules: { facts: [], rules: [fixture.rules.rules[0]] }, review: {
        requirements: [{ ...fixture.requirements[0], line: 2, quote: "No tabs." }],
        passages: [{ line: 1, quote: "# Café\r", kind: "context", requirements: [] },
            { line: 2, quote: "No tabs.\r", kind: "requirements", requirements: ["spaces"] },
            { line: 3, quote: "Keep this context.", kind: "context", requirements: [] }],
    } };
    review_initialize(candidate, fixture.source, text, contract);
    review_check(candidate, fixture.source, text, contract, "file:sample.mjs", facts);
    review_decide(candidate, "spaces", "approved", fixture.source, text, contract);
    assert.ok(review_reduce(candidate, fixture.source, text, contract).text.startsWith("# Café\r\nKeep this context.\n"));
    assert.ok(review_reduce(candidate, fixture.source, text, contract).marked.includes('No tabs.\r') === false);
    assert.ok(review_reduce(candidate, fixture.source, text, contract).marked.includes('<!-- krank: {"rule":"spaces"} -->\r\n'));
});

test("export, catalog, full and single-source builds preserve approved metadata and exact decisions", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const sandbox = `${root}tests.out/32-compile-review/fixture`;
    for (const directory of ["sources", "scripts", "prompts", "dataflow.in/compile"]) {
        mkdirSync(`${sandbox}/${directory}`, { recursive: true });
    }
    for (const path of ["sources/compile-review.mjs", "sources/ruleset-run.mjs", "sources/ruleset-render.mjs", "scripts/site-catalog.mjs", "scripts/site-facts.mjs", "scripts/prompts-build.mjs", "dataflow.in/object-model.json"]) {
        copyFileSync(`${root}${path}`, `${sandbox}/${path}`);
    }
    const actual_contract = fact_contract(createHash("sha256").update(readFileSync(`${root}scripts/site-facts.mjs`))
        .update(readFileSync(`${root}dataflow.in/object-model.json`)).digest("hex"));
    const candidate = candidate_new();
    review_initialize(candidate, fixture.source, fixture.text, actual_contract);
    review_check(candidate, fixture.source, fixture.text, actual_contract, "file:sample.mjs", facts);
    for (const id of ["spaces", "indent"]) {
        review_decide(candidate, id, "approved", fixture.source, fixture.text, actual_contract);
    }
    writeFileSync(`${sandbox}/prompts/example.md`, fixture.text);
    writeFileSync(`${sandbox}/dataflow.in/compile/example.json`, JSON.stringify({ source: fixture.source, approved: candidate.id, candidates: [candidate] }));
    const catalog = JSON.parse(execFileSync(process.execPath, [`${sandbox}/scripts/site-catalog.mjs`], { encoding: "utf8" }));
    assert.deepEqual(catalog.entries[0].candidates[0].review, candidate.review);
    const output = `${sandbox}/generated`;
    const build = (...args) => execFileSync(process.execPath, [`${sandbox}/scripts/prompts-build.mjs`, output, ...args], { encoding: "utf8" });
    build();
    const reduced = readFileSync(`${output}/example/reduced.md`, "utf8");
    assert.ok(reduced.startsWith("# File policy\nFiles must use spaces and four-space indentation.\nReviews must be helpful.\n"));
    assert.equal(reduced, review_reduce(candidate, fixture.source, fixture.text, actual_contract).text);
    const marked = readFileSync(`${output}/example/marked.md`, "utf8");
    assert.match(marked.split("\n")[1], /krank:.*spaces.*krank:.*indent/);
    assert.ok(!marked.split("\n")[2].includes("krank:"));
    const manifest = JSON.parse(readFileSync(`${output}/manifest.json`, "utf8"));
    assert.deepEqual(manifest.entries[0].coverage.removed, [2]);
    assert.equal(manifest.entries[0].coverage.approved, 2);
    writeFileSync(`${sandbox}/prompts/example.md`, `${fixture.text}New obligation.\n`);
    build("--source", fixture.source);
    assert.equal(readFileSync(`${output}/example/reduced.md`, "utf8"), `${fixture.text}New obligation.\n`);
    candidate.review.requirements = {};
    writeFileSync(`${sandbox}/dataflow.in/compile/example.json`, JSON.stringify({ source: fixture.source, approved: candidate.id, candidates: [candidate] }));
    build();
    assert.equal(readFileSync(`${output}/example/reduced.md`, "utf8"), `${fixture.text}New obligation.\n`);
});

// A small DOM adapter executes the actual studio event handlers without adding a
// browser dependency. It tests state/download behavior, not visual layout.
async function with_studio(run) {
    class Element {
        constructor() {
            this.children = [];
            this.dataset = {};
            this.listeners = {};
            this.value = "";
            this.classList = { toggle() {} };
            this.hidden = false;
        }
        set textContent(value) { this.text = String(value); this.children = []; }
        get textContent() { return (this.text ?? "") + this.children.map((item) => item.textContent ?? String(item)).join(""); }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.text = ""; this.children = children; }
        insertBefore(child) { this.append(child); }
        setAttribute(key, value) { this[key] = value; }
        removeAttribute(key) { delete this[key]; }
        querySelector(selector) { return element(selector); }
        querySelectorAll() { return []; }
        addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
        async fire(type) { for (const listener of this.listeners[type] ?? []) await listener({ target: this }); }
        focus() {}
        scrollIntoView() {}
    }
    const elements = new Map();
    function element(selector) {
        if (!elements.has(selector)) elements.set(selector, new Element());
        return elements.get(selector);
    }
    const selected = candidate_new();
    approve(selected);
    const first = candidate_new();
    first.id = "not-selected";
    const catalog = { fact_contract: contract, entries: [
        { source: fixture.source, markdown: fixture.text, compiled: true, approved: selected.id, candidates: [first, selected] },
        { source: "prompts/other.md", markdown: "Other prompt.", compiled: false, candidates: [] },
    ] };
    const pending = [];
    const saved = new Map(["document", "window", "history", "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const original_fetch = globalThis.fetch;
    const nodes = { querySelector: element, querySelectorAll: () => [], createElement: () => new Element(), createTextNode: (text) => ({ textContent: text }) };
    globalThis.document = nodes;
    globalThis.window = { addEventListener() {} };
    globalThis.history = { state: null, back() {}, pushState() {} };
    globalThis.fetch = async (url, options) => {
        if (url === "/compile") {
            return new Promise((resolve) => pending.push({ body: JSON.parse(options.body), resolve }));
        }
        const value = url === "./catalog.json" ? catalog
            : url === "./files.json" ? { files: [{ path: "sample.mjs", facts: { directory: "sources" }, entities: facts }] }
            : url === "./object-model.json" ? { objects: [], operations: [], relations: [], proposals: [] }
            : { manifest: null };
        return { ok: true, json: async () => value };
    };
    element("#scope").value = "file:sample.mjs";
    try {
        await import(`../sources/browser/studio.mjs?review-test=${Math.random()}`);
        await run({ element, pending, selected, original_fetch });
    } finally {
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
}

test("studio loads the selected reading and invalidates downloads on an unapplied edit", async () => {
    await with_studio(async ({ element, original_fetch }) => {
        const before = await (await original_fetch(element("#approve-compile").href)).json();
        assert.equal(before.candidates[0].id, "example");
        assert.equal(before.candidates[0].review.approvals.spaces.decision, "approved");
        element("#source").value = `${fixture.text}Unapplied edit.`;
        await element("#source").fire("input");
        for (const id of ["#approve-compile", "#approve-reduced", "#reduced-download"]) {
            assert.equal(element(id).href, undefined);
        }
        await element("#run").fire("click");
        assert.equal(element("#approve-compile").href, undefined);
        assert.match(element("#check-output").textContent, /Apply the edited prompt/);
        assert.equal(element("#source").value, `${fixture.text}Unapplied edit.`);
    });
});

test("studio discards delayed compile results after edits, resets, or prompt switches", async () => {
    for (const change of ["edit", "reset", "switch"]) {
        await with_studio(async ({ element, pending, selected }) => {
            const completion = element("#generate").fire("click");
            assert.equal(pending.length, 1);
            assert.equal(pending[0].body.text, fixture.text);
            if (change === "switch") {
                element("#prompt").value = "prompts/other.md";
                await element("#prompt").fire("change");
            } else {
                element("#source").value = `${fixture.text}Changed.`;
                await element("#source").fire("input");
                if (change === "reset") await element("#reset").fire("click");
            }
            pending[0].resolve(new Response(`data: ${JSON.stringify({ type: "done", candidates: [selected] })}\n\n`));
            await completion;
            assert.match(element("#generate-note").textContent, /result discarded/);
            if (change === "switch") assert.equal(element("#source").value, "Other prompt.");
        });
    }
});

test("studio scope changes discard checked approvals", async () => {
    await with_studio(async ({ element, original_fetch }) => {
        element("#scope").value = "file:other.mjs";
        await element("#scope").fire("change");
        const artifact = await (await original_fetch(element("#approve-compile").href)).json();
        assert.deepEqual(artifact.candidates[0].review.approvals, {});
        assert.equal(artifact.candidates[0].review.check, null);
        assert.equal(element("#reduced").textContent, fixture.text);
    });
});

test("missing, duplicate and unrelated explanations are refused without changing rules", () => {
    const candidate = candidate_new();
    const before = JSON.stringify(candidate.rules);
    assert.throws(() => explanation_accept(candidate, { explanations: [] }, fixture.source, fixture.text, contract));
    assert.equal(JSON.stringify(candidate.rules), before);
    assert.equal(explanation_current(candidate, "spaces", fixture.source, fixture.text, contract), null);
});
