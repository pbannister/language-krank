// catalog.mjs — the compile and check demo.
//
// It loads the compiled rule sets (catalog.json) and the file facts
// (files.json), both built by scripts/site-demo.sh. Selecting a prompt renders
// its rules, the prose those rules render back to, the comparison, and the
// reduced prompt. The check section runs the selected rule set against the facts
// of the chosen file or directory.
//
// The compile is recorded: this page does not call a model.

import { ruleset_render, ruleset_run } from "../krank.mjs";

const catalog = await load_json("./catalog.json");
const bundle = await load_json("./files.json");

const select_prompt = document.querySelector("#prompt");
const select_scope = document.querySelector("#scope");
const output = document.querySelector("#output");

let entry = catalog.entries.find((item) => item.id === "conventions") ?? catalog.entries[0];
let download_url = "";

async function load_json(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`could not load ${path}: ${response.status}`);
    }
    return response.json();
}

function table_row(cells) {
    const row = document.createElement("tr");
    for (const [text, class_name] of cells) {
        const cell = document.createElement("td");
        if (class_name) {
            cell.className = class_name;
        }
        cell.textContent = text;
        row.append(cell);
    }
    return row;
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

// reduced_markdown removes the lines of this file that a rule covers, and adds a
// pointer to the compiled rule set. A case from another file is left alone: it
// is not part of this prompt.
function reduced_markdown(current) {
    const covered = current.cases
        .filter((item) => (item.source ?? current.source) === current.source)
        .map((item) => item.original);
    const kept = current.markdown
        .split("\n")
        .filter((line) => !covered.some((original) => line.includes(original)));
    return `${kept.join("\n").trimEnd()}\n\n## Compiled rules\n\nThis file's covered rules are compiled into the krank rule set \`${current.id}\`; see the compiled rules on this page.\n`;
}

function render_entry() {
    document.querySelector("#rules").textContent = JSON.stringify(
        { facts: entry.rules.facts, rules: entry.rules.rules },
        null,
        4,
    );

    const prose = ruleset_render(entry.rules);
    document.querySelector("#rendered").textContent = prose;

    const rendered = rendered_by_rule(prose);
    const comparison = document.querySelector("#comparison");
    comparison.replaceChildren();
    for (const item of entry.cases) {
        comparison.append(table_row([
            [item.original],
            [rendered.get(item.rule) ?? "(not rendered)"],
            [item.verdict, "verdict"],
            [item.note],
        ]));
    }

    const reduced = reduced_markdown(entry);
    document.querySelector("#reduced").textContent = reduced;
    const link = document.querySelector("#download");
    if (download_url) {
        URL.revokeObjectURL(download_url);
    }
    download_url = URL.createObjectURL(new Blob([reduced], { type: "text/markdown" }));
    link.href = download_url;
    link.download = `${entry.id}-reduced.md`;

    output.textContent = "";
}

function populate_prompts() {
    for (const item of catalog.entries) {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${item.title} — ${item.source}`;
        select_prompt.append(option);
    }
    select_prompt.value = entry.id;
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

select_prompt.addEventListener("change", () => {
    entry = catalog.entries.find((item) => item.id === select_prompt.value) ?? catalog.entries[0];
    render_entry();
});

document.querySelector("#run").addEventListener("click", () => {
    try {
        const result = ruleset_run({ facts: selected_facts(), rules: entry.rules.rules });
        output.textContent = JSON.stringify(
            { rule_set: entry.id, firings: result.firings, emitted: result.emitted },
            null,
            4,
        );
    } catch (error) {
        output.textContent = `error: ${error.message}`;
    }
});

populate_prompts();
populate_scopes();
render_entry();
