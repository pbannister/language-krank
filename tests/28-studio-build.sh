#!/bin/sh
#
# 28-studio-build.sh — assert scripts/studio-build.sh assembles the local studio
# and scripts/studio-serve.mjs serves it on 127.0.0.1 with a module MIME type.
# Tier: portable.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$DIRECTORY_SCRIPT/.." && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

fail() {
    echo "28-studio-build: $1" >&2
    exit 1
}

DIRECTORY_TEST=$(test_output_directory)
DIRECTORY_TREE="$DIRECTORY_TEST/tree"

sh "$REPOSITORY_ROOT/scripts/studio-build.sh" "$DIRECTORY_TREE" \
    || fail 'studio-build.sh failed'

for file_expected in \
    "$DIRECTORY_TREE/browser/index.html" \
    "$DIRECTORY_TREE/browser/studio.mjs" \
    "$DIRECTORY_TREE/browser/prompt-diff.mjs" \
    "$DIRECTORY_TREE/browser/catalog.json" \
    "$DIRECTORY_TREE/browser/files.json" \
    "$DIRECTORY_TREE/browser/playground.html" \
    "$DIRECTORY_TREE/browser/demo.mjs" \
    "$DIRECTORY_TREE/browser/sample.json" \
    "$DIRECTORY_TREE/browser/object-model.json" \
    "$DIRECTORY_TREE/krank.mjs" \
    "$DIRECTORY_TREE/ruleset-run.mjs" \
    "$DIRECTORY_TREE/ruleset-render.mjs"; do
    [ -f "$file_expected" ] || fail "missing $file_expected"
done

if grep -q 'HOMELAB-NAV' "$DIRECTORY_TREE/browser/index.html"; then
    fail 'the local studio still carries the homelab nav marker'
fi

node -e 'const data = require(process.argv[1]); if (!Array.isArray(data.entries) || data.entries.length < 2) process.exit(1); if (!data.entries.some((e) => e.candidates.length > 1)) process.exit(1);' \
    "$DIRECTORY_TREE/browser/catalog.json" || fail 'catalog.json has no candidate choice'
node -e 'const data = require(process.argv[1]); if (!Array.isArray(data.files) || data.files.length === 0) process.exit(1);' \
    "$DIRECTORY_TREE/browser/files.json" || fail 'files.json has no files'

cat > "$DIRECTORY_TEST/fake-compiler.mjs" <<'JS'
let input = "";
process.stdin.on("data", (chunk) => {
    input += chunk;
});
process.stdin.on("end", () => {
    process.stdout.write(JSON.stringify({ type: "session", sessionId: "fake" }) + "\n");
    process.stdout.write(JSON.stringify({ type: "status", phase: "turn_start", turn: 1 }) + "\n");
    process.stdout.write(JSON.stringify({ type: "reasoning", text: "dsh: reasoning:\nI am reading this prompt.\n" }) + "\n");
    let answer;
    if (input.includes("Propose the object model")) {
        answer = {
            proposals: [{
                term: "fixture_term",
                kind: "object",
                guess: "exclude",
                status: "proposed",
                evidence: "The prompt names the term.",
                rationale: "It is a fixture term, not a domain object.",
                source: "prompts/x.md",
            }],
        };
    } else if (input.includes("UNCONFIRMED")) {
        answer = {
            candidates: [{
                id: "bad",
                title: "Bad candidate",
                explanation: "A candidate with an unconfirmed fact type.",
                rules: {
                    facts: [],
                    rules: [{ id: "ghost", when: [{ fact: { type: "ghost" } }], then: [{ emit: "seen" }] }],
                },
                cases: [{ rule: "ghost", source: "prompts/x.md", original: "A line.", verdict: "ok", note: "n", suggestion: "s" }],
            }],
        };
    } else {
        answer = {
            candidates: [{
                id: "fake",
                title: "Fake candidate",
                explanation: "A candidate the test compiler returns.",
                rules: {
                    facts: [],
                    rules: [{ id: "always", when: [{ fact: { type: "file", path: "$p" } }], then: [{ emit: "seen" }] }],
                },
                cases: [{ rule: "always", source: "prompts/x.md", original: "A line.", verdict: "ok", note: "n", suggestion: "s" }],
            }],
        };
    }
    process.stdout.write(JSON.stringify({ type: "final", sessionId: "fake", reason: "done", text: JSON.stringify(answer) }) + "\n");
});
JS

PORT=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')
STUDIO_COMPILER_SCRIPT="$DIRECTORY_TEST/fake-compiler.mjs" \
    node "$REPOSITORY_ROOT/scripts/studio-serve.mjs" "$PORT" "$DIRECTORY_TREE" \
    > "$DIRECTORY_TEST/serve.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

attempt=0
while [ "$attempt" -lt 40 ]; do
    if curl -sf "http://127.0.0.1:$PORT/browser/index.html" > /dev/null 2>&1; then
        break
    fi
    sleep 0.25
    attempt=$((attempt + 1))
done
[ "$attempt" -lt 40 ] || fail 'the server did not answer'

curl -sf -D "$DIRECTORY_TEST/headers" "http://127.0.0.1:$PORT/browser/studio.mjs" -o /dev/null \
    || fail 'studio.mjs is not served'
grep -qi 'content-type: text/javascript' "$DIRECTORY_TEST/headers" \
    || fail 'studio.mjs is not served as text/javascript'
curl -sf "http://127.0.0.1:$PORT/browser/catalog.json" > /dev/null \
    || fail 'catalog.json is not served'

curl -sf -X POST -H 'content-type: application/json' \
    -d '{"source":"prompts/x.md","text":"A line."}' \
    "http://127.0.0.1:$PORT/compile" > "$DIRECTORY_TEST/compile.sse" \
    || fail 'the compile endpoint failed'
node -e 'const fs = require("fs"); const text = fs.readFileSync(process.argv[1], "utf8"); const events = [...text.matchAll(/^data: (.*)$/gm)].map((m) => JSON.parse(m[1])); if (!events.some((e) => e.type === "phase" && e.phase === "start")) process.exit(1); if (!events.some((e) => e.type === "reasoning")) process.exit(1); const done = events.find((e) => e.type === "done"); if (!done) process.exit(1); const candidate = done.candidates[0]; if (!candidate || candidate.rules.rules.length !== 1 || candidate.cases.length !== 1) process.exit(1);' \
    "$DIRECTORY_TEST/compile.sse" || fail 'the compile endpoint returned a bad candidate'

curl -sf -X POST -H 'content-type: application/json' \
    -d '{"source":"prompts/x.md","text":"A line."}' \
    "http://127.0.0.1:$PORT/propose" > "$DIRECTORY_TEST/propose.sse" \
    || fail 'the propose endpoint failed'
node -e 'const fs = require("fs"); const text = fs.readFileSync(process.argv[1], "utf8"); const events = [...text.matchAll(/^data: (.*)$/gm)].map((m) => JSON.parse(m[1])); const done = events.find((e) => e.type === "done"); if (!done) process.exit(1); const proposal = done.proposals[0]; if (!proposal || proposal.term !== "fixture_term" || proposal.status !== "proposed" || !proposal.evidence || !proposal.rationale) process.exit(1);' \
    "$DIRECTORY_TEST/propose.sse" || fail 'the propose endpoint returned a bad proposal'

curl -s -X POST -H 'content-type: application/json' \
    -d '{"source":"prompts/x.md","text":"UNCONFIRMED"}' \
    "http://127.0.0.1:$PORT/compile" > "$DIRECTORY_TEST/refuse.sse" \
    || fail 'the refusing compile endpoint could not be reached'
node -e 'const fs = require("fs"); const text = fs.readFileSync(process.argv[1], "utf8"); const events = [...text.matchAll(/^data: (.*)$/gm)].map((m) => JSON.parse(m[1])); const error = events.find((e) => e.type === "error"); if (!error || !/not a confirmed object/.test(error.message)) process.exit(1);' \
    "$DIRECTORY_TEST/refuse.sse" || fail 'the compile endpoint accepted an unconfirmed fact type'

kill "$SERVER_PID" 2>/dev/null || true
trap - EXIT

test_output_cleanup "$DIRECTORY_TEST"
echo '28-studio-build: ok'
exit 0
