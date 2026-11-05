#!/bin/sh
#
# 20-ruleset-run.sh — run the node:test cases for sources/ruleset-run.mjs.
# Tier: tool-gated (node). The JavaScript body is tests/20-ruleset-run.test.mjs.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

skip_unless_tool node
node --test "$DIRECTORY_SCRIPT/20-ruleset-run.test.mjs"
