#!/bin/sh
#
# 24-publish.sh — exercise scripts/release-publish.sh hermetically: the happy
# path (test, tag, push, publish) and each refusal, with a fake npm and a local
# bare origin. Tier: tool-gated (git, node).
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$DIRECTORY_SCRIPT/.." && pwd)
. "$DIRECTORY_SCRIPT/lib/test_helpers.sh"

skip_unless_tool git
skip_unless_tool node

fail() {
    echo "24-publish: $1" >&2
    exit 1
}

DIRECTORY_TEST=$(test_output_directory)

write_fake_npm() {
    directory_bin=$1
    mkdir -p "$directory_bin"
    cat > "$directory_bin/npm" <<'NPM'
#!/bin/sh
printf '%s\n' "$*" >> "$FAKE_NPM_CALLS"
case "$1" in
    view)
        if [ "${FAKE_NPM_PUBLISHED:-0}" = "1" ]; then
            echo "1.2.3"
            exit 0
        fi
        exit 1
        ;;
    whoami)
        exit "${FAKE_NPM_AUTH_RC:-0}"
        ;;
    publish)
        exit "${FAKE_NPM_PUBLISH_RC:-0}"
        ;;
    *)
        exit 0
        ;;
esac
NPM
    chmod +x "$directory_bin/npm"
}

make_fixture() {
    directory_fixture=$1
    tests_rc=${2:-0}
    mkdir -p "$directory_fixture"
    git init -q --bare "$directory_fixture/origin.git"
    git init -q "$directory_fixture/project"
    (
        cd "$directory_fixture/project"
        git config user.email test@example.com
        git config user.name Test
        git remote add origin "$directory_fixture/origin.git"
        mkdir -p scripts
        cp "$REPOSITORY_ROOT/scripts/release-publish.sh" scripts/release-publish.sh
        printf '%s\n' '#!/bin/sh' 'echo ran >> "${FAKE_TESTS_LOG:-/dev/null}"' "exit $tests_rc" > scripts/tests-run.sh
        chmod +x scripts/tests-run.sh
        cat > package.json <<'JSON'
{
    "name": "@test/krank",
    "version": "1.2.3"
}
JSON
        git add -A
        git commit -q -m initial
    )
}

run_publish() {
    directory_fixture=$1
    shift
    ( cd "$directory_fixture/project" && sh scripts/release-publish.sh "$@" )
}

has_tag() {
    git -C "$1" rev-parse -q --verify refs/tags/v1.2.3 >/dev/null 2>&1
}

write_fake_npm "$DIRECTORY_TEST/bin"
PATH="$DIRECTORY_TEST/bin:$PATH"
export PATH
FAKE_NPM_CALLS="$DIRECTORY_TEST/npm-calls.log"
export FAKE_NPM_CALLS
: > "$FAKE_NPM_CALLS"

# 1. Happy path: the suite runs, the tag is created and pushed, npm publishes.
make_fixture "$DIRECTORY_TEST/happy"
FAKE_TESTS_LOG="$DIRECTORY_TEST/happy/tests.log"
export FAKE_TESTS_LOG
run_publish "$DIRECTORY_TEST/happy" || fail 'the happy path failed'
has_tag "$DIRECTORY_TEST/happy/project" || fail 'the tag was not created'
has_tag "$DIRECTORY_TEST/happy/origin.git" || fail 'the tag was not pushed'
grep -q 'publish --access public' "$FAKE_NPM_CALLS" || fail 'npm publish was not called with --access public'
grep -q 'ran' "$FAKE_TESTS_LOG" || fail 'the test suite did not run before tagging'

# 2. A dirty working tree is refused, and creates no tag.
make_fixture "$DIRECTORY_TEST/dirty"
printf 'dirty\n' > "$DIRECTORY_TEST/dirty/project/dirty.txt"
if run_publish "$DIRECTORY_TEST/dirty"; then
    fail 'a dirty working tree was accepted'
fi
has_tag "$DIRECTORY_TEST/dirty/project" && fail 'a tag was created for a dirty tree'

# 3. An existing tag is refused.
make_fixture "$DIRECTORY_TEST/tagged"
git -C "$DIRECTORY_TEST/tagged/project" tag -a v1.2.3 -m existing
if run_publish "$DIRECTORY_TEST/tagged"; then
    fail 'an existing tag was accepted'
fi

# 4. An already-published version is refused.
make_fixture "$DIRECTORY_TEST/published"
FAKE_NPM_PUBLISHED=1
export FAKE_NPM_PUBLISHED
if run_publish "$DIRECTORY_TEST/published"; then
    fail 'an already-published version was accepted'
fi
unset FAKE_NPM_PUBLISHED

# 5. A failing test suite is refused, and creates no tag.
make_fixture "$DIRECTORY_TEST/failing" 1
if run_publish "$DIRECTORY_TEST/failing"; then
    fail 'a failing test suite was accepted'
fi
has_tag "$DIRECTORY_TEST/failing/project" && fail 'a tag was created despite a failing suite'

# 6. A dry run changes nothing.
make_fixture "$DIRECTORY_TEST/dryrun"
run_publish "$DIRECTORY_TEST/dryrun" --dry-run || fail 'the dry run failed'
has_tag "$DIRECTORY_TEST/dryrun/project" && fail 'the dry run created a tag'

test_output_cleanup "$DIRECTORY_TEST"
echo '24-publish: ok'
exit 0
