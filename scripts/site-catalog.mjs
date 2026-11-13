// site-catalog.mjs — assemble the studio catalog the browser UI loads.
//
// Every prompt file under prompts/ becomes an entry. Authored candidates in
// dataflow.in/compile/ supply the compiled rules, the comparison cases, and the
// explanation; several files may name the same prompt, and each becomes a
// candidate, so the reader can compare them. A prompt with no candidate is
// listed with `compiled: false`, so the UI can say so instead of pretending.
//
// Output: { "entries": [ { source, compiled, markdown, candidates: [ { id, title,
// explanation, rules, cases } ] } ] }.
//
// The compile is recorded, not run here: the candidates were authored from the
// prose in sessions, and the UI says so.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { fact_contract } from "../sources/compile-review.mjs";

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

function resolve_rules(entry) {
    if (entry.rules) {
        return entry.rules;
    }
    if (entry.rules_file) {
        return JSON.parse(readFileSync(join(root, entry.rules_file), "utf8"));
    }
    throw new Error(`${entry.id ?? entry.source}: no rules and no rules_file`);
}

function resolve_cases(entry) {
    if (entry.cases) {
        return entry.cases;
    }
    if (entry.cases_file) {
        return JSON.parse(readFileSync(join(root, entry.cases_file), "utf8")).cases;
    }
    throw new Error(`${entry.id ?? entry.source}: no cases and no cases_file`);
}

function candidates_of(entry) {
    if (entry.candidates) {
        return entry.candidates.map((candidate) => ({
            id: candidate.id,
            title: candidate.title,
            explanation: candidate.explanation ?? "",
            rules: resolve_rules(candidate),
            cases: resolve_cases(candidate),
            ...(candidate.review ? { review: candidate.review } : {}),
        }));
    }
    return [{
        id: entry.id,
        title: entry.title,
        explanation: entry.explanation ?? "",
        rules: resolve_rules(entry),
        cases: resolve_cases(entry),
        ...(entry.review ? { review: entry.review } : {}),
    }];
}

const authored = new Map();
const approved = new Map();
for (const name of readdirSync(directory_compile)) {
    if (!name.endsWith(".json")) {
        continue;
    }
    const entry = JSON.parse(readFileSync(join(directory_compile, name), "utf8"));
    const list = authored.get(entry.source) ?? [];
    list.push(...candidates_of(entry));
    authored.set(entry.source, list);
    if (entry.approved) {
        approved.set(entry.source, entry.approved);
    }
}

const files = [];
walk(directory_prompts, files);
const scanned_at = new Date().toISOString();

const entries = files.sort().map((full) => {
    const source = relative(root, full);
    const markdown = readFileSync(full, "utf8");
    const candidates = authored.get(source) ?? [];
    return {
        source,
        compiled: candidates.length > 0,
        markdown,
        candidates,
        approved: approved.get(source),
        source_sha256: createHash("sha256").update(markdown).digest("hex"),
        edited_at: statSync(full).mtime.toISOString(),
        scanned_at,
    };
});

const contract = fact_contract(createHash("sha256")
    .update(readFileSync(new URL("./site-facts.mjs", import.meta.url)))
    .update(readFileSync(join(root, "dataflow.in/object-model.json"))).digest("hex"));
process.stdout.write(`${JSON.stringify({ entries, fact_contract: contract }, null, 4)}\n`);
