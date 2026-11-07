#!/usr/bin/env node
// prompts-build.mjs — generate prompts.out/, the formal form of the prompt corpus.
//
// For every prompt with an approved candidate it writes:
//
//   <slug>/rules.json     the candidate's rule set
//   <slug>/marked.md      the full prose, with a rule marker on every covered line
//   <slug>/reduced.md     the prose with the covered lines removed and a pointer
//   <slug>/rendered.md    the prose generated back from the rules (step 2)
//   <slug>/comparison.md  the original-vs-generated comparison (step 3): the
//                         lines a rule captured with a verdict, and the lines
//                         no rule captured
//   manifest.json         the sources, candidates, digests, and marker coverage
//
// The reducer uses the rule markers (documents/13-markers.md), not substring
// matching. A single-file mode (--source <path>) regenerates one entry and
// preserves the others, so a watcher can recompile a changed prompt cheaply.
//
// Usage: node scripts/prompts-build.mjs [output-directory] [--source <prompt-path>]
// The default output is prompts.out/, which is generated and not versioned.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ruleset_render } from "../sources/ruleset-render.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

const args = process.argv.slice(2);
const source_index = args.indexOf("--source");
const source_arg = source_index === -1 ? null : args[source_index + 1];
const positional = args.filter((arg) => arg !== "--source" && arg !== source_arg);
const output = positional[0] ? resolve(positional[0]) : join(root, "prompts.out");

if (output === "/" || output === "" || output === root) {
    console.error("prompts-build: refusing to clear the repository root");
    process.exit(1);
}

const builder = fileURLToPath(new URL("./site-catalog.mjs", import.meta.url));
const catalog = JSON.parse(execFileSync(process.execPath, [builder], { encoding: "utf8" }));

function slug_of(source) {
    return source.replace(/^prompts\//, "").replace(/\.md$/, "").replace(/[/_]/g, "-");
}

function digest(text) {
    return createHash("sha256").update(text).digest("hex");
}

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

// comparison_markdown writes the original-vs-generated comparison: the lines a
// rule captured (with a verdict and what was kept or lost) and the lines no rule
// captured, so the gap in intent is visible rather than hidden.
function comparison_markdown(source, markdown, cases) {
    const covered_originals = cases.map((item) => item.original);
    const uncovered = markdown
        .split("\n")
        .filter((line) => line.trim() !== "" && !covered_originals.some((original) => line.includes(original)));

    const rows = cases
        .map((item, index) => `| ${index + 1} | ${item.original} | \`${item.rule}\` | ${item.verdict} | ${item.note ?? ""} |`)
        .join("\n");

    const uncovered_lines = uncovered.length > 0
        ? uncovered.map((line) => `- ${line}`).join("\n")
        : "- (none)";

    return `# Comparison: ${source}

${cases.length} line(s) captured by a rule; ${uncovered.length} line(s) not captured.

## Covered (captured by a rule)

| # | Original (intent) | Rule | Verdict | What was kept and lost |
|---|---|---|---|---|
${rows}

## Not captured (no rule)

${uncovered_lines}

The rules are rendered back into prose in \`rendered.md\` and stored in \`rules.json\`.
`;
}

function build_entry(entry, output) {
    const candidate = entry.candidates.find((item) => item.id === entry.approved) ?? entry.candidates[0];
    const cases = candidate.cases.filter((item) => (item.source ?? entry.source) === entry.source);
    const directory = join(output, slug_of(entry.source));
    mkdirSync(directory, { recursive: true });

    const marked = mark(entry.markdown, cases);
    const reduced = reduce(entry.markdown, cases, candidate.id);

    writeFileSync(join(directory, "rules.json"), `${JSON.stringify(candidate.rules, null, 4)}\n`);
    writeFileSync(join(directory, "marked.md"), `${marked.text}\n`);
    writeFileSync(join(directory, "reduced.md"), reduced);
    writeFileSync(join(directory, "rendered.md"), `${ruleset_render(candidate.rules)}\n`);
    writeFileSync(join(directory, "comparison.md"), comparison_markdown(entry.source, entry.markdown, cases));

    return {
        source: entry.source,
        candidate: candidate.id,
        rules: candidate.rules.rules.length,
        cases: cases.length,
        markers_found: marked.markers.filter((item) => item.found).length,
        markers_missing: marked.markers.filter((item) => !item.found).length,
        source_sha256: digest(entry.markdown),
    };
}

const compiled = catalog.entries.filter((item) => item.compiled);
const manifest_file = join(output, "manifest.json");

if (source_arg) {
    let manifest = { generated_by: "scripts/prompts-build.mjs", entries: [] };
    if (existsSync(manifest_file)) {
        try {
            manifest = JSON.parse(readFileSync(manifest_file, "utf8"));
        } catch {
            manifest = { generated_by: "scripts/prompts-build.mjs", entries: [] };
        }
    }

    const entry = catalog.entries.find((item) => item.source === source_arg);
    if (!entry) {
        console.error(`prompts-build: no such prompt: ${source_arg}`);
        process.exit(1);
    }
    if (!entry.compiled) {
        rmSync(join(output, slug_of(entry.source)), { recursive: true, force: true });
        manifest.entries = manifest.entries.filter((item) => item.source !== entry.source);
        writeFileSync(manifest_file, `${JSON.stringify(manifest, null, 4)}\n`);
        process.stdout.write(`prompts-build: ${entry.source} has no candidate; removed its tree\n`);
        process.exit(0);
    }
    const record = build_entry(entry, output);
    const index = manifest.entries.findIndex((item) => item.source === entry.source);
    if (index === -1) {
        manifest.entries.push(record);
    } else {
        manifest.entries[index] = record;
    }
    manifest.entries.sort((left, right) => left.source.localeCompare(right.source));
    writeFileSync(manifest_file, `${JSON.stringify(manifest, null, 4)}\n`);
    process.stdout.write(`prompts-build: wrote ${entry.source}\n`);
    process.exit(0);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
writeFileSync(join(output, ".gitkeep"), "");

const manifest = { generated_by: "scripts/prompts-build.mjs", entries: [] };
for (const entry of compiled) {
    manifest.entries.push(build_entry(entry, output));
}
writeFileSync(manifest_file, `${JSON.stringify(manifest, null, 4)}\n`);

process.stdout.write(`prompts-build: wrote ${manifest.entries.length} prompt(s) into ${output}\n`);
