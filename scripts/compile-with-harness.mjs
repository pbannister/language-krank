#!/usr/bin/env node
// compile-with-harness.mjs — run the studio's compile task through the Harness.
//
// The studio server writes the task on stdin; this script runs it through the
// Harness headless profile and prints the model's answer on stdout. It holds no
// credential itself: the Harness owns the provider.
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
// its own environment: export DEEPSEEK_API_KEY before starting the studio. The
// web profile's stored key (the Models page) is not visible to a separate
// process, and a missing key fails with MISSING_CREDENTIAL.

import { execFile } from "node:child_process";
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

// The headless app reads the task from stdin when it is absent or "-", so the
// task is piped rather than passed as a positional (the positional form is
// rejected by the current CLI as "too many arguments").
const child = execFile(
    command,
    [...prefix, "--profile", profile],
    { timeout: 600000, maxBuffer: 16 * 1024 * 1024 },
    (error, stdout, stderr) => {
        if (error) {
            const hint = error.code === "ENOENT"
                ? "Set DSH_BIN to the Harness launcher path (for example ~/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh/lib/bin.js)."
                : "";
            process.stderr.write(`${stderr || error.message}${hint ? `\n${hint}` : ""}\n`);
            process.exit(1);
        }
        process.stdout.write(stdout);
    },
);
child.stdin.on("error", () => {});
child.stdin.end(task);
