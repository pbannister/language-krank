// site-facts.mjs — extract the facts the check workflow runs against.
//
// The check panel runs a rule set against facts extracted from a project file.
// This script extracts two layers:
//
//   facts    the file's own properties (path, extension, indentation, ...)
//   entities the artifact facts a family extractor reads: task sections and
//            operation lines, feature sections and requirements, test tier
//
// The first entity is always the `file` fact, so one selection carries both the
// file properties and the artifact facts.
//
// Output shape: { "directories": [...], "files": [ { "path", "facts", "entities" } ] }.
// Markdown is read only under prompts/; its indentation is structural elsewhere.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const directories = ["sources", "scripts", "tests", "site.in", "prompts"];
const skip = new Set([".gitkeep"]);

const TASK_SECTIONS = [
    "TASK-DESCRIPTION",
    "TASK-OUTPUT",
    "TASK-CONTEXT",
    "TASK-FILES",
    "TASK-VERIFY",
    "TASK-FEATURES",
    "TASK-ACCEPTANCE",
];
const TASK_REQUIRED = ["TASK-DESCRIPTION", "TASK-OUTPUT", "TASK-FILES", "TASK-VERIFY"];
const FEATURE_SECTIONS = ["Purpose", "Requirements", "Behavior", "Dependencies"];
const TEST_TIERS = ["portable", "tool-gated", "live-state"];

function walk(directory, files) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name);
        if (entry.isDirectory()) {
            walk(full, files);
            continue;
        }
        if (skip.has(entry.name)) {
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

// sections_of returns the markdown `##` sections of a file, keyed by heading.
function sections_of(text) {
    const sections = new Map();
    let current = null;
    for (const line of text.split("\n")) {
        const heading = /^##\s+(.+?)\s*$/.exec(line);
        if (heading) {
            current = heading[1];
            sections.set(current, []);
            continue;
        }
        if (current) {
            sections.get(current).push(line);
        }
    }
    return new Map([...sections].map(([name, lines]) => [name, lines.join("\n")]));
}

function task_facts(path, text) {
    const id = path.replace(/^prompts\/tasks\//, "").replace(/\.md$/, "");
    const sections = sections_of(text);
    const has_output_line = /^OUTPUT:/m.test(text);
    const applies_features = sections.has("TASK-FEATURES");
    const conforming = TASK_REQUIRED.every((name) => sections.has(name)) && has_output_line;
    const facts = [{ type: "task", id, path, conforming, has_output_line, applies_features }];

    for (const name of TASK_SECTIONS) {
        facts.push({ type: "task_section", task: id, name, present: sections.has(name) });
    }

    for (const match of text.matchAll(/^\s*[-*]\s+(Create|Modify|Delete|Rename|Inspect|Host):\s+`([^`]+)`/gim)) {
        const op_path = match[2];
        facts.push({
            type: "task_op_line",
            task: id,
            verb: match[1].toLowerCase(),
            path: op_path,
            relative: !/^(\/|~|[A-Za-z]:)/.test(op_path),
        });
    }

    const files_section = sections.get("TASK-FILES") ?? "";
    for (const match of files_section.matchAll(/^\s*\|\s*([a-z]+)\s*\|\s*`([^`]+)`\s*\|/gm)) {
        facts.push({ type: "task_file_row", task: id, verb: match[1].toLowerCase(), path: match[2] });
    }

    const verify = sections.get("TASK-VERIFY") ?? "";
    const expected = /^\s*[-*]\s*Expected:\s*(.+)$/im.exec(verify)?.[1] ?? "";
    if (expected !== "") {
        facts.push({
            type: "task_verify",
            task: id,
            expected: /looks? correct|works|no problems|seems|appears|obviously/i.test(expected) ? "judgment" : "observable",
        });
    }

    for (const match of (sections.get("TASK-FEATURES") ?? "").matchAll(/`([^`]+)`/g)) {
        facts.push({ type: "task_feature", task: id, feature: match[1] });
    }
    for (const match of (sections.get("TASK-ACCEPTANCE") ?? "").matchAll(/`([^`]+)`/g)) {
        facts.push({ type: "task_acceptance", task: id, requirement: match[1] });
    }
    return facts;
}

function feature_facts(path, text) {
    const id = path.replace(/^prompts\/features\//, "").replace(/\.md$/, "");
    const sections = sections_of(text);
    const facts = [{ type: "feature", id, path, mentions_todo: /\bTODO\b(?![.\w])/.test(text) }];

    for (const name of FEATURE_SECTIONS) {
        facts.push({ type: "feature_section", feature: id, name, present: sections.has(name) });
    }

    const requirements = sections.get("Requirements") ?? "";
    for (const match of requirements.matchAll(/^\s*[-*]\s*`([^`]+)`/gm)) {
        const requirement_id = match[1];
        facts.push({
            type: "requirement",
            id: requirement_id,
            feature: id,
            id_shape: /^[A-Z0-9-]+-R[0-9]{3}$/.test(requirement_id) ? "ok" : "bad",
            separate_bullet: true,
        });
    }

    const dependencies = sections.get("Dependencies") ?? "";
    for (const match of dependencies.matchAll(/`([^`]+\.md)`/g)) {
        facts.push({ type: "feature_dependency", feature: id, dependency: match[1] });
    }
    return facts;
}

function test_facts(path, text) {
    const tier = /Tier:\s*([a-z][a-z-]*(?: [a-z][a-z-]*)?)/i.exec(text)?.[1];
    if (!tier) {
        return [];
    }
    return [{ type: "test", path, tier: tier.toLowerCase(), hermetic: true, known_tier: TEST_TIERS.includes(tier.toLowerCase()) }];
}

function entities_of(path, text) {
    if (path.startsWith("prompts/tasks/") && path.endsWith(".md")) {
        return task_facts(path, text);
    }
    if (path.startsWith("prompts/features/") && path.endsWith(".md")) {
        return feature_facts(path, text);
    }
    if (path.startsWith("tests/") && path.endsWith(".sh")) {
        return test_facts(path, text);
    }
    return [];
}

const files = [];
for (const directory of directories) {
    walk(join(root, directory), files);
}

const entries = files
    .filter((full) => !full.endsWith(".md") || full.includes("/prompts/"))
    .sort()
    .map((full) => {
        const facts = facts_of(full);
        return {
            path: facts.path,
            facts,
            entities: [{ type: "file", ...facts }, ...entities_of(facts.path, readFileSync(full, "utf8"))],
        };
    });

process.stdout.write(`${JSON.stringify({ directories, files: entries }, null, 4)}\n`);
