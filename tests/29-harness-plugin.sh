#!/bin/sh
#
# 29-harness-plugin.sh — assert the Harness client plugin package is well formed.
# It does not load the plugin in a browser; it checks the manifest, the bundle
# patch, and the client bundle's registration.
# Tier: portable.
set -eu

DIRECTORY_SCRIPT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$DIRECTORY_SCRIPT/.." && pwd)
DIRECTORY_PLUGIN="$REPOSITORY_ROOT/sources/harness/krank-studio"

fail() {
    echo "29-harness-plugin: $1" >&2
    exit 1
}

for file_expected in package.json cordis.patch.yml lib/index.js lib/client.js README.md; do
    [ -f "$DIRECTORY_PLUGIN/$file_expected" ] || fail "missing $file_expected"
done

node --check "$DIRECTORY_PLUGIN/lib/client.js" || fail 'client.js does not parse'
node --check "$DIRECTORY_PLUGIN/lib/index.js" || fail 'index.js does not parse'

node -e '
const p = require(process.argv[1]);
if (!p.dsh || !p.dsh.bundle || !Array.isArray(p.dsh.bundle.patch)) process.exit(1);
if (!p.dsh.client || !Array.isArray(p.dsh.client.inject)) process.exit(1);
if (!p.dsh.client.inject.includes("@deepseek-ai/dsh-client-ui-conversation")) process.exit(1);
' "$DIRECTORY_PLUGIN/package.json" || fail 'the package manifest is incomplete'

grep -q 'name: dsh-krank-studio' "$DIRECTORY_PLUGIN/cordis.patch.yml" \
    || fail 'the bundle patch does not insert the plugin'
grep -q 'conversation.session.header.actions' "$DIRECTORY_PLUGIN/lib/client.js" \
    || fail 'the client registers no action'
grep -q '127.0.0.1:8090/browser/index.html' "$DIRECTORY_PLUGIN/lib/client.js" \
    || fail 'the client points at no studio URL'

echo '29-harness-plugin: ok'
exit 0
