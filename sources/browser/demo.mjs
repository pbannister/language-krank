// demo.mjs — the browser demo.
//
// It imports the library barrel directly. The engine and renderer carry no
// node: import, so the page needs no build step; serve the sources/ directory
// over HTTP (make demo) because ES modules do not load from file://.

import { ruleset_render, ruleset_run } from "../krank.mjs";

const input = document.querySelector("#input");
const output = document.querySelector("#output");

let sample = "";

function show(text) {
    output.textContent = text;
}

function ruleset_from_input() {
    try {
        return JSON.parse(input.value);
    } catch (error) {
        show(`not valid JSON: ${error.message}`);
        return null;
    }
}

async function load_sample() {
    const response = await fetch("./sample.json");
    if (!response.ok) {
        throw new Error(`could not load sample.json: ${response.status}`);
    }
    sample = await response.text();
    input.value = sample.trim();
}

document.querySelector("#run").addEventListener("click", () => {
    const ruleset = ruleset_from_input();
    if (ruleset === null) {
        return;
    }
    try {
        const result = ruleset_run(ruleset);
        show(JSON.stringify({ firings: result.firings, emitted: result.emitted }, null, 4));
    } catch (error) {
        show(`error: ${error.message}`);
    }
});

document.querySelector("#render").addEventListener("click", () => {
    const ruleset = ruleset_from_input();
    if (ruleset === null) {
        return;
    }
    try {
        show(ruleset_render(ruleset));
    } catch (error) {
        show(`error: ${error.message}`);
    }
});

document.querySelector("#reset").addEventListener("click", () => {
    input.value = sample;
    show("");
});

load_sample().catch((error) => show(`error: ${error.message}`));
