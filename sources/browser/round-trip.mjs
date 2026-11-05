// round-trip.mjs — the round-trip demo page.
//
// It loads the compiled rule set and the recorded cases, renders the rules back
// to prose, matches each case to its rendered rule, and runs the engine. The
// rules are the fixture dataflow.in/round-trip.json, copied in by
// scripts/site-demo.sh; the cases are cases.json.

import { ruleset_render, ruleset_run } from "../krank.mjs";

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

async function main() {
    const [ruleset, bundle] = await Promise.all([
        load_json("./round-trip.json"),
        load_json("./cases.json"),
    ]);

    const original = document.querySelector("#original");
    for (const item of bundle.cases) {
        const entry = document.createElement("li");
        entry.textContent = item.original;
        original.append(entry);
    }

    document.querySelector("#rules").textContent =
        JSON.stringify({ facts: ruleset.facts, rules: ruleset.rules }, null, 4);

    const prose = ruleset_render(ruleset);
    document.querySelector("#rendered").textContent = prose;

    const rendered = rendered_by_rule(prose);
    const comparison = document.querySelector("#comparison");
    for (const item of bundle.cases) {
        comparison.append(table_row([
            [item.original],
            [rendered.get(item.rule) ?? "(not rendered)"],
            [item.verdict, "verdict"],
            [item.note],
        ]));
    }

    const result = ruleset_run(ruleset);
    document.querySelector("#result").textContent =
        JSON.stringify({ firings: result.firings, emitted: result.emitted }, null, 4);
}

main().catch((error) => {
    document.querySelector("#result").textContent = `error: ${error.message}`;
});
