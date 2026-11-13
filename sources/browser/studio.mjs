// studio.mjs — the prompt studio.
//
// A step rail drives one panel per step: the prompt (editable, with its file
// history), the object-model review, the candidates, the compiled rules, the
// rendered prose, the comparison, the reduced prompt with its diff, the check,
// and the approval summary. The catalog (catalog.json), the file facts
// (files.json), and the object model (object-model.json) are built by
// scripts/studio-build.sh. Compile and propose call the server on demand, and
// state is local to the page.
//
// State is local to the page: choosing a candidate, editing the prompt, or
// narrowing the object model changes what is shown and what the downloads
// contain, and writes nothing.

import { ruleset_render, ruleset_run } from "../krank.mjs";
import { diff_lines } from "./prompt-diff.mjs";
import { render_file } from "./file-view.mjs";
import { review_report, review_reduce, review_check, review_decide, review_observations_match, explanation_current } from "../compile-review.mjs";
import { filter_proposals, review_counts, review_breakdown } from "./object-filter.mjs";
import { candidate_stats, coverage_delta } from "./candidate-summary.mjs";
import { rule_diff, rule_diff_summary, display_order } from "./candidate-diff.mjs";
import { review_progress, filter_requirements } from "./review-queue.mjs";
import { resolve_focus_index, move_focus_index, focus_position, focus_item } from "./review-focus.mjs";
import { reduction_summary, retained_reason, line_status_rows, filter_line_status, line_status_counts } from "./reduction-summary.mjs";
import { scope_stats, check_readiness, evaluation_summary } from "./check-summary.mjs";
import { scope_options, rank_scope_suggestions, suggestion_label } from "./scope-suggestions.mjs";
import { step_statuses, next_recommended_step } from "./step-status.mjs";
import { pipeline_track, pipeline_detail } from "./pipeline-model.mjs";
import { approval_checklist, artifact_state, build_coverage_text, build_freshness, build_totals, build_rows, sort_build_rows, filter_build_rows, build_filter_counts } from "./approve-build-summary.mjs";
import { parse_outline, selection_for_line, outline_matches } from "./prompt-outline.mjs";

const catalog = await load_json("./catalog.json");
const bundle = await load_json("./files.json");
const object_model = await load_json("./object-model.json");

const select_prompt = document.querySelector("#prompt");
const select_scope = document.querySelector("#scope");
const textarea = document.querySelector("#source");
const edit_note = document.querySelector("#edit-note");
const candidates_box = document.querySelector("#candidates");
const candidates_note = document.querySelector("#candidates-note");
const candidates_summary = document.querySelector("#candidates-summary");
const candidates_next = document.querySelector("#candidates-next");
const rules_box = document.querySelector("#rules");
const rules_note = document.querySelector("#rules-note");
const rules_badges = document.querySelector("#rules-badges");
const rule_summary = document.querySelector("#rule-summary");
const review_overview = document.querySelector("#rules-overview");
const review_policy = document.querySelector("#review-policy");
const review_counts_box = document.querySelector("#review-counts");
const review_next_note = document.querySelector("#review-next-note");
const review_next_action = document.querySelector("#review-next-action");
const review_toolbar = document.querySelector("#review-toolbar");
const review_search = document.querySelector("#review-search");
const review_filter = document.querySelector("#review-filter");
const review_clear_filters = document.querySelector("#review-clear-filters");
const review_next_needing = document.querySelector("#review-next-needing");
const review_focus_toggle = document.querySelector("#review-focus-toggle");
const review_focus_nav = document.querySelector("#review-focus-nav");
const review_focus_prev = document.querySelector("#review-focus-prev");
const review_focus_next = document.querySelector("#review-focus-next");
const review_focus_position = document.querySelector("#review-focus-position");
const review_focus_exit = document.querySelector("#review-focus-exit");
const review_focus_status = document.querySelector("#review-focus-status");
const review_queue_summary = document.querySelector("#review-queue-summary");
const review_empty = document.querySelector("#review-empty");
const review_empty_message = document.querySelector("#review-empty-message");
const review_empty_clear = document.querySelector("#review-empty-clear");
const review_empty_regenerate = document.querySelector("#review-empty-regenerate");
const prose_box = document.querySelector("#prose");
const compare_note = document.querySelector("#compare-note");
const compare_readiness = document.querySelector("#compare-readiness");
const compare_status = document.querySelector("#compare-status");
const compare_counts_box = document.querySelector("#compare-counts");
const compare_blockers = document.querySelector("#compare-blockers");
const compare_action_note = document.querySelector("#compare-action-note");
const compare_actions = document.querySelector("#compare-actions");
const compare_table_wrap = document.querySelector("#compare-table-wrap");
const comparison = document.querySelector("#comparison");
const line_status_section = document.querySelector("#line-status");
const line_status_filter = document.querySelector("#line-status-filter");
const line_status_summary = document.querySelector("#line-status-summary");
const line_status_body = document.querySelector("#line-status-body");
const line_status_empty = document.querySelector("#line-status-empty");
const reduced_readiness = document.querySelector("#reduced-readiness");
const reduced_status = document.querySelector("#reduced-status");
const reduced_counts_box = document.querySelector("#reduced-counts");
const reduced_blockers = document.querySelector("#reduced-blockers");
const reduced_action_note = document.querySelector("#reduced-action-note");
const reduced_download = document.querySelector("#reduced-download");
const reduced_box = document.querySelector("#reduced");
const diff_box = document.querySelector("#diff");
const diff_empty = document.querySelector("#diff-empty");
const check_output = document.querySelector("#check-output");
const check_summary = document.querySelector("#check-summary");
const scope_preview = document.querySelector("#scope-preview");
const scope_suggestions = document.querySelector("#scope-suggestions");
const scope_suggestion_note = document.querySelector("#scope-suggestion-note");
const scope_suggestion_list = document.querySelector("#scope-suggestion-list");
const scope_use_best = document.querySelector("#scope-use-best");
const check_readiness_box = document.querySelector("#check-readiness");
const check_readiness_card = document.querySelector("#check-readiness-card");
const check_status = document.querySelector("#check-status");
const check_next = document.querySelector("#check-next");
const check_next_action = document.querySelector("#check-next-action");
const check_next_note = document.querySelector("#check-next-note");
const run_button = document.querySelector("#run");
const approve = document.querySelector("#approve");
const approve_checklist = document.querySelector("#approve-checklist");
const approve_warning = document.querySelector("#approve-warning");
const approve_artifact_note = document.querySelector("#approve-artifact-note");
const build_cycle = document.querySelector("#build-cycle");
const build_totals_box = document.querySelector("#build-totals");
const build_note = document.querySelector("#build-note");
const build_filter = document.querySelector("#build-filter");
const build_filter_summary = document.querySelector("#build-filter-summary");
const build_empty = document.querySelector("#build-empty");
const build_filter_reset = document.querySelector("#build-filter-reset");
const build_entries = document.querySelector("#build-entries");
const build_output = document.querySelector("#build-output");
const build_button = document.querySelector("#build");
const history_log = document.querySelector("#history-log");
const file_history = document.querySelector("#file-history");
const object_file = document.querySelector("#object-file");
const file_overlay = document.querySelector("#file-overlay");
const file_overlay_close = document.querySelector("#file-overlay-close");
const step_announcement = document.querySelector("#step-announcement");
const step_next = document.querySelector("#step-next");
const step_next_note = document.querySelector("#step-next-note");
const step_next_action = document.querySelector("#step-next-action");
const pipeline_track_list = document.querySelector("#pipeline-track");
const pipeline_detail_title = document.querySelector("#pipeline-detail-title");
const pipeline_consumes = document.querySelector("#pipeline-consumes");
const pipeline_produces = document.querySelector("#pipeline-produces");
const pipeline_caution = document.querySelector("#pipeline-caution");
const pipeline_flow = document.querySelector("#pipeline-flow");
const file_overlay_body = document.querySelector("#file-overlay-body");
const file_overlay_note = document.querySelector("#file-overlay-note");
const file_overlay_title = document.querySelector("#file-overlay-title");
const prompt_panel = document.querySelector('.panel[data-panel="prompt"]');
const prompt_context = document.querySelector("#prompt-context");
const prompt_outline_select = document.querySelector("#prompt-outline-select");
const prompt_outline_query = document.querySelector("#prompt-outline-query");
const prompt_outline_count = document.querySelector("#prompt-outline-count");
const prompt_outline_status = document.querySelector("#prompt-outline-status");
const prompt_cursor_status = document.querySelector("#prompt-cursor-status");
const prompt_next = document.querySelector("#prompt-next");
const prompt_next_note = document.querySelector("#prompt-next-note");
const apply_button = document.querySelector("#apply");
const reset_button = document.querySelector("#reset");
const generate_button = document.querySelector("#generate");
const objects_count = document.querySelector("#objects-count");
const propose_note = document.querySelector("#propose-note");
const propose_button = document.querySelector("#propose");
const object_panel = document.querySelector('.panel[data-panel="objects"]');
const object_tabs = document.querySelector("#object-tabs");
const object_review_toolbar = document.querySelector("#object-review-toolbar");
const object_search = document.querySelector("#object-search");
const object_filter = document.querySelector("#object-filter");
const object_origin_select = document.querySelector("#object-origin");
const object_progress = document.querySelector("#object-progress");
const object_entry_progress = document.querySelector("#object-entry-progress");
const object_kind_jumps = document.querySelector("#object-kind-jumps");
const object_review_unreviewed = document.querySelector("#object-review-unreviewed");
const object_origin_summary = document.querySelector("#object-origin-summary");
const object_clear_filters = document.querySelector("#object-clear-filters");
const object_empty_clear = document.querySelector("#object-empty-clear");
const object_empty = document.querySelector("#object-empty");
const object_review_summary = document.querySelector("#object-review-summary");
const object_next_unreviewed = document.querySelector("#object-next-unreviewed");
const object_about_tab = object_tabs.querySelector('[data-tab="object-about"]');
const object_about_panel = object_panel.querySelector('.tab-panel[data-tab="object-about"]');

let entry = catalog.entries.find((item) => item.compiled) ?? catalog.entries[0];
let candidate = entry.candidates.find((item) => item.id === entry.approved) ?? entry.candidates[0] ?? null;
let working = entry.markdown;
let edited = false;
let last_check = null;
let check_running = false;
let draft_revision = 0;
let outline_entries = [];
let outline_selected_line = null;
let outline_source = null;
let proposals = proposal_rows(object_model);
let object_query = "";
let object_mode = "all";
let object_origin = "all";
let review_query = "";
let review_mode = "all";
let review_focused = false;
let review_focus_id = null;
let line_status_mode = "attention";
let current_review_report = null;
let current_step = null;
let file_overlay_return_focus = null;
const review_card_elements = new Map();
let review_cursor_term = null;
let highlighted_term = "";
const scan_times = new Map();
let build_state = null;
let build_filter_mode = "all";
const urls = [];

async function load_json(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`could not load ${path}: ${response.status}`);
    }
    return response.json();
}

function urls_reset() {
    for (const url of urls) {
        URL.revokeObjectURL(url);
    }
    urls.length = 0;
}

function download_url(data, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    urls.push(url);
    return url;
}

const KIND_LABELS = { object: "Objects", operation: "Operations", relation: "Relations" };
const kind_tabs = new Set();

function kind_tab_id(kind) {
    return `object-kind-${kind.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
}

function kind_label(kind) {
    if (KIND_LABELS[kind]) {
        return KIND_LABELS[kind];
    }
    const text = kind.replace(/[-_]/g, " ");
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}s`;
}

function ensure_kind_tab(kind) {
    if (kind_tabs.has(kind)) {
        return;
    }
    kind_tabs.add(kind);
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab";
    tab.dataset.tab = kind_tab_id(kind);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.textContent = kind_label(kind);
    tab.addEventListener("click", () => activate_tab(tab.dataset.tab, object_panel));
    object_tabs.insertBefore(tab, object_about_tab);

    const panel = document.createElement("div");
    panel.className = "tab-panel";
    panel.dataset.tab = kind_tab_id(kind);
    panel.hidden = true;
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const head_row = document.createElement("tr");
    for (const heading of ["Term", "Evidence / Rationale"]) {
        const th = document.createElement("th");
        th.textContent = heading;
        head_row.append(th);
    }
    head.append(head_row);
    const body = document.createElement("tbody");
    body.dataset.kind = kind;
    table.append(head, body);
    panel.append(table);
    object_panel.insertBefore(panel, object_about_panel);
    prepare_tab(tab);
}

function default_use(row) {
    const include = row.guess === "include";
    if (row.status === "rejected") {
        return include ? "ignore" : "accept";
    }
    return include ? "accept" : "ignore";
}

// file_url points the filename in an evidence line at the file viewer, carrying
// the source's section and the term so the viewer can highlight the cited lines.
function section_of(source, path) {
    if (typeof source === "string" && source.startsWith(path)) {
        return source.slice(path.length).trim();
    }
    return "";
}

function file_viewer_url(path, section, term) {
    const params = new URLSearchParams({ path });
    if (term) {
        params.set("term", term);
    }
    if (section) {
        params.set("section", section);
    }
    return `./file.html?${params.toString()}`;
}

function open_file_viewer(path, section, term) {
    if (file_overlay.hidden) {
        file_overlay_return_focus = document.activeElement;
    }
    file_overlay_title.textContent = path;
    file_overlay_note.textContent = "";
    file_overlay.hidden = false;
    file_overlay_close.focus();
    render_file(file_overlay_body, { path, section, term }, file_overlay_note).catch((error) => {
        file_overlay_note.textContent = error.message;
    });
}

function close_file_viewer() {
    const restore = file_overlay_return_focus;
    const was_open = !file_overlay.hidden;
    file_overlay.hidden = true;
    file_overlay_body.replaceChildren();
    file_overlay_note.textContent = "";
    file_overlay_title.textContent = "";
    file_overlay_return_focus = null;
    if (was_open && restore && restore.isConnected !== false && typeof restore.focus === "function") {
        restore.focus();
    }
}

function show_file_state(state) {
    if (state && state.file) {
        open_file_viewer(state.file.path, state.file.section, state.file.term);
    } else {
        close_file_viewer();
    }
}

file_overlay_close.addEventListener("click", () => {
    if (history.state && history.state.file) {
        history.back();
    } else {
        close_file_viewer();
    }
});

window.addEventListener("popstate", (event) => {
    show_file_state(event.state);
});

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !file_overlay.hidden) {
        file_overlay_close.click();
    }
});

show_file_state(history.state);

function proposal_rows(model) {
    const rows = [];
    for (const object of model.objects) {
        rows.push({
            term: object.id,
            kind: "object",
            guess: "include",
            status: object.status,
            evidence: object.evidence,
            rationale: object.rationale,
            source: object.source,
            origin: "registry",
        });
    }
    for (const operation of model.operations) {
        rows.push({
            term: operation.id,
            kind: "operation",
            subject: operation.subject,
            guess: "include",
            status: operation.status,
            evidence: operation.evidence,
            rationale: operation.rationale,
            source: operation.source,
            origin: "registry",
        });
    }
    for (const relation of model.relations) {
        rows.push({
            term: relation.id,
            kind: "relation",
            guess: "include",
            status: relation.status,
            evidence: relation.evidence,
            rationale: relation.rationale,
            source: relation.source,
            origin: "registry",
        });
    }
    for (const proposal of model.proposals ?? []) {
        rows.push({ ...proposal, origin: "scan" });
    }
    return rows.map((row) => ({ ...row, use: default_use(row), reviewed: false }));
}

function proposal_counts() {
    return review_counts(proposals);
}

function review_state(row) {
    if (!row.reviewed) {
        return "unreviewed";
    }
    return row.use === "accept" ? "accepted" : "ignored";
}

function object_summary(counts, shown, breakdown) {
    const filters = object_query !== "" || object_mode !== "all" || object_origin !== "all";
    const visible = filters ? ` Showing ${shown} matching term${shown === 1 ? "" : "s"}.` : "";
    const unknown = breakdown.unknown_origin ? `, ${breakdown.unknown_origin} unknown origin` : "";
    return `${counts.reviewed} of ${counts.total} reviewed `
        + `(${counts.accepted} accepted, ${counts.ignored} ignored); `
        + `${counts.unreviewed} unreviewed. ${breakdown.registry} registry, ${breakdown.scan} scan${unknown}.${visible}`;
}

function sync_object_toolbar(tab) {
    object_review_toolbar.hidden = tab === "object-about";
}

function clear_object_filters() {
    object_query = "";
    object_mode = "all";
    object_origin = "all";
    object_search.value = "";
    object_filter.value = "all";
    object_origin_select.value = "all";
    render_proposals();
}

function focus_object_row(row) {
    highlighted_term = row.term;
    activate_tab(kind_tab_id(row.kind), object_panel);
    render_proposals();
    const boxes = object_panel.querySelectorAll("input[data-review-term]");
    const box = [...boxes].find((input) => input.dataset.reviewTerm === row.term);
    if (box) {
        box.focus();
        box.scrollIntoView({ block: "center" });
    }
}

function review_unreviewed() {
    const breakdown = review_breakdown(proposals);
    const kind = ["object", "operation", "relation"]
        .find((candidate_kind) => (breakdown.by_kind[candidate_kind]?.unreviewed ?? 0) > 0);
    if (!kind) {
        object_review_summary.textContent = "Every term has a review decision.";
        return;
    }
    object_query = "";
    object_mode = "unreviewed";
    object_origin = "all";
    object_search.value = "";
    object_filter.value = "unreviewed";
    object_origin_select.value = "all";
    const next = proposals.find((row) => row.kind === kind && !row.reviewed);
    review_cursor_term = next.term;
    focus_object_row(next);
    object_review_summary.textContent = `Review queue opened at ${next.term} (${kind_label(next.kind)}). `
        + "Toggle terms to record decisions; use Next unreviewed to continue.";
}

function next_unreviewed() {
    const counts = proposal_counts();
    if (counts.unreviewed === 0) {
        object_review_summary.textContent = "Every term has a review decision.";
        return;
    }
    const visible = filter_proposals(proposals, object_query, object_mode, object_origin);
    const unreviewed = visible.filter((row) => !row.reviewed);
    if (unreviewed.length === 0) {
        object_review_summary.textContent = "No unreviewed term matches the current filters. "
            + "Use Review unreviewed to reset the filters and enter the queue.";
        return;
    }
    const cursor = proposals.findIndex((row) => row.term === review_cursor_term);
    const next = unreviewed.find((row) => proposals.indexOf(row) > cursor) ?? unreviewed[0];
    review_cursor_term = next.term;
    focus_object_row(next);
    object_review_summary.textContent = `Next unreviewed within current filters: ${next.term} (${kind_label(next.kind)}). `
        + "Toggle it to record a decision.";
}

function render_object_entry(counts, breakdown) {
    const percent = counts.total === 0 ? 0 : Math.round((100 * counts.reviewed) / counts.total);
    object_progress.max = Math.max(1, counts.total);
    object_progress.value = counts.reviewed;
    object_progress.setAttribute("aria-valuetext", `${counts.reviewed} of ${counts.total} reviewed`);
    object_progress.textContent = `${percent}%`;
    object_entry_progress.textContent = `${counts.reviewed} of ${counts.total} reviewed (${percent}%); `
        + `${counts.unreviewed} still need a decision. ${counts.default_include} include and `
        + `${counts.default_exclude} exclude are unreviewed model defaults, not decisions.`;
    object_kind_jumps.replaceChildren();
    for (const kind of ["object", "operation", "relation"]) {
        const kind_counts = breakdown.by_kind[kind] ?? { total: 0, unreviewed: 0 };
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.kind = kind;
        button.disabled = kind_counts.total === 0;
        button.textContent = kind_label(kind);
        const count = document.createElement("span");
        count.className = "jump-count";
        count.textContent = `${kind_counts.unreviewed} unreviewed of ${kind_counts.total}`;
        button.append(count);
        button.addEventListener("click", () => {
            activate_tab(kind_tab_id(kind), object_panel);
            const shown = filter_proposals(proposals, object_query, object_mode, object_origin)
                .filter((row) => row.kind === kind).length;
            object_review_summary.textContent = shown === 0
                ? `No ${kind_label(kind).toLowerCase()} match the current filters. Clear or change the filters to review this kind.`
                : `${kind_label(kind)}: showing ${shown} term${shown === 1 ? "" : "s"} under the current filters.`;
        });
        object_kind_jumps.append(button);
    }
    object_origin_summary.textContent = `${breakdown.registry} registry term${breakdown.registry === 1 ? "" : "s"} · `
        + `${breakdown.scan} scan proposal${breakdown.scan === 1 ? "" : "s"}`
        + (breakdown.unknown_origin ? ` · ${breakdown.unknown_origin} with unknown origin` : "");
    object_review_unreviewed.disabled = counts.unreviewed === 0;
}

let proposals_url = null;

function render_proposals() {
    for (const row of proposals) {
        ensure_kind_tab(row.kind);
    }
    const counts = proposal_counts();
    const breakdown = review_breakdown(proposals);
    const visible = filter_proposals(proposals, object_query, object_mode, object_origin);
    const visible_by_kind = new Map();
    for (const row of visible) {
        const list = visible_by_kind.get(row.kind) ?? [];
        list.push(row);
        visible_by_kind.set(row.kind, list);
    }
    const bodies = new Map();
    for (const body of object_panel.querySelectorAll("tbody[data-kind]")) {
        body.replaceChildren();
        bodies.set(body.dataset.kind, body);
    }
    for (const row of visible) {
        const tr = document.createElement("tr");
        tr.className = `use-${row.use}${row.reviewed ? "" : " unreviewed"}`
            + `${row.term === highlighted_term ? " next-highlight" : ""}`;
        tr.dataset.term = row.term;

        const term = document.createElement("td");
        const term_line = document.createElement("div");
        term_line.className = "term-line";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = row.use === "accept";
        box.indeterminate = !row.reviewed;
        box.dataset.reviewTerm = row.term;
        box.setAttribute("aria-label", `accept ${row.term}`);
        box.addEventListener("change", () => {
            row.use = box.checked ? "accept" : "ignore";
            row.reviewed = true;
            review_cursor_term = row.term;
            render_proposals();
        });
        term_line.append(box, document.createTextNode(row.term));
        term.append(term_line);
        const meta = document.createElement("div");
        meta.className = "review-meta";
        const origin = document.createElement("span");
        origin.className = `review-badge origin-${row.origin === "registry" ? "registry" : "scan"}`;
        origin.textContent = row.origin === "registry" ? "registry" : "scan";
        const kind = document.createElement("span");
        kind.className = "review-badge";
        kind.textContent = row.kind;
        const state = document.createElement("span");
        state.className = "review-badge";
        state.textContent = review_state(row);
        meta.append(origin, kind, state);
        term.append(meta);

        const evidence = document.createElement("td");
        evidence.className = "evidence";
        const evidence_line = document.createElement("div");
        evidence_line.className = "evidence-line";
        const match = /^([A-Za-z0-9_./-]+\.(?:md|sh|mjs|js|json|html|txt|ya?ml|toml|lock|py|c|h|cpp))\b/.exec(row.evidence ?? "");
        if (match) {
            const path = match[1];
            const section = section_of(row.source, path);
            const term = row.term ?? "";
            const link = document.createElement("a");
            link.href = file_viewer_url(path, section, term);
            link.textContent = path;
            link.addEventListener("click", (event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                    return;
                }
                event.preventDefault();
                history.pushState({ file: { path, section, term } }, "", `#file=${encodeURIComponent(path)}`);
                open_file_viewer(path, section, term);
            });
            evidence_line.append(link, document.createTextNode((row.evidence ?? "").slice(path.length)));
        } else {
            evidence_line.textContent = row.evidence;
        }
        const rationale_line = document.createElement("div");
        rationale_line.className = "rationale-line";
        rationale_line.textContent = row.rationale;
        evidence.append(evidence_line, rationale_line);

        tr.append(term, evidence);
        bodies.get(row.kind).append(tr);
    }
    for (const [kind, body] of bodies) {
        if ((visible_by_kind.get(kind) ?? []).length === 0) {
            const tr = document.createElement("tr");
            tr.className = "empty-row";
            const td = document.createElement("td");
            td.colSpan = 2;
            td.textContent = "No terms in this kind match the current filters.";
            tr.append(td);
            body.append(tr);
        }
    }

    object_empty.hidden = visible.length !== 0;
    object_next_unreviewed.disabled = counts.unreviewed === 0;
    objects_count.textContent = `Review progress: ${counts.reviewed} reviewed of ${counts.total}; `
        + `${counts.unreviewed} unreviewed suggestions (${counts.default_include} include, `
        + `${counts.default_exclude} exclude defaults).`;
    object_review_summary.textContent = object_summary(counts, visible.length, breakdown);
    render_object_entry(counts, breakdown);

    if (proposals_url !== null) {
        URL.revokeObjectURL(proposals_url);
    }
    proposals_url = download_url(JSON.stringify({ proposals }, null, 2), "application/json");
    document.querySelector("#proposals-download").href = proposals_url;
    update_step_status();
}

function cell(text, class_name) {
    const element = document.createElement("td");
    if (class_name) {
        element.className = class_name;
    }
    const content = document.createElement("div");
    content.className = "cell-text";
    content.textContent = text;
    element.append(content);
    return element;
}

function rendered_by_rule(prose) {
    const map = new Map();
    for (const line of prose.split("\n")) {
        const match = /^Rule "([^"]+)"/.exec(line);
        if (match) {
            map.set(match[1], line);
        }
    }
    return map;
}

function review_status() {
    return review_report(candidate, entry.source, working, catalog.fact_contract);
}

function reset_review_filters() {
    review_query = "";
    review_mode = "all";
    review_search.value = "";
    review_filter.value = "all";
}

function reset_review_focus() {
    review_focused = false;
    review_focus_id = null;
    review_focus_toggle.checked = false;
    review_focus_nav.hidden = true;
    review_focus_status.textContent = "";
}

function reset_line_status() {
    line_status_mode = "attention";
    line_status_filter.value = "attention";
}

function review_regenerate() {
    show("prompt");
    activate_tab("prompt", prompt_panel);
    generate_button.focus();
}

function review_go_check() {
    show("check");
    document.querySelector("#scope").focus();
}

function review_continue_approve() {
    show("approve");
}

function review_show_comparison() {
    show("rules");
    activate_tab("comparison", document.querySelector('.panel[data-panel="rules"]'));
}

function review_count_item(label, value, class_name = "") {
    const item = document.createElement("div");
    item.className = `review-count${class_name ? ` ${class_name}` : ""}`;
    item.setAttribute("role", "listitem");
    const number = document.createElement("strong");
    number.textContent = String(value);
    const caption = document.createElement("span");
    caption.textContent = label;
    item.append(number, caption);
    return item;
}

function readiness_caption(summary) {
    if (summary.legacy) {
        return "Nothing can be removed yet. This reading has no requirement-level review; regenerate candidates to inventory requirements and record decisions.";
    }
    if (!summary.available) {
        return "Nothing can be removed yet. The review metadata is stale or invalid; regenerate candidates before relying on this comparison.";
    }
    if (summary.removable === 0) {
        return `Nothing can be removed yet. ${summary.retained} nonblank line${summary.retained === 1 ? "" : "s"} remain because review or check evidence is incomplete.`;
    }
    if (summary.readiness === "ready") {
        return `${summary.removable} nonblank line${summary.removable === 1 ? "" : "s"} can be removed for the recorded scope. Headings and context still remain.`;
    }
    return `${summary.removable} nonblank line${summary.removable === 1 ? "" : "s"} can be removed, while ${summary.retained} remain. Resolve the blockers below before treating the reduction as complete.`;
}

function render_readiness_counts(container, summary) {
    container.replaceChildren(
        review_count_item("nonblank lines", summary.total_nonblank),
        review_count_item("removable now", summary.removable, summary.removable > 0 ? "good" : ""),
        review_count_item("retained", summary.retained, summary.removable === 0 ? "attention" : ""),
        review_count_item("approved requirements", summary.decisions.approved, summary.decisions.approved > 0 ? "good" : ""),
        review_count_item("unreviewed", summary.decisions.unreviewed, summary.decisions.unreviewed > 0 ? "attention" : ""),
    );
}

function render_readiness_blockers(container, summary) {
    container.replaceChildren();
    if (summary.blockers.length === 0) {
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = "No extraction or approval blocker is recorded. Counts describe this reading, not proven completeness.";
        container.append(note);
        return;
    }
    const heading = document.createElement("p");
    heading.className = "note";
    heading.textContent = "What keeps prose in place:";
    const list = document.createElement("ul");
    for (const blocker of summary.blockers) {
        const item = document.createElement("li");
        item.textContent = `${blocker.label}${blocker.count > 1 ? ` (${blocker.count})` : ""}`;
        list.append(item);
    }
    container.append(heading, list);
}

function readiness_button(label, handler, primary = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (primary) {
        button.className = "review-primary-action";
    }
    button.addEventListener("click", handler);
    return button;
}

function render_readiness_actions(summary, container, note, allow_approve = true) {
    container.replaceChildren();
    const actions = [];
    if (summary.legacy || !summary.available) {
        actions.push(readiness_button("Regenerate candidates", review_regenerate, true));
        actions.push(readiness_button("Go to Check", review_go_check));
        note.textContent = "Regeneration creates requirement-level review. A recorded reading alone cannot approve removal.";
    } else {
        const needs_review = summary.decisions.unreviewed > 0;
        const needs_check = summary.executable > 0 && !summary.check_scope;
        if (needs_review || summary.blockers.some((item) => ["rejected", "non_executable"].includes(item.key))) {
            actions.push(readiness_button("Review requirements", continue_to_rules, true));
        }
        if (needs_check) {
            actions.push(readiness_button("Go to Check", review_go_check));
        }
        if (summary.identified === 0) {
            actions.push(readiness_button("Regenerate candidates", review_regenerate));
        }
        if (allow_approve && summary.removable > 0) {
            actions.push(readiness_button("Continue to Approve", review_continue_approve, actions.length === 0));
        }
        if (actions.length === 0) {
            actions.push(readiness_button("Regenerate candidates", review_regenerate));
        }
        note.textContent = needs_review
            ? "Decisions remain in Rules. Review is separate from approval."
            : needs_check
                ? "Run a supported check before approval can unlock removal."
                : summary.removable > 0
                    ? "Continue only after reviewing the exact rules, limitations, and recorded scope."
                    : "No complete line is eligible yet. Review the retained reasons and current decisions.";
    }
    container.append(...actions);
}

function review_chip(text, class_name = "") {
    const chip = document.createElement("span");
    chip.className = `review-badge${class_name ? ` ${class_name}` : ""}`;
    chip.textContent = text;
    return chip;
}

function review_decision_button(requirement, decision, label, disabled_reason, eligibility) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = Boolean(disabled_reason);
    if (disabled_reason) {
        button.title = disabled_reason;
        button.setAttribute("aria-describedby", eligibility.id);
    }
    if (decision === "approved") {
        button.className = "review-primary-action";
    }
    button.addEventListener("click", () => {
        try {
            if (textarea.value !== working) {
                throw new Error("Apply the edited prompt before reviewing requirements.");
            }
            review_decide(candidate, requirement.id, decision, entry.source, working, catalog.fact_contract);
            render();
        } catch (error) {
            eligibility.textContent = error.message;
            eligibility.focus();
        }
    });
    return button;
}

function review_requirement_card(requirement, report, progress) {
    const status = report.requirements.find((item) => item.id === requirement.id);
    const decision = status?.decision ?? "unreviewed";
    const explanation = explanation_current(candidate, requirement.id, entry.source, working, catalog.fact_contract);
    const source_line = working.split("\n")[requirement.line - 1] ?? requirement.quote;
    const unapplied = textarea.value !== working;

    const card = document.createElement("article");
    card.className = "candidate review-card";
    card.dataset.decision = decision;
    card.dataset.status = requirement.status;
    card.dataset.requirement = requirement.id;
    card.tabIndex = -1;

    const heading = document.createElement("h3");
    heading.textContent = explanation?.title ?? requirement.title;

    const badges = document.createElement("div");
    badges.className = "review-badges";
    const status_label = requirement.status.replaceAll("_", " ");
    badges.append(review_chip(status_label, requirement.status === "executable" ? "origin-scan" : ""),
        review_chip(`decision: ${decision}`),
        review_chip(`line ${requirement.line}`));

    const quote = document.createElement("blockquote");
    quote.textContent = `${entry.source}:${requirement.line}\n${source_line}`;

    const eligibility = document.createElement("p");
    eligibility.className = "review-eligibility";
    eligibility.id = `review-eligibility-${requirement.id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
    let eligibility_text;
    if (unapplied) {
        eligibility_text = "Apply the edited prompt before approving or rejecting this requirement.";
    } else if (requirement.status !== "executable") {
        eligibility_text = `Retained as ${status_label}. Approval acknowledges this extracted requirement, but it cannot enable prose removal.`;
    } else if (!progress.has_check) {
        eligibility_text = "Needs a check. Run a relevant scope in 5. Check before approving this executable requirement.";
    } else if (decision === "approved") {
        eligibility_text = `Approved for the recorded check scope: ${report.check_scope}. The line may be removed only when every clause on it is eligible.`;
    } else if (decision === "rejected") {
        eligibility_text = "Rejected. The source text will remain.";
    } else {
        eligibility_text = "Ready for review. Approval confirms the explanation, limitations, and recorded scope; it does not prove future enforcement.";
    }
    eligibility.textContent = eligibility_text;
    eligibility.tabIndex = -1;

    const prose = document.createElement("p");
    prose.textContent = explanation
        ? `Model explanation: ${explanation.text}`
        : requirement.status === "executable"
            ? candidate.review.explanation_error ?? "Explanation unavailable. Review the exact interpretation below."
            : `Extraction rationale: ${requirement.reason}`;
    prose.className = "review-explanation";

    const limitations = document.createElement("p");
    limitations.className = "note";
    limitations.textContent = explanation
        ? `Limitations: ${explanation.limitations}`
        : `Missing facts: ${requirement.missing_facts.join(", ") || "none specified"}. This is not an approved executable interpretation.`;

    const rule_set = { facts: [], rules: candidate.rules.rules.filter((rule) => requirement.rules.includes(rule.id)) };
    const detail = document.createElement("details");
    detail.className = "raw";
    const label = document.createElement("summary");
    label.textContent = "Exact deterministic interpretation and raw rules";
    const exact = document.createElement("pre");
    exact.textContent = `${ruleset_render(rule_set)}\n\n${JSON.stringify(rule_set, null, 4)}`;
    detail.append(label, exact);

    const actions = document.createElement("div");
    actions.className = "review-actions";
    const needs_check = requirement.status === "executable" && !progress.has_check;
    const disabled_reason = unapplied
        ? "Apply the edited prompt first."
        : needs_check
            ? "Run a check on a supported scope before approving this executable requirement."
            : "";
    const approve_label = requirement.status === "executable" ? "Approve requirement" : "Approve retained prose";
    actions.append(
        review_decision_button(requirement, "approved", approve_label, disabled_reason, eligibility),
        review_decision_button(requirement, "rejected", "Reject", unapplied ? "Apply the edited prompt first." : "", eligibility),
        review_decision_button(requirement, "unreviewed", "Clear decision", unapplied ? "Apply the edited prompt first." : "", eligibility),
    );
    if (needs_check) {
        const check = document.createElement("button");
        check.type = "button";
        check.textContent = "Go to Check";
        check.addEventListener("click", review_go_check);
        actions.append(check);
    }

    card.append(heading, badges, quote, eligibility, prose, limitations, detail, actions);
    return card;
}

function review_legacy_card(report) {
    const legacy = !candidate.review;
    const stale = !legacy && report.reasons.length > 0;
    const card = document.createElement("article");
    card.className = "candidate review-card review-legacy";
    const heading = document.createElement("h3");
    heading.textContent = legacy
        ? "This reading has no requirement review"
        : stale ? "This review is stale or incomplete" : "Requirement review is unavailable";
    const explanation = document.createElement("p");
    explanation.textContent = legacy
        ? "The recorded candidate predates requirement-level review. Its compiled rules remain inspectable and can be checked, but no requirement is approved and no prose will be reduced."
        : report.reasons.join(" ");
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "Regenerate candidates to inventory requirements and enable individual review. Generating is not approval.";
    const actions = document.createElement("div");
    actions.className = "review-actions";
    const regenerate = document.createElement("button");
    regenerate.type = "button";
    regenerate.className = "review-primary-action";
    regenerate.textContent = "Regenerate candidates";
    regenerate.addEventListener("click", review_regenerate);
    const check = document.createElement("button");
    check.type = "button";
    check.textContent = "Go to Check";
    check.addEventListener("click", review_go_check);
    actions.append(regenerate, check);

    const detail = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Compiled rules (readable list)";
    detail.append(summary, rule_list(candidate));
    card.append(heading, explanation, note, actions, detail);
    return card;
}

function review_overview_next(report, progress) {
    if (!candidate.review || report.reasons.length > 0) {
        review_next_note.textContent = "No requirement can be reviewed until a current reading is generated. Use the recovery action below.";
        review_next_action.hidden = true;
        return;
    }
    if (progress.identified === 0) {
        review_next_note.textContent = "No requirements were extracted for this reading, so there is nothing to approve or remove.";
        review_next_action.hidden = false;
        review_next_action.textContent = "Regenerate candidates";
        review_next_action.onclick = review_regenerate;
        return;
    }
    if (progress.unreviewed > 0) {
        review_next_note.textContent = `${progress.unreviewed} requirement${progress.unreviewed === 1 ? "" : "s"} still ${progress.unreviewed === 1 ? "needs" : "need"} a decision. Review is separate from approval.`;
        review_next_action.hidden = false;
        review_next_action.textContent = "Next needing review";
        review_next_action.onclick = focus_next_review;
        return;
    }
    if (progress.executable > 0 && !progress.has_check) {
        review_next_note.textContent = "All requirements have a decision, but executable requirements need a current check before approval.";
        review_next_action.hidden = false;
        review_next_action.textContent = "Go to Check";
        review_next_action.onclick = review_go_check;
        return;
    }
    if (progress.executable === 0) {
        review_next_note.textContent = "No executable requirement can remove prose. Approval will record acknowledgement, but the prompt will remain intact.";
        review_next_action.hidden = false;
        review_next_action.textContent = "Continue to Approve";
        review_next_action.onclick = review_continue_approve;
        return;
    }
    if (progress.approved === 0) {
        review_next_note.textContent = "Every requirement has a decision, but none is approved. The prompt will remain unchanged.";
        review_next_action.hidden = false;
        review_next_action.textContent = "Review decisions";
        review_next_action.onclick = () => {
            review_mode = "all";
            review_filter.value = "all";
            render_review_queue(current_review_report, review_progress(current_review_report));
        };
        return;
    }
    if (progress.removable_lines === 0) {
        review_next_note.textContent = "Requirements are reviewed, but no complete source line is currently eligible for removal. Inspect the comparison for retained clauses.";
        review_next_action.hidden = false;
        review_next_action.textContent = "Review reduction blockers";
        review_next_action.onclick = review_show_comparison;
        return;
    }
    review_next_note.textContent = `${progress.removable_lines} line${progress.removable_lines === 1 ? "" : "s"} can be reduced after review. Continue to record the complete artifact.`;
    review_next_action.hidden = false;
    review_next_action.textContent = "Continue to Approve";
    review_next_action.onclick = review_continue_approve;
}

function render_review_overview(report, progress) {
    review_policy.textContent = "Only a source line whose clauses are all executable, checked against a current fact scope, and explicitly approved can be removed. "
        + "Approval records human judgement for that scope; it does not prove future enforcement or complete intent.";
    if (!candidate.review || report.reasons.length > 0) {
        const unavailable = document.createElement("p");
        unavailable.className = "note";
        unavailable.textContent = !candidate.review
            ? "No requirement counts are available because this reading has no requirement-level review."
            : "Requirement counts are unavailable because the recorded review is stale or invalid.";
        review_counts_box.replaceChildren(unavailable);
    } else {
        review_counts_box.replaceChildren(
            review_count_item("identified", progress.identified),
            review_count_item("executable", progress.executable, progress.executable > 0 ? "good" : ""),
            review_count_item("approved", progress.approved, progress.approved > 0 ? "good" : ""),
            review_count_item("rejected", progress.rejected),
            review_count_item("unreviewed", progress.unreviewed, progress.unreviewed > 0 ? "attention" : ""),
            review_count_item("removable lines", progress.removable_lines, progress.removable_lines > 0 ? "good" : ""),
        );
    }
    review_overview_next(report, progress);
}

function focus_next_review() {
    if (!candidate?.review) {
        review_next_note.textContent = "No review is available. Regenerate candidates first.";
        return;
    }
    const report = review_status();
    const requirements = candidate.review.requirements;
    const visible = filter_requirements(requirements, report, review_query, review_mode,
        (requirement) => explanation_current(candidate, requirement.id, entry.source, working, catalog.fact_contract));
    const next = visible.find((requirement) => {
        const row = report.requirements.find((item) => item.id === requirement.id);
        return (row?.decision ?? "unreviewed") === "unreviewed";
    });
    if (!next) {
        review_next_note.textContent = review_focused
            ? "No visible requirement is waiting for a decision under the current filters."
            : "No requirement is waiting for a decision.";
        render_review_queue(report, review_progress(report));
        return;
    }
    if (review_focused) {
        review_focus_id = next.id;
        render_review_queue(report, review_progress(report));
        review_queue_summary.textContent = `Focused requirement ${next.id}. Its decision is still unreviewed.`;
        review_focus_status.textContent = `Focused requirement ${next.id}; its decision is still unreviewed.`;
        const card = review_card_elements.get(next.id);
        card?.focus({ preventScroll: true });
        card?.scrollIntoView?.({ block: "center" });
        return;
    }
    review_query = "";
    review_search.value = "";
    review_mode = "all";
    review_filter.value = "all";
    render_review_queue(report, review_progress(report));
    const card = review_card_elements.get(next.id);
    review_queue_summary.textContent = `Focused requirement ${next.id}. Its decision is still ${"unreviewed"}.`;
    if (card) {
        card.focus({ preventScroll: true });
        card.scrollIntoView?.({ block: "center" });
    }
}

function render_review_queue(report, progress) {
    review_card_elements.clear();
    if (!candidate.review || report.reasons.length > 0) {
        review_toolbar.hidden = true;
        rule_summary.replaceChildren(review_legacy_card(report));
        return;
    }
    review_toolbar.hidden = false;
    const requirements = candidate.review.requirements;
    const visible = filter_requirements(requirements, report, review_query, review_mode,
        (requirement) => explanation_current(candidate, requirement.id, entry.source, working, catalog.fact_contract));
    let rendered = visible;
    review_focus_toggle.checked = review_focused;
    if (review_focused) {
        const focus_index = resolve_focus_index(visible, review_focus_id);
        const focused = focus_item(visible, focus_index);
        review_focus_id = focused?.id ?? null;
        rendered = focused ? [focused] : [];
        const position = focus_position(visible, focus_index);
        review_focus_nav.hidden = false;
        review_focus_position.textContent = position.label;
        review_focus_prev.disabled = focus_index <= 0;
        review_focus_next.disabled = focus_index < 0 || focus_index >= visible.length - 1;
    } else {
        review_focus_nav.hidden = true;
        review_focus_status.textContent = "";
    }
    review_queue_summary.textContent = `${visible.length} of ${requirements.length} requirements shown. `
        + `${progress.unreviewed} awaiting a decision; ${progress.approved} approved; ${progress.rejected} rejected.`
        + (review_focused ? " One at a time mode is on." : "");
    review_empty.hidden = visible.length > 0;
    review_next_needing.disabled = progress.unreviewed === 0;
    const no_requirements = requirements.length === 0;
    review_empty_message.textContent = no_requirements
        ? "No requirements were extracted for this reading. Regenerate candidates to try again, or inspect the rules below."
        : "No requirements match these filters.";
    review_empty_clear.hidden = no_requirements;
    review_empty_regenerate.hidden = !no_requirements;
    if (rendered.length === 0) {
        rule_summary.replaceChildren();
        return;
    }
    const cards = rendered.map((requirement) => {
        const card = review_requirement_card(requirement, report, progress);
        review_card_elements.set(requirement.id, card);
        return card;
    });
    rule_summary.replaceChildren(...cards);
}

let prompt_url = null;

function update_edit_note() {
    const text = textarea.value;
    const unsaved = text !== working;
    const changed = text !== entry.markdown;
    edit_note.classList.toggle("edit-dirty", changed);
    edit_note.classList.toggle("status-file", !changed);
    edit_note.classList.toggle("status-applied", changed && !unsaved);
    edit_note.classList.toggle("status-unsaved", unsaved);
    if (!changed) {
        edit_note.textContent = "Draft matches the file. Nothing is unsaved.";
    } else if (unsaved) {
        edit_note.textContent = "Unsaved edit — the file is unchanged. Apply the edit to use it on this page, or download the text to keep a copy.";
    } else {
        edit_note.textContent = "Applied draft — the file is unchanged. The compile still uses the file's cases; the comparison marks a covered line the edit broke. Download the text to keep a copy.";
    }
}

function update_prompt_context() {
    const text = textarea.value;
    const lines = text === "" ? 0 : text.split("\n").length;
    const count = entry.candidates.length;
    const selected = candidate ? `selected ${candidate.id}` : "no candidate selected";
    prompt_context.textContent = `${lines} line${lines === 1 ? "" : "s"} · ${text.length} character${text.length === 1 ? "" : "s"} · ${count} candidate reading${count === 1 ? "" : "s"} · ${selected}.`;
}

function update_cursor_status() {
    const text = textarea.value;
    const total = text === "" ? 0 : text.split("\n").length;
    if (total === 0) {
        prompt_cursor_status.textContent = "Line 0 of 0";
        return;
    }
    const raw_position = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
    const position = Math.max(0, Math.min(raw_position, text.length));
    const line = text.slice(0, position).split("\n").length;
    prompt_cursor_status.textContent = `Line ${line} of ${total}`;
}

function outline_option(text, value) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    return option;
}

// rebuild_outline changes only the controls. It never moves the textarea
// cursor or scroll position, so typing and IME composition stay undisturbed.
function rebuild_outline() {
    const previous_line = outline_selected_line;
    outline_entries = parse_outline(textarea.value);
    const query = prompt_outline_query.value;
    const filtered = outline_matches(outline_entries, query);
    prompt_outline_select.replaceChildren();

    if (outline_entries.length === 0) {
        prompt_outline_select.append(outline_option("No headings in this prompt", ""));
        prompt_outline_select.disabled = true;
        prompt_outline_query.disabled = true;
        prompt_outline_query.value = "";
        prompt_outline_count.textContent = "No headings in this prompt.";
        outline_selected_line = null;
        prompt_outline_status.textContent = "";
        return;
    }

    prompt_outline_query.disabled = false;
    prompt_outline_select.disabled = filtered.length === 0;
    prompt_outline_select.append(outline_option(
        filtered.length === 0 ? "No matching headings" : "Choose a heading",
        "",
    ));
    for (const heading of filtered) {
        const indent = "\u00a0\u00a0".repeat(Math.max(0, heading.level - 1));
        prompt_outline_select.append(outline_option(
            `${indent}H${heading.level} · ${heading.line} · ${heading.title || "(untitled)"}`,
            String(heading.line),
        ));
    }

    const selected_exists = previous_line !== null && outline_entries.some((heading) => heading.line === previous_line);
    const selected_visible = selected_exists && filtered.some((heading) => heading.line === previous_line);
    if (selected_visible) {
        prompt_outline_select.value = String(previous_line);
    } else if (selected_exists) {
        prompt_outline_select.value = "";
        prompt_outline_status.textContent = "The selected heading is hidden by the filter.";
    } else {
        if (previous_line !== null) {
            prompt_outline_status.textContent = "The selected heading is no longer available.";
        }
        outline_selected_line = null;
        prompt_outline_select.value = "";
    }

    prompt_outline_count.textContent = query.trim() === ""
        ? `${outline_entries.length} heading${outline_entries.length === 1 ? "" : "s"}.`
        : `${filtered.length} of ${outline_entries.length} headings match.`;
}

function jump_to_outline_line(line_number) {
    const line = Number(line_number);
    const selection = selection_for_line(textarea.value, line);
    if (!selection) {
        return;
    }
    outline_selected_line = line;
    textarea.focus();
    textarea.setSelectionRange(selection.start, selection.end);
    if (textarea.clientHeight > 0) {
        textarea.scrollTop = Math.max(0, (line - 1) * 20 - textarea.clientHeight / 2);
    }
    const heading = outline_entries.find((item) => item.line === line);
    prompt_outline_status.textContent = `Selected line ${line}${heading?.title ? `: ${heading.title}` : ""}.`;
    update_cursor_status();
}

function update_prompt_actions() {
    const text = textarea.value;
    apply_button.disabled = text === working;
    apply_button.title = apply_button.disabled
        ? "No unsaved edits to apply."
        : "Use the current text on this page. The file is unchanged.";
    reset_button.disabled = text === entry.markdown;
    reset_button.title = reset_button.disabled
        ? "The draft already matches the file."
        : "Discard the page-local draft and restore the file text.";
}

function update_prompt_next() {
    const count = entry.candidates.length;
    prompt_next.hidden = count === 0;
    if (count === 0) {
        prompt_next_note.textContent = "No candidate reading yet. Generate candidates from the current draft to create the first reading.";
        return;
    }
    prompt_next_note.textContent = `Next: review ${count} candidate reading${count === 1 ? "" : "s"} in Candidates. Choosing a reading is not approval.`;
}

function update_prompt_state() {
    update_edit_note();
    update_prompt_context();
    update_prompt_actions();
    update_prompt_next();
    rebuild_outline();
    update_cursor_status();
    update_prompt_download();
}

function update_prompt_download() {
    if (prompt_url !== null) {
        URL.revokeObjectURL(prompt_url);
    }
    prompt_url = URL.createObjectURL(new Blob([textarea.value], { type: "text/markdown" }));
    const link = document.querySelector("#prompt-download");
    link.href = prompt_url;
    link.download = entry.source.split("/").pop() ?? "prompt.md";
}

function render_prompt() {
    const source_changed = outline_source !== entry.source;
    if (source_changed) {
        outline_source = entry.source;
        outline_selected_line = null;
        prompt_outline_query.value = "";
        prompt_outline_status.textContent = "";
    }
    select_prompt.value = entry.source;
    const text_changed = textarea.value !== working;
    textarea.value = working;
    if (source_changed || text_changed) {
        textarea.setSelectionRange(0, 0);
        textarea.scrollTop = 0;
    }
    update_prompt_state();
}

function badge_toggle(count, noun, detail) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "badge";
    button.setAttribute("aria-expanded", "false");
    button.textContent = `▸ ${count} ${noun}`;
    button.addEventListener("click", () => {
        const open = detail.hidden;
        detail.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
        button.textContent = `${open ? "▾" : "▸"} ${count} ${noun}`;
    });
    return button;
}

function rule_list(item) {
    const rendered = rendered_by_rule(ruleset_render(item.rules));
    const list = document.createElement("ul");
    list.className = "rule-list";
    for (const rule of item.rules.rules) {
        const line = rendered.get(rule.id) ?? "(not rendered)";
        const prefix = `Rule "${rule.id}": `;
        const li = document.createElement("li");
        const code = document.createElement("code");
        code.textContent = rule.id;
        const prose = document.createElement("span");
        prose.className = "rule-prose";
        prose.textContent = line.startsWith(prefix) ? line.slice(prefix.length) : line;
        li.append(code, prose);
        list.append(li);
    }
    return list;
}

function rules_detail(item) {
    const detail = document.createElement("div");
    detail.className = "candidate-detail";
    detail.hidden = true;
    detail.append(rule_list(item));
    return detail;
}

function cases_detail(item) {
    const detail = document.createElement("div");
    detail.className = "candidate-detail";
    detail.hidden = true;
    const list = document.createElement("ul");
    list.className = "case-list";
    for (const case_item of item.cases) {
        const li = document.createElement("li");
        const original = document.createElement("div");
        original.className = "case-original";
        original.textContent = case_item.original;
        const meta = document.createElement("div");
        meta.className = "case-meta";
        const source = case_item.source ?? entry.source;
        meta.textContent = `${case_item.rule} · ${case_item.verdict}${source === entry.source ? "" : ` · ${source}`}`;
        const note = document.createElement("div");
        note.className = "case-note";
        note.textContent = case_item.note ?? "";
        li.append(original, meta, note);
        if (case_item.suggestion) {
            const hint = document.createElement("div");
            hint.className = "case-hint";
            hint.textContent = case_item.suggestion;
            li.append(hint);
        }
        list.append(li);
    }
    detail.append(list);
    return detail;
}

function candidate_stat_line(item) {
    const stats = candidate_stats(item, entry.source);
    const lines = `${stats.source_lines} quoted prompt line${stats.source_lines === 1 ? "" : "s"}`;
    const files = `${stats.source_files} source file${stats.source_files === 1 ? "" : "s"}`;
    const cross = stats.cross_file_cases === 0 ? "" : ` · ${stats.cross_file_cases} other-file case${stats.cross_file_cases === 1 ? "" : "s"}`;
    return `${stats.rule_count} rule${stats.rule_count === 1 ? "" : "s"} · ${lines} · ${files}${cross}`;
}

function continue_to_rules() {
    if (!candidate) {
        return;
    }
    show("rules");
    activate_tab("rules", document.querySelector('.panel[data-panel="rules"]'));
}

function candidate_delta(item) {
    const detail = document.createElement("details");
    detail.className = "candidate-delta";
    if (!candidate) {
        const summary = document.createElement("summary");
        summary.textContent = "No current choice to compare with";
        detail.append(summary);
        return detail;
    }
    const delta = coverage_delta(item, candidate, entry.source);
    const summary = document.createElement("summary");
    summary.textContent = `Compared with ${candidate.id}: ${delta.shared} shared · ${delta.only_this} only here · ${delta.only_current} only current`;
    detail.append(summary);
    for (const [key, label] of [["only_this", "Only this reading"], ["only_current", "Only the current choice"], ["shared", "Shared by both"]]) {
        const heading = document.createElement("p");
        heading.className = "candidate-label";
        heading.textContent = label;
        detail.append(heading);
        if (delta.examples[key].length === 0) {
            const none = document.createElement("p");
            none.className = "note";
            none.textContent = "None.";
            detail.append(none);
            continue;
        }
        const list = document.createElement("ul");
        for (const line of delta.examples[key]) {
            const item = document.createElement("li");
            item.textContent = line;
            list.append(item);
        }
        detail.append(list);
    }
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "Examples are limited to three. The counts are distinct quoted lines from this prompt; cases from another file stay in the case details.";
    detail.append(note);
    return detail;
}

function rule_id_list(label, ids) {
    const block = document.createElement("div");
    block.className = "rule-diff-group";
    const heading = document.createElement("p");
    heading.className = "candidate-label";
    heading.textContent = `${label} (${ids.length})`;
    block.append(heading);
    if (ids.length === 0) {
        const none = document.createElement("p");
        none.className = "note";
        none.textContent = "None.";
        block.append(none);
        return block;
    }
    const list = document.createElement("ul");
    list.className = "rule-id-list";
    for (const id of ids) {
        const item = document.createElement("li");
        const code = document.createElement("code");
        code.textContent = id;
        item.append(code);
        list.append(item);
    }
    block.append(list);
    return block;
}

function candidate_rules_delta(item) {
    const detail = document.createElement("details");
    detail.className = "candidate-rule-diff";
    const diff = rule_diff(item, candidate);
    const summary = document.createElement("summary");
    summary.textContent = `Formal differences: ${rule_diff_summary(diff)}`;
    detail.append(summary);
    if (!diff.valid) {
        const problem = document.createElement("p");
        problem.className = "note";
        problem.textContent = `These rule sets cannot be compared safely: ${diff.errors.join("; ")}.`;
        detail.append(problem);
        return detail;
    }
    const coverage = coverage_delta(item, candidate, entry.source);
    if (diff.identical) {
        const same = document.createElement("p");
        same.className = "note";
        same.textContent = coverage.only_this === 0 && coverage.only_current === 0
            ? "Same rules and quoted lines. The reading is still a separate choice, not an approval."
            : "Same rules; only case coverage differs.";
        detail.append(same);
    }
    if (diff.only_this.length > 0) {
        detail.append(rule_id_list("Rules only in this reading", diff.only_this));
    }
    if (diff.only_current.length > 0) {
        detail.append(rule_id_list("Rules only in the current choice", diff.only_current));
    }
    if (diff.changed.length > 0) {
        detail.append(rule_id_list("Same rule id, different definition", diff.changed));
    }
    if (diff.shared.length > 0) {
        detail.append(rule_id_list("Shared rule ids", diff.shared));
    }
    if (diff.order_changed) {
        const order = document.createElement("p");
        order.className = "note";
        order.textContent = "Shared rules appear in a different order.";
        detail.append(order);
    }
    const caveat = document.createElement("p");
    caveat.className = "note";
    caveat.textContent = "These differences describe form, not correctness or better intent. Review the requirements and their explanations before choosing.";
    detail.append(caveat);
    return detail;
}

function candidate_current_note() {
    const note = document.createElement("p");
    note.className = "candidate-current-note note";
    note.textContent = "Current choice (not approval). Its rules are the ones reviewed and checked in the following steps.";
    return note;
}

function render_candidates() {
    candidates_box.replaceChildren();
    candidates_next.hidden = !candidate;
    if (!candidate) {
        candidates_summary.textContent = "No reading has been generated for this prompt.";
        candidates_note.textContent = "A reading is required before rules, checks, or approval. Generate candidates from the Prompt step using the current draft.";
        const empty = document.createElement("div");
        empty.className = "candidate-empty";
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = "Generate candidates is the next action. Generation sends the prompt to the model; it does not approve anything.";
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Go to Prompt and generate";
        button.addEventListener("click", () => {
            show("prompt");
            activate_tab("prompt", prompt_panel);
            generate_button.focus();
        });
        empty.append(note, button);
        candidates_box.append(empty);
        return;
    }
    const current = candidate_stats(candidate, entry.source);
    candidates_summary.textContent = `${entry.candidates.length} reading${entry.candidates.length === 1 ? "" : "s"}. `
        + `Current choice: ${candidate.title} (${candidate.id}), with ${current.source_lines} quoted prompt line${current.source_lines === 1 ? "" : "s"}. `
        + "Choosing a reading changes which rules are reviewed; it does not approve them.";
    candidates_note.textContent = "Quoted-line counts cover this prompt only; the source-file count includes cases from other files. Other-file cases remain visible in each card's Case details.";
    for (const item of display_order(entry.candidates, candidate.id)) {
        const article = document.createElement("article");
        article.className = `candidate${item.id === candidate.id ? " selected" : ""}`;

        const title = document.createElement("h3");
        title.textContent = `${item.title} (${item.id})`;
        if (item.id === candidate.id) {
            const badge = document.createElement("span");
            badge.className = "badge current-choice";
            badge.textContent = "Current choice";
            title.append(" ", badge);
        }

        const explanation_label = document.createElement("p");
        explanation_label.className = "candidate-label";
        explanation_label.textContent = "Why this reading";

        const explanation = document.createElement("p");
        explanation.className = "candidate-why";
        explanation.textContent = item.explanation;

        const stats = document.createElement("p");
        stats.className = "candidate-stats";
        stats.textContent = candidate_stat_line(item);

        const rule_detail = rules_detail(item);
        const case_detail = cases_detail(item);

        const badges = document.createElement("div");
        badges.className = "badges";
        badges.append(
            badge_toggle(item.rules.rules.length, "rules", rule_detail),
            badge_toggle(item.cases.length, "cases", case_detail),
        );

        const choose = document.createElement("button");
        choose.type = "button";
        if (item.id === candidate.id) {
            choose.className = "primary-action";
            choose.textContent = "Continue to Rules";
            choose.addEventListener("click", continue_to_rules);
        } else {
            choose.textContent = "Choose this reading";
            choose.addEventListener("click", () => {
                candidate = item;
                reset_review_filters();
                reset_review_focus();
                reset_line_status();
                last_check = null;
                reconcile_check();
                check_output.textContent = "";
                urls_reset();
                render();
            });
        }

        article.append(title, explanation_label, explanation, stats, badges);
        if (item.id === candidate.id) {
            article.append(candidate_current_note());
        } else {
            article.append(candidate_rules_delta(item), candidate_delta(item));
        }
        article.append(choose, rule_detail, case_detail);
        candidates_box.append(article);
    }
}

function render_rules() {
    const report = review_status();
    const progress = review_progress(report);
    current_review_report = report;
    const review_state = !candidate.review
        ? "No requirement review is recorded."
        : report.reasons.length > 0
            ? "The recorded review is stale or invalid."
            : `${progress.approved} of ${progress.identified} requirements approved.`;
    const rule_count = candidate.rules.rules.length;
    const case_count = candidate.cases.length;
    const rule_label = `${rule_count} rule${rule_count === 1 ? "" : "s"}`;
    const case_label = `${case_count} case${case_count === 1 ? "" : "s"}`;
    rules_note.textContent = `Candidate ${candidate.id}: ${rule_label}, ${case_label}. ${review_state}${edited ? " The working prompt has an applied edit." : ""}`;
    rules_badges.replaceChildren();
    const badge_texts = [rule_label, case_label];
    if (candidate.review) {
        badge_texts.push(`${progress.identified} requirements`, `${progress.approved} approved`);
    }
    for (const text of badge_texts) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = text;
        rules_badges.append(badge);
    }
    render_review_overview(report, progress);
    render_review_queue(report, progress);
    const text = JSON.stringify(candidate.rules, null, 2);
    rules_box.textContent = text;
    const link = document.querySelector("#rules-download");
    link.href = download_url(text, "application/json");
    link.download = `${candidate.id}-rules.json`;
}

function render_prose() {
    prose_box.textContent = ruleset_render(candidate.rules);
}

function render_comparison_row(item, row, report) {
    const tr = document.createElement("tr");
    tr.append(cell(`Line ${item.line} — ${item.quote}`));

    const requirement_cell = document.createElement("td");
    const title = document.createElement("div");
    title.className = "cell-text";
    title.textContent = item.title ?? item.id;
    const meta = document.createElement("div");
    meta.className = "case-meta";
    meta.textContent = `${item.id} · ${item.status.replaceAll("_", " ")}`;
    const detail = document.createElement("details");
    detail.className = "comparison-detail";
    const label = document.createElement("summary");
    label.textContent = "Explanation and rationale";
    const explanation = explanation_current(candidate, item.id, entry.source, working, catalog.fact_contract);
    const prose = document.createElement("p");
    prose.textContent = explanation?.text ?? (item.status === "executable"
        ? candidate.review?.explanation_error ?? "Explanation unavailable. Review the exact rules in Rules."
        : "This requirement is retained rather than formally executable.");
    const limitations = document.createElement("p");
    limitations.className = "note";
    limitations.textContent = explanation?.limitations
        ?? `Extraction reason: ${item.reason}. Missing facts: ${item.missing_facts.join(", ") || "none specified"}.`;
    const rules = { facts: [], rules: candidate.rules.rules.filter((rule) => item.rules.includes(rule.id)) };
    const exact = document.createElement("pre");
    exact.textContent = ruleset_render(rules);
    detail.append(label, prose, limitations, exact);
    requirement_cell.append(title, meta, detail);

    const decision = row?.decision ?? "unreviewed";
    const eligibility = row?.eligible === true ? "Eligible for removal" : "Retained";
    tr.append(requirement_cell, cell(decision, "verdict"), cell(eligibility),
        cell(row?.reason ?? retained_reason(report, item.line, [item])));
    return tr;
}

function render_line_status(report) {
    line_status_filter.value = line_status_mode;
    const rows = line_status_rows(working, report, candidate.review?.requirements);
    const counts = line_status_counts(rows);
    const visible = filter_line_status(rows, line_status_mode);
    line_status_summary.textContent = `${counts.total} nonblank source line${counts.total === 1 ? "" : "s"}; `
        + `${counts.removable} removable; ${counts.retained} retained. Showing ${visible.length} under this filter.`;
    line_status_body.replaceChildren();
    line_status_empty.hidden = visible.length > 0;
    if (visible.length === 0) {
        return;
    }
    for (const row of visible) {
        const tr = document.createElement("tr");
        const status = row.state === "removable" ? "Removable" : row.category.replaceAll("_", " ");
        tr.append(cell(String(row.line)), cell(status), cell(row.text), cell(row.reason));
        const action = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `Open line ${row.line}`;
        button.addEventListener("click", () => {
            show("prompt");
            activate_tab("prompt", prompt_panel);
            jump_to_outline_line(row.line);
        });
        action.append(button);
        tr.append(action);
        line_status_body.append(tr);
    }
}

function render_compare() {
    const report = review_status();
    const summary = reduction_summary(report, working);
    compare_note.textContent = "Readiness describes this selected reading, not proven extraction completeness. "
        + "A line is removable only when every requirement on that exact line is eligible.";
    compare_readiness.dataset.readiness = summary.readiness;
    compare_status.textContent = readiness_caption(summary);
    render_readiness_counts(compare_counts_box, summary);
    render_readiness_blockers(compare_blockers, summary);
    render_readiness_actions(summary, compare_actions, compare_action_note);
    compare_table_wrap.hidden = summary.legacy || !summary.available || summary.identified === 0;
    comparison.replaceChildren();
    if (!compare_table_wrap.hidden) {
        const rows = new Map(report.requirements.map((row) => [row.id, row]));
        for (const item of Array.isArray(candidate.review?.requirements) ? candidate.review.requirements : []) {
            comparison.append(render_comparison_row(item, rows.get(item.id), report));
        }
    }
    const show_lines = !summary.legacy && summary.available && summary.identified > 0;
    line_status_section.hidden = !show_lines;
    if (show_lines) {
        render_line_status(report);
    } else {
        line_status_body.replaceChildren();
        line_status_summary.textContent = "";
        line_status_empty.hidden = true;
    }
}

function render_reduced() {
    const reduction = review_reduce(candidate, entry.source, working, catalog.fact_contract);
    const summary = reduction_summary(reduction.report, working);
    reduced_box.textContent = reduction.text;

    reduced_readiness.dataset.readiness = summary.readiness;
    reduced_status.textContent = readiness_caption(summary);
    render_readiness_counts(reduced_counts_box, summary);
    render_readiness_blockers(reduced_blockers, summary);

    const can_download = summary.removed_lines.length > 0;
    if (can_download) {
        reduced_download.href = download_url(reduction.text, "text/markdown");
        reduced_download.download = `${candidate.id}-reduced.md`;
        reduced_download.setAttribute("aria-disabled", "false");
        reduced_download.textContent = `Download the reduced prompt (${summary.removable} line${summary.removable === 1 ? "" : "s"} removed)`;
        reduced_action_note.textContent = "This download is a review preview for the recorded scope. Later work must run the saved rules and supply suitable facts.";
    } else {
        reduced_download.removeAttribute("href");
        reduced_download.setAttribute("aria-disabled", "true");
        reduced_download.textContent = "Reduced prompt download unavailable";
        reduced_action_note.textContent = "Nothing is approved for removal, so there is no reduced prompt to download. "
            + "Resolve the retained reasons and current review blockers first.";
    }

    diff_box.replaceChildren();
    diff_empty.hidden = can_download;
    diff_empty.textContent = "No line is removed, so there is no difference yet.";
    diff_box.hidden = !can_download;
    if (!can_download) {
        return;
    }
    for (const row of diff_lines(working, reduction.text)) {
        const line = document.createElement("div");
        line.className = `diff-line diff-${row.kind}`;
        line.textContent = `${row.kind === "remove" ? "- " : row.kind === "add" ? "+ " : "  "}${row.text}`;
        diff_box.append(line);
    }
}

function selected_scope_files() {
    const separator = select_scope.value.indexOf(":");
    const kind = select_scope.value.slice(0, separator);
    const target = select_scope.value.slice(separator + 1);
    return kind === "dir"
        ? bundle.files.filter((file) => file.facts.directory === target)
        : bundle.files.filter((file) => file.path === target);
}

function scope_label() {
    const option = select_scope.options?.[select_scope.selectedIndex];
    return option?.textContent ?? select_scope.value;
}

function render_scope_suggestions() {
    scope_suggestion_list.replaceChildren();
    scope_use_best.hidden = true;
    if (!candidate || !Array.isArray(candidate.rules?.rules) || candidate.rules.rules.length === 0) {
        scope_suggestions.hidden = true;
        return;
    }
    scope_suggestions.hidden = false;
    const options = scope_options(bundle.files, candidate.rules.rules);
    const suggestions = rank_scope_suggestions(options, 5);
    const current = options.find((option) => option.value === select_scope.value);
    scope_suggestion_note.textContent = current?.ready
        ? "The current scope can run. These alternatives may provide broader or narrower evidence; choosing one does not run it."
        : "The current scope cannot supply everything these rules need. These alternatives show the closest available evidence.";
    if (suggestions.length === 0) {
        const empty = document.createElement("p");
        empty.className = "note";
        empty.textContent = "No file or directory scope is available in the build-time snapshot.";
        scope_suggestion_list.append(empty);
        return;
    }
    for (const option of suggestions) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = suggestion_label(option);
        button.setAttribute("aria-pressed", String(option.value === select_scope.value));
        button.title = option.ready
            ? `${option.fact_count} observations across ${option.file_count} file(s). Choosing this scope does not run the check.`
            : `Missing types: ${option.missing_types.join(", ")}. Choosing this scope does not run the check.`;
        button.addEventListener("click", () => choose_scope(option.value));
        scope_suggestion_list.append(button);
    }
    const best = suggestions.find((option) => option.ready && option.value !== select_scope.value);
    if (best) {
        scope_use_best.hidden = false;
        scope_use_best.textContent = `Use best suggested scope: ${best.label}`;
        scope_use_best.onclick = () => choose_scope(best.value);
    }
}

function render_check_preview() {
    const files = selected_scope_files();
    const facts = selected_facts();
    const stats = scope_stats(files);
    scope_preview.replaceChildren();
    render_facts(scope_preview, [
        ["Scope", scope_label()],
        ["Files", String(stats.file_count)],
        ["Observations", String(stats.fact_count)],
        ["Reading", candidate ? `${candidate.title} (${candidate.id})` : "none"],
        ["Rules", candidate ? String(candidate.rules.rules.length) : "0"],
    ]);
    if (stats.types.length === 0) {
        const empty = document.createElement("p");
        empty.className = "note";
        empty.textContent = "No fact types are present in this scope.";
        scope_preview.append(empty);
    } else {
        const list = document.createElement("ul");
        list.className = "check-types";
        list.setAttribute("aria-label", "Fact types and observation counts");
        for (const type of stats.types) {
            const item = document.createElement("li");
            item.textContent = `${type} × ${stats.counts[type]}`;
            list.append(item);
        }
        scope_preview.append(list);
    }

    check_readiness_box.replaceChildren();
    check_readiness_card.classList.toggle("check-status-good", false);
    check_readiness_card.classList.toggle("check-status-blocked", false);
    let message;
    let ready = false;
    if (!candidate) {
        message = "No reading is selected. Generate candidates in 1. Prompt before checking.";
    } else if (textarea.value !== working) {
        message = "Apply the edited prompt before running a check. The current rule set still describes the applied text.";
    } else {
        const readiness = check_readiness(candidate.rules.rules, facts);
        ready = readiness.ready;
        message = readiness.ready
            ? `Ready to run. The scope has ${readiness.fact_count} observation(s), including every fact type these rules require.`
            : `Cannot run: ${readiness.reason}`;
    }
    const status = document.createElement("p");
    status.className = "note";
    status.textContent = message;
    check_readiness_box.append(status);
    if (message.startsWith("Ready to run")) {
        const detail = document.createElement("p");
        detail.className = "note";
        detail.textContent = "A successful evaluation records this fact scope. It does not approve a requirement or establish complete intent.";
        check_readiness_box.append(detail);
    }
    check_readiness_card.classList.toggle("check-status-good", ready);
    check_readiness_card.classList.toggle("check-status-blocked", !ready);
    run_button.disabled = !ready || check_running;
    run_button.setAttribute("aria-busy", String(check_running));
    run_button.textContent = check_running ? "Running…" : "Run the rules";

    const current_scope = review_status().check_scope;
    check_next.hidden = !current_scope;
    check_next_note.textContent = current_scope
        ? `A current check is recorded for ${current_scope}. Approval is still a separate decision.`
        : "";
    render_scope_suggestions();
}

function render_check_result() {
    check_summary.replaceChildren();
    if (!last_check) {
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = "No evaluation is recorded for the current scope. Run the rules to supply check evidence; this alone approves nothing.";
        check_summary.append(note);
        update_step_status();
        return;
    }
    const summary = evaluation_summary(last_check);
    const headline = document.createElement("p");
    headline.className = "scan-result";
    headline.textContent = summary.has_violations
        ? `Evaluation completed — ${summary.emission_count} violation(s) emitted.`
        : "Evaluation completed — no violation was emitted.";
    check_summary.append(headline);
    const explanation = document.createElement("p");
    explanation.className = "note";
    explanation.textContent = `${summary.firings} rule firing(s) over the selected scope. `
        + (summary.has_violations
            ? "These are findings within this scope, not proof that the project fails elsewhere."
            : "This is not a pass or an approval. Only the selected facts were checked, and absence of a finding does not prove conformance.");
    check_summary.append(explanation);
    if (!summary.has_violations) {
        return;
    }
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const head_row = document.createElement("tr");
    for (const label of ["#", "Emitted finding"]) {
        const th = document.createElement("th");
        th.textContent = label;
        head_row.append(th);
    }
    head.append(head_row);
    const body = document.createElement("tbody");
    last_check.emitted.forEach((item, index) => {
        const row = document.createElement("tr");
        const emitted = document.createElement("td");
        emitted.className = "emission-item";
        const pre = document.createElement("pre");
        pre.textContent = JSON.stringify(item, null, 2);
        emitted.append(pre);
        row.append(cell(String(index + 1)), emitted);
        body.append(row);
    });
    table.append(head, body);
    const wrap = document.createElement("div");
    wrap.className = "table-scroll";
    wrap.append(table);
    check_summary.append(wrap);
}

function render_approve() {
    const report = review_status();
    const legacy = !candidate.review || report.reasons.length > 0;
    approve.replaceChildren();
    const rows = [
        ["Prompt", entry.source],
        ["Candidate", `${candidate.title} (${candidate.id})`],
        ["Rules", String(candidate.rules.rules.length)],
        ["Requirements", String(report.identified)],
        ["Approved requirements", String(report.approved)],
        ["Removable lines", String(report.removed.length)],
        ["Recorded check scope", report.check_scope ?? "none"],
        ["Prompt edited", edited ? "yes" : "no"],
    ];
    for (const [label, value] of rows) {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        approve.append(dt, dd);
    }

    approve_checklist.replaceChildren();
    const items = approval_checklist(candidate, report, edited);
    const targets = {
        prompt: ["Revise prompt", revise_prompt],
        candidates: ["Review candidates", () => show("candidates")],
        rules: ["Review requirements", () => show("rules")],
        check: ["Run check", () => show("check")],
        build: ["Build prompts.out", () => show("build")],
    };
    for (const item of items) {
        const row = document.createElement("div");
        row.className = `approval-item ${item.state}`;
        row.setAttribute("role", "listitem");
        const state = document.createElement("span");
        state.className = "approval-state";
        state.textContent = item.state === "done" ? "Done" : item.state === "warning" ? "Note" : "Blocked";
        const text = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = item.label;
        const detail = document.createElement("p");
        detail.className = "note";
        detail.textContent = item.detail;
        text.append(label, detail);
        const action = document.createElement("button");
        action.type = "button";
        const [action_label, action_call] = targets[item.target] ?? ["Go", () => {}];
        action.textContent = action_label;
        action.disabled = item.state === "done";
        action.addEventListener("click", action_call);
        row.append(state, text, action);
        approve_checklist.append(row);
    }
    const blocking = items.filter((item) => item.state === "blocked");
    approve_warning.textContent = blocking.length
        ? `${blocking.length} readiness item(s) blocked. Downloading artifacts does not remove these blockers.`
        : "Review readiness is complete for the recorded evidence. Approval remains a human decision, not a property of a download.";

    const artifact = artifact_state(report, legacy);
    const rules_link = document.querySelector("#approve-rules");
    rules_link.href = download_url(JSON.stringify(candidate.rules, null, 2), "application/json");
    rules_link.download = `${candidate.id}-rules.json`;

    const reduced_link = document.querySelector("#approve-reduced");
    if (artifact.reduced) {
        reduced_link.href = download_url(reduced_box.textContent, "text/markdown");
        reduced_link.download = `${candidate.id}-reduced.md`;
        reduced_link.removeAttribute("aria-disabled");
        reduced_link.textContent = "Download the reduced prompt (Markdown)";
        reduced_link.removeAttribute("title");
    } else {
        reduced_link.removeAttribute("href");
        reduced_link.removeAttribute("download");
        reduced_link.setAttribute("aria-disabled", "true");
        reduced_link.textContent = "Reduced prompt unavailable";
        reduced_link.title = artifact.reduced_reason;
    }
    approve_artifact_note.textContent = `${artifact.reduced_reason} The complete review artifact is the record even when no prose can be removed.`;

    const compile_link = document.querySelector("#approve-compile");
    compile_link.href = download_url(JSON.stringify({ source: entry.source, approved: candidate.id, candidates: [candidate] }, null, 4), "application/json");
    compile_link.download = `${candidate.id}-compile.json`;
}

function local_time(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.valueOf()) ? "(unknown)" : date.toLocaleString();
}

function render_facts(container, rows) {
    container.replaceChildren();
    for (const [label, value] of rows) {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        container.append(dt, dd);
    }
}

function render_file_history() {
    render_facts(file_history, [
        ["Prompt", entry.source],
        ["Last changed", local_time(entry.edited_at)],
        ["Last scanned", local_time(entry.scanned_at)],
        ["Candidates", String(entry.candidates.length)],
        ["Size", `${entry.markdown.length} characters`],
    ]);
}

function render_object_file() {
    render_facts(object_file, [
        ["Prompt", entry.source],
        ["Last changed", local_time(entry.edited_at)],
        ["Last scanned", local_time(scan_times.get(entry.source) ?? entry.scanned_at)],
    ]);
}

function build_slug(source) {
    return source.replace(/^prompts\//, "").replace(/\.md$/, "").replace(/[/_]/g, "-");
}

function build_catalog_entry(source) {
    return catalog.entries.find((item) => item.source === source);
}

function build_totals_view() {
    const totals = build_totals(build_state);
    const entries = Array.isArray(build_state?.entries) ? build_state.entries : [];
    const stale = entries.filter((item) => build_freshness(item, build_catalog_entry(item.source)).state !== "fresh").length;
    return { totals, stale };
}

function review_count(label, value, tone = "") {
    const item = document.createElement("div");
    item.className = `review-count ${tone}`;
    item.setAttribute("role", "listitem");
    const strong = document.createElement("strong");
    strong.textContent = String(value);
    const span = document.createElement("span");
    span.textContent = label;
    item.append(strong, span);
    return item;
}

function render_build_cycle() {
    build_cycle.replaceChildren();
    const counts = proposal_counts();
    const built_entry = build_state?.entries?.find((item) => item.source === entry.source);
    const freshness = build_freshness(built_entry, build_catalog_entry(entry.source));
    const rows = [
        ["Objects", `${counts.reviewed} reviewed · ${counts.accepted} accepted · ${counts.ignored} ignored · ${counts.unreviewed} unreviewed`],
        ["Candidate", candidate ? candidate.id : "none"],
        ["This prompt", `${candidate ? candidate.id : "none"} on the page · ${built_entry ? built_entry.candidate : "not built"} in prompts.out`],
        ["Freshness", freshness.state],
        ["prompts.out", build_state ? `built ${local_time(build_state.generated_at)}` : "not built"],
    ];
    for (const [label, value] of rows) {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        build_cycle.append(dt, dd);
    }
    build_totals_box.replaceChildren();
    if (!build_state) {
        return;
    }
    const { totals, stale } = build_totals_view();
    build_totals_box.append(
        review_count("entries", totals.entries),
        review_count("with removable lines", totals.with_removable, totals.with_removable ? "good" : ""),
        review_count("removable lines", totals.removable),
        review_count("stale or missing", stale, stale ? "attention" : "good"),
    );
}

function render_build() {
    render_build_cycle();
    build_entries.replaceChildren();
    if (!build_state) {
        build_note.textContent = "prompts.out/ has not been built yet. Build it to produce the reduced prompts and rule sets.";
        build_filter_summary.textContent = "";
        build_empty.hidden = true;
        return;
    }
    const totals = build_totals(build_state);
    if (!Array.isArray(build_state.entries) || build_state.entries.length === 0) {
        build_note.textContent = "The build manifest has no usable entries. Rebuild prompts.out/.";
        build_filter_summary.textContent = "";
        build_empty.hidden = true;
        return;
    }
    build_note.textContent = `Built ${local_time(totals.generated_at)}; ${totals.entries} compiled prompt(s), ${totals.removable} removable line(s). This build uses recorded compile entries, not the page draft.`;
    const rows = sort_build_rows(build_rows(build_state.entries, catalog.entries));
    const counts = build_filter_counts(rows);
    const visible = filter_build_rows(rows, build_filter_mode);
    build_filter.value = build_filter_mode;
    build_filter_summary.textContent = `${visible.length} of ${counts.all} entries shown; `
        + `${counts.stale} stale, ${counts.missing} missing, ${counts.fresh} fresh, ${counts.removable} with removable lines.`;
    build_empty.hidden = visible.length > 0;
    const invalid_count = build_state.entries.length - rows.length;
    if (invalid_count > 0) {
        build_filter_summary.textContent += ` ${invalid_count} malformed entr${invalid_count === 1 ? "y" : "ies"} ignored.`;
    }
    if (visible.length === 0) {
        return;
    }
    for (const { entry: item, freshness } of visible) {
        const article = document.createElement("article");
        article.className = `build-entry ${freshness.state}`;

        const title = document.createElement("h3");
        title.textContent = item.source;

        const meta = document.createElement("p");
        meta.className = "build-meta";
        const status = document.createElement("span");
        status.className = `status-label status-${freshness.state}`;
        status.textContent = freshness.state;
        const meta_text = document.createElement("span");
        meta_text.textContent = `Candidate ${item.candidate} · ${item.rules} rule(s) · ${build_coverage_text(item.coverage)} · ${freshness.reason}`;
        meta.append(status, meta_text);

        const links = document.createElement("p");
        const slug = build_slug(item.source);
        const files = ["rules.json", "reduced.md", "rendered.md", "comparison.md"];
        files.forEach((file, index) => {
            if (index > 0) {
                links.append(document.createTextNode(" · "));
            }
            const link = document.createElement("a");
            link.href = `/prompts-out/${slug}/${file}`;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = file;
            links.append(link);
        });

        article.append(title, meta, links);
        build_entries.append(article);
    }
    update_step_status();
}

async function load_build_state() {
    try {
        const response = await fetch("/build-state");
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        build_state = data.manifest;
        render_build();
    } catch {
        // A missing build is shown as "not built".
    }
}

function revise_prompt() {
    show("prompt");
    activate_tab("prompt", prompt_panel);
    textarea.focus();
    textarea.scrollIntoView({ block: "center" });
}

build_filter.addEventListener("change", () => {
    build_filter_mode = build_filter.value;
    if (build_state) {
        render_build();
    }
});

build_filter_reset.addEventListener("click", () => {
    build_filter_mode = "all";
    build_filter.value = "all";
    if (build_state) {
        render_build();
    }
});

build_button.addEventListener("click", async () => {
    build_button.disabled = true;
    build_button.setAttribute("aria-busy", "true");
    build_button.textContent = "Building…";
    build_note.textContent = "Building prompts.out/ from the recorded compile entries…";
    try {
        const response = await fetch("/build", { method: "POST" });
        const data = await response.json();
        if (!response.ok || !data.ok) {
            throw new Error(data.error ?? `HTTP ${response.status}`);
        }
        build_state = data.manifest;
        build_output.textContent = data.output ?? "";
        render_build();
        build_note.textContent = `Build complete. ${build_totals(build_state).entries} entry(ies) generated; review freshness and removable-line counts before relying on them.`;
    } catch (error) {
        build_note.textContent = `Build failed: ${error.message}. Previous output was left unchanged; correct the error and retry.`;
    } finally {
        build_button.disabled = false;
        build_button.removeAttribute("aria-busy");
        build_button.textContent = "Build prompts.out";
    }
});

for (const id of ["#revise-comparison", "#revise-approve"]) {
    document.querySelector(id).addEventListener("click", revise_prompt);
}

candidates_next.addEventListener("click", continue_to_rules);

function render() {
    urls_reset();
    render_file_history();
    render_object_file();
    render_proposals();
    render_prompt();
    render_candidates();

    if (!candidate) {
        reset_review_focus();
        reset_line_status();
        rules_box.textContent = "";
        rules_note.textContent = "No candidate rule set for this prompt yet.";
        prose_box.textContent = "";
        comparison.replaceChildren();
        compare_note.textContent = "";
        compare_readiness.dataset.readiness = "legacy";
        compare_status.textContent = "Nothing can be removed yet. This prompt has no candidate rule set.";
        compare_counts_box.replaceChildren();
        compare_blockers.replaceChildren();
        compare_action_note.textContent = "Generate candidates before reviewing a reduction.";
        compare_actions.replaceChildren(readiness_button("Generate candidates", review_regenerate, true));
        compare_table_wrap.hidden = true;
        line_status_section.hidden = true;
        line_status_body.replaceChildren();
        line_status_summary.textContent = "";
        line_status_empty.hidden = true;
        reduced_readiness.dataset.readiness = "legacy";
        reduced_status.textContent = "Nothing can be removed yet. This prompt has no candidate rule set.";
        reduced_counts_box.replaceChildren();
        reduced_blockers.replaceChildren();
        reduced_action_note.textContent = "There is no reduced prompt to download.";
        reduced_download.removeAttribute("href");
        reduced_download.setAttribute("aria-disabled", "true");
        reduced_download.textContent = "Reduced prompt download unavailable";
        reduced_box.textContent = working;
        diff_box.replaceChildren();
        diff_box.hidden = true;
        diff_empty.hidden = false;
        diff_empty.textContent = "No candidate rule set exists, so no comparison can be shown.";
        check_output.textContent = "";
        check_summary.replaceChildren();
        const no_check = document.createElement("p");
        no_check.className = "note";
        no_check.textContent = "No candidate rule set to check.";
        check_summary.append(no_check);
        render_check_preview();
        approve.replaceChildren();
        const dt = document.createElement("dt");
        dt.textContent = "Note";
        const dd = document.createElement("dd");
        dd.textContent = "No candidate rule set for this prompt yet.";
        approve.append(dt, dd);
        approve_warning.hidden = true;
        for (const id of ["#rules-download", "#reduced-download", "#approve-rules", "#approve-reduced", "#approve-compile"]) {
            document.querySelector(id).removeAttribute("href");
        }
        update_step_status();
        return;
    }

    if (last_check === null) {
        check_output.textContent = "";
    }
    render_rules();
    render_prose();
    render_compare();
    render_reduced();
    render_check_preview();
    render_check_result();
    render_approve();
    render_build_cycle();
    update_step_status();
}

function populate_prompts() {
    for (const item of catalog.entries) {
        const option = document.createElement("option");
        option.value = item.source;
        option.textContent = item.compiled ? item.source : `${item.source} — not compiled`;
        select_prompt.append(option);
    }
    select_prompt.value = entry.source;
}

function scope_directory_label(directory) {
    return directory === "." ? "the repository root" : `${directory}/`;
}

function populate_scopes() {
    const by_directory = new Map();
    for (const file of bundle.files) {
        const list = by_directory.get(file.facts.directory) ?? [];
        list.push(file);
        by_directory.set(file.facts.directory, list);
    }
    for (const [directory, files] of [...by_directory].sort()) {
        const group = document.createElement("optgroup");
        group.label = scope_directory_label(directory);
        const all = document.createElement("option");
        all.value = `dir:${directory}`;
        all.textContent = `all files in ${scope_directory_label(directory)} (${files.length})`;
        group.append(all);
        for (const file of files) {
            const option = document.createElement("option");
            option.value = `file:${file.path}`;
            option.textContent = file.path;
            group.append(option);
        }
        select_scope.append(group);
    }
}

function selected_facts() {
    return selected_scope_files().flatMap((file) => file.entities ?? [{ type: "file", ...file.facts }]);
}

function reconcile_check() {
    const check = candidate?.review?.check;
    if (!check) {
        return;
    }
    const previous = select_scope.value;
    select_scope.value = check.scope;
    if (review_observations_match(candidate, select_scope.value, selected_facts()) && review_status().check_scope) {
        last_check = check.result;
    } else {
        select_scope.value = previous;
        candidate.review.check = null;
        candidate.review.approvals = {};
        last_check = null;
    }
}

const STEP_LABELS = {
    prompt: "Step 1: Prompt",
    objects: "Step 2: Objects",
    candidates: "Step 3: Candidates",
    rules: "Step 4: Rules",
    check: "Step 5: Check",
    approve: "Step 6: Approve",
    build: "Step 7: Build and use",
};

function render_pipeline(status_rows, context = {}) {
    const current = current_step ?? "prompt";
    const stages = pipeline_track(status_rows, current);
    pipeline_track_list.replaceChildren();
    for (const stage of stages) {
        const item = document.createElement("li");
        item.className = "pipeline-stage";
        item.dataset.current = String(stage.current);
        item.dataset.step = stage.step;
        if (stage.current) {
            item.setAttribute("aria-current", "step");
        }
        const title = document.createElement("span");
        title.className = "pipeline-stage-title";
        title.textContent = `${PIPELINE_NUMBER[stage.step]}. ${stage.label}`;
        const artifact = document.createElement("span");
        artifact.className = "pipeline-stage-artifact";
        artifact.textContent = `Artifact: ${stage.artifact}`;
        const marker = document.createElement("span");
        marker.className = `step-state ${stage.state}`;
        marker.textContent = stage.state;
        marker.setAttribute("aria-hidden", "true");
        item.append(title, artifact, marker);
        if (stage.current) {
            const current_marker = document.createElement("span");
            current_marker.className = "pipeline-current";
            current_marker.textContent = "Current step";
            item.append(current_marker);
        }
        item.title = stage.detail;
        pipeline_track_list.append(item);
    }
    const current_item = pipeline_track_list.querySelector?.('[data-current="true"]');
    if (current_item && typeof current_item.offsetLeft === "number" && pipeline_track_list.clientWidth > 0) {
        const centered = current_item.offsetLeft - (pipeline_track_list.clientWidth - current_item.offsetWidth) / 2;
        pipeline_track_list.scrollLeft = Math.max(0, centered);
    }
    const detail = pipeline_detail(current, context);
    pipeline_detail_title.textContent = detail.title;
    pipeline_consumes.textContent = detail.consumes;
    pipeline_produces.textContent = detail.produces;
    pipeline_caution.textContent = detail.caution;
    pipeline_flow.replaceChildren();
    for (const item of detail.flow) {
        const step = document.createElement("li");
        const label = document.createElement("strong");
        label.textContent = item.label;
        const artifact = document.createElement("span");
        artifact.textContent = item.artifact;
        step.append(label, artifact);
        pipeline_flow.append(step);
    }
}

const PIPELINE_NUMBER = { prompt: 1, objects: 2, candidates: 3, rules: 4, check: 5, approve: 6, build: 7 };

function update_step_status() {
    const built = build_state?.entries?.find((item) => item.source === entry?.source);
    const freshness = built ? build_freshness(built, build_catalog_entry(entry.source)).state : null;
    const report = candidate ? review_status() : null;
    const rows = step_statuses({
        candidate,
        report,
        objects: proposal_counts(),
        edited,
        build: { present: Boolean(build_state && built), freshness },
    });
    const pipeline_context = {
        report,
        source: entry.source,
        draft_state: textarea.value !== working ? "unsaved_edit" : edited ? "applied_draft" : "matches_file",
        candidate_count: entry.candidates.length,
        current_candidate: candidate?.id,
        current_rule_count: Array.isArray(candidate?.rules?.rules) ? candidate.rules.rules.length : 0,
        objects: proposal_counts(),
        scope_label: scope_label(),
        scope_fact_count: selected_facts().length,
        scope_ready: candidate ? check_readiness(candidate.rules.rules, selected_facts()).ready : false,
        check_scope: report?.check_scope ?? null,
        build_present: Boolean(build_state && built),
        build_freshness: freshness,
        build_entries: build_totals(build_state).entries,
        build_removable: build_totals(build_state).removable,
        object_origins: review_breakdown(proposals),
        edited,
    };
    const by_step = new Map(rows.map((row) => [row.step, row]));
    for (const button of document.querySelectorAll(".steps button")) {
        const row = by_step.get(button.dataset.step);
        if (!row) {
            continue;
        }
        let marker = button.querySelector(".step-state");
        if (!marker) {
            marker = document.createElement("span");
            marker.className = "step-state";
            marker.setAttribute("aria-hidden", "true");
            button.append(marker);
        }
        marker.className = `step-state ${row.state}`;
        marker.textContent = row.state;
        button.setAttribute("aria-label", `${row.title} — ${row.state}. ${row.detail}`);
        button.title = row.detail;
    }
    const next = next_recommended_step(rows);
    step_next.hidden = !next;
    if (next) {
        step_next_note.textContent = `Next: ${next.title} — ${next.detail}`;
        step_next_action.textContent = `Go to ${next.title.replace(/^Step [0-9]+: /, "")}`;
        step_next_action.onclick = () => show(next.step);
    }
    render_pipeline(rows, pipeline_context);
}

function show(step, announce = true) {
    for (const button of document.querySelectorAll(".steps button")) {
        const active = button.dataset.step === step;
        button.classList.toggle("active", active);
        if (active) {
            button.setAttribute("aria-current", "step");
        } else {
            button.removeAttribute("aria-current");
        }
    }
    for (const panel of document.querySelectorAll(".panel")) {
        panel.hidden = panel.dataset.panel !== step;
    }
    if (announce && step !== current_step) {
        step_announcement.textContent = STEP_LABELS[step] ?? step;
    }
    current_step = step;
    update_step_status();
}

function tab_panel_of(tab) {
    const tablist = tab.closest('[role="tablist"]');
    if (!tablist) {
        return null;
    }
    const scope = tab.closest(".panel") ?? document;
    return scope.querySelector(`.tab-panel[data-tab="${tab.dataset.tab}"]`);
}

function prepare_tab(tab) {
    const tablist = tab.closest('[role="tablist"]');
    const panel = tab_panel_of(tab);
    if (!tablist || !panel) {
        return;
    }
    const panel_name = tablist.closest(".panel")?.dataset.panel ?? "page";
    panel.id ||= `tab-panel-${panel_name}-${tab.dataset.tab}`;
    tab.id ||= `${panel.id}-tab`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    tab.tabIndex = tab.classList.contains("active") ? 0 : -1;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
}

function tablist_keydown(event) {
    const tab = event.target.closest?.(".tab");
    const tablist = tab?.closest('[role="tablist"]');
    if (!tab || !tablist) {
        return;
    }
    const tabs = [...tablist.querySelectorAll('[role="tab"]')].filter((item) => !item.disabled);
    const index = tabs.indexOf(tab);
    let next = null;
    if (event.key === "ArrowRight") {
        next = tabs[(index + 1) % tabs.length];
    } else if (event.key === "ArrowLeft") {
        next = tabs[(index - 1 + tabs.length) % tabs.length];
    } else if (event.key === "Home") {
        next = tabs[0];
    } else if (event.key === "End") {
        next = tabs[tabs.length - 1];
    }
    if (!next) {
        return;
    }
    event.preventDefault();
    activate_tab(next.dataset.tab, next.closest(".panel"));
    next.focus();
}

function prepare_tablist(tablist) {
    tablist.setAttribute("role", "tablist");
    for (const tab of tablist.querySelectorAll('[role="tab"]')) {
        prepare_tab(tab);
    }
    if (!tablist.dataset.keyboardBound) {
        tablist.dataset.keyboardBound = "true";
        tablist.addEventListener("keydown", tablist_keydown);
    }
}

function prepare_all_tabs() {
    for (const tablist of document.querySelectorAll('[role="tablist"]')) {
        prepare_tablist(tablist);
    }
}

select_prompt.addEventListener("change", () => {
    draft_revision += 1;
    entry = catalog.entries.find((item) => item.source === select_prompt.value) ?? catalog.entries[0];
    candidate = entry.candidates.find((item) => item.id === entry.approved) ?? entry.candidates[0] ?? null;
    working = entry.markdown;
    edited = false;
    last_check = null;
    reset_review_filters();
    reset_review_focus();
    reset_line_status();
    reconcile_check();
    render();
});

textarea.addEventListener("input", () => {
    draft_revision += 1;
    if (candidate?.review) {
        candidate.review.approvals = {};
        candidate.review.check = null;
        candidate.review.explanations = null;
    }
    last_check = null;
    urls_reset();
    if (candidate) {
        render_rules();
        render_compare();
        render_reduced();
        render_approve();
        render_check_preview();
        render_check_result();
    }
    if (textarea.value !== working) {
        for (const id of ["#reduced-download", "#approve-rules", "#approve-reduced", "#approve-compile"]) {
            document.querySelector(id).removeAttribute("href");
        }
        reduced_box.textContent = textarea.value;
        approve_warning.hidden = false;
        approve_warning.textContent = "Apply the edited prompt before checking or downloading review artifacts.";
    }
    render_proposals();
    update_prompt_state();
});

for (const event_name of ["click", "keyup", "select"]) {
    textarea.addEventListener(event_name, update_cursor_status);
}

prompt_outline_query.addEventListener("input", rebuild_outline);

prompt_outline_select.addEventListener("change", () => {
    if (prompt_outline_select.value !== "") {
        jump_to_outline_line(prompt_outline_select.value);
    }
});

document.querySelector("#apply").addEventListener("click", () => {
    working = textarea.value;
    edited = working !== entry.markdown;
    last_check = null;
    render();
});

document.querySelector("#reset").addEventListener("click", () => {
    draft_revision += 1;
    working = entry.markdown;
    edited = false;
    last_check = null;
    render();
});

prompt_next.addEventListener("click", () => {
    show("candidates");
});

function status_text(event) {
    switch (event.phase) {
        case "session":
            return "the Harness session started";
        case "turn_start":
            return "the model turn started";
        case "step_start":
            return "the model is working";
        case "thinking":
            return "the model is reasoning";
        case "text":
            return "the model is writing";
        case "tool_call":
            return `the model is calling a tool (${event.tool ?? "?"})`;
        case "tool_result":
            return "a tool returned";
        case "step_end":
            return "a step finished";
        case "turn_end":
            return "the turn finished";
        default:
            return event.phase ?? "working";
    }
}

function activate_tab(name, scope) {
    const container = scope ?? document;
    for (const button of container.querySelectorAll(".tab")) {
        const active = button.dataset.tab === name;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
    }
    for (const panel of container.querySelectorAll(".tab-panel")) {
        panel.hidden = panel.dataset.tab !== name;
    }
    if (scope === object_panel) {
        sync_object_toolbar(name);
    }
}

let history_entries = [];

function render_history() {
    history_log.textContent = history_entries.map((entry) => `[${entry.seconds}s] ${entry.text}`).join("\n") + "\n";
    history_log.scrollTop = history_log.scrollHeight;
}

function append_history(seconds, text) {
    history_entries.push({ seconds, text });
    render_history();
}

function reasoning_tail(text) {
    const cleaned = text.replace(/dsh: reasoning:\s*/g, "").replace(/\s+/g, " ").trim();
    if (!cleaned) {
        return "thinking";
    }
    const tail = 80;
    const clipped = cleaned.length > tail ? `…${cleaned.slice(-tail)}` : cleaned;
    return `thinking: ${clipped}`;
}

// post_sse runs one server task and returns its terminal `done` event. A
// `phase`, `status`, or `reasoning` event is passed to on_event so the caller can
// show progress.
async function post_sse(path, body, on_event) {
    const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result = null;
    while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
            break;
        }
        buffer += decoder.decode(chunk.value, { stream: true });
        let index;
        while ((index = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            for (const line of frame.split("\n")) {
                if (!line.startsWith("data: ")) {
                    continue;
                }
                const event = JSON.parse(line.slice(6));
                if (event.type === "error") {
                    throw new Error(event.message);
                }
                if (event.type === "done") {
                    result = event;
                }
                if (on_event) {
                    on_event(event);
                }
            }
        }
    }
    if (!result) {
        throw new Error("the server returned no result");
    }
    return result;
}

object_search.addEventListener("input", () => {
    object_query = object_search.value;
    render_proposals();
});

object_filter.addEventListener("change", () => {
    object_mode = object_filter.value;
    render_proposals();
});

object_origin_select.addEventListener("change", () => {
    object_origin = object_origin_select.value;
    render_proposals();
});

object_clear_filters.addEventListener("click", clear_object_filters);
object_empty_clear.addEventListener("click", clear_object_filters);
object_next_unreviewed.addEventListener("click", next_unreviewed);
object_review_unreviewed.addEventListener("click", review_unreviewed);

function clear_review_filters() {
    reset_review_filters();
    render_review_queue(current_review_report, review_progress(current_review_report));
}

review_search.addEventListener("input", () => {
    review_query = review_search.value;
    render_review_queue(current_review_report, review_progress(current_review_report));
});

review_filter.addEventListener("change", () => {
    review_mode = review_filter.value;
    render_review_queue(current_review_report, review_progress(current_review_report));
});

review_clear_filters.addEventListener("click", clear_review_filters);
review_empty_clear.addEventListener("click", clear_review_filters);
review_empty_regenerate.addEventListener("click", review_regenerate);
review_next_needing.addEventListener("click", focus_next_review);

function focus_visible_review(delta) {
    if (!candidate?.review) {
        return;
    }
    const report = review_status();
    const visible = filter_requirements(candidate.review.requirements, report, review_query, review_mode,
        (requirement) => explanation_current(candidate, requirement.id, entry.source, working, catalog.fact_contract));
    const current = resolve_focus_index(visible, review_focus_id);
    const next = move_focus_index(visible, current, delta);
    const item = focus_item(visible, next);
    if (!item) {
        review_focus_status.textContent = "No requirement is visible under the current filters.";
        return;
    }
    review_focus_id = item.id;
    review_focused = true;
    review_focus_toggle.checked = true;
    render_review_queue(report, review_progress(report));
    const position = focus_position(visible, next);
    review_focus_status.textContent = `${position.label}: ${item.title}.`;
    const card = review_card_elements.get(item.id);
    card?.focus({ preventScroll: true });
    card?.scrollIntoView?.({ block: "center" });
}

function set_review_focus(on) {
    review_focused = Boolean(on);
    review_focus_toggle.checked = review_focused;
    if (!review_focused) {
        review_focus_nav.hidden = true;
        review_focus_status.textContent = "";
        if (candidate?.review) {
            const report = review_status();
            render_review_queue(report, review_progress(report));
        }
        return;
    }
    if (!candidate?.review) {
        reset_review_focus();
        return;
    }
    const report = review_status();
    const visible = filter_requirements(candidate.review.requirements, report, review_query, review_mode,
        (requirement) => explanation_current(candidate, requirement.id, entry.source, working, catalog.fact_contract));
    const unreviewed = visible.find((requirement) => {
        const row = report.requirements.find((item) => item.id === requirement.id);
        return (row?.decision ?? "unreviewed") === "unreviewed";
    });
    const chosen = visible.find((requirement) => requirement.id === review_focus_id) ?? unreviewed ?? visible[0];
    review_focus_id = chosen?.id ?? null;
    render_review_queue(report, review_progress(report));
    review_focus_status.textContent = chosen
        ? `${focus_position(visible, resolve_focus_index(visible, chosen.id)).label}: ${chosen.title}.`
        : "No requirement is visible under the current filters.";
}

review_focus_toggle.addEventListener("change", () => set_review_focus(review_focus_toggle.checked));
review_focus_prev.addEventListener("click", () => focus_visible_review(-1));
review_focus_next.addEventListener("click", () => focus_visible_review(1));
review_focus_exit.addEventListener("click", () => set_review_focus(false));

line_status_filter.addEventListener("change", () => {
    line_status_mode = line_status_filter.value;
    if (candidate) {
        render_line_status(review_status());
    }
});

propose_button.addEventListener("click", async () => {
    const source_scan = entry.source;
    propose_button.disabled = true;
    propose_button.setAttribute("aria-busy", "true");
    propose_button.textContent = "Scanning…";
    propose_note.textContent = "Scanning…";
    try {
        const result = await post_sse("/propose", { source: source_scan, text: textarea.value }, (event) => {
            if (event.type === "phase") {
                propose_note.textContent = event.message ?? event.phase;
            } else if (event.type === "status") {
                propose_note.textContent = status_text(event);
            }
        });
        const known = new Set(proposals.map((row) => row.term));
        let new_count = 0;
        let known_count = 0;
        for (const proposal of result.proposals) {
            if (!known.has(proposal.term)) {
                proposals.push({ ...proposal, origin: "scan", use: default_use(proposal), reviewed: false });
                known.add(proposal.term);
                new_count += 1;
            } else {
                known_count += 1;
            }
        }
        render_proposals();
        scan_times.set(source_scan, new Date().toISOString());
        render_object_file();
        propose_note.textContent = `${result.proposals.length} proposal(s) read; `
            + `${new_count} new and ${known_count} already present. New terms are unreviewed.`;
    } catch (error) {
        propose_note.textContent = `Scan failed: ${error.message}`;
    } finally {
        propose_button.disabled = false;
        propose_button.setAttribute("aria-busy", "false");
        propose_button.textContent = "Scan file";
    }
});

document.querySelector("#generate").addEventListener("click", async () => {
    const button = generate_button;
    const request_entry = entry;
    const request_text = textarea.value;
    const request_revision = draft_revision;
    const note = document.querySelector("#generate-note");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Generating…";
    let phase = "generation started";
    let reasoning = "";
    let last_appended = null;
    const started = Date.now();
    history_entries = [];
    activate_tab("history", prompt_panel);
    const update = () => {
        const seconds = Math.round((Date.now() - started) / 1000);
        if (phase !== last_appended) {
            last_appended = phase;
            append_history(seconds, phase);
        }
        note.textContent = `Compiling… ${seconds}s elapsed; ${phase}`;
    };
    update();
    const timer = setInterval(update, 1000);
    try {
        const result = await post_sse("/compile", { source: request_entry.source, text: request_text }, (event) => {
            if (event.type === "phase") {
                phase = event.message ?? event.phase;
            } else if (event.type === "status") {
                phase = status_text(event);
            } else if (event.type === "reasoning") {
                reasoning += event.text;
                phase = reasoning_tail(reasoning);
            }
        });
        if (entry !== request_entry || textarea.value !== request_text || draft_revision !== request_revision) {
            throw new Error("Prompt changed during generation; result discarded. Generate again for the current draft.");
        }
        const candidates = result.candidates;
        entry = { ...entry, compiled: true, candidates };
        candidate = entry.candidates[0];
        reset_review_filters();
        reset_review_focus();
        reset_line_status();
        working = request_text;
        edited = working !== entry.markdown;
        last_check = null;
        phase = `generated ${candidates.length} candidate(s)`;
        append_history(Math.round((Date.now() - started) / 1000), phase);
        last_appended = phase;
        note.textContent = `Generated ${candidates.length} candidate(s); choose one in the next panel.`;
        render();
        show("candidates");
    } catch (error) {
        phase = `failed: ${error.message}`;
        append_history(Math.round((Date.now() - started) / 1000), phase);
        last_appended = phase;
        note.textContent = `Generation failed: ${error.message}`;
    } finally {
        clearInterval(timer);
        button.disabled = false;
        button.setAttribute("aria-busy", "false");
        button.textContent = "Generate candidates";
    }
});

function scope_changed() {
    last_check = null;
    if (candidate?.review) {
        candidate.review.check = null;
        candidate.review.approvals = {};
    }
    if (textarea.value !== working) {
        render_check_preview();
        render_scope_suggestions();
        render_check_result();
        return;
    }
    render();
}

function choose_scope(value) {
    if (typeof value !== "string" || value === "") {
        return;
    }
    select_scope.value = value;
    scope_changed();
}

select_scope.addEventListener("change", scope_changed);

check_next_action.addEventListener("click", () => show("approve"));

document.querySelector("#run").addEventListener("click", async () => {
    if (check_running) {
        return;
    }
    if (!candidate) {
        check_status.textContent = "No candidate rule set to run.";
        check_output.textContent = "No candidate rule set to run.";
        return;
    }
    if (textarea.value !== working) {
        check_status.textContent = "Apply the edited prompt before running a check.";
        check_output.textContent = "Apply the edited prompt before running a check.";
        render_check_preview();
        return;
    }
    const facts = selected_facts();
    const readiness = check_readiness(candidate.rules.rules, facts);
    if (!readiness.ready) {
        check_status.textContent = `Cannot run: ${readiness.reason}`;
        check_output.textContent = `Cannot run: ${readiness.reason}`;
        render_check_preview();
        return;
    }
    check_running = true;
    check_status.textContent = `Running the rules against ${facts.length} observation(s)…`;
    render_check_preview();
    await new Promise((resolve) => {
        if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(resolve);
        } else {
            setTimeout(resolve, 0);
        }
    });
    try {
        const result = candidate.review
            ? review_check(candidate, entry.source, working, catalog.fact_contract, select_scope.value, facts)
            : ruleset_run({ facts, rules: candidate.rules.rules });
        last_check = result;
        check_output.textContent = JSON.stringify(
            { rule_set: candidate.id, scope: select_scope.value, firings: result.firings, emitted: result.emitted },
            null,
            2,
        );
        check_status.textContent = `Evaluation completed for ${scope_label()}. No approval was recorded.`;
    } catch (error) {
        last_check = null;
        check_output.textContent = `error: ${error.message}`;
        check_status.textContent = `Check refused: ${error.message}`;
    } finally {
        check_running = false;
        render_rules();
        render_compare();
        render_reduced();
        render_check_preview();
        render_check_result();
        render_approve();
    }
});

for (const button of document.querySelectorAll(".steps button")) {
    button.addEventListener("click", () => show(button.dataset.step));
}

for (const button of document.querySelectorAll(".tab")) {
    button.addEventListener("click", () => activate_tab(button.dataset.tab, button.closest(".panel")));
}

populate_prompts();
populate_scopes();
reconcile_check();
render();
prepare_all_tabs();
show("prompt", false);
load_build_state();
