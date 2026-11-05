#!/bin/sh
#
# 22-package-surface.sh — run the node:test cases for the npm package surface.
# Tier: tool-gated (node). The JavaScript body is tests/22-package-surface.test.mjs.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

skip_unless_tool node
node --test "$DIRECTORY_SCRIPT/22-package-surface.test.mjs"
