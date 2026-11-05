// studio.mjs — the prompt studio.
//
// A step rail drives one panel per step: the prompt (editable), the candidates,
// the compiled rules, the rendered prose, the comparison, the reduced prompt
// with its diff, the check, and the approval summary. The catalog (catalog.json)
// and the file facts (files.json) are built by scripts/site-demo.sh; the compile
// is recorded, and this page does not call a model.
//
// State is local to the page: choosing a candidate or editing the prompt changes
// what is shown and what the downloads contain, and writes nothing.

import { ruleset_render, ruleset_run } from "../krank.mjs";
import { diff_lines } from "./prompt-diff.mjs";

const catalog = await load_json("./catalog.json");
const bundle = await load_json("./files.json");

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

let entry = catalog.entries.find((item) => item.compiled) ?? catalog.entries[0];
let candidate = entry.candidates[0] ?? null;
let working = entry.markdown;
let edited = false;
let last_check = null;
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

function cell(text, class_name) {
    const element = document.createElement("td");
    if (class_name) {
        element.className = class_name;
    }
    element.textContent = text;
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

function render() {
    urls_reset();
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
    return files.map((file) => ({ type: "file", ...file.facts }));
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

document.querySelector("#generate").addEventListener("click", async () => {
    const button = document.querySelector("#generate");
    const note = document.querySelector("#generate-note");
    button.disabled = true;
    note.textContent = "Compiling… the Harness is running the task; this can take a while.";
    try {
        const response = await fetch("/compile", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ source: entry.source, text: textarea.value }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error ?? `HTTP ${response.status}`);
        }
        entry = { ...entry, compiled: true, candidates: data.candidates };
        candidate = entry.candidates[0];
        working = textarea.value;
        edited = working !== entry.markdown;
        last_check = null;
        note.textContent = `Generated ${data.candidates.length} candidate(s); choose one in the next panel.`;
        render();
        show("candidates");
    } catch (error) {
        note.textContent = `Generation failed: ${error.message}`;
    } finally {
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

populate_prompts();
populate_scopes();
render();
