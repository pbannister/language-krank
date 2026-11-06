#!/bin/sh
#
# 30-object-model.sh — run the node:test cases for dataflow.in/object-model.json.
# Tier: tool-gated (node). The JavaScript body is tests/30-object-model.test.mjs.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

skip_unless_tool node
node --test "$DIRECTORY_SCRIPT/30-object-model.test.mjs"
