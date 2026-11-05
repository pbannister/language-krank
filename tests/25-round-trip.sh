#!/bin/sh
#
# 25-round-trip.sh — run the node:test cases for the round-trip fixture.
# Tier: tool-gated (node). The JavaScript body is tests/25-round-trip.test.mjs.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

skip_unless_tool node
node --test "$DIRECTORY_SCRIPT/25-round-trip.test.mjs"
