// 33-core-contract.test.mjs — the frozen core contract, checked against real artifacts.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
    CORE_CONTRACT_NAME, CORE_CONTRACT_VERSION, contract_document,
    validate_artifact, validate_catalog, validate_check_result, validate_compile_request,
    validate_compile_response, validate_fact_bundle, validate_object_model,
    validate_prompts_manifest,
} from "../sources/studio-contract.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read_json = (rel) => JSON.parse(readFileSync(`${root}${rel}`, "utf8"));
const run_json = (script, args = []) => JSON.parse(execFileSync(process.execPath, [`${root}${script}`, ...args], { encoding: "utf8" }));
const malformed = (kind, value) => {
    const result = validate_artifact(kind, value);
    assert.equal(result.ok, false, `${kind} accepted a malformed value`);
    assert.ok(result.errors.length > 0);
    return result;
};

test("the contract document is named, versioned, and frozen", () => {
    const document = contract_document();
    assert.equal(document.name, CORE_CONTRACT_NAME);
    assert.equal(document.version, CORE_CONTRACT_VERSION);
    assert.equal(document.stability, "frozen");
    assert.ok(document.artifacts.object_model);
    assert.ok(document.artifacts.compile_response);
    assert.match(document.versioning, /Bump version/);
});

test("real object model, catalog, and fact bundle satisfy the contract", () => {
    const model = read_json("dataflow.in/object-model.json");
    const before = JSON.stringify(model);
    assert.equal(validate_object_model(model).ok, true);
    assert.equal(JSON.stringify(model), before);

    const catalog = run_json("scripts/site-catalog.mjs");
    assert.equal(validate_catalog(catalog).ok, true);
    assert.ok(catalog.fact_contract.version);

    const facts = run_json("scripts/site-facts.mjs");
    assert.equal(validate_fact_bundle(facts).ok, true);
    assert.ok(facts.files.length > 0);
    assert.equal(facts.files[0].entities[0].type, "file");
});

test("compile request and response shapes are exact", () => {
    assert.equal(validate_compile_request({ source: "prompts/x.md", text: "A rule." }).ok, true);
    malformed("compile_request", { source: "", text: "" });
    malformed("compile_request", { source: "prompts/x.md" });

    const candidate = { id: "c", title: "Reading", rules: { facts: [], rules: [] }, cases: [] };
    assert.equal(validate_compile_response({ candidates: [candidate] }).ok, true);
    malformed("compile_response", { candidates: [] });
    malformed("compile_response", { candidates: [{ ...candidate, cases: null }] });
    malformed("compile_response", { candidates: [{ ...candidate, rules: null }] });
});

test("prompts manifest and check result satisfy the contract", () => {
    const output = `${root}tests.out/33-core-contract/prompts.out`;
    rmSync(output, { recursive: true, force: true });
    mkdirSync(`${root}tests.out/33-core-contract`, { recursive: true });
    execFileSync(process.execPath, [`${root}scripts/prompts-build.mjs`, output], { encoding: "utf8" });
    const manifest = JSON.parse(readFileSync(`${output}/manifest.json`, "utf8"));
    assert.equal(validate_prompts_manifest(manifest).ok, true);
    malformed("prompts_manifest", { ...manifest, entries: [{ ...manifest.entries[0], source_sha256: "bad" }] });
    malformed("prompts_manifest", { ...manifest, entries: [{ ...manifest.entries[0], markers_found: "0" }] });

    const check = run_json("sources/ruleset-command.mjs", ["check", "dataflow.in/round-trip.json"]);
    assert.equal(validate_check_result(check).ok, true);
    malformed("check_result", { firings: -1, emitted: [] });
    malformed("check_result", { firings: 1, emitted: "no" });
});

test("the CLI exposes the frozen contract", () => {
    const output = run_json("sources/ruleset-command.mjs", ["contract"]);
    assert.equal(output.name, CORE_CONTRACT_NAME);
    assert.equal(output.version, CORE_CONTRACT_VERSION);
});
