// site-catalog.mjs — assemble the compile catalog the demo page loads.
//
// Every prompt file under prompts/ becomes an entry, so the page can select any
// of them. An authored entry in dataflow.in/compile/ carries the compiled rules
// and cases; a prompt with no authored entry is listed with `compiled: false`,
// so the page can say so instead of pretending.
//
// Output: { "entries": [ { id, title, source, compiled, markdown, rules, cases } ] }.
//
// The compile itself is recorded, not run here: the rules were authored from the
// prose in a session, and the page says so. This script only assembles them.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const directory_prompts = join(root, "prompts");
const directory_compile = join(root, "dataflow.in", "compile");

function walk(directory, files) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name);
        if (entry.isDirectory()) {
            walk(full, files);
            continue;
        }
        if (entry.name.endsWith(".md")) {
            files.push(full);
        }
    }
}

const authored = new Map();
for (const name of readdirSync(directory_compile)) {
    if (!name.endsWith(".json")) {
        continue;
    }
    const entry = JSON.parse(readFileSync(join(directory_compile, name), "utf8"));
    if (!entry.rules) {
        if (!entry.rules_file) {
            throw new Error(`${name}: no rules and no rules_file`);
        }
        entry.rules = JSON.parse(readFileSync(join(root, entry.rules_file), "utf8"));
    }
    if (!entry.cases) {
        if (!entry.cases_file) {
            throw new Error(`${name}: no cases and no cases_file`);
        }
        entry.cases = JSON.parse(readFileSync(join(root, entry.cases_file), "utf8")).cases;
    }
    authored.set(entry.source, entry);
}

const files = [];
walk(directory_prompts, files);

const entries = files.sort().map((full) => {
    const source = relative(root, full);
    const markdown = readFileSync(full, "utf8");
    const entry = authored.get(source);
    if (entry) {
        return { ...entry, compiled: true, markdown };
    }
    const id = source.replace(/^prompts\//, "").replace(/\.md$/, "").replace(/[/_]/g, "-");
    return {
        id,
        title: source.replace(/^prompts\//, ""),
        source,
        compiled: false,
        rules: { facts: [], rules: [] },
        cases: [],
        markdown,
    };
});

process.stdout.write(`${JSON.stringify({ entries }, null, 4)}\n`);
