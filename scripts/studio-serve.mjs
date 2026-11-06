#!/usr/bin/env node
// studio-serve.mjs — serve the local prompt studio, and compile a prompt on demand.
//
// GET requests serve the tree studio-build.sh writes, with the MIME types a
// browser module needs (.mjs is text/javascript; a plain directory server may
// guess wrong). POST /compile takes { source, text }, runs the compile task
// through a model backend, and streams Server-Sent Events: a `start` phase,
// the model's run events as `status`, a `parsing` phase, and a terminal
// `done` (with the candidates) or `error`. The events let the studio show
// progress instead of one static message while the model runs.
//
// The model backend is a separate Node script (STUDIO_COMPILER_SCRIPT, default
// scripts/compile-with-harness.mjs) that reads the task on stdin and streams
// the Harness run events as newline-delimited JSON. This server holds no model
// credential; the backend does.
//
// Usage: node scripts/studio-serve.mjs [port] [root]
// Defaults: port 8090, root dataflow.out/studio.

import { spawn } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ruleset_run } from "../sources/krank.mjs";

const port = Number(process.argv[2] ?? 8090);
const root = resolve(process.argv[3] ?? fileURLToPath(new URL("../dataflow.out/studio", import.meta.url)));
const compiler = process.env.STUDIO_COMPILER_SCRIPT ?? fileURLToPath(new URL("./compile-with-harness.mjs", import.meta.url));
const page_studio = "/browser/index.html";
const page_playground = "/browser/playground.html";

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
};

function fail(message) {
    console.error(`studio-serve: ${message}`);
    process.exit(1);
}

const SCHEMA = `A krank rule set is JSON:
{"facts": [], "rules": [{"id": "string", "when": [CONDITION], "then": [{"emit": VALUE}]}]}

A CONDITION is one of:
- {"fact": PATTERN}
- {"fact": PATTERN, "not": true}
- {"count": {"fact": PATTERN, "at_least": N}}  (or at_most, or both)

A PATTERN is an object keyed by fact key; a value is a scalar (equality), a
"$variable" (binding), or an operator object using eq, ne, lt, lte, gt, gte, in,
or prefix. A negated or count pattern may use an already-bound variable but may
not bind a new one. A rule's "then" holds assert, retract, or emit actions.`;

function build_task(source, text) {
    return `Compile a project prompt into krank rules.

${SCHEMA}

Answer with ONE JSON object and nothing else, no prose and no code fence:
{"candidates": [{"id": "short-id", "title": "short title", "explanation": "why this reading", "rules": {"facts": [], "rules": []}, "cases": [{"rule": "rule-id", "source": "${source}", "original": "a line of the prompt quoted exactly", "verdict": "short verdict", "note": "what was kept and lost", "suggestion": "how to rewrite the prompt"}]}]}

Rules for the compile:
- Compile only lines that are discrete and fact-shaped. Leave judgment, process, modality, and references alone; do not invent facts for them.
- Each case must quote a line that appears verbatim in the prompt, so the reduced prompt can remove it.
- Emit one candidate. Emit two only when the prose genuinely supports two readings, and explain the difference.
- Every rule must be valid: a condition is a fact pattern or a count; actions are assert, retract, or emit; a negated or count pattern may not bind a new variable.
- The facts are supplied by an extractor; name the facts you assume at the top of the explanation.

THE PROMPT (${source}):
${text}
`;
}

function parse_candidates(output) {
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");
    if (start === -1 || end <= start) {
        throw new Error("the compiler returned no JSON object");
    }
    let data;
    try {
        data = JSON.parse(output.slice(start, end + 1));
    } catch (error) {
        throw new Error(`the compiler returned invalid JSON: ${error.message}`);
    }
    if (!Array.isArray(data.candidates) || data.candidates.length === 0) {
        throw new Error("the compiler returned no candidates");
    }
    for (const candidate of data.candidates) {
        if (!candidate.rules || !Array.isArray(candidate.rules.rules) || candidate.rules.rules.length === 0) {
            throw new Error(`candidate ${candidate.id ?? "?"} has no rules`);
        }
        try {
            ruleset_run({ facts: candidate.rules.facts ?? [], rules: candidate.rules.rules });
        } catch (error) {
            throw new Error(`candidate ${candidate.id ?? "?"} is invalid: ${error.message}`);
        }
        for (const item of candidate.cases ?? []) {
            if (typeof item.rule !== "string" || typeof item.original !== "string" || item.original === "") {
                throw new Error(`candidate ${candidate.id ?? "?"} has an incomplete case`);
            }
        }
    }
    return { candidates: data.candidates };
}

function compile(task, on_event) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [compiler], { stdio: ["pipe", "pipe", "pipe"] });
        let buffer = "";
        let final_text = null;
        let stderr = "";
        child.stdout.on("data", (chunk) => {
            buffer += chunk.toString();
            let index;
            while ((index = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, index).trim();
                buffer = buffer.slice(index + 1);
                if (!line) {
                    continue;
                }
                let event;
                try {
                    event = JSON.parse(line);
                } catch {
                    continue;
                }
                if (event.type === "final") {
                    final_text = event.text;
                }
                if (on_event) {
                    on_event(event);
                }
            }
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", (error) => reject(new Error(error.message)));
        child.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || `compiler exited ${code}`));
            } else if (final_text === null) {
                reject(new Error("the compiler returned no final answer"));
            } else {
                resolve(final_text);
            }
        });
        child.stdin.on("error", () => {});
        child.stdin.end(task);
    });
}

// Distill a Harness run event into the compact status the studio shows.
function progress_event(event) {
    switch (event.type) {
        case "session":
            return { type: "status", phase: "session" };
        case "status":
            return { type: "status", phase: event.phase, turn: event.turn, step: event.step };
        case "thinking":
            return { type: "status", phase: "thinking" };
        case "text":
            return { type: "status", phase: "text" };
        case "tool_call":
            return { type: "status", phase: "tool_call", tool: event.tool };
        case "tool_result":
            return { type: "status", phase: "tool_result", status: event.status };
        default:
            return null;
    }
}

function body_of(request) {
    return new Promise((resolve, reject) => {
        let data = "";
        request.on("data", (chunk) => {
            data += chunk;
            if (data.length > 2 * 1024 * 1024) {
                reject(new Error("request too large"));
                request.destroy();
            }
        });
        request.on("end", () => resolve(data));
        request.on("error", reject);
    });
}

try {
    if (!statSync(resolve(root, `.${page_studio}`)).isFile()) {
        fail(`missing ${page_studio}`);
    }
} catch {
    fail(`no studio tree at ${root} (run: sh scripts/studio-build.sh)`);
}

const server = createServer((request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        response.writeHead(400);
        response.end("bad path\n");
        return;
    }

    if (request.method === "POST" && pathname === "/compile") {
        (async () => {
            let stream_open = false;
            try {
                const body = JSON.parse(await body_of(request));
                if (typeof body.source !== "string" || typeof body.text !== "string") {
                    throw new Error("source and text are required");
                }
                response.writeHead(200, {
                    "content-type": "text/event-stream; charset=utf-8",
                    "cache-control": "no-store",
                    "connection": "keep-alive",
                });
                stream_open = true;
                const send = (event) => response.write(`data: ${JSON.stringify(event)}\n\n`);
                send({ type: "phase", phase: "start", message: "the Harness started; waiting for the model" });
                const answer = await compile(build_task(body.source, body.text), (event) => {
                    const progress = progress_event(event);
                    if (progress) {
                        send(progress);
                    }
                });
                send({ type: "phase", phase: "parsing", message: "the model finished; parsing candidates" });
                const data = parse_candidates(answer);
                send({ type: "done", candidates: data.candidates });
                response.end();
            } catch (error) {
                if (stream_open) {
                    response.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
                    response.end();
                } else {
                    response.writeHead(500, { "content-type": "application/json", "cache-control": "no-store" });
                    response.end(JSON.stringify({ error: error.message }));
                }
            }
        })();
        return;
    }

    if (request.method !== "GET") {
        response.writeHead(405);
        response.end("method not allowed\n");
        return;
    }
    if (pathname === "/") {
        response.writeHead(302, { location: page_studio });
        response.end();
        return;
    }
    const full = resolve(root, `.${pathname}`);
    if (full !== root && !full.startsWith(`${root}/`)) {
        response.writeHead(403);
        response.end("forbidden\n");
        return;
    }
    try {
        const data = readFileSync(full);
        response.writeHead(200, {
            "content-type": TYPES[extname(full)] ?? "application/octet-stream",
            "cache-control": "no-store",
        });
        response.end(data);
    } catch {
        response.writeHead(404);
        response.end("not found\n");
    }
});

server.on("error", (error) => fail(error.message));
server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    console.log(`studio-serve: studio    http://127.0.0.1:${address.port}${page_studio}`);
    console.log(`studio-serve: playground http://127.0.0.1:${address.port}${page_playground}`);
    console.log(`studio-serve: compiler  ${compiler}`);
});
