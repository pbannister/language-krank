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
const object_model = JSON.parse(read("dataflow.in/object-model.json"));
const object_types = new Set(object_model.objects.map((object) => object.id));
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
    for (const step of ["prompt", "objects", "candidates", "rules", "check", "approve", "build"]) {
        assert.ok(html.includes(`data-step="${step}"`), `the rail has no ${step}`);
        assert.ok(html.includes(`data-panel="${step}"`), `no panel for ${step}`);
    }
    for (const tab of ["prompt", "history", "about", "object-status", "object-about", "candidates", "rules", "prose", "comparison", "reduced"]) {
        assert.ok(html.includes(`data-tab="${tab}"`), `no tab for ${tab}`);
    }
    for (const id of ["source", "candidates", "rules", "prose", "comparison", "reduced", "diff", "scope", "run", "check-output", "approve", "object-tabs", "objects-count", "propose", "object-file", "file-history", "history-log", "prompt-download", "file-overlay", "file-overlay-body", "file-overlay-note", "file-overlay-close", "candidates-note", "rules-badges", "rule-summary", "uncovered", "check-summary", "approve-warning", "build", "build-cycle", "build-note", "build-entries", "build-output", "revise-comparison", "revise-approve"]) {
        assert.ok(html.includes(`id="${id}"`), `the page has no #${id}`);
    }
});

test("the studio loads the object model and offers a proposal review", () => {
    const source = read("sources/browser/studio.mjs");
    assert.match(source, /load_json\("\.\/object-model\.json"\)/, "the studio does not load the object model");
    assert.match(source, /\/propose/, "the studio has no propose call");
    assert.match(source, /Scan result: .* accept · .* ignore · .* unreviewed/, "the studio has no scan result");
    assert.match(source, /render_object_file/, "the studio does not render the objects file status");
    assert.match(source, /Evidence \/ Rationale/, "the studio has no combined evidence column");
});

test("the Objects Status panel explains the scan beside its button", () => {
    const html = read("sources/browser/index.html");
    const status = html.split('<div class="tab-panel" data-tab="object-status">')[1]
        .split('<div class="tab-panel" data-tab="object-about"')[0];
    assert.match(status, /id="object-scan-help"/);
    assert.match(status, /id="propose"[^>]*aria-describedby="object-scan-help"/);
    const text = status.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    for (const explanation of [
        "current text in 1. Prompt", "including unsaved edits", "language model through the Harness",
        "Objects", "Operations", "Relations", "not a rule-generation or correctness check",
        "combined review list", "not just this scan", "do not update the confirmed object registry",
        "Download the reviewed proposals", "3. Candidates",
    ]) {
        assert.ok(text.includes(explanation), `Objects Status is missing: ${explanation}`);
    }
    assert.match(status, /id="propose-note"[^>]*aria-live="polite"/);
});

test("the studio links the evidence filename to a highlighting file viewer", () => {
    assert.match(read("sources/browser/studio.mjs"), /\.\/file\.html\?/, "the studio does not link to the file viewer");
    const viewer = read("sources/browser/file.html");
    assert.match(viewer, /id="lines"/, "the viewer has no line list");
    assert.match(viewer, /render_file/, "the viewer does not use the shared renderer");
    const view = read("sources/browser/file-view.mjs");
    assert.match(view, /\/file\?path=/, "the renderer does not fetch a repository file");
    assert.match(view, /file-line highlight|highlight/, "the renderer has no highlight");
});

test("the studio closes the cycle with a build step", () => {
    const source = read("sources/browser/studio.mjs");
    assert.match(source, /\/build-state/, "the studio does not read the build state");
    assert.match(source, /fetch\("\/build"/, "the studio has no build action");
    assert.match(source, /\/prompts-out\//, "the build entries have no generated links");
    assert.match(source, /revise_prompt/, "the studio has no revise-the-prompt action");
});

test("the prompt edit is marked as unsaved and downloadable", () => {
    const source = read("sources/browser/studio.mjs");
    assert.match(source, /the file is unchanged/, "the edit note does not say the file is unchanged");
    assert.match(source, /update_edit_note/, "the edit note does not update on input");
    const html = read("sources/browser/index.html");
    assert.match(html, /id="prompt-download"/, "the prompt text has no download");
    assert.ok(!html.includes('<label for="prompt">Prompt file</label>'), "the prompt file label remains");
});

test("Prompt introduces draft decisions, accessible state, and the next action", () => {
    const html = read("sources/browser/index.html");
    const prompt = html.split('<div class="tab-panel" id="tab-prompt"')[1]
        .split('<div class="tab-panel" id="tab-history"')[0];
    const text = prompt.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    for (const phrase of ["Select prose", "page-local draft", "current text, including unsaved edits",
        "does not overwrite the prompt file", "not approval"]) {
        assert.ok(text.includes(phrase), `Prompt introduction is missing: ${phrase}`);
    }
    assert.match(prompt, /id="edit-note"[^>]*role="status"[^>]*aria-live="polite"/);
    assert.match(prompt, /id="prompt-context"[^>]*aria-live="polite"/);
    assert.match(prompt, /id="generate"[^>]*class="primary-action"/);
    assert.ok(prompt.indexOf('id="generate"') < prompt.indexOf('id="apply"'));
    assert.match(prompt, /id="prompt-next"[^>]*hidden/);
    assert.match(prompt, /id="prompt-next-note"/);
    assert.match(html, /\.prompt-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(html, /@media \(max-width: 54rem\)\s*\{\s*body\s*\{[^}]*padding-top:\s*3\.5rem/s);
    assert.match(html, /#tab-prompt #source\s*\{[^}]*box-sizing:\s*border-box/s);
});

test("the candidate cards expand their rules and cases", () => {
    const source = read("sources/browser/studio.mjs");
    assert.match(source, /badge_toggle/, "the candidates have no expandable badges");
    assert.match(source, /aria-expanded/, "the badges are not disclosure controls");
    assert.match(source, /candidate-detail/, "the candidate details have no container");
    assert.match(read("sources/browser/index.html"), /\.candidate-detail/, "the details have no style");
});

test("the evidence viewer pushes history so back returns to the studio", () => {
    const source = read("sources/browser/studio.mjs");
    assert.match(source, /history\.pushState/, "the evidence link does not push history");
    assert.match(source, /addEventListener\("popstate"/, "the studio does not restore on back");
});

test("the catalog reports when each prompt file was edited and scanned", () => {
    const catalog = build("site-catalog.mjs");
    assert.ok(catalog.entries.length > 0);
    for (const entry of catalog.entries) {
        assert.match(entry.edited_at, /^\d{4}-\d{2}-\d{2}T/, `${entry.source}: no edited_at`);
        assert.match(entry.scanned_at, /^\d{4}-\d{2}-\d{2}T/, `${entry.source}: no scanned_at`);
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

test("review and reduction share the browser-safe core", () => {
    for (const path of ["sources/browser/studio.mjs", "sources/browser/catalog.mjs", "scripts/prompts-build.mjs"]) {
        assert.match(read(path), /compile-review\.mjs/);
        assert.match(read(path), /review_reduce\(/);
    }
    assert.match(read("sources/browser/index.html"), /id="approve-compile"/);
    assert.match(read("sources/browser/studio.mjs"), /explanation_current\(/);
    assert.match(read("sources/browser/studio.mjs"), /review_decide\(/);
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

test("the task extractor reads a task's sections, scope, and verification", () => {
    const facts = build("site-facts.mjs");
    const task = facts.files.find((file) => file.path === "prompts/tasks/01-site-build-implement.md");
    assert.ok(task, "the task file is not extracted");
    const entities = task.entities.filter((item) => item.type !== "file");
    assert.ok(entities.some((item) => item.type === "task" && item.conforming === true));
    assert.ok(entities.some((item) => item.type === "task_section" && item.name === "TASK-VERIFY" && item.present));
    assert.ok(entities.some((item) => item.type === "task_op_line" && item.verb === "create"));
    assert.ok(entities.some((item) => item.type === "task_file_row"));
    assert.ok(entities.some((item) => item.type === "task_verify" && item.expected === "observable"));
    assert.ok(entities.some((item) => item.type === "task_acceptance"));
});

test("the feature extractor reads a feature's sections and requirements", () => {
    const facts = build("site-facts.mjs");
    const feature = facts.files.find((file) => file.path === "prompts/features/03-rules-engine.md");
    assert.ok(feature, "the feature file is not extracted");
    const entities = feature.entities.filter((item) => item.type !== "file");
    assert.ok(entities.some((item) => item.type === "feature_section" && item.name === "Requirements" && item.present));
    assert.ok(entities.some((item) => item.type === "requirement" && item.id_shape === "ok"));
});

test("the test extractor reads a declared tier", () => {
    const facts = build("site-facts.mjs");
    assert.ok(facts.files.some((file) => file.entities.some((item) => item.type === "test" && item.tier)));
});

test("the extracted facts drive the task and feature rules", () => {
    const catalog = build("site-catalog.mjs");
    const facts = build("site-facts.mjs");
    const entities_of = (path) => facts.files.find((file) => file.path === path).entities;

    const task = ruleset_run({
        facts: entities_of("prompts/tasks/01-site-build-implement.md"),
        rules: candidates(catalog, "task-format").rules.rules,
    });
    assert.equal(task.emitted.length, 0, "the conforming task produced a finding");

    const feature = ruleset_run({
        facts: entities_of("prompts/features/03-rules-engine.md"),
        rules: candidates(catalog, "feature-format").rules.rules,
    });
    assert.equal(feature.emitted.length, 0, "the conforming feature produced a finding");

    const unknown = ruleset_run({
        facts: [{ type: "test", path: "tests/x.sh", tier: "unknown" }],
        rules: candidates(catalog, "workflow").rules.rules,
    });
    assert.ok(unknown.emitted.some((item) => item.violation === "unknown-test-tier"));
});

test("the episode, document, page, version, and todo extractors", () => {
    const facts = build("site-facts.mjs");
    const episode = facts.files.find((file) => file.path === "prompts/episodes/01-episode-template.md");
    assert.ok(episode.entities.some((item) => item.type === "episode" && item.branch !== ""));
    assert.ok(episode.entities.some((item) => item.type === "episode_section" && item.name === "EPISODE-GOAL" && item.present));
    assert.ok(facts.files.some((file) => file.path === "documents/10-rule-notation.md" && file.entities.some((item) => item.type === "document")));
    const nav = facts.files.find((file) => file.path === "site.in/pages.nav");
    assert.ok(nav.entities.some((item) => item.type === "nav" && item.label.length > 0));
    const version = facts.files.find((file) => file.path === "package.json");
    assert.ok(version.entities.some((item) => item.type === "version" && item.value === "0.3.0"));
    const todo = facts.files.find((file) => file.path === "TODO.md");
    assert.ok(todo.entities.some((item) => item.type === "todo_item" && item.checked));
});

test("every emitted type is registered in the object model", () => {
    const facts = build("site-facts.mjs");
    for (const file of facts.files) {
        for (const item of file.entities) {
            if (typeof item.type === "string") {
                assert.ok(object_types.has(item.type), `unregistered type ${item.type} from ${file.path}`);
            }
        }
    }
});
