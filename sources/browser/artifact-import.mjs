// artifact-import.mjs — browser-safe parsing for a downloaded compile/review artifact.
// Parsing does not validate the review; the studio validates it with review_report.

export function parse_artifact(text) {
    if (typeof text !== "string" || text.trim() === "") {
        return { ok: false, error: "The selected file is empty." };
    }
    let value;
    try {
        value = JSON.parse(text);
    } catch (error) {
        return { ok: false, error: `The selected file is not valid JSON: ${error.message}` };
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, error: "The artifact must be a JSON object." };
    }
    if (typeof value.source !== "string" || value.source === "") {
        return { ok: false, error: "The artifact has no prompt source." };
    }
    if (!Array.isArray(value.candidates) || value.candidates.length === 0) {
        return { ok: false, error: "The artifact has no candidates." };
    }
    return { ok: true, error: "", artifact: value };
}

export function select_artifact_candidate(artifact, source) {
    if (!artifact || typeof artifact !== "object" || artifact.source !== source) {
        return null;
    }
    const list = Array.isArray(artifact.candidates) ? artifact.candidates : [];
    return list.find((candidate) => candidate?.id === artifact.approved)
        ?? list.find((candidate) => typeof candidate?.id === "string" && candidate.id !== "")
        ?? null;
}

export function merge_candidate(candidates, candidate) {
    const list = Array.isArray(candidates) ? candidates : [];
    if (!candidate || typeof candidate.id !== "string" || candidate.id === "") {
        return [...list];
    }
    const index = list.findIndex((item) => item?.id === candidate.id);
    if (index === -1) {
        return [candidate, ...list];
    }
    return list.map((item, position) => (position === index ? candidate : item));
}
