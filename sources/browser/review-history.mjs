// review-history.mjs — browser-safe undo record for the object review queue.

export function review_snapshot(row) {
    if (!row || typeof row.term !== "string") {
        return null;
    }
    return { term: row.term, use: row.use, reviewed: Boolean(row.reviewed) };
}

export function undo_last_review(history, rows) {
    const list = Array.isArray(history) ? history : [];
    const snapshot = list[list.length - 1];
    if (!snapshot) {
        return { history: [...list], row: null, snapshot: null };
    }
    const row = (Array.isArray(rows) ? rows : []).find((item) => item?.term === snapshot.term) ?? null;
    return { history: list.slice(0, -1), row, snapshot };
}
