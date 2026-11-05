#!/bin/sh
#
# 20-engine.sh — run the node:test cases for sources/engine.mjs.
# Tier: tool-gated (node). The JavaScript body is tests/20-engine.test.mjs.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

skip_unless_tool node
node --test "$DIRECTORY_SCRIPT/20-engine.test.mjs"
