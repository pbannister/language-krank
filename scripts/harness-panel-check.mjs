#!/usr/bin/env node
// harness-panel-check.mjs — mount the Krank action in a running Harness Web UI.
//
// This is the live-state replacement for a Vitest component mount: the installed
// DSH package ships no Vitest or DOM environment. It drives the real page through
// Chrome DevTools Protocol and verifies the action, dialog, iframe, close/reopen
// persistence, and Escape dismissal.
//
// Usage: node scripts/harness-panel-check.mjs <harness-url> [screenshot-path]
// The URL is the tokenized address printed by `dsh web --port 3081 --no-open`.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const url = process.argv[2];
const screenshot = process.argv[3] ?? "dataflow.out/ui-audit/harness-panel-live.png";
if (!url) {
    console.error("usage: node scripts/harness-panel-check.mjs <harness-url> [screenshot-path]");
    process.exit(2);
}

const port = 9233;
const chrome = spawn("google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--user-data-dir=${process.cwd()}/dataflow.out/ui-audit/harness-panel-check-profile`,
    `--remote-debugging-port=${port}`, "--window-size=1440,1000", url,
], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}${path}`);
            if (response.ok) return response.json();
        } catch {}
        await sleep(250);
    }
    throw new Error(`Harness did not answer on port ${port}`);
}

let socket;
try {
    const version = await get("/json/version");
    socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let next_id = 1;
    const calls = new Map();
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (!message.id || !calls.has(message.id)) return;
        const { resolve, reject } = calls.get(message.id);
        calls.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
    };
    function send(method, params = {}, session = undefined) {
        const id = next_id++;
        socket.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
        return new Promise((resolve, reject) => calls.set(id, { resolve, reject }));
    }
    const page = (await get("/json/list")).find((target) => target.type === "page");
    const { sessionId } = await send("Target.attachToTarget", { targetId: page.id, flatten: true });
    const command = (method, params = {}) => send(method, params, sessionId);
    await command("Runtime.enable");
    await command("Page.enable");
    await sleep(5000);

    const evaluate = async (expression) => {
        const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
        return result.result.value;
    };
    const click_text = (label) => evaluate(`(() => {
        const item = [...document.querySelectorAll('button,a')].find((node) => node.textContent.trim() === ${JSON.stringify(label)});
        if (!item) return false;
        item.click();
        return true;
    })()`);

    let has_action = await evaluate("[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Krank')");
    if (!has_action) {
        await click_text("New Session");
        await sleep(2500);
        const opened = await evaluate(`(() => {
            const item = [...document.querySelectorAll('[role="treeitem"][class*="sessionRow"]')]
                .find((node) => node.textContent.trim() !== "New Session")
                ?? [...document.querySelectorAll('[role="treeitem"]')].find((node) => /\b(min|h|d)$/.test(node.textContent.trim()));
            if (!item) return false;
            item.click();
            return true;
        })()`);
        if (!opened) throw new Error("no Harness session entry to open");
        await sleep(5000);
        has_action = await evaluate("[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Krank')");
    }
    if (!has_action) throw new Error("Krank action did not mount in the session header");

    if (!(await click_text("Krank"))) throw new Error("Krank action could not be clicked");
    await sleep(2500);
    const opened = await evaluate(`(() => {
        const panel = document.querySelector('[role="dialog"][aria-label="Krank prompt studio"]');
        const frame = panel?.querySelector("iframe");
        if (!panel || !frame) return { present: false };
        window.__krankFrame = frame;
        return { present: true, src: frame.getAttribute("src"), title: frame.getAttribute("title") };
    })()`);
    if (!opened.present) throw new Error("Krank dialog did not open");
    if (!opened.src?.endsWith("/browser/index.html")) throw new Error(`unexpected iframe source: ${opened.src}`);

    if (!(await click_text("Close"))) throw new Error("dialog has no Close action");
    await sleep(500);
    const closed = await evaluate(`(() => {
        const panel = document.querySelector('[role="dialog"][aria-label="Krank prompt studio"]');
        const overlay = panel?.parentElement;
        return { hidden: !panel || getComputedStyle(overlay).display === "none", retained: Boolean(window.__krankFrame?.isConnected) };
    })()`);
    if (!closed.hidden) throw new Error("Close did not hide the panel");
    if (!closed.retained) throw new Error("Close unmounted the iframe");

    if (!(await click_text("Krank"))) throw new Error("Krank action could not be reopened");
    await sleep(500);
    const reopened = await evaluate(`(() => {
        const panel = document.querySelector('[role="dialog"][aria-label="Krank prompt studio"]');
        return { visible: getComputedStyle(panel.parentElement).display !== "none", same: window.__krankFrame === panel.querySelector("iframe") };
    })()`);
    if (!reopened.visible || !reopened.same) throw new Error("reopening did not preserve the studio iframe");

    await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
    await sleep(500);
    const escaped = await evaluate(`getComputedStyle(document.querySelector('[role="dialog"][aria-label="Krank prompt studio"]').parentElement).display === "none"`);
    if (!escaped) throw new Error("Escape did not dismiss the panel");

    mkdirSync(dirname(screenshot), { recursive: true });
    if (!(await click_text("Krank"))) throw new Error("Krank action could not be reopened for capture");
    await sleep(1500);
    const image = await command("Page.captureScreenshot", { format: "png", fromSurface: true });
    writeFileSync(screenshot, Buffer.from(image.data, "base64"));
    console.log(`harness-panel-check: ok — ${opened.title} at ${opened.src}; iframe retained across close; Escape works`);
} finally {
    socket?.close();
    chrome.kill("SIGKILL");
}
