#!/usr/bin/env bash
# Freeze the plugin under test, then build the six scenario fixtures from the
# frozen bytes.
#
# Run 1 of the stress test was partly void: the plugin changed underneath it
# while the agents were reading it, so several findings were measured against
# text that no longer existed. This is the control that closed that, and it is
# the first thing to run — before any executor is launched.
#
#   bash freeze-plugin.sh           freeze, lock, hash, build the six fixtures
#   bash freeze-plugin.sh verify    re-hash the frozen tree, compare, exit 1 on drift
#   bash freeze-plugin.sh unlock    make the frozen tree deletable again
#
# Set before running:
#   RUN   a scratch directory OUTSIDE this repository. Everything is created
#         under it and nothing is written anywhere else.
#   LIVE  the checkout to freeze. Defaults to this repository.
#
# Run with Git Bash. Requires node, git, tar.
set -euo pipefail

ACTION="${1:-freeze}"
RIG="$(cd "$(dirname "$0")" && pwd)"
LIVE="${LIVE:-$(cd "$RIG/../../../.." && pwd)}"
RUN="${RUN:-$(mktemp -d)/run}"

FROZEN="$RUN/frozen"     # read-only, hashed. The CLAUDE_PLUGIN_ROOT agents read.
SRCW="$RUN/src"          # writable twin, fixture source only.
ST="$RUN/stress"         # the six scenario repositories.
BEFORE="$RUN/frozen-before.sha"

# ---- verify: the same digest, taken again ----------------------------------
if [ "$ACTION" = "verify" ]; then
  [ -f "$BEFORE" ] || { echo "no opening digest at $BEFORE — was freeze run?"; exit 1; }
  after="$(bash "$RIG/hash-tree.sh" "$FROZEN")"
  before="$(cat "$BEFORE")"
  echo "before: $before"
  echo "after:  $after"
  if [ "$before" = "$after" ]; then echo "FROZEN: the tree did not move during the run"; exit 0; fi
  echo "DRIFT: the plugin changed under the run — its findings do not stand"; exit 1
fi

# ---- unlock: read-only files cannot be deleted ------------------------------
if [ "$ACTION" = "unlock" ]; then
  chmod -R u+w "$FROZEN" 2>/dev/null || true
  echo "unlocked $FROZEN — safe to rm -rf $RUN"; exit 0
fi

[ "$ACTION" = "freeze" ] || { echo "usage: freeze-plugin.sh [freeze|verify|unlock]"; exit 64; }

chmod -R u+w "$FROZEN" 2>/dev/null || true
rm -rf "$FROZEN" "$SRCW" "$ST"
mkdir -p "$FROZEN" "$SRCW" "$ST"

# One tar stream into FROZEN, then a plain copy for the twin, so the two copies
# are byte-identical by construction. GNU tar reads "C:/..." as a remote host,
# so the -f form is avoided entirely and the stream is piped. rsync is not
# installed in Git Bash here; tar is what the rig already uses.
(cd "$LIVE" && tar --exclude='./.git' --exclude='./assets' --exclude='./node_modules' --exclude='.canary' -cf - .) \
  | (cd "$FROZEN" && tar -xf -)
cp -r "$FROZEN/." "$SRCW/"

# Hash the frozen tree BEFORE locking it, so the opening digest describes the
# bytes the agents will read rather than the bytes plus a permission change.
bash "$RIG/hash-tree.sh" "$FROZEN" > "$BEFORE"
echo "frozen tree: $(cat "$BEFORE")"

# Lock every instruction file and script the agents will read.
find "$FROZEN/plugins" -type f \( -name '*.md' -o -name '*.js' -o -name '*.json' \) -exec chmod a-w {} +
chmod a-w "$FROZEN"/*.md 2>/dev/null || true
locked=$(find "$FROZEN/plugins" -type f ! -writable | wc -l | tr -d ' ')
echo "locked read-only under plugins/: $locked files"
[ "$locked" -gt 0 ] || { echo "FREEZE FAILED: chmod a-w locked nothing"; exit 1; }

# Prove the lock rather than assume it, against both a shell redirect and a Node
# write — the two ways anything in this rig actually writes a file.
probe="$FROZEN/plugins/toque/skills/plan/stages/stage-2-design.md"
[ -f "$probe" ] || { echo "FREEZE FAILED: probe file missing at $probe"; exit 1; }
if (echo x >> "$probe") 2>/dev/null; then echo "FREEZE FAILED: shell append succeeded"; exit 1; fi
if node -e "require('fs').appendFileSync(process.argv[1],'x')" "$probe" 2>/dev/null; then
  echo "FREEZE FAILED: node append succeeded"; exit 1
fi
echo "lock verified: shell and node writes both refused on the gate stage file"

# Build the six fixtures from the writable twin, using the twin's copy of the
# builder — the rig is frozen along with the plugin, so editing this repository
# mid-run cannot change what the fixtures are.
ST="$ST" SRC="$SRCW" bash "$SRCW/docs/plans/2026-09-04-methodology-conformance/stress-rig/build-fixtures.sh"

echo ""
echo "PLUGIN (frozen, read-only): $FROZEN/plugins/toque"
echo "scenarios:                  $ST/s1 .. $ST/s6"
echo "opening digest:             $BEFORE"
echo ""
echo "After the run:  RUN=$RUN bash $RIG/freeze-plugin.sh verify"
