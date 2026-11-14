// studio-contract.mjs — the frozen, browser-safe contract between the studio
// core and its surfaces (standalone web, Harness panel, CLI).
//
// A breaking shape change requires a version bump here and updates to every
// surface. Validators return { ok, errors } and never mutate their input.

export const CORE_CONTRACT_VERSION = 1;
export const CORE_CONTRACT_NAME = "krank-studio-core";

const HEX64 = /^[0-9a-f]{64}$/;

function is_object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
    return typeof value === "string" && value.trim() !== "";
}

function array(value) {
    return Array.isArray(value);
}

function errors_for(errors, condition, message) {
    if (!condition) {
        errors.push(message);
    }
}

function validate_rules(errors, rules, label) {
    errors_for(errors, is_object(rules) && array(rules.rules) && array(rules.facts ?? []), `${label}: rules must be {facts, rules}`);
}

export function contract_document() {
    return {
        name: CORE_CONTRACT_NAME,
        version: CORE_CONTRACT_VERSION,
        stability: "frozen",
        artifacts: {
            object_model: "dataflow.in/object-model.json",
            catalog: "catalog.json from scripts/site-catalog.mjs",
            fact_bundle: "files.json from scripts/site-facts.mjs",
            compile_request: "POST /compile {source, text}",
            compile_response: "{candidates}",
            prompts_manifest: "prompts.out/manifest.json",
            check_result: "krank check output {firings, emitted}",
        },
        versioning: "Bump version for a breaking shape change; additive optional fields do not bump it.",
    };
}

export function validate_object_model(value) {
    const errors = [];
    errors_for(errors, is_object(value), "object model must be an object");
    if (!is_object(value)) {
        return { ok: false, errors };
    }
    for (const key of ["objects", "operations", "relations", "proposals"]) {
        errors_for(errors, array(value[key]), `object model.${key} must be an array`);
    }
    for (const [index, item] of (Array.isArray(value.objects) ? value.objects : []).entries()) {
        errors_for(errors, is_object(item) && text(item.id) && array(item.fields), `objects[${index}] must have id and fields`);
    }
    for (const [index, item] of (Array.isArray(value.operations) ? value.operations : []).entries()) {
        errors_for(errors, is_object(item) && text(item.id) && text(item.subject) && text(item.object), `operations[${index}] must have id, subject, object`);
    }
    for (const [index, item] of (Array.isArray(value.relations) ? value.relations : []).entries()) {
        errors_for(errors, is_object(item) && text(item.id) && text(item.from) && text(item.to), `relations[${index}] must have id, from, to`);
    }
    return { ok: errors.length === 0, errors };
}

export function validate_catalog(value) {
    const errors = [];
    errors_for(errors, is_object(value) && array(value.entries) && is_object(value.fact_contract), "catalog must be {entries, fact_contract}");
    if (!is_object(value)) {
        return { ok: false, errors };
    }
    for (const [index, entry] of (Array.isArray(value.entries) ? value.entries : []).entries()) {
        errors_for(errors, is_object(entry) && text(entry.source) && text(entry.markdown) && array(entry.candidates), `entries[${index}] must have source, markdown, candidates`);
        for (const [candidate_index, candidate] of (Array.isArray(entry?.candidates) ? entry.candidates : []).entries()) {
            errors_for(errors, is_object(candidate) && text(candidate.id) && text(candidate.title) && array(candidate.cases), `entries[${index}].candidates[${candidate_index}] must have id, title, cases`);
            validate_rules(errors, candidate?.rules, `entries[${index}].candidates[${candidate_index}]`);
        }
    }
    return { ok: errors.length === 0, errors };
}

export function validate_fact_bundle(value) {
    const errors = [];
    errors_for(errors, is_object(value) && array(value.files), "fact bundle must be {files}");
    if (!is_object(value)) {
        return { ok: false, errors };
    }
    for (const [index, file] of (Array.isArray(value.files) ? value.files : []).entries()) {
        errors_for(errors, is_object(file) && text(file.path) && is_object(file.facts) && array(file.entities), `files[${index}] must have path, facts, entities`);
        errors_for(errors, is_object(file?.entities?.[0]) && file.entities[0].type === "file", `files[${index}].entities[0] must be the file fact`);
    }
    return { ok: errors.length === 0, errors };
}

export function validate_compile_request(value) {
    const errors = [];
    errors_for(errors, is_object(value) && text(value.source) && typeof value.text === "string", "compile request must be {source, text}");
    return { ok: errors.length === 0, errors };
}

export function validate_compile_response(value) {
    const errors = [];
    errors_for(errors, is_object(value) && array(value.candidates) && value.candidates.length > 0, "compile response must hold at least one candidate");
    if (!is_object(value)) {
        return { ok: false, errors };
    }
    for (const [index, candidate] of (Array.isArray(value.candidates) ? value.candidates : []).entries()) {
        errors_for(errors, is_object(candidate) && text(candidate.id) && text(candidate.title), `candidates[${index}] must have id and title`);
        validate_rules(errors, candidate?.rules, `candidates[${index}]`);
        errors_for(errors, array(candidate?.cases), `candidates[${index}].cases must be an array`);
    }
    return { ok: errors.length === 0, errors };
}

export function validate_prompts_manifest(value) {
    const errors = [];
    errors_for(errors, is_object(value) && text(value.generated_by) && text(value.generated_at) && array(value.entries), "manifest must have generated_by, generated_at, entries");
    if (!is_object(value)) {
        return { ok: false, errors };
    }
    for (const [index, entry] of (Array.isArray(value.entries) ? value.entries : []).entries()) {
        errors_for(errors, is_object(entry) && text(entry.source) && text(entry.candidate), `manifest.entries[${index}] must have source and candidate`);
        errors_for(errors, HEX64.test(entry?.source_sha256 ?? ""), `manifest.entries[${index}].source_sha256 must be a SHA-256 hex digest`);
        errors_for(errors, Number.isInteger(entry?.markers_found) && Number.isInteger(entry?.markers_missing), `manifest.entries[${index}] must have marker counts`);
        errors_for(errors, is_object(entry?.coverage), `manifest.entries[${index}].coverage must be an object`);
    }
    return { ok: errors.length === 0, errors };
}

export function validate_check_result(value) {
    const errors = [];
    errors_for(errors, is_object(value) && Number.isInteger(value.firings) && value.firings >= 0 && array(value.emitted), "check result must be {firings, emitted}");
    return { ok: errors.length === 0, errors };
}

export function validate_artifact(kind, value) {
    const validators = {
        object_model: validate_object_model,
        catalog: validate_catalog,
        fact_bundle: validate_fact_bundle,
        compile_request: validate_compile_request,
        compile_response: validate_compile_response,
        prompts_manifest: validate_prompts_manifest,
        check_result: validate_check_result,
    };
    const validator = validators[kind];
    if (!validator) {
        return { ok: false, errors: [`unknown contract artifact: ${kind}`] };
    }
    return validator(value);
}

export function assert_artifact(kind, value) {
    const result = validate_artifact(kind, value);
    if (!result.ok) {
        throw new Error(`${kind} violates core contract v${CORE_CONTRACT_VERSION}: ${result.errors.join("; ")}`);
    }
    return value;
}
