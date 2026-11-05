#!/bin/sh
#
# Skeleton sanity test.
# Verifies that every required repository directory and canonical root file
# exists. The directory list is read from prompts/01-contract.md section 7, not
# copied here, so the two cannot drift apart.
set -eu

REPOSITORY_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

# The required list is the run of "- `name/` — purpose" bullets that follows the
# marker comment "<!-- MARKER_DIRECTORIES_REQUIRED ... -->" in section 7 of the
# contract. The run ends at the first line that is not a bullet.
DIRECTORIES_REQUIRED=$(awk '
    /^<!-- MARKER_DIRECTORIES_REQUIRED/ { inside = 1; next }
    inside && /^- `[^`]*\/` — / {
        name = $0
        sub(/^- `/, "", name)
        sub(/\/`.*/, "", name)
        print name
        next
    }
    inside && NF > 0 { exit }
' "$REPOSITORY_ROOT/prompts/01-contract.md")

if [ -z "$DIRECTORIES_REQUIRED" ]; then
    echo "00-skeleton: no required directories found in prompts/01-contract.md section 7" >&2
    exit 1
fi

FILES_REQUIRED='
.gitignore
AGENTS.md
LICENSE
Makefile
package.json
README.md
rules.lock
TODO.md
'

for dir in $DIRECTORIES_REQUIRED; do
    if [ ! -d "$REPOSITORY_ROOT/$dir" ]; then
        echo "00-skeleton: missing required directory: $dir" >&2
        exit 1
    fi
done

for file in $FILES_REQUIRED; do
    if [ ! -f "$REPOSITORY_ROOT/$file" ]; then
        echo "00-skeleton: missing required root file: $file" >&2
        exit 1
    fi
done

echo '00-skeleton: structure ok'
exit 0
