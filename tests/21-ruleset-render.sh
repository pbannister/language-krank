#!/bin/sh
#
# 21-ruleset-render.sh — run the node:test cases for sources/ruleset-render.mjs.
# Tier: tool-gated (node). The JavaScript body is tests/21-ruleset-render.test.mjs.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

skip_unless_tool node
node --test "$DIRECTORY_SCRIPT/21-ruleset-render.test.mjs"
