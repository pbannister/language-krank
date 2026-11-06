#!/usr/bin/env node
// prompts-build.mjs — generate prompts.out/, the formal form of the prompt corpus.
//
// For every prompt with an approved candidate, it writes:
//
//   <slug>/rules.json   the candidate's rule set
//   <slug>/marked.md    the full prose, with a rule marker on every covered line
//   <slug>/reduced.md   the prose with the covered lines removed and a pointer
//   manifest.json       the sources, candidates, and marker coverage
//
// The reducer uses the rule markers (documents/13-markers.md), not substring
// matching: the marked form is the evidence, the reduced form is the load.
//
// Usage: node scripts/prompts-build.mjs [output-directory]
// The default output is prompts.out/, which is generated and not versioned.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = process.argv[2] ? resolve(process.argv[2]) : join(root, "prompts.out");

if (output === "/" || output === "" || output === root) {
    console.error("prompts-build: refusing to clear the repository root");
    process.exit(1);
}

const builder = fileURLToPath(new URL("./site-catalog.mjs", import.meta.url));
const catalog = JSON.parse(execFileSync(process.execPath, [builder], { encoding: "utf8" }));

function slug_of(source) {
    return source.replace(/^prompts\//, "").replace(/\.md$/, "").replace(/[/_]/g, "-");
}

// mark appends a rule marker to the first line each case covers.
function mark(source, cases) {
    const lines = source.split("\n");
    const markers = [];
    for (const item of cases) {
        const index = lines.findIndex((line) => line.includes(item.original));
        if (index === -1) {
            markers.push({ rule: item.rule, original: item.original, found: false });
            continue;
        }
        lines[index] = `${lines[index]} <!-- krank: {"rule":"${item.rule}"} -->`;
        markers.push({ rule: item.rule, original: item.original, found: true });
    }
    return { text: lines.join("\n"), markers };
}

function reduce(source, cases, candidate_id) {
    const covered = cases.map((item) => item.original);
    const kept = source
        .split("\n")
        .filter((line) => !covered.some((original) => line.includes(original)));
    const ids = [...new Set(cases.map((item) => item.rule))]
        .map((id) => `- \`${id}\``)
        .join("\n");
    return `${kept.join("\n").trimEnd()}\n\n## Compiled rules\n\nThis file's covered rules are compiled into the krank rule set \`${candidate_id}\`:\n\n${ids}\n`;
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
writeFileSync(join(output, ".gitkeep"), "");

const manifest = { generated_by: "scripts/prompts-build.mjs", entries: [] };
for (const entry of catalog.entries.filter((item) => item.compiled)) {
    const candidate = entry.candidates.find((item) => item.id === entry.approved) ?? entry.candidates[0];
    const cases = candidate.cases.filter((item) => (item.source ?? entry.source) === entry.source);
    const directory = join(output, slug_of(entry.source));
    mkdirSync(directory, { recursive: true });

    const marked = mark(entry.markdown, cases);
    const reduced = reduce(entry.markdown, cases, candidate.id);

    writeFileSync(join(directory, "rules.json"), `${JSON.stringify(candidate.rules, null, 4)}\n`);
    writeFileSync(join(directory, "marked.md"), `${marked.text}\n`);
    writeFileSync(join(directory, "reduced.md"), reduced);

    manifest.entries.push({
        source: entry.source,
        candidate: candidate.id,
        rules: candidate.rules.rules.length,
        cases: cases.length,
        markers_found: marked.markers.filter((item) => item.found).length,
        markers_missing: marked.markers.filter((item) => !item.found).length,
    });
}
writeFileSync(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 4)}\n`);

process.stdout.write(`prompts-build: wrote ${manifest.entries.length} prompt(s) into ${output}\n`);
