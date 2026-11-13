#!/bin/sh
# Tier: tool-gated (node).
set -eu
DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"
skip_unless_tool node
DIRECTORY_TEST=$(test_output_directory)
node --test "$DIRECTORY_SCRIPT/32-compile-review.test.mjs"
test_output_cleanup "$DIRECTORY_TEST"
