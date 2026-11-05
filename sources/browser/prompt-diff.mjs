// prompt-diff.mjs — a line diff for the reduced-prompt view.
//
// It is a plain longest-common-subsequence diff: enough to show which lines the
// reducer removed and which pointer it added, with no dependency. The input is
// the original markdown and the reduced markdown; the output is one row per
// line, tagged same, remove, or add.

export function diff_lines(before, after) {
    const left = before.split("\n");
    const right = after.split("\n");
    const rows = [];

    const lcs = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
    for (let x = left.length - 1; x >= 0; x -= 1) {
        for (let y = right.length - 1; y >= 0; y -= 1) {
            lcs[x][y] = left[x] === right[y]
                ? lcs[x + 1][y + 1] + 1
                : Math.max(lcs[x + 1][y], lcs[x][y + 1]);
        }
    }

    let x = 0;
    let y = 0;
    while (x < left.length && y < right.length) {
        if (left[x] === right[y]) {
            rows.push({ kind: "same", text: left[x] });
            x += 1;
            y += 1;
        } else if (lcs[x + 1][y] >= lcs[x][y + 1]) {
            rows.push({ kind: "remove", text: left[x] });
            x += 1;
        } else {
            rows.push({ kind: "add", text: right[y] });
            y += 1;
        }
    }
    while (x < left.length) {
        rows.push({ kind: "remove", text: left[x] });
        x += 1;
    }
    while (y < right.length) {
        rows.push({ kind: "add", text: right[y] });
        y += 1;
    }
    return rows;
}
