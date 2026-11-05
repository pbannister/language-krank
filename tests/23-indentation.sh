#!/bin/sh
#
# 23-indentation.sh — assert the project's 4-space, tab-free indentation in its
# JavaScript and JSON (prompts/03-conventions.md section 1).
# Tier: portable.
#
# A multi-line template literal whose content is intentionally indented would
# trip the multiple-of-4 check. Keep such content at column 0, or move it to a
# file this check does not cover.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$DIRECTORY_SCRIPT/.." && pwd)

fail() {
    echo "23-indentation: $1" >&2
    exit 1
}

for file_check in "$REPOSITORY_ROOT"/sources/*.mjs \
                  "$REPOSITORY_ROOT"/sources/*/*.mjs \
                  "$REPOSITORY_ROOT"/tests/*.mjs \
                  "$REPOSITORY_ROOT"/package.json; do
    [ -f "$file_check" ] || continue
    name_check=$(basename "$file_check")
    if grep -q "$(printf '\t')" "$file_check"; then
        fail "tab character in $name_check"
    fi
    if ! awk 'match($0, /^ */) && RLENGTH % 4 != 0 { exit 1 }' "$file_check"; then
        fail "indentation is not a multiple of 4 in $name_check"
    fi
done

echo '23-indentation: ok'
exit 0
