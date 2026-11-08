// 30-object-model.test.mjs — node:test cases for dataflow.in/object-model.json.
// Invoked by tests/30-object-model.sh.
//
// The registry is the shared vocabulary: every object has fields, provenance,
// and a confirmed status; every operation and relation names objects that exist
// and carries the same provenance; every excluded guess is kept with its reason;
// and every fact type the fixtures and compiled candidates use is a confirmed
// object. A type the model lacks is a future rule that cannot be written without
// inventing a parallel vocabulary.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { ruleset_run } from "../sources/krank.mjs";

const model = JSON.parse(readFileSync(new URL("../dataflow.in/object-model.json", import.meta.url), "utf8"));
const objects = new Map(model.objects.map((object) => [object.id, object]));
const PROPOSAL_KINDS = new Set(["object", "operation", "relation"]);
const PROPOSAL_GUESSES = new Set(["include", "exclude"]);
const PROPOSAL_STATUSES = new Set(["proposed", "confirmed", "rejected"]);

function assert_provenance(entry, label) {
    assert.equal(typeof entry.evidence, "string", `${label} has no evidence`);
    assert.ok(entry.evidence.trim().length > 0, `${label} has empty evidence`);
    assert.equal(typeof entry.rationale, "string", `${label} has no rationale`);
    assert.ok(entry.rationale.trim().length > 0, `${label} has empty rationale`);
    assert.equal(typeof entry.source, "string", `${label} has no source`);
    assert.equal(entry.status, "confirmed", `${label} is not confirmed`);
}

function assert_confirmed_object(type, label) {
    const object = objects.get(type);
    assert.ok(object, `${label}: unregistered type ${type}`);
    assert.equal(object.status, "confirmed", `${label}: ${type} is not a confirmed object`);
}

test("every object has fields, provenance, and a confirmed status", () => {
    assert.ok(model.objects.length > 0);
    for (const object of model.objects) {
        assert.equal(typeof object.id, "string", "an object has no id");
        assert.ok(Array.isArray(object.fields) && object.fields.length > 0, `${object.id} has no fields`);
        assert_provenance(object, object.id);
    }
});

test("every operation names known objects and carries provenance", () => {
    for (const operation of model.operations) {
        assert.ok(objects.has(operation.subject), `${operation.id}: unknown subject ${operation.subject}`);
        assert.ok(objects.has(operation.object), `${operation.id}: unknown object ${operation.object}`);
        assert.equal(typeof operation.effect, "string", `${operation.id} has no effect`);
        assert_provenance(operation, operation.id);
    }
});

test("every relation names known objects and carries provenance", () => {
    for (const relation of model.relations) {
        assert.ok(objects.has(relation.from), `${relation.id}: unknown from ${relation.from}`);
        assert.ok(objects.has(relation.to), `${relation.id}: unknown to ${relation.to}`);
        assert.ok(relation.cardinality.length > 0, `${relation.id} has no cardinality`);
        assert_provenance(relation, relation.id);
    }
});

test("every excluded or rejected guess is kept with its reason", () => {
    assert.ok(Array.isArray(model.proposals), "the model has no proposals");
    for (const proposal of model.proposals) {
        assert.equal(typeof proposal.term, "string", "a proposal has no term");
        assert.ok(PROPOSAL_KINDS.has(proposal.kind), `${proposal.term}: unknown kind ${proposal.kind}`);
        assert.ok(PROPOSAL_GUESSES.has(proposal.guess), `${proposal.term}: unknown guess ${proposal.guess}`);
        assert.ok(PROPOSAL_STATUSES.has(proposal.status), `${proposal.term}: unknown status ${proposal.status}`);
        assert.equal(typeof proposal.evidence, "string", `${proposal.term} has no evidence`);
        assert.ok(proposal.evidence.trim().length > 0, `${proposal.term} has empty evidence`);
        assert.equal(typeof proposal.rationale, "string", `${proposal.term} has no rationale`);
        assert.ok(proposal.rationale.trim().length > 0, `${proposal.term} has empty rationale`);
        assert.equal(typeof proposal.source, "string", `${proposal.term} has no source`);
        if (proposal.kind === "operation") {
            assert.ok(objects.has(proposal.subject), `${proposal.term}: unknown subject ${proposal.subject}`);
        }
    }
});

test("a confirmed proposal is not also a registry object it duplicates", () => {
    for (const proposal of model.proposals) {
        if (proposal.status !== "confirmed" || proposal.guess !== "include") {
            continue;
        }
        assert.ok(objects.has(proposal.term), `${proposal.term}: confirmed include is not in the registry`);
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

test("every fact type in the fixtures and candidates is a confirmed object", () => {
    for (const ruleset of rulesets()) {
        for (const fact of ruleset.facts ?? []) {
            if (typeof fact.type === "string") {
                assert_confirmed_object(fact.type, "fact");
            }
        }
        for (const rule of ruleset.rules ?? []) {
            for (const condition of rule.when) {
                const pattern = condition.fact ?? condition.count?.fact;
                if (pattern && typeof pattern.type === "string") {
                    assert_confirmed_object(pattern.type, `rule ${rule.id}`);
                }
            }
            for (const action of rule.then ?? []) {
                const pattern = action.assert ?? action.retract;
                if (pattern && typeof pattern.type === "string") {
                    assert_confirmed_object(pattern.type, `rule ${rule.id} action`);
                }
            }
        }
    }
});
