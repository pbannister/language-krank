// file-view.mjs — render a repository file with line numbers and highlights.
//
// The file viewer page and the studio overlay share this module: the page calls
// it for a direct link, and the overlay calls it in place. Rendering in place
// keeps the overlay's history on the studio document, so the browser back arrow
// and the overlay's Close button traverse exactly one history entry.

function escape_regex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function section_match(section, heading_text) {
    if (/^[0-9]+(\.[0-9]+)*$/.test(section)) {
        return new RegExp(`^${escape_regex(section)}(?:\\.|\\s|$)`).test(heading_text);
    }
    return heading_text.toLowerCase().includes(section.toLowerCase());
}

export async function render_file(container, { path, section = "", term = "" }, note) {
    container.replaceChildren();
    container.scrollTop = 0;
    if (path === "") {
        if (note) {
            note.textContent = "No file requested.";
        }
        return null;
    }
    const response = await fetch(`/file?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
        if (note) {
            note.textContent = `Could not read ${path}: HTTP ${response.status}`;
        }
        return null;
    }
    const text = await response.text();
    const lines = text.split("\n");

    let start = -1;
    let end = -1;
    let level = 0;
    if (section !== "") {
        for (let index = 0; index < lines.length; index++) {
            const heading = /^(#{1,6})\s+(.*)$/.exec(lines[index]);
            if (heading && section_match(section, heading[2])) {
                start = index;
                level = heading[1].length;
                break;
            }
        }
        if (start !== -1) {
            end = lines.length;
            for (let index = start + 1; index < lines.length; index++) {
                const heading = /^(#{1,6})\s/.exec(lines[index]);
                if (heading && heading[1].length <= level) {
                    end = index;
                    break;
                }
            }
        }
    }

    const highlight = new Set();
    if (start !== -1) {
        for (let index = start; index < end; index++) {
            highlight.add(index);
        }
    } else if (term !== "") {
        for (let index = 0; index < lines.length; index++) {
            if (lines[index].toLowerCase().includes(term.toLowerCase())) {
                highlight.add(index);
            }
        }
    }

    const description = start !== -1
        ? `section ${section}`
        : term !== ""
            ? `${highlight.size} line(s) containing "${term}"`
            : "no section requested";

    const fragment = document.createDocumentFragment();
    let first = -1;
    for (let index = 0; index < lines.length; index++) {
        const row = document.createElement("div");
        row.className = `file-line${highlight.has(index) ? " highlight" : ""}`;
        if (highlight.has(index) && first === -1) {
            first = index;
        }
        const number = document.createElement("span");
        number.className = "number";
        number.textContent = String(index + 1);
        const body = document.createElement("span");
        body.className = "text";
        body.textContent = lines[index] === "" ? " " : lines[index];
        row.append(number, body);
        fragment.append(row);
    }
    container.append(fragment);
    if (first !== -1) {
        container.children[first].scrollIntoView({ block: "center" });
    }
    if (note) {
        note.textContent = `${lines.length} line(s); ${highlight.size} highlighted from ${description}.`;
    }
    return { lines: lines.length, highlighted: highlight.size, description };
}
