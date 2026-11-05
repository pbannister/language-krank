#!/bin/sh
#
# studio-build.sh: assemble the local prompt studio.
#
# The studio is a local tool, not a published page. It reads the compile catalog
# (scripts/site-catalog.mjs) and the file facts (scripts/site-facts.mjs), both
# generated from the repository, so it cannot be served from sources/ alone.
# This script writes a self-contained tree, and studio-serve.mjs serves it on
# 127.0.0.1.
#
# Usage: sh scripts/studio-build.sh [output-directory]
# The default output is dataflow.out/studio, which is generated and not versioned.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$DIRECTORY_SCRIPT/.." && pwd)
DIRECTORY_OUTPUT=${1:-"$REPOSITORY_ROOT/dataflow.out/studio"}
DIRECTORY_BROWSER="$DIRECTORY_OUTPUT/browser"

fail() {
    echo "studio-build: $1" >&2
    exit 1
}

case "$DIRECTORY_OUTPUT" in
    /|"") fail "refusing to clear $DIRECTORY_OUTPUT" ;;
esac

rm -rf "$DIRECTORY_OUTPUT"
mkdir -p "$DIRECTORY_BROWSER"

# The local tree mirrors the published layout: the page and its modules under
# browser/, the library modules at the root, so ../krank.mjs resolves.
sed '/HOMELAB-NAV/d' "$REPOSITORY_ROOT/sources/browser/index.html" > "$DIRECTORY_BROWSER/index.html"
sed '/HOMELAB-NAV/d' "$REPOSITORY_ROOT/sources/browser/playground.html" > "$DIRECTORY_BROWSER/playground.html"

for file_asset in studio.mjs prompt-diff.mjs demo.mjs sample.json; do
    cp "$REPOSITORY_ROOT/sources/browser/$file_asset" "$DIRECTORY_BROWSER/"
done

node "$REPOSITORY_ROOT/scripts/site-catalog.mjs" > "$DIRECTORY_BROWSER/catalog.json" \
    || fail 'the catalog builder failed'
node "$REPOSITORY_ROOT/scripts/site-facts.mjs" > "$DIRECTORY_BROWSER/files.json" \
    || fail 'the facts builder failed'

for file_library in krank.mjs ruleset-run.mjs ruleset-render.mjs; do
    cp "$REPOSITORY_ROOT/sources/$file_library" "$DIRECTORY_OUTPUT/"
done

echo "studio-build: wrote $DIRECTORY_OUTPUT"
