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

const catalog = await load_json("./catalog.json");
const bundle = await load_json("./files.json");
const object_model = await load_json("./object-model.json");

const select_prompt = document.querySelector("#prompt");
const select_scope = document.querySelector("#scope");
const textarea = document.querySelector("#source");
const edit_note = document.querySelector("#edit-note");
const candidates_box = document.querySelector("#candidates");
const rules_box = document.querySelector("#rules");
const rules_note = document.querySelector("#rules-note");
const prose_box = document.querySelector("#prose");
const compare_note = document.querySelector("#compare-note");
const comparison = document.querySelector("#comparison");
const reduced_box = document.querySelector("#reduced");
const diff_box = document.querySelector("#diff");
const check_output = document.querySelector("#check-output");
const approve = document.querySelector("#approve");
const history_log = document.querySelector("#history-log");
const file_history = document.querySelector("#file-history");
const prompt_panel = document.querySelector('.panel[data-panel="prompt"]');
const objects_count = document.querySelector("#objects-count");
const propose_note = document.querySelector("#propose-note");
const object_panel = document.querySelector('.panel[data-panel="objects"]');
const object_tabs = document.querySelector("#object-tabs");
const object_about_tab = object_tabs.querySelector('[data-tab="object-about"]');
const object_about_panel = object_panel.querySelector('.tab-panel[data-tab="object-about"]');

let entry = catalog.entries.find((item) => item.compiled) ?? catalog.entries[0];
let candidate = entry.candidates[0] ?? null;
let working = entry.markdown;
let edited = false;
let last_check = null;
let proposals = proposal_rows(object_model);
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
function file_url(path, source, term) {
    const params = new URLSearchParams({ path, term: term ?? "" });
    if (typeof source === "string" && source.startsWith(path)) {
        const section = source.slice(path.length).trim();
        if (section !== "") {
            params.set("section", section);
        }
    }
    return `./file.html?${params.toString()}`;
}

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
        });
    }
    for (const proposal of model.proposals ?? []) {
        rows.push({ ...proposal });
    }
    return rows.map((row) => ({ ...row, use: default_use(row), reviewed: false }));
}

function proposal_counts() {
    const counts = { accept: 0, ignore: 0, unreviewed: 0 };
    for (const row of proposals) {
        counts[row.use] += 1;
        if (!row.reviewed) {
            counts.unreviewed += 1;
        }
    }
    return counts;
}

let proposals_url = null;

function render_proposals() {
    for (const row of proposals) {
        ensure_kind_tab(row.kind);
    }
    const bodies = new Map();
    for (const body of object_panel.querySelectorAll("tbody[data-kind]")) {
        body.replaceChildren();
        bodies.set(body.dataset.kind, body);
    }
    for (const row of proposals) {
        const tr = document.createElement("tr");
        tr.className = `use-${row.use}${row.reviewed ? "" : " unreviewed"}`;

        const term = document.createElement("td");
        const term_line = document.createElement("div");
        term_line.className = "term-line";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = row.use === "accept";
        box.indeterminate = !row.reviewed;
        box.setAttribute("aria-label", `accept ${row.term}`);
        box.addEventListener("change", () => {
            row.use = box.checked ? "accept" : "ignore";
            row.reviewed = true;
            render_proposals();
        });
        term_line.append(box, document.createTextNode(row.term));
        term.append(term_line);
        if (!row.reviewed) {
            const hint = document.createElement("div");
            hint.className = "review-hint";
            hint.textContent = "unreviewed";
            term.append(hint);
        }

        const evidence = document.createElement("td");
        evidence.className = "evidence";
        const evidence_line = document.createElement("div");
        evidence_line.className = "evidence-line";
        const match = /^([A-Za-z0-9_./-]+\.(?:md|sh|mjs|js|json|html|txt|ya?ml|toml|lock|py|c|h|cpp))\b/.exec(row.evidence ?? "");
        if (match) {
            const link = document.createElement("a");
            link.href = file_url(match[1], row.source, row.term);
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = match[1];
            evidence_line.append(link, document.createTextNode((row.evidence ?? "").slice(match[1].length)));
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

    const counts = proposal_counts();
    objects_count.textContent = `${counts.accept} accept · ${counts.ignore} ignore · ${counts.unreviewed} unreviewed (of ${proposals.length})`;

    if (proposals_url !== null) {
        URL.revokeObjectURL(proposals_url);
    }
    proposals_url = download_url(JSON.stringify({ proposals }, null, 2), "application/json");
    document.querySelector("#proposals-download").href = proposals_url;
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

function covered_origins(current_entry, current_candidate) {
    return current_candidate.cases
        .filter((item) => (item.source ?? current_entry.source) === current_entry.source)
        .map((item) => item.original);
}

function reduce(text, origins, candidate_id) {
    const kept = text
        .split("\n")
        .filter((line) => !origins.some((origin) => line.includes(origin)));
    return `${kept.join("\n").trimEnd()}\n\n## Compiled rules\n\nThis file's covered rules are compiled into the krank rule set \`${candidate_id}\`; see the compiled rules on this page.\n`;
}

function render_prompt() {
    select_prompt.value = entry.source;
    textarea.value = working;
    edit_note.textContent = edited
        ? "The working text differs from the file. The compile still comes from the file's cases; the comparison marks a covered line the edit broke."
        : "The working text is the file's text.";
}

function render_candidates() {
    candidates_box.replaceChildren();
    if (entry.candidates.length === 0) {
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = "This prompt has no candidate rule set yet.";
        candidates_box.append(note);
        return;
    }
    for (const item of entry.candidates) {
        const article = document.createElement("article");
        article.className = `candidate${item.id === candidate.id ? " selected" : ""}`;

        const title = document.createElement("h3");
        title.textContent = `${item.title} (${item.id})`;

        const explanation = document.createElement("p");
        explanation.textContent = item.explanation;

        const badges = document.createElement("div");
        badges.className = "badges";
        for (const text of [`${item.rules.rules.length} rules`, `${item.cases.length} cases`]) {
            const badge = document.createElement("span");
            badge.textContent = text;
            badges.append(badge);
        }

        const choose = document.createElement("button");
        choose.type = "button";
        choose.textContent = item.id === candidate.id ? "Selected" : "Choose this candidate";
        choose.disabled = item.id === candidate.id;
        choose.addEventListener("click", () => {
            candidate = item;
            last_check = null;
            check_output.textContent = "";
            urls_reset();
            render();
        });

        article.append(title, explanation, badges, choose);
        candidates_box.append(article);
    }
}

function render_rules() {
    rules_note.textContent = `Candidate ${candidate.id}: ${candidate.rules.rules.length} rules${edited ? "; the working prompt has been edited" : ""}.`;
    const text = JSON.stringify(candidate.rules, null, 2);
    rules_box.textContent = text;
    const link = document.querySelector("#rules-download");
    link.href = download_url(text, "application/json");
    link.download = `${candidate.id}-rules.json`;
}

function render_prose() {
    prose_box.textContent = ruleset_render(candidate.rules);
}

function render_compare() {
    const rendered = rendered_by_rule(ruleset_render(candidate.rules));
    const origins = covered_origins(entry, candidate);
    const present = origins.filter((origin) => working.includes(origin)).length;
    compare_note.textContent = origins.length === 0
        ? "This candidate has no case drawn from this file."
        : `${present} of ${origins.length} covered lines are present in the prompt text; a missing line is dimmed.`;
    comparison.replaceChildren();
    for (const item of candidate.cases) {
        const row = document.createElement("tr");
        if (!working.includes(item.original)) {
            row.className = "missing";
        }
        row.append(
            cell(item.original),
            cell(rendered.get(item.rule) ?? "(not rendered)"),
            cell(item.verdict, "verdict"),
            cell(item.note),
            cell(item.suggestion ?? "", "hint"),
        );
        comparison.append(row);
    }
}

function render_reduced() {
    const origins = covered_origins(entry, candidate);
    const reduced = origins.length === 0 ? working : reduce(working, origins, candidate.id);
    reduced_box.textContent = reduced;

    diff_box.replaceChildren();
    for (const row of diff_lines(working, reduced)) {
        const line = document.createElement("div");
        line.className = `diff-line diff-${row.kind}`;
        line.textContent = `${row.kind === "remove" ? "- " : row.kind === "add" ? "+ " : "  "}${row.text}`;
        diff_box.append(line);
    }

    const link = document.querySelector("#reduced-download");
    link.href = download_url(reduced, "text/markdown");
    link.download = `${candidate.id}-reduced.md`;
}

function render_approve() {
    approve.replaceChildren();
    const rows = [
        ["Prompt", entry.source],
        ["Candidate", `${candidate.title} (${candidate.id})`],
        ["Rules", String(candidate.rules.rules.length)],
        ["Cases", String(candidate.cases.length)],
        ["Prompt edited", edited ? "yes" : "no"],
        ["Check", last_check ? `${last_check.firings} firing(s), ${last_check.emitted.length} emission(s)` : "not run"],
    ];
    for (const [label, value] of rows) {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        approve.append(dt, dd);
    }

    const rules_link = document.querySelector("#approve-rules");
    rules_link.href = download_url(JSON.stringify(candidate.rules, null, 2), "application/json");
    rules_link.download = `${candidate.id}-rules.json`;

    const reduced_link = document.querySelector("#approve-reduced");
    reduced_link.href = download_url(reduced_box.textContent, "text/markdown");
    reduced_link.download = `${candidate.id}-reduced.md`;
}

function local_time(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.valueOf()) ? "(unknown)" : date.toLocaleString();
}

function render_file_history() {
    file_history.replaceChildren();
    const rows = [
        ["Prompt", entry.source],
        ["Last edited", local_time(entry.edited_at)],
        ["Last scanned", local_time(entry.scanned_at)],
        ["Candidates", String(entry.candidates.length)],
        ["Size", `${entry.markdown.length} characters`],
    ];
    for (const [label, value] of rows) {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        file_history.append(dt, dd);
    }
}

function render() {
    urls_reset();
    render_file_history();
    render_proposals();
    render_prompt();
    render_candidates();

    if (!candidate) {
        rules_box.textContent = "";
        rules_note.textContent = "No candidate rule set for this prompt yet.";
        prose_box.textContent = "";
        comparison.replaceChildren();
        compare_note.textContent = "";
        reduced_box.textContent = working;
        diff_box.textContent = "No candidate rule set for this prompt yet.";
        check_output.textContent = "";
        approve.replaceChildren();
        const dt = document.createElement("dt");
        dt.textContent = "Note";
        const dd = document.createElement("dd");
        dd.textContent = "No candidate rule set for this prompt yet.";
        approve.append(dt, dd);
        for (const id of ["#rules-download", "#reduced-download", "#approve-rules", "#approve-reduced"]) {
            document.querySelector(id).removeAttribute("href");
        }
        return;
    }

    if (last_check === null) {
        check_output.textContent = "";
    }
    render_rules();
    render_prose();
    render_compare();
    render_reduced();
    render_approve();
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

function populate_scopes() {
    const by_directory = new Map();
    for (const file of bundle.files) {
        const list = by_directory.get(file.facts.directory) ?? [];
        list.push(file);
        by_directory.set(file.facts.directory, list);
    }
    for (const [directory, files] of [...by_directory].sort()) {
        const group = document.createElement("optgroup");
        group.label = directory;
        const all = document.createElement("option");
        all.value = `dir:${directory}`;
        all.textContent = `all files in ${directory}/ (${files.length})`;
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
    const separator = select_scope.value.indexOf(":");
    const kind = select_scope.value.slice(0, separator);
    const target = select_scope.value.slice(separator + 1);
    const files = kind === "dir"
        ? bundle.files.filter((file) => file.facts.directory === target)
        : bundle.files.filter((file) => file.path === target);
    return files.flatMap((file) => file.entities ?? [{ type: "file", ...file.facts }]);
}

function show(step) {
    for (const button of document.querySelectorAll(".steps button")) {
        button.classList.toggle("active", button.dataset.step === step);
    }
    for (const panel of document.querySelectorAll(".panel")) {
        panel.hidden = panel.dataset.panel !== step;
    }
}

select_prompt.addEventListener("change", () => {
    entry = catalog.entries.find((item) => item.source === select_prompt.value) ?? catalog.entries[0];
    candidate = entry.candidates[0] ?? null;
    working = entry.markdown;
    edited = false;
    last_check = null;
    render();
});

document.querySelector("#apply").addEventListener("click", () => {
    working = textarea.value;
    edited = working !== entry.markdown;
    last_check = null;
    render();
});

document.querySelector("#reset").addEventListener("click", () => {
    working = entry.markdown;
    edited = false;
    last_check = null;
    render();
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
    }
    for (const panel of container.querySelectorAll(".tab-panel")) {
        panel.hidden = panel.dataset.tab !== name;
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

document.querySelector("#propose").addEventListener("click", async () => {
    const button = document.querySelector("#propose");
    button.disabled = true;
    propose_note.textContent = "Proposing…";
    try {
        const result = await post_sse("/propose", { source: entry.source, text: textarea.value }, (event) => {
            if (event.type === "phase") {
                propose_note.textContent = event.message ?? event.phase;
            } else if (event.type === "status") {
                propose_note.textContent = status_text(event);
            }
        });
        const known = new Set(proposals.map((row) => row.term));
        for (const proposal of result.proposals) {
            if (!known.has(proposal.term)) {
                proposals.push(proposal);
                known.add(proposal.term);
            }
        }
        render_proposals();
        propose_note.textContent = `${result.proposals.length} proposal(s) read; new terms are pending.`;
    } catch (error) {
        propose_note.textContent = `Proposal failed: ${error.message}`;
    } finally {
        button.disabled = false;
    }
});

document.querySelector("#generate").addEventListener("click", async () => {
    const button = document.querySelector("#generate");
    const note = document.querySelector("#generate-note");
    button.disabled = true;
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
        const result = await post_sse("/compile", { source: entry.source, text: textarea.value }, (event) => {
            if (event.type === "phase") {
                phase = event.message ?? event.phase;
            } else if (event.type === "status") {
                phase = status_text(event);
            } else if (event.type === "reasoning") {
                reasoning += event.text;
                phase = reasoning_tail(reasoning);
            }
        });
        const candidates = result.candidates;
        entry = { ...entry, compiled: true, candidates };
        candidate = entry.candidates[0];
        working = textarea.value;
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
    }
});

document.querySelector("#run").addEventListener("click", () => {
    if (!candidate) {
        check_output.textContent = "No candidate rule set to run.";
        return;
    }
    try {
        const result = ruleset_run({ facts: selected_facts(), rules: candidate.rules.rules });
        last_check = result;
        check_output.textContent = JSON.stringify(
            { rule_set: candidate.id, firings: result.firings, emitted: result.emitted },
            null,
            2,
        );
    } catch (error) {
        last_check = null;
        check_output.textContent = `error: ${error.message}`;
    }
    render_approve();
});

for (const button of document.querySelectorAll(".steps button")) {
    button.addEventListener("click", () => show(button.dataset.step));
}

for (const button of document.querySelectorAll(".tab")) {
    button.addEventListener("click", () => activate_tab(button.dataset.tab, button.closest(".panel")));
}

populate_prompts();
populate_scopes();
render();
