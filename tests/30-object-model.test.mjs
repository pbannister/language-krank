// 30-object-model.test.mjs — node:test cases for dataflow.in/object-model.json.
// Invoked by tests/30-object-model.sh.
//
// The registry is the shared vocabulary: every object has fields and a source;
// every operation and relation names objects that exist; and every fact type the
// fixtures and compiled candidates use is registered. A type the model lacks is
// a future rule that cannot be written without inventing a parallel vocabulary.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { ruleset_run } from "../sources/krank.mjs";

const model = JSON.parse(readFileSync(new URL("../dataflow.in/object-model.json", import.meta.url), "utf8"));
const objects = new Set(model.objects.map((object) => object.id));

test("every object has fields and a source", () => {
    assert.ok(model.objects.length > 0);
    for (const object of model.objects) {
        assert.equal(typeof object.id, "string", "an object has no id");
        assert.ok(Array.isArray(object.fields) && object.fields.length > 0, `${object.id} has no fields`);
        assert.equal(typeof object.source, "string", `${object.id} has no source`);
    }
});

test("every operation names known objects", () => {
    for (const operation of model.operations) {
        assert.ok(objects.has(operation.subject), `${operation.id}: unknown subject ${operation.subject}`);
        assert.ok(objects.has(operation.object), `${operation.id}: unknown object ${operation.object}`);
        assert.equal(typeof operation.effect, "string", `${operation.id} has no effect`);
        assert.equal(typeof operation.source, "string", `${operation.id} has no source`);
    }
});

test("every relation names known objects", () => {
    for (const relation of model.relations) {
        assert.ok(objects.has(relation.from), `${relation.id}: unknown from ${relation.from}`);
        assert.ok(objects.has(relation.to), `${relation.id}: unknown to ${relation.to}`);
        assert.ok(relation.cardinality.length > 0, `${relation.id} has no cardinality`);
        assert.equal(typeof relation.source, "string", `${relation.id} has no source`);
    }
});

function rulesets() {
    const found = [];
    const round_trip = JSON.parse(readFileSync(new URL("../dataflow.in/round-trip.json", import.meta.url), "utf8"));
    found.push(round_trip);
    const directory = new URL("../dataflow.in/compile/", import.meta.url);
    for (const name of readdirSync(directory)) {
        if (!name.endsWith(".json")) {
            continue;
        }
        const entry = JSON.parse(readFileSync(new URL(name, directory), "utf8"));
        if (entry.rules) {
            found.push(entry.rules);
        }
        if (entry.rules_file) {
            found.push(JSON.parse(readFileSync(new URL(`../${entry.rules_file}`, import.meta.url), "utf8")));
        }
    }
    return found;
}

test("every candidate's rules are valid", () => {
    for (const ruleset of rulesets()) {
        ruleset_run({ facts: ruleset.facts ?? [], rules: ruleset.rules ?? [] });
    }
});

test("every fact type in the fixtures and candidates is registered", () => {
    for (const ruleset of rulesets()) {
        for (const fact of ruleset.facts ?? []) {
            if (typeof fact.type === "string") {
                assert.ok(objects.has(fact.type), `unregistered fact type ${fact.type}`);
            }
        }
        for (const rule of ruleset.rules ?? []) {
            for (const condition of rule.when) {
                const pattern = condition.fact ?? condition.count?.fact;
                if (pattern && typeof pattern.type === "string") {
                    assert.ok(objects.has(pattern.type), `rule ${rule.id}: unregistered type ${pattern.type}`);
                }
            }
        }
    }
});
