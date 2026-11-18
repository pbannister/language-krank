#!/bin/sh
# 34-answer-hygiene.sh — generated answer fixtures belong under dataflow.out/.
#
# These files are scratch work products, not project source. The builders write
# to dataflow.out/answers/; this guard catches an accidental copy left at the
# repository root.
# Tier: portable.
set -eu

REPOSITORY_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
found=0
for path in "$REPOSITORY_ROOT"/answer*.json "$REPOSITORY_ROOT"/build_answer*.py; do
    [ -e "$path" ] || continue
    echo "34-answer-hygiene: generated scratch file in project root: $(basename "$path")" >&2
    found=1
done
if [ "$found" -ne 0 ]; then
    echo '34-answer-hygiene: move it under dataflow.out/answers/' >&2
    exit 1
fi

echo '34-answer-hygiene: ok'
exit 0
