#!/bin/sh
#
# release-publish.sh: tag the current commit, push it, and publish to npm.
#
# Usage: sh scripts/release-publish.sh [--dry-run]
#
# The version in package.json is the npm contract, so the tag is `v<version>`.
# That is an explicit tag, allowed to override the `v<date>-<branch>` default in
# prompts/capabilities/04-release-and-publishing.md.
#
# The script is unattended and fails closed. It refuses to run when:
#   * the working tree has uncommitted changes;
#   * HEAD is not on a branch;
#   * there is no `origin` remote;
#   * the tag exists locally or on origin;
#   * the version is already published on npm;
#   * npm is not authenticated;
#   * the test suite fails.
#
# --dry-run runs the same guards and prints the plan without tagging, pushing,
# or publishing. The steps are ordered so a failure leaves the tag local and
# easy to delete, rather than a published version with no tag.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$DIRECTORY_SCRIPT/.." && pwd)

dry_run=0
while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run)
            dry_run=1
            ;;
        -h|--help)
            echo 'usage: sh scripts/release-publish.sh [--dry-run]' >&2
            exit 2
            ;;
        *)
            echo "release-publish: unknown argument: $1" >&2
            echo 'usage: sh scripts/release-publish.sh [--dry-run]' >&2
            exit 2
            ;;
    esac
    shift
done

fail() {
    echo "release-publish: $1" >&2
    echo 'release-publish: NOT PUBLISHED' >&2
    exit 1
}

command -v node >/dev/null 2>&1 || fail 'node is required to read package.json'
command -v npm >/dev/null 2>&1 || fail 'npm is required to publish'
command -v git >/dev/null 2>&1 || fail 'git is required to tag and push'

cd "$REPOSITORY_ROOT"

manifest=$(node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(data.name + " " + data.version);' package.json)
name_package=${manifest%% *}
version_package=${manifest#* }
[ -n "$name_package" ] || fail 'package.json has no name'
[ -n "$version_package" ] || fail 'package.json has no version'
tag_package="v$version_package"

if [ -n "$(git status --porcelain)" ]; then
    fail 'the working tree is not clean; commit or stash the changes first'
fi

branch_current=$(git symbolic-ref --short -q HEAD) || fail 'HEAD is not on a branch'
git remote get-url origin >/dev/null 2>&1 || fail 'there is no "origin" remote to push to'

if git rev-parse -q --verify "refs/tags/$tag_package" >/dev/null; then
    fail "the tag $tag_package already exists locally"
fi
if git ls-remote --tags --exit-code origin "refs/tags/$tag_package" >/dev/null 2>&1; then
    fail "the tag $tag_package already exists on origin"
fi

if npm view "$name_package@$version_package" version >/dev/null 2>&1; then
    fail "$name_package@$version_package is already published"
fi
if ! npm whoami >/dev/null 2>&1; then
    fail 'npm is not authenticated; run npm login, or set NODE_AUTH_TOKEN'
fi

if [ "$dry_run" -eq 1 ]; then
    echo 'release-publish: dry run'
    echo "release-publish: would tag $tag_package on $branch_current"
    echo "release-publish: would push $branch_current and $tag_package to origin"
    echo "release-publish: would publish $name_package@$version_package"
    exit 0
fi

sh "$REPOSITORY_ROOT/scripts/tests-run.sh" \
    || fail 'the test suite failed; nothing was tagged or published'

git tag -a "$tag_package" -m "$name_package $version_package" \
    || fail "could not create the tag $tag_package"

git push origin "HEAD:$branch_current" \
    || fail "the tag $tag_package is local but $branch_current was not pushed; delete it with: git tag -d $tag_package"

if ! git push origin "refs/tags/$tag_package"; then
    echo "release-publish: the tag $tag_package was not pushed" >&2
    fail "delete it with: git tag -d $tag_package"
fi

if ! npm publish --access public; then
    echo "release-publish: $name_package@$version_package is tagged but not published" >&2
    echo "release-publish: to retry, remove the tag: git tag -d $tag_package && git push origin :refs/tags/$tag_package" >&2
    fail 'npm publish failed'
fi

echo "release-publish: published $name_package@$version_package (tag $tag_package)"
