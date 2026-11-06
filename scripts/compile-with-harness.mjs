#!/usr/bin/env node
// compile-with-harness.mjs — run the studio's compile task through the Harness.
//
// The studio server writes the task on stdin; this script runs it through the
// Harness headless profile in plain mode and streams progress. Plain mode writes
// the provider's reasoning to stderr as it happens, so this script forwards each
// stderr chunk as a `reasoning` event on stdout (newline-delimited JSON) and, at
// the end, emits a terminal `final` event carrying the answer text. Diagnostics
// go to stderr. This script holds no credential itself: the Harness owns the
// provider.
//
// The Harness launcher is resolved in this order:
//   1. DSH_BIN, when set (a path ending in ".js" is run with the current Node);
//   2. the installed CLI under ~/.npm/_npx (the one the running Harness uses);
//   3. `dsh` from PATH.
//
// Configuration:
//   DSH_BIN      the Harness launcher (override the resolution above)
//   DSH_PROFILE  default "headless".
//
// The headless profile makes a model call, so it needs the provider credential in
// its own environment: export DEEPSEEK_API_KEY before starting the studio. A
// missing key fails with MISSING_CREDENTIAL.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const task = readFileSync(0, "utf8");
const profile = process.env.DSH_PROFILE ?? "headless";

// Prefer the installed (npx) CLI, the one the running Harness uses; the source
// checkout's build is a dev artifact and may not match the running profile.
function resolve_dsh() {
    if (process.env.DSH_BIN) {
        return process.env.DSH_BIN;
    }
    const npx = join(homedir(), ".npm", "_npx");
    if (existsSync(npx)) {
        const bins = readdirSync(npx)
            .map((dir) => join(npx, dir, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"))
            .filter((path) => existsSync(path))
            .sort();
        if (bins.length > 0) {
            return bins[bins.length - 1];
        }
    }
    return "dsh";
}

const bin = resolve_dsh();
const command = bin.endsWith(".js") ? process.execPath : bin;
const prefix = bin.endsWith(".js") ? [bin] : [];

// The headless app reads the task from stdin (absent or "-"), so the task is
// piped rather than passed as a positional. Plain mode streams the reasoning to
// stderr, which is the only signal available while the model is thinking.
const child = spawn(command, [...prefix, "--profile", profile], { stdio: ["pipe", "pipe", "pipe"] });
child.stdin.on("error", () => {});
child.stdin.end(task);

let answer = "";
let diagnostics = "";
child.stdout.on("data", (chunk) => {
    answer += chunk.toString();
});
child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    diagnostics += text;
    process.stdout.write(`${JSON.stringify({ type: "reasoning", text })}\n`);
});
child.on("error", (error) => {
    const hint = error.code === "ENOENT"
        ? "Set DSH_BIN to the Harness launcher path (for example ~/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh/lib/bin.js)."
        : "";
    process.stderr.write(`${error.message}${hint ? `\n${hint}` : ""}\n`);
    process.exitCode = 1;
});
child.on("close", (code) => {
    if (code !== 0) {
        const lines = diagnostics
            .split("\n")
            .filter((line) => line.startsWith("dsh: ") && !line.startsWith("dsh: reasoning"))
            .join("\n");
        process.stderr.write(lines || `compiler exited ${code}`);
        process.exitCode = code;
        return;
    }
    process.stdout.write(`${JSON.stringify({ type: "final", text: answer.trim() })}\n`);
    process.exitCode = 0;
});
