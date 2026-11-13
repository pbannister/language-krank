// draft-history.mjs — browser-safe undo/redo for applied page-local drafts.

export function empty_draft_history() {
    return { past: [], future: [] };
}

export function record_draft(history, text, label = "Draft") {
    const state = history ?? empty_draft_history();
    if (typeof text !== "string") {
        return state;
    }
    return {
        past: [...(Array.isArray(state.past) ? state.past : []), { text, label }],
        future: [],
    };
}

export function undo_draft(history, current_text) {
    const state = history ?? empty_draft_history();
    const past = Array.isArray(state.past) ? state.past : [];
    if (past.length === 0) {
        return null;
    }
    const entry = past[past.length - 1];
    return {
        history: {
            past: past.slice(0, -1),
            future: [{ text: current_text, label: "Current draft" }, ...(Array.isArray(state.future) ? state.future : [])],
        },
        entry,
    };
}

export function redo_draft(history, current_text) {
    const state = history ?? empty_draft_history();
    const future = Array.isArray(state.future) ? state.future : [];
    if (future.length === 0) {
        return null;
    }
    const entry = future[0];
    return {
        history: {
            past: [...(Array.isArray(state.past) ? state.past : []), { text: current_text, label: "Current draft" }],
            future: future.slice(1),
        },
        entry,
    };
}
