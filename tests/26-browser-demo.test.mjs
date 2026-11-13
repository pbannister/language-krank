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
import { filter_proposals, review_counts } from "../sources/browser/object-filter.mjs";
import { review_progress, filter_requirements } from "../sources/browser/review-queue.mjs";
import { reduction_summary, retained_reason } from "../sources/browser/reduction-summary.mjs";

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
    for (const id of ["source", "candidates", "rules", "prose", "comparison", "reduced", "diff", "scope", "run", "check-output", "approve", "object-tabs", "objects-count", "propose", "object-file", "file-history", "history-log", "prompt-download", "file-overlay", "file-overlay-body", "file-overlay-note", "file-overlay-close", "candidates-note", "candidates-summary", "candidates-next", "rules-badges", "rule-summary", "uncovered", "check-summary", "approve-warning", "build", "build-cycle", "build-note", "build-entries", "build-output", "revise-comparison", "revise-approve"]) {
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

test("Objects review toolbar filters across tabs and exposes progress", () => {
    const html = read("sources/browser/index.html");
    for (const id of ["object-review-toolbar", "object-search", "object-filter", "object-clear-filters",
        "object-next-unreviewed", "object-review-summary", "object-empty", "object-empty-clear"]) {
        assert.ok(html.includes(`id="${id}"`), `the review toolbar has no #${id}`);
    }
    assert.match(html, /id="object-search"[^>]*type="search"/);
    assert.match(html, /id="object-review-summary"[^>]*aria-live="polite"/);
    assert.match(html, /id="object-next-unreviewed"[^>]*type="button"/);
    const source = read("sources/browser/studio.mjs");
    for (const wiring of ["filter_proposals(", 'origin-${row.origin === "registry" ? "registry" : "scan"}',
        "object_empty.hidden", "next_unreviewed", "aria-busy", "new_count", "known_count"]) {
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

test("Comparison and Reduced explain readiness and never offer a vacuous reduction", () => {
    const html = read("sources/browser/index.html");
    for (const id of ["compare-readiness", "compare-status", "compare-counts", "compare-blockers",
        "compare-action-note", "compare-actions", "compare-table-wrap", "reduced-readiness",
        "reduced-status", "reduced-counts", "reduced-blockers", "reduced-action-note",
        "reduced-download", "diff-empty"]) {
        assert.ok(html.includes(`id="${id}"`), `Reduction UI is missing #${id}`);
    }
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
        "setAttribute(\"aria-disabled\", \"false\")", "render_retained_groups("]) {
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

test("Candidates clarifies stats, choice, comparison, and next action", () => {
    const source = read("sources/browser/studio.mjs");
    const html = read("sources/browser/index.html");
    assert.match(source, /candidate_stats\(/, "Candidates does not use distinct statistics");
    assert.match(source, /coverage_delta\(/, "Candidates has no coverage comparison");
    assert.match(source, /candidate_stats\(item, entry\.source\)/, "statistics do not use the selected source");
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
