// site-catalog.mjs — assemble the compile catalog the demo page loads.
//
// Each authored entry in dataflow.in/compile/ names a prompt file and either
// carries its compiled rules and cases inline or references the fixture files.
// This script resolves both, reads the prompt's markdown, and prints one bundle:
//
//   { "entries": [ { id, title, source, markdown, rules, cases } ] }
//
// The compile itself is recorded, not run here: the rules were authored from the
// prose in a session, and the page says so. This script only assembles them.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const directory = join(root, "dataflow.in", "compile");

const entries = readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
        const entry = JSON.parse(readFileSync(join(directory, name), "utf8"));
        if (!entry.rules) {
            if (!entry.rules_file) {
                throw new Error(`${name}: no rules and no rules_file`);
            }
            entry.rules = JSON.parse(readFileSync(join(root, entry.rules_file), "utf8"));
        }
        if (!entry.cases) {
            if (!entry.cases_file) {
                throw new Error(`${name}: no cases and no cases_file`);
            }
            entry.cases = JSON.parse(readFileSync(join(root, entry.cases_file), "utf8")).cases;
        }
        entry.markdown = readFileSync(join(root, entry.source), "utf8");
        return entry;
    });

process.stdout.write(`${JSON.stringify({ entries }, null, 4)}\n`);
