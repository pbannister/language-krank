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
import { candidate_stats, coverage_delta } from "../sources/browser/candidate-summary.mjs";
import { rule_diff, rule_diff_summary, display_order } from "../sources/browser/candidate-diff.mjs";
import { filter_proposals, review_counts, review_breakdown } from "../sources/browser/object-filter.mjs";
import { review_progress, filter_requirements } from "../sources/browser/review-queue.mjs";
import { resolve_focus_index, move_focus_index, focus_position, focus_item } from "../sources/browser/review-focus.mjs";
import { reduction_summary, retained_reason, line_status_rows, filter_line_status, line_status_counts } from "../sources/browser/reduction-summary.mjs";
import { scope_stats, required_fact_types, check_readiness, evaluation_summary } from "../sources/browser/check-summary.mjs";
import { scope_options, rank_scope_suggestions, suggestion_label } from "../sources/browser/scope-suggestions.mjs";
import { step_statuses, next_recommended_step } from "../sources/browser/step-status.mjs";
import { approval_checklist, artifact_state, build_coverage_text, build_freshness, build_totals, build_rows, sort_build_rows, filter_build_rows, build_filter_counts } from "../sources/browser/approve-build-summary.mjs";
import { parse_outline, selection_for_line, outline_matches } from "../sources/browser/prompt-outline.mjs";

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
    const filter = read("sources/browser/object-filter.mjs");
    assert.ok(!/from\s+["']node:/.test(filter), "object-filter.mjs imports a node: builtin");
    assert.ok(!/\bdocument\b|\bwindow\b/.test(filter), "object-filter.mjs depends on the DOM");
    const queue = read("sources/browser/review-queue.mjs");
    assert.ok(!/from\s+["']node:/.test(queue), "review-queue.mjs imports a node: builtin");
    assert.ok(!/\bdocument\b|\bwindow\b/.test(queue), "review-queue.mjs depends on the DOM");
    const reduction = read("sources/browser/reduction-summary.mjs");
    assert.ok(!/from\s+["']node:/.test(reduction), "reduction-summary.mjs imports a node: builtin");
    assert.ok(!/\bdocument\b|\bwindow\b/.test(reduction), "reduction-summary.mjs depends on the DOM");
    const check = read("sources/browser/check-summary.mjs");
    assert.ok(!/from\s+["']node:/.test(check), "check-summary.mjs imports a node: builtin");
    assert.ok(!/\bdocument\b|\bwindow\b/.test(check), "check-summary.mjs depends on the DOM");
});

test("each page loads its module", () => {
    assert.match(read("sources/browser/index.html"), /src="\.\/studio\.mjs"/);
    assert.match(read("sources/browser/playground.html"), /src="\.\/demo\.mjs"/);
});

test("the studio exposes skip, step, and tab navigation semantics", () => {
    const html = read("sources/browser/index.html");
    assert.match(html, /<a class="skip-link" href="#main">Skip to main content<\/a>/);
    assert.match(html, /<main id="main" tabindex="-1">/);
    assert.match(html, /id="step-announcement" role="status" aria-live="polite" aria-atomic="true"/);
    for (const [step, label] of [["prompt", "Step 1: Prompt"], ["objects", "Step 2: Objects"],
        ["candidates", "Step 3: Candidates"], ["rules", "Step 4: Rules"], ["check", "Step 5: Check"],
        ["approve", "Step 6: Approve"], ["build", "Step 7: Build and use"]]) {
        assert.ok(html.includes(`data-step="${step}"`), `no step button for ${step}`);
        assert.ok(html.includes(`aria-controls="step-${step}"`), `no aria-controls for ${step}`);
        assert.ok(html.includes(`id="step-${step}"`), `no panel id for ${step}`);
        assert.ok(html.includes(`aria-label="${label}"`), `no panel label for ${step}`);
    }
    assert.match(html, /id="step-prompt"[^>]*aria-label="Step 1: Prompt"/);
    assert.match(html, /id="step-next"[^>]*hidden/);
    assert.match(html, /id="step-next-note"/);
    assert.match(html, /id="step-next-action"/);
    assert.match(html, /\.step-state\.blocked/);
    assert.match(html, /id="file-overlay"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="file-overlay-title"/);
    const source = read("sources/browser/studio.mjs");
    for (const wiring of ["aria-current", "step_announcement.textContent", "function prepare_tab",
        "aria-controls", "tabIndex = active ? 0 : -1", "ArrowRight", "ArrowLeft", "Home", "End",
        "file_overlay_return_focus", "file_overlay_close.focus()", "restore.focus()",
        "step_statuses(", "next_recommended_step(", "update_step_status(", "step-state"]) {
        assert.ok(source.includes(wiring), `accessibility wiring is missing ${wiring}`);
    }
    assert.match(html, /:where\(a, button, input, select, textarea, summary\):focus-visible/);
    assert.match(html, /@media \(max-width: 54rem\)[\s\S]*?align-content: start/);
    assert.match(html, /body,[\s\S]*?\.tab-panel \{\s*min-width: 0;/);
    assert.match(html, /table-layout: fixed/);
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
    for (const id of ["source", "candidates", "rules", "prose", "comparison", "reduced", "diff", "scope", "run", "check-output", "approve", "object-tabs", "objects-count", "propose", "object-file", "file-history", "history-log", "prompt-download", "file-overlay", "file-overlay-body", "file-overlay-note", "file-overlay-close", "candidates-note", "candidates-summary", "candidates-next", "rules-badges", "rule-summary", "line-status-body", "line-status-summary", "line-status-filter", "check-summary", "approve-warning", "build", "build-cycle", "build-note", "build-entries", "build-output", "revise-comparison", "revise-approve"]) {
        assert.ok(html.includes(`id="${id}"`), `the page has no #${id}`);
    }
});

test("the studio loads the object model and offers a proposal review", () => {
    const source = read("sources/browser/studio.mjs");
    assert.match(source, /load_json\("\.\/object-model\.json"\)/, "the studio does not load the object model");
    assert.match(source, /\/propose/, "the studio has no propose call");
    assert.match(source, /Review progress:/, "the studio has no review progress");
    assert.match(source, /reviewed of/, "the studio does not report reviewed progress");
    assert.match(source, /unreviewed suggestions/, "the studio does not report unreviewed defaults");
    assert.match(source, /review_counts\(proposals\)/, "the studio does not separate reviewed decisions");
    assert.match(source, /render_object_file/, "the studio does not render the objects file status");
    assert.match(source, /Evidence \/ Rationale/, "the studio has no combined evidence column");
});

test("object filtering is immutable and separates human decisions from defaults", () => {
    const rows = [
        { term: "alpha", kind: "object", evidence: "The Alpha term.", rationale: "A thing.", use: "accept", reviewed: false },
        { term: "beta", kind: "operation", evidence: "Creates Beta.", rationale: "An action.", use: "ignore", reviewed: true },
        { term: "gamma", kind: "relation", evidence: "Gamma links them.", rationale: "A connection.", use: "accept", reviewed: true },
    ];
    const before = JSON.stringify(rows);
    assert.deepEqual(filter_proposals(rows, "BETA", "all").map((row) => row.term), ["beta"]);
    assert.deepEqual(filter_proposals(rows, "action", "all").map((row) => row.term), ["beta"]);
    assert.deepEqual(filter_proposals(rows, "connection", "all").map((row) => row.term), ["gamma"]);
    assert.deepEqual(filter_proposals(rows, "", "unreviewed").map((row) => row.term), ["alpha"]);
    assert.deepEqual(filter_proposals(rows, "", "accepted").map((row) => row.term), ["gamma"]);
    assert.deepEqual(filter_proposals(rows, "", "ignored").map((row) => row.term), ["beta"]);
    assert.equal(JSON.stringify(rows), before, "filtering mutated its input");

    assert.deepEqual(review_counts(rows), {
        total: 3, reviewed: 2, unreviewed: 1, accepted: 1, ignored: 1,
        default_include: 1, default_exclude: 0,
    });
});

test("object origin filters and review breakdown stay conservative", () => {
    const rows = [
        { term: "alpha", kind: "object", origin: "registry", use: "accept", reviewed: false },
        { term: "beta", kind: "operation", origin: "scan", use: "ignore", reviewed: true },
        { term: "gamma", kind: "object", origin: "scan", use: "accept", reviewed: true },
        { term: "delta", kind: "relation", use: "accept", reviewed: false },
    ];
    const before = JSON.stringify(rows);
    assert.deepEqual(filter_proposals(rows, "", "all").map((row) => row.term), ["alpha", "beta", "gamma", "delta"]);
    assert.deepEqual(filter_proposals(rows, "", "all", "registry").map((row) => row.term), ["alpha"]);
    assert.deepEqual(filter_proposals(rows, "", "all", "scan").map((row) => row.term), ["beta", "gamma"]);
    assert.deepEqual(filter_proposals(rows, "a", "unreviewed", "scan"), []);
    assert.deepEqual(filter_proposals(rows, "", "all", "bogus"), [], "unknown origin must not fall back to all");
    assert.deepEqual(filter_proposals([], "", "all", "registry"), []);
    assert.deepEqual(review_breakdown(rows), {
        registry: 1, scan: 2, unknown_origin: 1,
        by_kind: {
            object: { total: 2, unreviewed: 1 },
            operation: { total: 1, unreviewed: 0 },
            relation: { total: 1, unreviewed: 1 },
        },
    });
    assert.equal(JSON.stringify(rows), before, "origin filtering mutated its input");
});

test("Objects review toolbar filters across tabs and exposes a review entry", () => {
    const html = read("sources/browser/index.html");
    for (const id of ["object-review-toolbar", "object-search", "object-filter", "object-origin",
        "object-clear-filters", "object-next-unreviewed", "object-review-summary", "object-empty",
        "object-empty-clear", "object-review-entry", "object-entry-progress", "object-progress",
        "object-kind-jumps", "object-review-unreviewed", "object-origin-summary"]) {
        assert.ok(html.includes(`id="${id}"`), `the review toolbar has no #${id}`);
    }
    assert.match(html, /id="object-search"[^>]*type="search"/);
    assert.match(html, /id="object-review-summary"[^>]*aria-live="polite"/);
    assert.match(html, /id="object-next-unreviewed"[^>]*type="button"/);
    assert.match(html, /id="object-review-unreviewed"[^>]*class="primary-action"/);
    assert.match(html, /id="object-progress"[^>]*aria-label="Object review progress"/);
    const source = read("sources/browser/studio.mjs");
    for (const wiring of ["filter_proposals(", "review_breakdown(", "render_object_entry(",
        "review_unreviewed", "next_unreviewed", "object_origin", "within current filters",
        'origin-${row.origin === "registry" ? "registry" : "scan"}', "object_empty.hidden", "aria-busy",
        "new_count", "known_count"]) {
        assert.ok(source.includes(wiring), `the Objects step is missing ${wiring}`);
    }
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

test("prompt outline ignores fenced headings and preserves Markdown levels", () => {
    const text = [
        "# Top",
        "## Work",
        "```js",
        "# hidden backtick",
        "```",
        "~~~",
        "## hidden tilde",
        "````",
        "## still hidden",
        "~~~~",
        "### After",
        "   ## Indented",
        "    ## Too deep",
        "## Closing ##",
        "#NoSpace",
        "## Dup",
        "## Dup",
    ].join("\r\n");
    assert.deepEqual(parse_outline(text), [
        { line: 1, level: 1, title: "Top" },
        { line: 2, level: 2, title: "Work" },
        { line: 11, level: 3, title: "After" },
        { line: 12, level: 2, title: "Indented" },
        { line: 14, level: 2, title: "Closing" },
        { line: 16, level: 2, title: "Dup" },
        { line: 17, level: 2, title: "Dup" },
    ]);
    assert.deepEqual(parse_outline("```\n# hidden\n```\n# open"), [
        { line: 4, level: 1, title: "open" },
    ]);
    assert.deepEqual(parse_outline("````\n```\n# hidden\n`````\n# after"), [
        { line: 5, level: 1, title: "after" },
    ]);
    assert.deepEqual(parse_outline("plain text"), []);
});

test("prompt outline selections use exact CRLF-aware line offsets", () => {
    const text = "# A\r\nbody\r\n## B";
    assert.deepEqual(selection_for_line(text, 2), { start: 5, end: 9, text: "body" });
    assert.deepEqual(selection_for_line(text, 3), { start: 11, end: 15, text: "## B" });
    assert.deepEqual(selection_for_line("last line", 1), { start: 0, end: 9, text: "last line" });
    assert.deepEqual(selection_for_line("", 1), { start: 0, end: 0, text: "" });
    for (const invalid of [0, 4, -1, 1.5, "2", null]) {
        assert.equal(selection_for_line(text, invalid), null);
    }
});

test("prompt outline filtering is case-insensitive, ordered, and immutable", () => {
    const outline = parse_outline("# Alpha\n## Beta\n### alpha two\n");
    const before = JSON.stringify(outline);
    assert.deepEqual(outline_matches(outline, "ALPHA").map((item) => item.line), [1, 3]);
    assert.deepEqual(outline_matches(outline, "  ").map((item) => item.line), [1, 2, 3]);
    assert.deepEqual(outline_matches(outline, "missing"), []);
    assert.equal(JSON.stringify(outline), before);
    assert.notEqual(outline_matches(outline, ""), outline);
    assert.deepEqual(outline_matches(null, "alpha"), []);
});

test("Prompt exposes a compact outline, jump status, and cursor line", () => {
    const html = read("sources/browser/index.html");
    const prompt = html.split('<div class="tab-panel" id="tab-prompt"')[1]
        .split('<div class="tab-panel" id="tab-history"')[0];
    for (const id of ["prompt-outline", "prompt-outline-select", "prompt-outline-query",
        "prompt-outline-count", "prompt-outline-status", "prompt-cursor-status"]) {
        assert.ok(prompt.includes(`id="${id}"`), `Prompt outline is missing #${id}`);
    }
    assert.match(prompt, /<label for="prompt-outline-select">/);
    assert.match(prompt, /id="prompt-outline-status"[^>]*role="status"[^>]*aria-live="polite"/);
    assert.match(prompt, /id="prompt-outline-query"[^>]*type="search"/);
    assert.match(html, /\.prompt-outline\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(html, /#prompt-outline-select\s*\{[^}]*max-width:\s*100%/s);
    const source = read("sources/browser/studio.mjs");
    assert.match(source, /parse_outline\(/);
    assert.match(source, /outline_matches\(/);
    assert.match(source, /selection_for_line\(/);
    assert.match(source, /setSelectionRange\(/);
    assert.match(source, /No headings in this prompt/);
    assert.match(source, /prompt-outline-select/);
    assert.match(source, /prompt-outline-query/);
});

test("review progress separates decisions, checks, and removable lines", () => {
    const report = {
        identified: 5,
        executable: 3,
        approved: 1,
        check_scope: "file:prompts/x.md",
        removed: [2],
        requirements: [
            { id: "a", decision: "approved", eligible: true },
            { id: "b", decision: "unreviewed", eligible: false },
            { id: "c", decision: "rejected", eligible: false },
            { id: "d", decision: "approved", eligible: false },
        ],
    };
    assert.deepEqual(review_progress(report), {
        identified: 5,
        executable: 3,
        approved: 2,
        rejected: 1,
        unreviewed: 1,
        eligible: 1,
        non_executable: 2,
        blocked: 2,
        needs_check: 0,
        removable_lines: 1,
        decided: 3,
        all_reviewed: false,
        has_check: true,
    });
    const unchecked = review_progress({ ...report, check_scope: null, removed: [] });
    assert.equal(unchecked.needs_check, 3);
    assert.equal(unchecked.has_check, false);
    assert.equal(unchecked.removable_lines, 0);
    const empty = review_progress({});
    assert.equal(empty.identified, 0);
    assert.equal(empty.all_reviewed, false);
});

test("reduction summaries derive readiness only from the review report", () => {
    const text = "# Policy\nUse spaces.\nReviews are helpful.\n";
    const legacy = {
        identified: 0, executable: 0, approved: 0, removed: [], check_scope: null,
        requirements: [], reasons: ["legacy or stale review; regenerate before approval"],
    };
    const blocked = {
        identified: 2, executable: 1, approved: 0, removed: [], check_scope: null,
        requirements: [
            { id: "spaces", decision: "unreviewed", eligible: false },
            { id: "helpful", decision: "unreviewed", eligible: false },
        ],
        reasons: [],
    };
    const partial = {
        identified: 2, executable: 1, approved: 2, removed: [2], check_scope: "file:sample.mjs",
        requirements: [
            { id: "spaces", decision: "approved", eligible: true },
            { id: "helpful", decision: "approved", eligible: false },
        ],
        reasons: [],
    };
    const ready = {
        identified: 2, executable: 2, approved: 2, removed: [2, 3], check_scope: "file:sample.mjs",
        requirements: [
            { id: "spaces", decision: "approved", eligible: true },
            { id: "helpful", decision: "approved", eligible: true },
        ],
        reasons: [],
    };
    const before = JSON.stringify([legacy, blocked, partial, ready]);
    assert.equal(reduction_summary(legacy, text).readiness, "legacy");
    assert.equal(reduction_summary(legacy, text).retained, 3);
    assert.equal(reduction_summary(legacy, text).blockers[0].key, "stale");
    const blocked_summary = reduction_summary(blocked, text);
    assert.equal(blocked_summary.readiness, "blocked");
    assert.equal(blocked_summary.removable, 0);
    assert.deepEqual(blocked_summary.blockers.map((item) => [item.key, item.count]), [
        ["unreviewed", 2], ["non_executable", 1], ["needs_check", 1],
    ]);
    const partial_summary = reduction_summary(partial, text);
    assert.equal(partial_summary.readiness, "partial");
    assert.equal(partial_summary.removable, 1);
    assert.equal(partial_summary.retained, 2);
    assert.deepEqual(partial_summary.blockers.map((item) => item.key), ["non_executable"]);
    const ready_summary = reduction_summary(ready, text);
    assert.equal(ready_summary.readiness, "ready");
    assert.equal(ready_summary.removable, 2);
    assert.deepEqual(ready_summary.blockers, []);
    assert.equal(reduction_summary({ ...ready, removed: [99, "x", -1] }, text).removable, 0);
    assert.equal(reduction_summary({ identified: 0, executable: 0, requirements: [], reasons: [], removed: [] }, text).readiness, "blocked");
    assert.equal(reduction_summary({ reasons: ["bad metadata"], requirements: [{ id: "x" }] }, text).available, false);
    assert.equal(JSON.stringify([legacy, blocked, partial, ready]), before, "summary mutated its report");
});

test("retained reasons explain context, decisions, status, and check evidence", () => {
    const requirements = [
        { id: "spaces", line: 2, status: "executable" },
        { id: "helpful", line: 3, status: "human_judgment" },
    ];
    const report = {
        identified: 2, executable: 1, check_scope: "file:sample.mjs", removed: [],
        requirements: [
            { id: "spaces", decision: "approved", eligible: true },
            { id: "helpful", decision: "approved", eligible: false },
        ],
        reasons: [],
    };
    assert.equal(retained_reason(report, 1, requirements), "Context line: no extracted requirement.");
    assert.match(retained_reason(report, 3, requirements), /non-executable/);
    const pending = { ...report, requirements: [{ id: "spaces", decision: "unreviewed", eligible: false }] };
    assert.match(retained_reason(pending, 2, requirements), /Needs a decision/);
    const rejected = { ...report, requirements: [{ id: "spaces", decision: "rejected", eligible: false }] };
    assert.match(retained_reason(rejected, 2, requirements), /Rejected/);
    const unchecked = { ...report, check_scope: null, requirements: [{ id: "spaces", decision: "approved", eligible: false }] };
    assert.match(retained_reason(unchecked, 2, requirements), /current check/);
    const checked = { ...report, requirements: [{ id: "spaces", decision: "approved", eligible: false }] };
    assert.match(retained_reason(checked, 2, requirements), /recorded check/);
    assert.match(retained_reason(null, 2, requirements), /No review artifact/);
    assert.match(retained_reason({
        identified: 0, executable: 0, requirements: [], reasons: ["legacy review"], removed: [],
    }, 2, []), /No requirement-level review/);
    assert.match(retained_reason({
        identified: 1, executable: 1, requirements: [{ id: "x" }], reasons: ["stale metadata"], removed: [],
    }, 2, requirements), /Review unavailable/);
});

test("requirement filtering uses report decisions and never mutates", () => {
    const requirements = [
        { id: "a", status: "executable", title: "Files use spaces", quote: "Files use spaces.", reason: "Observed.", missing_facts: [], explanation: { title: "Spaces", text: "Reject tabs.", limitations: "Lexical only." } },
        { id: "b", status: "executable", title: "Tasks verify", quote: "Tasks verify.", reason: "Observed.", missing_facts: [] },
        { id: "c", status: "executable", title: "History stays", quote: "History stays.", reason: "Observed.", missing_facts: [] },
        { id: "d", status: "needs_facts", title: "Helpful reviews", quote: "Reviews help.", reason: "Needs judgement.", missing_facts: ["Review quality"] },
    ];
    const report = {
        requirements: [
            { id: "a", decision: "approved", eligible: true, reason: "Approved for scope." },
            { id: "b", decision: "unreviewed", eligible: false, reason: "Review first." },
            { id: "c", decision: "rejected", eligible: false, reason: "Rejected." },
            { id: "d", decision: "approved", eligible: false, reason: "Retained." },
        ],
    };
    const before = JSON.stringify(requirements);
    assert.deepEqual(filter_requirements(requirements, report, "", "all").map((item) => item.id), ["a", "b", "c", "d"]);
    assert.deepEqual(filter_requirements(requirements, report, "", "needs_review").map((item) => item.id), ["b"]);
    assert.deepEqual(filter_requirements(requirements, report, "", "approved").map((item) => item.id), ["a", "d"]);
    assert.deepEqual(filter_requirements(requirements, report, "", "rejected").map((item) => item.id), ["c"]);
    assert.deepEqual(filter_requirements(requirements, report, "", "non_executable").map((item) => item.id), ["d"]);
    assert.deepEqual(filter_requirements(requirements, report, "LEXICAL", "all").map((item) => item.id), ["a"]);
    assert.deepEqual(filter_requirements(requirements, report, "review quality", "all").map((item) => item.id), ["d"]);
    assert.deepEqual(
        filter_requirements(requirements, report, "separate explanation store", "all",
            (item) => item.id === "b" ? { text: "This text lives in the separate explanation store." } : null)
            .map((item) => item.id),
        ["b"],
    );
    assert.equal(JSON.stringify(requirements), before, "requirement filtering mutated its input");
    const orphan = filter_requirements(requirements, {}, "", "needs_review");
    assert.equal(orphan.length, 4, "an absent report must not silently hide requirements");
});

test("focused review navigation is pure, bounded, and immutable", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const before = JSON.stringify(items);
    assert.equal(resolve_focus_index(items, "b"), 1);
    assert.equal(resolve_focus_index(items, "missing"), 0);
    assert.equal(resolve_focus_index([], "a"), -1);
    assert.equal(resolve_focus_index(null, "a"), -1);
    assert.equal(move_focus_index(items, 1, 1), 2);
    assert.equal(move_focus_index(items, 2, 1), 2);
    assert.equal(move_focus_index(items, 0, -1), 0);
    assert.equal(move_focus_index([], 0, 1), -1);
    assert.deepEqual(focus_position(items, 1), { index: 1, count: 3, label: "Requirement 2 of 3" });
    assert.deepEqual(focus_position([], 0), { index: -1, count: 0, label: "No requirements visible" });
    assert.deepEqual(focus_item(items, 2), { id: "c" });
    assert.equal(focus_item(items, 9), null);
    assert.equal(focus_item(items, -1), null);
    assert.equal(JSON.stringify(items), before);
    assert.equal(resolve_focus_index([{ id: "x" }, { id: "x" }], "x"), 0);
});

test("Rules exposes a bounded one-at-a-time review mode", () => {
    const html = read("sources/browser/index.html");
    for (const id of ["review-focus-toggle", "review-focus-nav", "review-focus-prev", "review-focus-next",
        "review-focus-position", "review-focus-exit", "review-focus-status"]) {
        assert.ok(html.includes(`id="${id}"`), `Rules focus mode is missing #${id}`);
    }
    assert.match(html, /id="review-focus-nav"[^>]*hidden/);
    assert.match(html, /id="review-focus-status"[^>]*aria-live="polite"/);
    assert.match(html, /One at a time/);
    const source = read("sources/browser/studio.mjs");
    for (const text of ["review_focused", "review_focus_id", "set_review_focus(", "focus_visible_review(",
        "review_focus_nav.hidden", "reset_review_focus(", "Rendered = focused ? [focused] : []"]) {
        if (text === "Rendered = focused ? [focused] : []") {
            assert.match(source, /rendered = focused \? \[focused\] : \[\]/);
            continue;
        }
        assert.ok(source.includes(text), `Rules focus mode is missing: ${text}`);
    }
    assert.match(source, /review_focus_toggle\.addEventListener/);
    assert.match(source, /review_focus_prev\.addEventListener/);
    assert.match(source, /review_focus_next\.addEventListener/);
    assert.match(html, /\.review-focus-nav\[hidden\]\s*\{\s*display:\s*none/);
});

test("Rules explains review progress, legacy recovery, and next actions", () => {
    const html = read("sources/browser/index.html");
    for (const id of ["rules-overview", "review-policy", "review-counts", "review-next-note",
        "review-next-action", "review-toolbar", "review-search", "review-filter",
        "review-clear-filters", "review-next-needing", "review-queue-summary",
        "review-empty", "review-empty-clear", "review-empty-message", "review-empty-regenerate"]) {
        assert.ok(html.includes(`id="${id}"`), `Rules is missing #${id}`);
    }
    assert.match(html, /id="review-counts"[^>]*role="list"/);
    assert.match(html, /id="review-next-note"[^>]*aria-live="polite"/);
    assert.match(html, /id="review-queue-summary"[^>]*aria-live="polite"/);
    assert.match(html, /id="review-toolbar"[^>]*hidden/);
    const source = read("sources/browser/studio.mjs");
    for (const text of ["review_progress(", "filter_requirements(", "This reading has no requirement review",
        "This review is stale or incomplete", "Regenerate candidates", "Approve retained prose",
        "Go to Check", "Continue to Approve", "Review reduction blockers", "Needs a check.",
        "No requirements were extracted", "Exact deterministic interpretation and raw rules", "review_decide(candidate"]) {
        assert.ok(source.includes(text), `Rules is missing: ${text}`);
    }
    assert.match(source, /ruleset_render\(rule_set\)/);
    assert.match(source, /JSON\.stringify\(rule_set, null, 4\)/);
    assert.match(source, /aria-describedby/, "a disabled approval must point to its explanation");
    assert.match(html, /\.review-card\[data-decision="approved"\]/);
    assert.match(html, /\.review-legacy/);
});

test("source-line status distinguishes removable lines, decisions, and check gaps", () => {
    const text = "heading\nremove me\nblank context\nneeds decision\nneeds facts\nneeds check\nrejected line";
    const requirements = [
        { id: "a", line: 2, status: "executable" },
        { id: "b", line: 4, status: "executable" },
        { id: "c", line: 5, status: "needs_facts" },
        { id: "d", line: 6, status: "executable" },
        { id: "e", line: 7, status: "executable" },
    ];
    const report = {
        removed: [2],
        check_scope: "file:x",
        reasons: [],
        requirements: [
            { id: "a", decision: "approved", eligible: true },
            { id: "b", decision: "unreviewed", eligible: false },
            { id: "c", decision: "approved", eligible: false },
            { id: "d", decision: "approved", eligible: false },
            { id: "e", decision: "rejected", eligible: false },
        ],
    };
    const before = JSON.stringify(report);
    const rows = line_status_rows(text, report, requirements);
    assert.equal(rows.length, 7);
    assert.deepEqual(rows.map((row) => row.category), [
        "context", "removable", "context", "needs_decision", "non_executable", "needs_check", "rejected",
    ]);
    assert.equal(rows[1].state, "removable");
    assert.equal(rows[2].state, "retained");
    assert.deepEqual(line_status_counts(rows), {
        total: 7, removable: 1, retained: 6,
        by_category: { context: 2, removable: 1, needs_decision: 1, non_executable: 1, needs_check: 1, rejected: 1 },
    });
    assert.deepEqual(filter_line_status(rows, "removable").map((row) => row.line), [2]);
    assert.deepEqual(filter_line_status(rows, "context").map((row) => row.line), [1, 3]);
    assert.deepEqual(filter_line_status(rows, "attention").map((row) => row.line), [2, 4, 5, 6, 7]);
    assert.deepEqual(filter_line_status(rows, "retained").map((row) => row.line), [1, 3, 4, 5, 6, 7]);
    assert.equal(filter_line_status(rows, "unknown").length, 7);
    assert.equal(JSON.stringify(report), before);
    const legacy = line_status_rows("a\nb", { reasons: ["legacy"], removed: [] }, []);
    assert.ok(legacy.every((row) => row.category === "legacy"));
    assert.deepEqual(line_status_rows("", report, requirements), []);
    assert.ok(line_status_rows("a\nb", null, []).every((row) => row.category === "legacy"));
});

test("Comparison and Reduced explain readiness and never offer a vacuous reduction", () => {
    const html = read("sources/browser/index.html");
    for (const id of ["compare-readiness", "compare-status", "compare-counts", "compare-blockers",
        "compare-action-note", "compare-actions", "compare-table-wrap", "reduced-readiness",
        "reduced-status", "reduced-counts", "reduced-blockers", "reduced-action-note",
        "reduced-download", "diff-empty", "line-status", "line-status-filter", "line-status-summary",
        "line-status-body", "line-status-empty"]) {
        assert.ok(html.includes(`id="${id}"`), `Reduction UI is missing #${id}`);
    }
    assert.match(html, /id="line-status-summary"[^>]*aria-live="polite"/);
    assert.match(html, /<option value="attention">Needs attention<\/option>/);
    assert.match(html, /id="line-status-filter"[\s\S]*?<option value="removable">/);
    assert.match(read("sources/browser/studio.mjs"), /line_status_section\.hidden = !show_lines/);
    assert.match(read("sources/browser/studio.mjs"), /!summary\.legacy && summary\.available && summary\.identified > 0/);
    assert.match(html, /id="compare-status"[^>]*aria-live="polite"/);
    assert.match(html, /id="reduced-status"[^>]*aria-live="polite"/);
    assert.match(html, /id="reduced-download"[^>]*aria-disabled="true"/);
    assert.match(html, /class="diff-legend"/);
    for (const column of ["Source line", "Requirement", "Decision", "Eligibility", "Why retained or eligible"]) {
        assert.ok(html.includes(`<th>${column}</th>`), `Comparison is missing the ${column} column`);
    }
    assert.match(html, /\.table-scroll\s*\{[^}]*overflow-x:\s*auto/s);
    assert.match(html, /#reduced-download\[aria-disabled="true"\]/);
    const source = read("sources/browser/studio.mjs");
    for (const text of ["reduction_summary(", "retained_reason(", "Nothing can be removed yet.",
        "Reduced prompt download unavailable", "No extraction or approval blocker is recorded",
        "Resolve the retained reasons", "removeAttribute(\"href\")", "setAttribute(\"aria-disabled\", \"true\")",
        "setAttribute(\"aria-disabled\", \"false\")", "render_line_status(", "line_status_rows(",
        "filter_line_status(", "Open line "]) {
        assert.ok(source.includes(text), `Reduction UI is missing: ${text}`);
    }
    assert.match(source, /if \(can_download\)/);
});

test("candidate statistics separate selected-source lines from all case files", () => {
    const candidate = {
        rules: { facts: [], rules: [{ id: "one" }, { id: "two" }] },
        cases: [
            { rule: "one", source: "prompts/x.md", original: "Rule A" },
            { rule: "two", source: "prompts/x.md", original: "Rule A" },
            { rule: "two", source: "prompts/y.md", original: "Rule B" },
            { rule: "two", original: "Rule C" },
        ],
    };
    const before = JSON.stringify(candidate);
    assert.deepEqual(candidate_stats(candidate, "prompts/x.md"), {
        rule_count: 2,
        case_count: 4,
        source_lines: 2,
        source_files: 2,
        cross_file_cases: 1,
    });
    assert.equal(JSON.stringify(candidate), before, "statistics mutated the candidate");

    const multi_file = {
        rules: { facts: [], rules: [] },
        cases: [
            { rule: "a", source: "prompts/one.md", original: "One" },
            { rule: "b", source: "prompts/two.md", original: "Two" },
            { rule: "c", source: "prompts/two.md", original: "Two" },
        ],
    };
    const multi_before = JSON.stringify(multi_file);
    assert.deepEqual(candidate_stats(multi_file, "prompts/one.md"), {
        rule_count: 0,
        case_count: 3,
        source_lines: 1,
        source_files: 2,
        cross_file_cases: 2,
    });
    assert.equal(JSON.stringify(multi_file), multi_before, "multi-file statistics mutated the candidate");

    const current = {
        rules: { facts: [], rules: [{ id: "old" }] },
        cases: [
            { rule: "old", source: "prompts/x.md", original: "Rule A" },
            { rule: "old", source: "prompts/x.md", original: "Rule D" },
        ],
    };
    assert.deepEqual(coverage_delta(candidate, current, "prompts/x.md"), {
        shared: 1,
        only_this: 1,
        only_current: 1,
        examples: { shared: ["Rule A"], only_this: ["Rule C"], only_current: ["Rule D"] },
    });
    const none = coverage_delta(candidate, null, "prompts/x.md");
    assert.equal(none.shared, 0);
    assert.equal(none.only_this, 2);
    assert.equal(none.only_current, 0);
});

test("candidate rule comparison is structural and never ranks readings", () => {
    const current = {
        id: "current",
        rules: { facts: [], rules: [
            { id: "a", when: [{ fact: { type: "file", path: "x" } }], then: [{ emit: "a" }] },
            { id: "b", when: [{ fact: { type: "file", path: "y" } }], then: [{ emit: "b" }] },
            { id: "c", when: [{ fact: { type: "file", path: "z" } }], then: [{ emit: "c" }] },
        ] },
    };
    const candidate = {
        id: "other",
        rules: { facts: [], rules: [
            { then: [{ emit: "b2" }], when: [{ fact: { path: "y", type: "file" } }], id: "b" },
            { id: "c", when: [{ fact: { type: "file", path: "z" } }], then: [{ emit: "c" }] },
            { id: "a", when: [{ fact: { type: "file", path: "x" } }], then: [{ emit: "a" }] },
            { id: "d", when: [{ fact: { type: "file", path: "w" } }], then: [{ emit: "d" }] },
        ] },
    };
    const before = JSON.stringify({ candidate, current });
    const diff = rule_diff(candidate, current);
    assert.equal(diff.valid, true);
    assert.deepEqual(diff.shared, ["b", "c", "a"]);
    assert.deepEqual(diff.only_this, ["d"]);
    assert.deepEqual(diff.only_current, []);
    assert.deepEqual(diff.changed, ["b"]);
    assert.equal(diff.order_changed, true);
    assert.equal(diff.identical, false);
    assert.match(rule_diff_summary(diff), /1 only here/);
    assert.match(rule_diff_summary(diff), /1 changed/);
    assert.match(rule_diff_summary(diff), /order differs/);
    assert.equal(JSON.stringify({ candidate, current }), before);

    const canonical_twin = {
        id: "twin",
        rules: { facts: [], rules: [
            { then: [{ emit: "a" }], when: [{ fact: { path: "x", type: "file" } }], id: "a" },
            { id: "b", when: [{ fact: { type: "file", path: "y" } }], then: [{ emit: "b" }] },
            { id: "c", when: [{ fact: { type: "file", path: "z" } }], then: [{ emit: "c" }] },
        ] },
    };
    assert.equal(rule_diff(canonical_twin, current).identical, true);
});

test("candidate rule comparison fails closed on malformed rules", () => {
    const malformed = { id: "bad", rules: { rules: [{ id: "a" }, { id: "a" }, { when: [] }] } };
    const valid = { id: "ok", rules: { rules: [{ id: "a", when: [], then: [] }] } };
    const diff = rule_diff(malformed, valid);
    assert.equal(diff.valid, false);
    assert.equal(diff.identical, false);
    assert.ok(diff.errors.some((error) => /repeats rule id a/.test(error)));
    assert.ok(diff.errors.some((error) => /has no id/.test(error)));
    assert.equal(rule_diff_summary(diff), "Rules cannot be compared safely");
    assert.equal(rule_diff(valid, null).valid, false);
    assert.equal(rule_diff({ id: "none" }, valid).valid, false);
});

test("candidate display order puts the current choice first without mutation", () => {
    const candidates = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const before = JSON.stringify(candidates);
    assert.deepEqual(display_order(candidates, "b").map((item) => item.id), ["b", "a", "c"]);
    assert.deepEqual(display_order(candidates, "missing").map((item) => item.id), ["a", "b", "c"]);
    assert.deepEqual(display_order([], "x"), []);
    assert.equal(JSON.stringify(candidates), before);
});

test("Candidates clarifies stats, choice, comparison, and next action", () => {
    const source = read("sources/browser/studio.mjs");
    const html = read("sources/browser/index.html");
    assert.match(source, /candidate_stats\(/, "Candidates does not use distinct statistics");
    assert.match(source, /coverage_delta\(/, "Candidates has no coverage comparison");
    assert.match(source, /candidate_stats\(item, entry\.source\)/, "statistics do not use the selected source");
    assert.match(source, /display_order\(entry\.candidates, candidate\.id\)/, "the current choice is not rendered first");
    assert.match(source, /candidate_rules_delta\(item\)/, "Candidates has no formal rule comparison");
    assert.match(source, /Formal differences:/);
    assert.match(source, /These rule sets cannot be compared safely/);
    assert.match(source, /Same rules and quoted lines/);
    assert.match(source, /Same rules; only case coverage differs/);
    assert.match(source, /Current choice \(not approval\)/);
    assert.match(source, /describe form, not correctness or better intent/);
    assert.ok(!/Covers .*line\(s\)/.test(source), "case count is still presented as covered lines");
    assert.match(source, /Current choice/);
    assert.match(source, /Choose this reading/);
    assert.match(source, /Continue to Rules/);
    assert.match(source, /Choosing a reading changes which rules are reviewed; it does not approve them/);
    assert.match(source, /No reading has been generated/);
    assert.match(source, /Go to Prompt and generate/);
    assert.match(html, /id="candidates-summary"[^>]*aria-live="polite"/);
    assert.match(html, /id="candidates-next"[^>]*hidden/);
    assert.match(html, /\.candidate-stats/);
    assert.match(html, /\.candidate-delta/);
    assert.match(html, /\.candidate-rule-diff/);
    assert.match(html, /\.rule-id-list\s*\{[^}]*max-height/s);
    assert.match(html, /\.candidate-empty/);
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
        assert.match(entry.source_sha256, /^[0-9a-f]{64}$/, `${entry.source}: no source_sha256`);
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

test("scope statistics count files, observations, and sorted types", () => {
    const files = [
        { path: "sources/a.mjs", entities: [{ type: "file", path: "sources/a.mjs" }, { type: "task", id: "t1" }] },
        { path: "prompts/b.md", entities: [{ type: "file", path: "prompts/b.md" }, { type: "task", id: "t2" }] },
        { path: "prompts/c.md", entities: [{ type: "feature", id: "f1" }] },
    ];
    const before = JSON.stringify(files);
    assert.deepEqual(scope_stats(files), {
        file_count: 3,
        fact_count: 5,
        types: ["feature", "file", "task"],
        counts: { feature: 1, file: 2, task: 2 },
    });
    assert.equal(JSON.stringify(files), before, "scope_stats mutated its input");
    assert.deepEqual(scope_stats([]), { file_count: 0, fact_count: 0, types: [], counts: {} });
});

test("required fact types separate positive observations from actions and variables", () => {
    const rules = [
        { id: "file-rule", when: [{ fact: { type: "file", path: "$p" } }], then: [{ emit: "x" }] },
        { id: "task-rule", when: [{ count: { fact: { type: "task" }, at_least: 1 } }, { fact: { type: "task", id: "$t" }, not: true }], then: [{ assert: { type: "finding", task: "$t" } }] },
        { id: "any-kind", when: [{ fact: { type: "$kind" } }], then: [{ emit: "x" }] },
    ];
    assert.deepEqual(required_fact_types(rules), [
        { type: "file", rule_ids: ["file-rule"], observation_required: true },
        { type: "finding", rule_ids: ["task-rule"], observation_required: false },
        { type: "task", rule_ids: ["task-rule"], observation_required: false },
    ]);
    assert.deepEqual(required_fact_types([]), []);
});

test("check readiness mirrors conservative observation and field gates", () => {
    const rules = [{ id: "files", when: [{ fact: { type: "file", path: "$p", has_tab: false } }], then: [{ emit: "x" }] }];
    const empty = check_readiness(rules, []);
    assert.equal(empty.ready, false);
    assert.match(empty.reason, /no observations/);
    const wrong = check_readiness(rules, [{ type: "task", id: "t" }]);
    assert.equal(wrong.ready, false);
    assert.deepEqual(wrong.missing_types, ["file"]);
    assert.match(wrong.reason, /required fact types: file/);
    const incomplete = check_readiness(rules, [{ type: "file" }]);
    assert.equal(incomplete.ready, false);
    assert.deepEqual(incomplete.missing_fields, ["file.path", "file.has_tab"]);
    assert.match(incomplete.reason, /required fields/);
    const ready = check_readiness(rules, [{ type: "file", path: "sources/a.mjs", has_tab: false }]);
    assert.deepEqual(ready, { ready: true, blocked: false, reason: "", missing_types: [], missing_fields: [], fact_count: 1 });
    const count_only = [{ id: "tasks", when: [{ count: { fact: { type: "task" }, at_least: 1 } }], then: [{ emit: "x" }] }];
    assert.match(check_readiness(count_only, [{ type: "file", path: "x" }]).reason, /no observations relevant/);
});

test("check evaluation summary never turns no emissions into a pass", () => {
    assert.deepEqual(evaluation_summary({ firings: 3, emitted: [] }), {
        firings: 3, emission_count: 0, has_violations: false, completed: true,
    });
    assert.deepEqual(evaluation_summary({ firings: 1, emitted: [{ violation: "x" }] }), {
        firings: 1, emission_count: 1, has_violations: true, completed: true,
    });
});

test("scope suggestions find viable evidence and rank ready scopes first", () => {
    const files = [
        {
            path: "sources/a.mjs", facts: { directory: "sources" },
            entities: [{ type: "file", path: "sources/a.mjs", indent_unit: 4 }],
        },
        {
            path: "sources/b.md", facts: { directory: "sources" },
            entities: [{ type: "task", id: "b", path: "sources/b.md" }],
        },
        {
            path: "prompts/a.md", facts: { directory: "prompts" },
            entities: [{ type: "task", id: "a", path: "prompts/a.md" }],
        },
    ];
    const rules = [
        { id: "needs-file", when: [{ fact: { type: "file", indent_unit: 4 } }], then: [{ emit: "x" }] },
        { id: "needs-task", when: [{ fact: { type: "task", id: "$t" } }], then: [{ emit: "$t" }] },
    ];
    const before = JSON.stringify(files);
    const options = scope_options(files, rules);
    const by_value = new Map(options.map((option) => [option.value, option]));
    assert.equal(by_value.get("file:sources/a.mjs").ready, false);
    assert.equal(by_value.get("file:sources/b.md").ready, false);
    assert.equal(by_value.get("file:prompts/a.md").ready, false);
    assert.equal(by_value.get("dir:sources").ready, true);
    assert.equal(by_value.get("dir:prompts").ready, false);
    assert.ok(by_value.get("dir:sources").types.includes("file"));
    assert.equal(JSON.stringify(files), before);

    const ranked = rank_scope_suggestions(options, 3);
    assert.equal(ranked[0].value, "dir:sources");
    assert.equal(ranked.length, 3);
    const first_blocked = ranked.findIndex((option) => !option.ready);
    assert.ok(first_blocked > 0);
    assert.ok(ranked.slice(first_blocked).every((option) => !option.ready));
    assert.match(suggestion_label(by_value.get("dir:sources")), /ready$/);
    assert.match(suggestion_label(by_value.get("file:prompts/a.md")), /missing file/);
    assert.equal(rank_scope_suggestions(null).length, 0);
    assert.equal(rank_scope_suggestions([{ value: "x" }, { value: "x" }]).length, 1);
    assert.equal(scope_options([{ path: "bad" }, null], rules).length, 0);
});

test("Check explains scope, readiness, results, and the separate approval step", () => {
    const html = read("sources/browser/index.html");
    for (const id of ["scope-preview", "check-readiness", "check-status", "check-next",
        "check-next-action", "run", "check-summary", "check-output", "scope-suggestions",
        "scope-suggestion-note", "scope-suggestion-list", "scope-use-best"]) {
        assert.ok(html.includes(`id="${id}"`), `Check is missing #${id}`);
    }
    assert.match(html, /id="scope-suggestion-list"/);
    assert.match(html, /Choosing one does not run the check or approve anything/);
    assert.match(html, /id="scope"[^>]*aria-describedby="check-readiness"/);
    assert.match(html, /id="run"[^>]*aria-describedby="check-readiness"/);
    assert.match(html, /id="check-status"[^>]*aria-live="polite"/);
    assert.match(html, /id="check-readiness"[^>]*aria-live="polite"/);
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    for (const phrase of ["deterministic", "build-time snapshot", "only the selected scope",
        "does not prove", "Continue to Approve"]) {
        assert.ok(text.includes(phrase), `Check is missing: ${phrase}`);
    }
    const source = read("sources/browser/studio.mjs");
    for (const text of ["scope_stats(", "check_readiness(", "evaluation_summary(",
        "Evaluation completed", "no violation was emitted", "not a pass", "Cannot run:",
        "No evaluation is recorded", "Running…", "review_check(candidate", "scope_options(",
        "rank_scope_suggestions(", "render_scope_suggestions(", "choose_scope(", "scope_changed("]) {
        assert.ok(source.includes(text), `Check controller is missing: ${text}`);
    }
    assert.match(source, /aria-busy/);
    assert.match(source, /render_check_preview\(\)/);
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

test("approval readiness separates evidence, warnings, and legacy review", () => {
    const report = {
        identified: 2, executable: 2, approved: 1, removed: [2], check_scope: "file:prompts/x.md",
        requirements: [
            { id: "a", decision: "approved", eligible: true, reason: "Approved." },
            { id: "b", decision: "unreviewed", eligible: false, reason: "No decision." },
        ],
    };
    const candidate = { id: "c", title: "Current", review: { requirements: [{ id: "a" }, { id: "b" }] } };
    const before = JSON.stringify({ report, candidate });
    const items = approval_checklist(candidate, report, false);
    assert.equal(items.find((item) => item.id === "check").state, "done");
    assert.equal(items.find((item) => item.id === "decisions").state, "warning");
    assert.equal(items.find((item) => item.id === "reduction").state, "done");
    const legacy = approval_checklist({ id: "old", title: "Old" }, { reasons: ["legacy"], requirements: [] }, true);
    assert.equal(legacy.find((item) => item.id === "review").state, "blocked");
    assert.equal(legacy.find((item) => item.id === "edit").state, "blocked");
    assert.deepEqual(artifact_state(report, false), { complete: true, rules: true, reduced: true, reduced_reason: "1 approved line(s) are removable." });
    assert.equal(artifact_state({ removed: [] }, true).reduced, false);
    assert.equal(JSON.stringify({ report, candidate }), before);
});

test("build coverage wording distinguishes unavailable review from reviewed zero", () => {
    assert.equal(build_coverage_text({
        identified: 4, approved: 2, removed: [2, 3], reasons: [],
    }), "4 identified · 2 approved · 2 removable line(s)");
    assert.equal(build_coverage_text({
        identified: 0, approved: 0, removed: [], reasons: [],
    }), "0 identified · 0 approved · 0 removable line(s)");
    assert.equal(build_coverage_text({
        identified: 0, approved: 0, removed: [], reasons: ["legacy or stale review"],
    }), "Requirement review unavailable (legacy or stale)");
    assert.match(build_coverage_text({
        identified: 0, approved: 0, removed: [2, 3], reasons: ["legacy"],
    }), /Requirement review unavailable \(legacy or stale\).*2 removable line\(s\)/);
    assert.match(build_coverage_text(null), /Coverage unavailable/);
    assert.match(build_coverage_text({ removed: [] }), /Requirement review unavailable/);
    assert.match(build_coverage_text({ identified: "4", approved: 2, removed: [], reasons: [] }), /Coverage unavailable/);
    assert.match(build_coverage_text({ identified: 3, approved: 1, removed: [], reasons: "bad" }), /Requirement review unavailable/);
});

test("build filtering puts stale entries first and separates filters", () => {
    const catalog = [
        { source: "prompts/fresh.md", source_sha256: "a", approved: "one" },
        { source: "prompts/stale.md", source_sha256: "b", approved: "one" },
        { source: "prompts/removable.md", source_sha256: "c", approved: "one" },
    ];
    const entries = [
        { source: "prompts/fresh.md", candidate: "one", source_sha256: "a", rules: 1, coverage: { removed: [] } },
        { source: "prompts/stale.md", candidate: "one", source_sha256: "old", rules: 1, coverage: { removed: [] } },
        { source: "prompts/removable.md", candidate: "one", source_sha256: "c", rules: 2, coverage: { removed: [4] } },
        { source: "prompts/missing.md", candidate: "one", source_sha256: "x", rules: 1, coverage: { removed: [] } },
        { candidate: "bad" },
        null,
    ];
    const before = JSON.stringify({ entries, catalog });
    const rows = build_rows(entries, catalog);
    assert.equal(rows.length, 4);
    const sorted = sort_build_rows(rows);
    assert.deepEqual(sorted.map((row) => row.entry.source), [
        "prompts/stale.md", "prompts/missing.md", "prompts/fresh.md", "prompts/removable.md",
    ]);
    assert.deepEqual(filter_build_rows(rows, "stale").map((row) => row.entry.source).sort(), [
        "prompts/missing.md", "prompts/stale.md",
    ]);
    assert.deepEqual(filter_build_rows(rows, "fresh").map((row) => row.entry.source).sort(), [
        "prompts/fresh.md", "prompts/removable.md",
    ]);
    assert.deepEqual(filter_build_rows(rows, "removable").map((row) => row.entry.source), ["prompts/removable.md"]);
    assert.equal(filter_build_rows(rows, "all").length, 4);
    assert.deepEqual(build_filter_counts(rows), { all: 4, fresh: 2, stale: 1, missing: 1, removable: 1 });
    assert.equal(JSON.stringify({ entries, catalog }), before);
    assert.deepEqual(build_rows(null, null), []);
});

test("build freshness and totals fail conservatively", () => {
    const catalog = { source_sha256: "aa", approved: "chosen" };
    assert.equal(build_freshness({ source_sha256: "aa", candidate: "chosen" }, catalog).state, "fresh");
    assert.equal(build_freshness({ source_sha256: "aa", candidate: "first" }, {
        source_sha256: "aa", candidates: [{ id: "first" }],
    }).state, "fresh");
    assert.equal(build_freshness({ source_sha256: "bb", candidate: "chosen" }, catalog).state, "stale");
    assert.equal(build_freshness({ source_sha256: "aa", candidate: "other" }, catalog).state, "stale");
    assert.equal(build_freshness({ candidate: "chosen" }, catalog).state, "missing");
    assert.equal(build_freshness(null, catalog).state, "missing");
    assert.deepEqual(build_totals({ entries: [
        { coverage: { removed: [2, 3] } }, { coverage: { removed: [] } }, {}
    ], generated_at: "today" }), { entries: 3, with_removable: 1, removable: 2, generated_at: "today" });
    assert.deepEqual(build_totals(null), { entries: 0, with_removable: 0, removable: 0, generated_at: "" });
});

test("step status summarizes readiness without claiming approval", () => {
    const blocked = step_statuses({
        candidate: null, report: null, objects: { total: 0, reviewed: 0, unreviewed: 0 }, edited: false,
        build: { present: false, freshness: null },
    });
    assert.equal(blocked.length, 7);
    assert.equal(blocked.find((row) => row.step === "candidates").state, "blocked");
    assert.equal(blocked.find((row) => row.step === "rules").state, "blocked");
    assert.equal(blocked.find((row) => row.step === "objects").state, "optional");
    assert.equal(blocked.find((row) => row.step === "build").state, "blocked");
    assert.equal(next_recommended_step(blocked).step, "candidates");

    const ready = step_statuses({
        candidate: { id: "c", review: { requirements: [{ id: "r" }] } },
        report: {
            requirements: [{ id: "r", decision: "approved", eligible: true }],
            executable: 1, check_scope: "file:x", removed: [1], reasons: [],
        },
        objects: { total: 2, reviewed: 2, unreviewed: 0 },
        edited: false,
        build: { present: true, freshness: "fresh" },
    });
    assert.equal(ready.find((row) => row.step === "prompt").state, "ready");
    for (const step of ["objects", "candidates", "rules", "check", "approve", "build"]) {
        assert.equal(ready.find((row) => row.step === step).state, "done", step);
    }
    assert.equal(next_recommended_step(ready), null);

    const attention = step_statuses({
        candidate: { id: "c", review: { requirements: [{ id: "r" }] } },
        report: {
            requirements: [{ id: "r", decision: "unreviewed" }],
            executable: 1, check_scope: null, removed: [], reasons: [],
        },
        objects: { total: 2, reviewed: 1, unreviewed: 1 },
        edited: true,
        build: { present: true, freshness: "stale" },
    });
    assert.equal(attention.find((row) => row.step === "prompt").state, "attention");
    assert.equal(attention.find((row) => row.step === "objects").state, "attention");
    assert.equal(attention.find((row) => row.step === "rules").state, "attention");
    assert.equal(attention.find((row) => row.step === "check").state, "blocked");
    assert.equal(attention.find((row) => row.step === "build").state, "attention");
    assert.equal(next_recommended_step(attention).step, "check");
    assert.deepEqual(step_statuses(null), blocked);
});

test("the Approve and Build panels expose readiness, artifacts, and freshness", () => {
    const html = read("sources/browser/index.html");
    for (const id of ["approve-checklist", "approve-artifact-note", "build-totals", "build-filter",
        "build-filter-summary", "build-empty", "build-filter-reset"]) {
        assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
    }
    assert.match(html, /id="build-filter"[\s\S]*?<option value="stale">/);
    assert.match(html, /All entries \(stale first\)/);
    assert.match(html, /id="approve-compile"[^>]*class="primary-action"/);
    assert.match(html, /id="approve-rules"[^>]*>Download the rules only \(not approval\)/);
    assert.match(html, /id="approve-reduced"[^>]*aria-disabled="true"/);
    assert.match(html, /later work must supply facts and run the saved rules/);
    assert.match(html, /@media \(max-width: 54rem\)[\s\S]*\.approval-item\s*\{\s*grid-template-columns:\s*1fr;/);
    const build_panel = html.split('id="step-build"')[1].split("</section>")[0];
    assert.ok(!/approved candidates/i.test(build_panel), "Build claims candidates are approved");
    assert.match(build_panel, /recorded candidate selections/i);
    assert.match(build_panel, /selection is not requirement approval/i);
    assert.match(build_panel, /supply facts and run the saved rules/i);
    const source = read("sources/browser/studio.mjs");
    assert.match(source, /approval_checklist\(/);
    assert.match(source, /build_freshness\(/);
    assert.match(source, /build_coverage_text\(item\.coverage\)/);
    assert.match(source, /build_rows\(build_state\.entries, catalog\.entries\)/);
    assert.match(source, /filter_build_rows\(rows, build_filter_mode\)/);
    assert.match(source, /build_filter\.addEventListener/);
    assert.match(source, /reduced_link\.removeAttribute\("href"\)/);
    assert.match(source, /aria-busy/);
    assert.match(source, /Approval remains a human decision/);
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
