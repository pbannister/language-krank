#!/bin/sh
#
# project_helpers.sh: project-owned helpers for the tests in tests/.
#
# Sourced by tests/lib/test_helpers.sh when present; never executed. Not vendored,
# so a change here survives a rules upgrade.
#
# Working files for a test go under tests.out/, never under /tmp, and each test
# owns exactly one subdirectory of it, named after the test. See
# prompts/01-contract.md section 7.

# test_output_directory: print the working directory for the calling test,
# creating it empty. The name is the calling test's file name without ".sh", so a
# test cannot write into another test's directory. A previous run's contents are
# removed first, so no state leaks from an earlier failure.
test_output_directory() {
    directory_repository=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
    name_test=$(basename -- "$0" .sh)
    directory_test="$directory_repository/tests.out/$name_test"
    rm -rf "$directory_test"
    mkdir -p "$directory_test"
    printf '%s\n' "$directory_test"
}

# test_output_cleanup DIRECTORY: remove a test's working directory after a pass.
# Call it only on success, so a failure leaves its files for inspection.
test_output_cleanup() {
    rm -rf "$1"
}
