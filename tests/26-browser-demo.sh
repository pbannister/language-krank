#!/bin/sh
#
# 26-browser-demo.sh — run the node:test cases for the browser demo.
# Tier: tool-gated (node). The JavaScript body is tests/26-browser-demo.test.mjs.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

skip_unless_tool node
node --test "$DIRECTORY_SCRIPT/26-browser-demo.test.mjs"
