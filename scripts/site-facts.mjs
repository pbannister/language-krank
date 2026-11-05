// site-facts.mjs — extract the file facts the demo's check workflow runs against.
//
// The published demo is static, so it cannot read the repository. This script
// reads the project's code and site files at build time and prints a JSON bundle
// of observable facts; the demo turns each entry into a `file` fact and runs the
// selected rule set against it.
//
// Output shape: { "directories": [...], "files": [ { "path": "...", "facts": {...} } ] }.
// Markdown is skipped: its indentation is structural, not a style choice.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const directories = ["sources", "scripts", "tests", "site.in"];
const skip = new Set([".gitkeep"]);

function walk(directory, files) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name);
        if (entry.isDirectory()) {
            walk(full, files);
            continue;
        }
        if (skip.has(entry.name) || entry.name.endsWith(".md")) {
            continue;
        }
        files.push(full);
    }
}

function indent_unit(text) {
    const counts = new Set();
    for (const line of text.split("\n")) {
        const match = /^( +)/.exec(line);
        if (match) {
            counts.add(match[1].length);
        }
    }
    if (counts.size === 0) {
        return 0;
    }
    const all = [...counts];
    if (all.every((count) => count % 4 === 0)) {
        return 4;
    }
    if (all.every((count) => count % 2 === 0)) {
        return 2;
    }
    return 0;
}

function facts_of(full) {
    const path = relative(root, full);
    const name = basename(full);
    const text = readFileSync(full, "utf8");
    const lines = text.split("\n");
    return {
        path,
        directory: path.split("/")[0],
        name,
        extension: extname(name),
        lines: lines.length,
        bytes: statSync(full).size,
        has_tab: text.includes("\t"),
        has_shebang: (lines[0] ?? "").startsWith("#!"),
        has_space: name.includes(" "),
        has_non_ascii: /[^\x00-\x7F]/.test(name),
        camel_case: /[a-z][A-Z]/.test(name),
        has_dash: name.includes("-"),
        numbered: /^[0-9]{2}-/.test(name),
        indent_unit: indent_unit(text),
    };
}

const files = [];
for (const directory of directories) {
    walk(join(root, directory), files);
}

const entries = files
    .sort()
    .map((full) => {
        const facts = facts_of(full);
        return { path: facts.path, facts };
    });

process.stdout.write(`${JSON.stringify({ directories, files: entries }, null, 4)}\n`);
