#!/bin/sh
#
# 60-compile-review-eval.sh — assert the compile-review eval collector refuses
# live work without authorization and keeps rubric language out of its calls.
# Tier: portable.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$DIRECTORY_SCRIPT/.." && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

fail() {
    echo "60-compile-review-eval: $1" >&2
    exit 1
}

DIRECTORY_TEST=$(test_output_directory)
DIRECTORY_REFUSAL="$DIRECTORY_TEST/refusal"
DIRECTORY_NO_MODEL="$DIRECTORY_TEST/no-model"

set +e
OUTPUT_REFUSAL=$(cd "$REPOSITORY_ROOT" && env -u KRANK_EVAL_LIVE -u KRANK_EVAL_MODEL -u KRANK_EVAL_RUNS \
    node scripts/compile-review-eval.mjs "tests.out/60-compile-review-eval/refusal" 2>&1)
STATUS_REFUSAL=$?
set -e
[ "$STATUS_REFUSAL" -ne 0 ] || fail 'the collector ran without the live opt-in'
printf '%s\n' "$OUTPUT_REFUSAL" | grep -q 'not run' || fail 'the refusal did not say not run'
[ ! -e "$DIRECTORY_REFUSAL" ] || fail 'the refusal wrote an output directory'

set +e
OUTPUT_NO_MODEL=$(cd "$REPOSITORY_ROOT" && env -u KRANK_EVAL_MODEL KRANK_EVAL_LIVE=1 \
    node scripts/compile-review-eval.mjs "tests.out/60-compile-review-eval/no-model" 2>&1)
STATUS_NO_MODEL=$?
set -e
[ "$STATUS_NO_MODEL" -ne 0 ] || fail 'the collector ran without a model label'
[ ! -e "$DIRECTORY_NO_MODEL" ] || fail 'the missing-model refusal wrote an output directory'

if grep -Fq 'evals/08-compile-review.md' "$REPOSITORY_ROOT/scripts/compile-review-eval.mjs"; then
    fail 'the collector reads the evaluation rubric'
fi
for phrase_rubric in \
    'Identification recall' \
    'Supported executable recall' \
    'Explanation fidelity' \
    'Safe reduction'; do
    if grep -Fqi "$phrase_rubric" "$REPOSITORY_ROOT/scripts/compile-review-eval.mjs"; then
        fail "the collector carries rubric language: $phrase_rubric"
    fi
done

test_output_cleanup "$DIRECTORY_TEST"
pass_test '60-compile-review-eval'
