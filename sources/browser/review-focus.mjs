// review-focus.mjs — browser-safe navigation over the visible requirement list.
// This module does not decide eligibility or approval; it only selects an item.

function list_of(items) {
    return Array.isArray(items) ? items : [];
}

export function resolve_focus_index(items, preferred_id) {
    const list = list_of(items);
    if (list.length === 0) {
        return -1;
    }
    if (typeof preferred_id === "string" || typeof preferred_id === "number") {
        const index = list.findIndex((item) => item?.id === preferred_id);
        if (index !== -1) {
            return index;
        }
    }
    return 0;
}

export function move_focus_index(items, index, delta) {
    const list = list_of(items);
    if (list.length === 0) {
        return -1;
    }
    const current = Number.isInteger(index) ? index : 0;
    const step = Number.isInteger(delta) ? delta : 0;
    return Math.max(0, Math.min(list.length - 1, current + step));
}

export function focus_position(items, index) {
    const list = list_of(items);
    if (list.length === 0) {
        return { index: -1, count: 0, label: "No requirements visible" };
    }
    const position = Number.isInteger(index) ? Math.max(0, Math.min(list.length - 1, index)) : 0;
    return {
        index: position,
        count: list.length,
        label: `Requirement ${position + 1} of ${list.length}`,
    };
}

export function focus_item(items, index) {
    const list = list_of(items);
    if (!Number.isInteger(index) || index < 0 || list.length <= index) {
        return null;
    }
    return list[index];
}
