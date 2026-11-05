#!/bin/sh
#
# tests-run.sh: run every test in tests/ in order and report a summary.
# Invoked by `npm test`, which the top-level Makefile calls via `make test`.
#
# Every test runs even when an earlier one fails, so one failure cannot mask
# the others; the runner exits nonzero when any test failed.
#
# Every run mirrors its transcript into a timestamped log file:
#   logs/YYYY-MM-DD-HH-MM-SS-test-run.log
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$DIRECTORY_SCRIPT/.." && pwd)

mkdir -p "$REPOSITORY_ROOT/logs"
TIMESTAMP_RUN=$(date +%Y-%m-%d-%H-%M-%S)
FILE_LOG="$REPOSITORY_ROOT/logs/$TIMESTAMP_RUN-test-run.log"
echo "tests-run: log: $FILE_LOG" | tee -a "$FILE_LOG"

status_run=0
for file_test in "$REPOSITORY_ROOT"/tests/*.sh; do
    name_test=$(basename "$file_test")
    echo "=== $name_test" | tee -a "$FILE_LOG"
    if output_test=$(sh "$file_test" 2>&1); then
        status_test=0
    else
        status_test=$?
    fi
    if [ -n "$output_test" ]; then
        printf '%s\n' "$output_test" | tee -a "$FILE_LOG"
    fi
    if [ "$status_test" -eq 0 ]; then
        echo "PASS $name_test" | tee -a "$FILE_LOG"
        # A passing test removes its working directory (prompts/01-contract.md section 7).
        name_stem=$(basename "$file_test" .sh)
        if [ -e "$REPOSITORY_ROOT/tests.out/$name_stem" ]; then
            echo "tests-run: $name_test passed but left tests.out/$name_stem" | tee -a "$FILE_LOG" >&2
            status_run=1
        fi
    else
        echo "FAIL $name_test" | tee -a "$FILE_LOG"
        status_run=1
    fi
done

# Working directories: tests.out/ may hold only one subdirectory per test, named
# after that test (prompts/01-contract.md section 7). Anything else is a test
# that wrote outside its own directory, or a stale one left by a renamed test.
for entry_output in "$REPOSITORY_ROOT"/tests.out/*/; do
    [ -d "$entry_output" ] || continue
    name_output=$(basename "$entry_output")
    if [ ! -f "$REPOSITORY_ROOT/tests/$name_output.sh" ]; then
        echo "tests-run: tests.out/$name_output has no test tests/$name_output.sh" | tee -a "$FILE_LOG" >&2
        status_run=1
    fi
done

if [ "$status_run" -ne 0 ]; then
    echo 'tests-run: FAILED' | tee -a "$FILE_LOG" >&2
    exit 1
fi

echo 'tests-run: all tests passed' | tee -a "$FILE_LOG"
exit 0
