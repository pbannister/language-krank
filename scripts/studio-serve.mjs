#!/usr/bin/env node
// studio-serve.mjs — serve the local prompt studio on 127.0.0.1.
//
// The studio is a local tool: it is not published, and the homelab strips a
// project-authored <nav>, which the studio's step rail needs. This server serves
// the tree studio-build.sh writes, with the MIME types a browser module needs
// (.mjs is text/javascript; a plain directory server may guess wrong).
//
// Usage: node scripts/studio-serve.mjs [port] [root]
// Defaults: port 8090, root dataflow.out/studio.

import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.argv[2] ?? 8090);
const root = resolve(process.argv[3] ?? fileURLToPath(new URL("../dataflow.out/studio", import.meta.url)));
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
});
