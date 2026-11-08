// site-facts.mjs — extract the facts the check workflow runs against.
//
// The check panel runs a rule set against facts extracted from a project file.
// This script extracts two layers:
//
//   facts    the file's own properties (path, extension, indentation, ...)
//   entities the artifact facts a family extractor reads: task, feature,
//            episode, record, document, page, version, todo, test, and any
//            `<!-- krank: {...} -->` marker.
//
// The first entity is always the `file` fact, so one selection carries both the
// file properties and the artifact facts.
//
// Markers are the deterministic bridge for objects the prose cannot express
// (session, goal, failure, boundary, credential, delegation): a prose line such
// as `<!-- krank: {"type":"session", "id":"s1", "goal":"..."} -->` becomes a
// fact verbatim. See documents/13-markers.md.
//
// Output shape: { "directories": [...], "files": [ { "path", "facts", "entities" } ] }.
// Markdown is read only under prompts/, records/, and documents/.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const directories = ["sources", "scripts", "tests", "site.in", "prompts", "records", "documents"];
const root_files = ["TODO.md", "package.json"];
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
const EPISODE_SECTIONS = [
    "EPISODE-GOAL",
    "EPISODE-ACCEPTANCE",
    "EPISODE-RISKS",
    "EPISODE-TASKS",
    "EPISODE-OUTPUT",
    "EPISODE-FILES",
    "EPISODE-BRANCH",
];
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
        directory: path.includes("/") ? path.split("/")[0] : ".",
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

// marker_facts parses `<!-- krank: {...} -->` comments and returns their JSON
// objects verbatim. It is the deterministic bridge for runtime facts the prose
// cannot express, and for the rule-to-line mapping the reducer uses.
function marker_facts(text) {
    const facts = [];
    for (const match of text.matchAll(/<!--\s*krank:\s*(\{[^<]*\})\s*-->/gs)) {
        try {
            facts.push(JSON.parse(match[1]));
        } catch {
            // a malformed marker is ignored here; the object-model test catches a
            // missing type later.
        }
    }
    return facts;
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

function episode_facts(path, text) {
    const id = path.replace(/^prompts\/episodes\//, "").replace(/\.md$/, "");
    const sections = sections_of(text);
    const branch = (sections.get("EPISODE-BRANCH") ?? "").trim().split("\n")[0];
    const facts = [{ type: "episode", id, path, branch, branch_shape: /^llm\/episode-[0-9]+$/.test(branch) ? "ok" : "bad" }];
    for (const name of EPISODE_SECTIONS) {
        facts.push({ type: "episode_section", episode: id, name, present: sections.has(name) });
    }
    return facts;
}

function record_facts(path, text) {
    const id = path.replace(/^records\//, "").replace(/\.md$/, "");
    if (id === "README") {
        return [];
    }
    const title = /^#\s+Record:\s*(.+)$/im.exec(text)?.[1] ?? "";
    const kind = /incident/i.test(title) ? "incident" : /handoff/i.test(title) ? "handoff" : "outcome";
    const facts = [{ type: "record", id, path, kind }];
    for (const match of text.matchAll(/^\s*[-*]\s*`([0-9a-f]{7,40})`/gim)) {
        facts.push({ type: "record_commit", record: id, hash: match[1] });
    }
    return facts;
}

function document_facts(path, text) {
    const generated = /do not edit by hand|Generated from/i.test(text);
    return [{ type: "document", path, generated }];
}

function page_facts(text) {
    const facts = [];
    for (const line of text.split("\n")) {
        const match = /^([^\s|]+)\|(.+)$/.exec(line.trim());
        if (match) {
            facts.push({ type: "nav", page: match[1], href: match[1], label: match[2] });
        }
    }
    return facts;
}

function version_facts(text) {
    try {
        const package_json = JSON.parse(text);
        return [{ type: "version", value: package_json.version ?? "", source: "package.json" }];
    } catch {
        return [];
    }
}

function todo_facts(text) {
    const facts = [];
    for (const match of text.matchAll(/^\s*[-*]\s+\[( |x|X)\]\s*(.+)$/gm)) {
        facts.push({ type: "todo_item", text: match[2].trim(), checked: match[1] !== " " });
    }
    return facts;
}

function test_facts(path, text) {
    const tier = /Tier:\s*([a-z][a-z-]*(?: [a-z][a-z-]*)?)/i.exec(text)?.[1];
    if (!tier) {
        return [];
    }
    return [{
        type: "test",
        path,
        tier: tier.toLowerCase(),
        hermetic: true,
        known_tier: TEST_TIERS.includes(tier.toLowerCase()),
    }];
}

function entities_of(path, text) {
    const is_prose = path.endsWith(".md") || path === "site.in/pages.nav";
    const entities = is_prose ? marker_facts(text) : [];
    if (path.startsWith("prompts/tasks/") && path.endsWith(".md")) {
        return [...task_facts(path, text), ...entities];
    }
    if (path.startsWith("prompts/features/") && path.endsWith(".md")) {
        return [...feature_facts(path, text), ...entities];
    }
    if (path.startsWith("prompts/episodes/") && path.endsWith(".md")) {
        return [...episode_facts(path, text), ...entities];
    }
    if (path.startsWith("records/") && path.endsWith(".md")) {
        return [...record_facts(path, text), ...entities];
    }
    if (path.startsWith("documents/") && path.endsWith(".md")) {
        return [...document_facts(path, text), ...entities];
    }
    if (path === "site.in/pages.nav") {
        return [...page_facts(text), ...entities];
    }
    if (path === "TODO.md") {
        return [...todo_facts(text), ...entities];
    }
    if (path === "package.json") {
        return [...version_facts(text), ...entities];
    }
    if (path.startsWith("tests/") && path.endsWith(".sh")) {
        return [...test_facts(path, text), ...entities];
    }
    return entities;
}

const files = [];
for (const directory of directories) {
    walk(join(root, directory), files);
}
for (const rel of root_files) {
    files.push(join(root, rel));
}

const keep_markdown = (full) => ["/prompts/", "/records/", "/documents/"].some((part) => full.includes(part)) || full.endsWith("TODO.md");

const entries = files
    .filter((full) => !full.endsWith(".md") || keep_markdown(full))
    .sort()
    .map((full) => {
        const facts = facts_of(full);
        const text = readFileSync(full, "utf8");
        return {
            path: facts.path,
            facts,
            entities: [{ type: "file", ...facts }, ...entities_of(facts.path, text)],
        };
    });

process.stdout.write(`${JSON.stringify({ directories, files: entries }, null, 4)}\n`);
