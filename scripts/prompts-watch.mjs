#!/usr/bin/env node
// prompts-watch.mjs — recompile prompts.out/ when a prompt or a candidate changes.
//
// It watches prompts/ and dataflow.in/compile/, maps each change to a prompt
// source, and re-runs the single-file build, debounced, so an edit mid-typing does
// not trigger a build per keystroke. A failed build is reported and the previous
// tree is left in place, because the single-file build writes one entry at a time.
//
// This is the deterministic half of on-demand evaluation. The LLM half
// (propose new candidates for the changed prose) is the studio's /compile; wire
// it here with a --compile flag once the compile pipeline is extracted.
//
// Usage: node scripts/prompts-watch.mjs [output-directory]

import { watch, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = process.argv[2] ? resolve(process.argv[2]) : join(root, "prompts.out");

function run(source) {
    try {
        execFile(
            process.execPath,
            [join(root, "scripts", "prompts-build.mjs"), output, "--source", source],
            { encoding: "utf8", timeout: 60000 },
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`prompts-watch: ${stderr.trim() || error.message}`);
                    return;
                }
                process.stdout.write(stdout);
            },
        );
    } catch (error) {
        console.error(`prompts-watch: ${error.message}`);
    }
}

function source_of(path) {
    const rel = relative(root, path);
    if (rel.startsWith("prompts/") && rel.endsWith(".md")) {
        return rel;
    }
    if (rel.startsWith("dataflow.in/compile/") && rel.endsWith(".json")) {
        try {
            return JSON.parse(readFileSync(path, "utf8")).source ?? null;
        } catch {
            return null;
        }
    }
    return null;
}

let timer = null;
const pending = new Set();

function flush() {
    timer = null;
    const sources = [...pending];
    pending.clear();
    for (const source of sources) {
        run(source);
    }
}

for (const directory of [join(root, "prompts"), join(root, "dataflow.in", "compile")]) {
    watch(directory, { recursive: true }, (_event, name) => {
        const source = source_of(join(directory, name));
        if (!source) {
            return;
        }
        pending.add(source);
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(flush, 300);
    });
}

process.stdout.write(`prompts-watch: watching prompts/ and dataflow.in/compile/ into ${output}\n`);
