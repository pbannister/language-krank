// coverage-report.mjs — how much of the prompt corpus is compiled into rules.
//
// A prompt file is prose; the compile maps some of its lines to rules. This
// report counts the bullet lines of every prompt file and the distinct lines a
// candidate's cases claim, so "so little is translated" becomes a number per
// file and a list of the largest gaps.
//
// The denominator is every bullet, including descriptive files (README, how-to,
// glossary) that are not rules. Read the per-file rows, not just the total: a
// rule-dense file with 4 of 93 compiled is the actionable gap.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const builder = fileURLToPath(new URL("./site-catalog.mjs", import.meta.url));
const catalog = JSON.parse(execFileSync(process.execPath, [builder], { encoding: "utf8" }));

let total_bullets = 0;
let total_covered = 0;
const rows = [];

for (const entry of catalog.entries) {
    const bullets = entry.markdown.split("\n").filter((line) => /^\s*[-*] /.test(line)).length;
    const covered = new Set();
    for (const candidate of entry.candidates) {
        for (const item of candidate.cases) {
            if ((item.source ?? entry.source) === entry.source) {
                covered.add(item.original);
            }
        }
    }
    total_bullets += bullets;
    total_covered += covered.size;
    rows.push({
        source: entry.source,
        bullets,
        compiled: covered.size,
        candidates: entry.candidates.length,
    });
}

rows.sort((left, right) => (right.bullets - right.compiled) - (left.bullets - left.compiled));

console.log("source                                              bullets  compiled");
for (const row of rows) {
    const mark = row.candidates === 0 ? " " : "*";
    console.log(`${mark} ${row.source.padEnd(48)} ${String(row.bullets).padStart(6)} ${String(row.compiled).padStart(9)}`);
}

const percent = total_bullets === 0 ? 0 : (100 * total_covered) / total_bullets;
console.log("---");
console.log(`prompt files ${rows.length}, bullet lines ${total_bullets}, lines with a compiled rule ${total_covered} (${percent.toFixed(1)}%)`);
console.log("a * marks a prompt with at least one candidate");
