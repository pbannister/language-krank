#!/bin/sh
#
# 31-prompts-build.sh — run the node:test cases for scripts/prompts-build.mjs.
# Tier: tool-gated (node). The JavaScript body is tests/31-prompts-build.test.mjs.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

skip_unless_tool node
DIRECTORY_TEST=$(test_output_directory)
node --test "$DIRECTORY_SCRIPT/31-prompts-build.test.mjs"
test_output_cleanup "$DIRECTORY_TEST"
