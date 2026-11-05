// 22-package-surface.test.mjs — node:test cases for the npm package surface.
// Invoked by tests/22-package-surface.sh.
//
// The guard is hermetic: it reads package.json and the sources it names, and
// asserts the repository skeleton (prompts/, tests/, scripts/, ...) cannot ship,
// that every export target exists, and that the library modules are browser-safe.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const repo_root = new URL("..", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("package.json", repo_root), "utf8"));

test("package.json declares name, version, license, and exports", () => {
    assert.equal(pkg.name, "@bannister.us/krank");
    assert.equal(pkg.license, "MIT");
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
    assert.equal(typeof pkg.exports, "object");
});

test("package.json links the repository and bug tracker", () => {
    assert.equal(pkg.repository?.type, "git");
    assert.match(pkg.repository?.url ?? "", /github\.com\/pbannister\/language-krank/);
    assert.match(pkg.bugs?.url ?? "", /\/issues$/);
});

test("the files field is a whitelist that excludes the repository skeleton", () => {
    assert.ok(Array.isArray(pkg.files), "files must be a whitelist array");
    const forbidden = [
        "prompts", "tests", "scripts", "evals", "records", "tools",
        "site.in", "site.out", "dataflow.in", "dataflow.out", "logs",
        "Makefile", "TODO.md", "AGENTS.md", "rules.lock", ".gitignore",
        ".aider.conf.yml", ".aiderignore",
    ];
    for (const entry of pkg.files) {
        const top = entry.replace(/\/$/, "").split("/")[0];
        assert.ok(!forbidden.includes(top), `files whitelist leaks skeleton path: ${entry}`);
    }
});

test("every export target resolves to an existing file", () => {
    for (const [specifier, target] of Object.entries(pkg.exports)) {
        if (specifier === "./package.json") {
            continue;
        }
        assert.ok(existsSync(new URL(target, repo_root)), `export "${specifier}" target missing: ${target}`);
    }
});

test("the bin entry points at the command-line tool", () => {
    const bin_target = String(pkg.bin?.krank ?? "");
    assert.match(bin_target, /ruleset-command\.mjs$/);
    const resolved = new URL(bin_target.replace(/^\.\//, ""), repo_root);
    assert.ok(existsSync(resolved), `bin target missing: ${bin_target}`);
});

test("the library modules carry no node: import", () => {
    const library_files = [
        "sources/krank.mjs",
        "sources/ruleset-run.mjs",
        "sources/ruleset-render.mjs",
    ];
    for (const rel of library_files) {
        const text = readFileSync(new URL(rel, repo_root), "utf8");
        assert.ok(!/from\s+["']node:/.test(text), `${rel} imports a node: builtin`);
    }
});

test("the barrel re-exports the public functions", async () => {
    const barrel = await import("../sources/krank.mjs");
    const exported = [
        "ruleset_run", "ruleset_session", "is_match", "fact_key", "keys_sort",
        "is_variable", "variable_name", "is_operator",
        "ruleset_render", "rule_render", "fact_render", "fact_phrase",
        "condition_render", "action_render",
    ];
    for (const name of exported) {
        assert.equal(typeof barrel[name], "function", `krank.mjs does not export ${name}`);
    }
});
