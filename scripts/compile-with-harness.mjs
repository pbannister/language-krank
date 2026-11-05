#!/usr/bin/env node
// compile-with-harness.mjs — run the studio's compile task through the Harness.
//
// The studio server writes the task on stdin; this script runs it through the
// Harness headless profile and prints the model's answer on stdout. It holds no
// credential itself: the Harness owns the provider.
//
// Configuration:
//   DSH_BIN   the Harness launcher. Default "dsh" from PATH. A path ending in
//             ".js" is run with the current Node; set the profile with
//             DSH_PROFILE (default "headless").
//   DSH_PROFILE  default "headless".
//
// Usage: printf 'task' | node scripts/compile-with-harness.mjs

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";

const task = readFileSync(0, "utf8");
const bin = process.env.DSH_BIN ?? "dsh";
const profile = process.env.DSH_PROFILE ?? "headless";
const command = bin.endsWith(".js") ? process.execPath : bin;
const prefix = bin.endsWith(".js") ? [bin] : [];

execFile(
    command,
    [...prefix, "--profile", profile, task],
    { timeout: 600000, maxBuffer: 16 * 1024 * 1024 },
    (error, stdout, stderr) => {
        if (error) {
            process.stderr.write(`${stderr || error.message}\n`);
            process.exit(1);
        }
        process.stdout.write(stdout);
    },
);
