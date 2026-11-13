// prompt-outline.mjs — browser-safe heading navigation for the Prompt panel.
//
// The prompt text stays the source of truth. These helpers only describe its
// ATX headings and exact line offsets, so a jump can select a line without
// rewriting the draft.

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING = /^( {0,3})(#{1,6})(?:[ \t]+(.*))?$/;

function clean_title(raw) {
    return (raw ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
}

export function parse_outline(text) {
    const outline = [];
    let fence = null;
    const lines = String(text ?? "").split("\n");
    lines.forEach((raw_line, index) => {
        const line = raw_line.endsWith("\r") ? raw_line.slice(0, -1) : raw_line;
        const fence_match = FENCE.exec(line);
        if (fence !== null) {
            if (fence_match
                && fence_match[1][0] === fence.character
                && fence_match[1].length >= fence.length
                && fence_match[2].trim() === "") {
                fence = null;
            }
            return;
        }
        if (fence_match) {
            fence = { character: fence_match[1][0], length: fence_match[1].length };
            return;
        }
        const heading = HEADING.exec(line);
        if (!heading) {
            return;
        }
        outline.push({ line: index + 1, level: heading[2].length, title: clean_title(heading[3]) });
    });
    return outline;
}

export function selection_for_line(text, line_number) {
    if (!Number.isInteger(line_number) || line_number < 1) {
        return null;
    }
    const lines = String(text ?? "").split("\n");
    if (line_number > lines.length) {
        return null;
    }
    let start = 0;
    for (let index = 0; index < line_number - 1; index += 1) {
        start += lines[index].length + 1;
    }
    let line_text = lines[line_number - 1];
    let end = start + line_text.length;
    if (line_text.endsWith("\r")) {
        line_text = line_text.slice(0, -1);
        end -= 1;
    }
    return { start, end, text: line_text };
}

export function outline_matches(outline, query) {
    if (!Array.isArray(outline)) {
        return [];
    }
    const needle = String(query ?? "").trim().toLowerCase();
    if (needle === "") {
        return outline.slice();
    }
    return outline.filter((heading) => String(heading?.title ?? "").toLowerCase().includes(needle));
}
