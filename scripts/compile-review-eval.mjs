#!/usr/bin/env node
// compile-review-eval.mjs — collect raw compile-review evidence without scoring.
//
// This is a fail-closed data collector for the case fixture in dataflow.in/.
// It reads only that fixture and sends only {source, text} to the studio's
// /compile endpoint. The fixture's expected answers never leave this process.
// It does not read the evaluation rubric, compute metrics, or claim acceptance.
// A live call needs KRANK_EVAL_LIVE=1 and an explicit KRANK_EVAL_MODEL label.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIRECTORY_GENERATED = resolve(REPOSITORY_ROOT, "tests.out");
const FILE_CASE = resolve(REPOSITORY_ROOT, "dataflow.in/compile-review-cases.json");
const ENDPOINT_DEFAULT = "http://127.0.0.1:8090/compile";
const RUNS_DEFAULT = 3;

function fail(message) {
    process.stderr.write(`compile-review-eval: ${message}\n`);
    process.exit(2);
}

function is_inside(path_child, path_parent) {
    const value = relative(path_parent, path_child);
    return value !== "" && !value.startsWith("..") && !isAbsolute(value);
}

function revision_of() {
    try {
        return execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: REPOSITORY_ROOT,
            encoding: "utf8",
        }).trim();
    } catch {
        return null;
    }
}

const arguments_cli = process.argv.slice(2);
if (arguments_cli.length !== 1) {
    fail("usage: node scripts/compile-review-eval.mjs <tests.out/... directory>");
}

if (process.env.KRANK_EVAL_LIVE !== "1") {
    fail("not run (set KRANK_EVAL_LIVE=1 to authorize live model calls)");
}

const model = process.env.KRANK_EVAL_MODEL;
if (typeof model !== "string" || model.trim() === "") {
    fail("KRANK_EVAL_MODEL must name the exact model used");
}

const runs_text = process.env.KRANK_EVAL_RUNS ?? String(RUNS_DEFAULT);
if (!/^[1-9][0-9]*$/.test(runs_text)) {
    fail("KRANK_EVAL_RUNS must be a positive whole number");
}
const runs = Number(runs_text);

const directory_output = resolve(REPOSITORY_ROOT, arguments_cli[0]);
if (!is_inside(directory_output, DIRECTORY_GENERATED)) {
    fail("the output directory must be inside tests.out/");
}

let url_endpoint;
try {
    url_endpoint = new URL(process.env.STUDIO_URL ?? ENDPOINT_DEFAULT);
} catch {
    fail("STUDIO_URL is not a URL");
}
if (url_endpoint.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url_endpoint.hostname)) {
    fail("STUDIO_URL must be a loopback HTTP URL");
}

let case_data;
try {
    case_data = JSON.parse(readFileSync(FILE_CASE, "utf8"));
} catch (error) {
    fail(`cannot read the case fixture: ${error.message}`);
}
if (typeof case_data.source !== "string" || case_data.source.trim() === "" || typeof case_data.text !== "string") {
    fail("the case fixture needs a source and a text");
}

const request = { source: case_data.source, text: case_data.text };

const settings = {
    model: model.trim(),
    runs,
    profile: process.env.DSH_PROFILE ?? "headless",
    compiler: process.env.STUDIO_COMPILER_SCRIPT ?? "scripts/compile-with-harness.mjs",
    endpoint: url_endpoint.href,
    revision: revision_of(),
};

async function collect(run) {
    const started = Date.now();
    const record = {
        run,
        request,
        status: null,
        raw: "",
        events: [],
        done: null,
        error: null,
        failure: null,
        latency_ms: 0,
    };
    try {
        const response = await fetch(url_endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(request),
        });
        record.status = response.status;
        record.raw = await response.text();
        for (const line of record.raw.split("\n")) {
            if (!line.startsWith("data: ")) {
                continue;
            }
            try {
                record.events.push(JSON.parse(line.slice(6)));
            } catch {
                // A malformed event stays in raw; it is never reconstructed.
            }
        }
        record.done = record.events.find((event) => event.type === "done") ?? null;
        record.error = record.events.find((event) => event.type === "error")?.message ?? null;
    } catch (failure) {
        record.failure = failure.message;
    }
    record.latency_ms = Date.now() - started;
    writeFileSync(
        resolve(directory_output, `run-${String(run).padStart(2, "0")}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
    );
    return record;
}

mkdirSync(directory_output, { recursive: true });
writeFileSync(
    resolve(directory_output, "metadata.json"),
    `${JSON.stringify({
        generated_by: "scripts/compile-review-eval.mjs",
        collected_at: new Date().toISOString(),
        settings,
        request,
        scored: false,
        note: "Raw evidence only. A human scores it after review; no claim is made here.",
    }, null, 2)}\n`,
);

const records = [];
for (let run = 1; run <= runs; run += 1) {
    records.push(await collect(run));
}
const failed = records.filter((record) => record.failure !== null || record.error !== null || record.status !== 200).length;
writeFileSync(
    resolve(directory_output, "results.json"),
    `${JSON.stringify({ collected: records.length, failed, scored: false }, null, 2)}\n`,
);
process.stdout.write(`compile-review-eval: collected ${records.length} run(s); not scored\n`);
