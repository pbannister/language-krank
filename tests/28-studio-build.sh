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

PORT=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')
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

kill "$SERVER_PID" 2>/dev/null || true
trap - EXIT

test_output_cleanup "$DIRECTORY_TEST"
echo '28-studio-build: ok'
exit 0
