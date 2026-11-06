#!/usr/bin/env node
// object-model-report.mjs — which object types the rules and extractors use.
//
// It is the registry-hygiene aid, not a gate: a type used by neither a rule nor
// an extractor is a deletion candidate unless it is marker-fed (the runtime
// objects such as session and failure, which prompt.out/ will carry later). The
// report names the three sets so the human can decide.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const model = JSON.parse(readFileSync(`${root}dataflow.in/object-model.json`, "utf8"));
const catalog = JSON.parse(execFileSync(process.execPath, [`${root}scripts/site-catalog.mjs`], { encoding: "utf8" }));
const facts = JSON.parse(execFileSync(process.execPath, [`${root}scripts/site-facts.mjs`], { encoding: "utf8" }));

const used_by_rules = new Set();
for (const entry of catalog.entries) {
    for (const candidate of entry.candidates) {
        for (const fact of candidate.rules.facts ?? []) {
            if (typeof fact.type === "string") {
                used_by_rules.add(fact.type);
            }
        }
        for (const rule of candidate.rules.rules ?? []) {
            for (const condition of rule.when) {
                const pattern = condition.fact ?? condition.count?.fact;
                if (pattern && typeof pattern.type === "string") {
                    used_by_rules.add(pattern.type);
                }
            }
        }
    }
}

const used_by_extractors = new Set();
for (const file of facts.files) {
    for (const item of file.entities) {
        if (typeof item.type === "string") {
            used_by_extractors.add(item.type);
        }
    }
}

const rows = model.objects
    .map((object) => ({
        id: object.id,
        rule: used_by_rules.has(object.id),
        extractor: used_by_extractors.has(object.id),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

console.log("object                    rule  extractor");
for (const row of rows) {
    console.log(`${row.id.padEnd(24)} ${row.rule ? "y" : " "}     ${row.extractor ? "y" : " "}`);
}

const by_rule = rows.filter((row) => row.rule);
const by_extractor = rows.filter((row) => row.extractor);
const by_neither = rows.filter((row) => !row.rule && !row.extractor);
console.log("---");
console.log(`objects ${rows.length}: ${by_rule.length} by rules, ${by_extractor.length} by an extractor, ${by_neither.length} by neither`);
console.log(`by neither (marker-fed or deletion candidates): ${by_neither.map((row) => row.id).join(", ") || "none"}`);
