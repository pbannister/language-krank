#!/bin/sh
#
# demo-serve.sh: serve the browser demo over HTTP.
#
# The demo is a native ES module page that imports sources/krank.mjs directly,
# with no build step. ES modules do not load from file://, so a static server is
# required. Only sources/ is served, so prompts, tests, and records are not
# exposed.
#
# Usage: sh scripts/demo-serve.sh [port]    (default 8080, or $PORT)
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$DIRECTORY_SCRIPT/.." && pwd)

port=${1:-${PORT:-8080}}
case "$port" in
    ''|*[!0-9]*)
        echo "demo-serve: the port must be a number: $port" >&2
        exit 2
        ;;
esac

command -v python3 >/dev/null 2>&1 || {
    echo 'demo-serve: python3 is required to serve the demo' >&2
    exit 1
}

echo "demo-serve: serving http://127.0.0.1:$port/browser/ (press Ctrl-C to stop)"
cd "$REPOSITORY_ROOT/sources"
exec python3 -m http.server "$port" --bind 127.0.0.1
