#!/usr/bin/env bash
# Build isolated scratch repositories for the quick-plan / quick-audit stress test.
#
# Set two variables before running:
#   ST  a scratch directory OUTSIDE this repository; the scenario repos are
#       created as $ST/s1 .. $ST/s6 and $ST/s8 (run 4) and nothing is written
#       anywhere else.
#   SRC a checkout of this repository (scenarios s2 and s5 audit a copy of it;
#       s1, s3, s4 and s6 use the small invented Node project below).
# Run with Git Bash. Requires node, git, tar.
set -euo pipefail
ST="${ST:-$(mktemp -d)/stress}"
SRC="${SRC:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
mkdir -p "$ST"
RIG="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="$SRC/plugins/toque"
PLAN="docs/plans/2026-09-03-plan-centerpiece-alignment"
rm -rf "$ST/s1" "$ST/s2" "$ST/s3" "$ST/s4" "$ST/s5" "$ST/s6" "$ST/s8" "$ST/base-small" "$ST/base-toque"

sha() { node -e "const f=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1],'utf8').replace(/\r\n/g,'\n')).digest('hex'))" "$1"; }
gitinit() { (cd "$1" && git init -q && git config core.longpaths true && git add -A 2>/dev/null && git -c user.name=stress -c user.email=stress@example.invalid commit -qm "fixture" && printf '.stress-baseline/\n' >> .git/info/exclude); }

# ---- small fake project -----------------------------------------------------
mkdir -p "$ST/base-small/src" "$ST/base-small/tests" "$ST/base-small/docs"
cat > "$ST/base-small/package.json" <<'EOF'
{ "name": "reportly", "version": "0.4.2", "private": true,
  "scripts": { "test": "node --test tests/" },
  "dependencies": { "express": "^4.19.2", "pg": "^8.11.3", "node-cron": "^3.0.3" } }
EOF
cat > "$ST/base-small/src/server.js" <<'EOF'
const express = require('express');
const { requireUser } = require('./auth');
const reports = require('./reports');
const app = express();
app.use(express.json());
app.get('/api/reports', requireUser, async (req, res) => {
  const rows = await reports.listForAccount(req.user.accountId);
  res.json(rows);
});
app.post('/api/reports/:id/send', requireUser, async (req, res) => {
  // Permission is checked here, at request time, by requireUser + canView.
  const report = await reports.get(req.params.id);
  if (!reports.canView(req.user, report)) return res.status(403).end();
  await reports.send(report, req.user.email);
  res.status(202).end();
});
module.exports = app;
if (require.main === module) app.listen(process.env.PORT || 3000);
EOF
cat > "$ST/base-small/src/reports.js" <<'EOF'
const db = require('./db');
async function listForAccount(accountId) {
  return db.query('select id, title, owner_id, account_id from reports where account_id = $1', [accountId]);
}
async function get(id) { return (await db.query('select * from reports where id = $1', [id]))[0]; }
function canView(user, report) {
  if (!report) return false;
  if (user.role === 'admin') return report.account_id === user.accountId;
  return report.owner_id === user.id || (report.shared_with || []).includes(user.id);
}
async function send(report, email) {
  // Renders and emails a report. Called synchronously from the HTTP handler today.
  const body = await render(report);
  return mailer.send({ to: email, subject: report.title, body });
}
async function render(report) {
  const started = Date.now();
  // Pricing is computed inline here today: seats times unit price, summed over rows.
  const total = (report.rows || []).reduce((sum, r) => sum + (r.seats || 0) * (r.unit_price || 0), 0);
  const html = `<h1>${report.title}</h1><p>Total: ${total}</p>`;
  console.log(`render ${report.id} ${Date.now() - started}ms`); // render timing log
  return html;
}
const mailer = { send: async () => ({ ok: true }) };
module.exports = { listForAccount, get, canView, send, render };
EOF
cat > "$ST/base-small/src/auth.js" <<'EOF'
const sessions = new Map();
function requireUser(req, res, next) {
  const token = req.get('authorization');
  const user = sessions.get(token);
  if (!user) return res.status(401).end();
  req.user = user; // { id, accountId, role, email }
  next();
}
module.exports = { requireUser, sessions };
EOF
cat > "$ST/base-small/src/db.js" <<'EOF'
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
module.exports = { query: async (text, params) => (await pool.query(text, params)).rows };
EOF
cat > "$ST/base-small/tests/reports.test.js" <<'EOF'
const test = require('node:test');
const assert = require('node:assert');
const { canView } = require('../src/reports');
test('owner can view own report', () => {
  assert.equal(canView({ id: 1, accountId: 9, role: 'user' }, { owner_id: 1, account_id: 9 }), true);
});
test('other user cannot view', () => {
  assert.equal(canView({ id: 2, accountId: 9, role: 'user' }, { owner_id: 1, account_id: 9 }), false);
});
EOF
cat > "$ST/base-small/README.md" <<'EOF'
# Reportly

A small reporting API. Users see reports for their account; a report is sent by email on request. Permissions are checked at request time in the HTTP handler.

Run `npm test`.
EOF

cp -r "$ST/base-small" "$ST/s1"; gitinit "$ST/s1"
cp -r "$ST/base-small" "$ST/s6"; gitinit "$ST/s6"

# s3: a standalone template-shaped spec beside which quick-audit must write its
# gate folder. The spec describes this small project (its pricing arithmetic sits
# inline in src/reports.js, its tests run under node --test, its render has a
# timing log), so every path it CLAIMS resolves and an INFRA-GAP or a LINT-15/16
# verdict is about the document, not the binding. Run 3 bound it to a copy of the
# Toque repository and every claimed path was absent for that reason alone
# (stress-run3-critic.md §4b row 7).
cp -r "$ST/base-small" "$ST/s3"; mkdir -p "$ST/s3/docs/specs"
cp "$RIG/fixture-template-spec.md" "$ST/s3/docs/specs/pricing-engine.md"
gitinit "$ST/s3"; mkdir -p "$ST/s3/.stress-baseline"
sha "$ST/s3/docs/specs/pricing-engine.md" > "$ST/s3/.stress-baseline/doc.sha"

# s8 (run 4): quick-audit re-run on a document with a prior gate folder, where
# the second audit flips one element on text the revision did not touch.
# Commit 1 is the s3 spec (v1) plus the gate folder run 3's s3 produced for it,
# with one prior-auditor miss planted: LINT-13 (options analysis) is recorded
# as pass although the Design section evaluates no alternative. Commit 2
# revises Phase 2 and drops its Rollback line. A fresh auditor should fail
# LINT-13 on unchanged text (AUDITOR VARIANCE under D10, not a regression) and
# LINT-03 on changed text (a regression, inside the diff), so LINT-14 is UNMET
# for exactly one reason. The previous document is reachable from git history
# by the baseline's doc_sha256, which is the D10 reconstruction path.
cp -r "$ST/base-small" "$ST/s8"; mkdir -p "$ST/s8/docs/specs/pricing-engine"
cp "$RIG/fixture-template-spec.md" "$ST/s8/docs/specs/pricing-engine.md"
cp "$RIG/fixture-prior-gate/audit.md" "$RIG/fixture-prior-gate/gate.json" "$ST/s8/docs/specs/pricing-engine/"
cp -r "$RIG/fixture-prior-gate/evidence" "$ST/s8/docs/specs/pricing-engine/"
gitinit "$ST/s8"
cp "$RIG/fixture-template-spec-v2.md" "$ST/s8/docs/specs/pricing-engine.md"
(cd "$ST/s8" && git add -A && git -c user.name=stress -c user.email=stress@example.invalid commit -qm "spec: revise Phase 2 to add promotional codes")
mkdir -p "$ST/s8/.stress-baseline"; sha "$ST/s8/docs/specs/pricing-engine.md" > "$ST/s8/.stress-baseline/doc.sha"

# s4: a prose ADR with none of the canary shapes
cp -r "$ST/base-small" "$ST/s4"; mkdir -p "$ST/s4/docs/adr"
cat > "$ST/s4/docs/adr/ADR-reporting-pipeline.md" <<'EOF'
# ADR: Move report delivery to a background pipeline

Status: Proposed. Date: 2026-09-01.

## Context

Report sending runs inside the HTTP request today (`src/server.js`, the send route). Large reports time out the request, and the customer sees an error even when the email later arrives. Product wants scheduled delivery as well, which cannot run inside a request at all.

## Decision

Introduce a queue-backed pipeline. The HTTP route enqueues a job and returns 202; a worker renders and sends. Scheduled reports enqueue the same job from a cron entry. Permissions are evaluated when the job runs, not when it is enqueued, because sharing can change between the two.

## Consequences

The worker is a second process to deploy and monitor. Duplicate sends become possible if a job is retried after the email went out; the worker must record the send before acknowledging the job. The cron schedule needs a time zone decision that the product team has not made.

We will revisit this decision after the first month of production use.
EOF
gitinit "$ST/s4"

# ---- copies of the toque repository (the centerpiece plan is about it) ------
mkdir -p "$ST/base-toque"
(cd "$SRC" && tar --exclude='./.git' --exclude='./assets' --exclude='./node_modules' --exclude='.canary' --exclude='./docs/plans/2026-07-20-plugin-hardening-v5' -cf - .) | (cd "$ST/base-toque" && tar -xf -)
for s in s2 s5; do cp -r "$ST/base-toque" "$ST/$s"; done

for s in s2 s5; do gitinit "$ST/$s"; mkdir -p "$ST/$s/.stress-baseline"; sha "$ST/$s/$PLAN/audit.md" > "$ST/$s/.stress-baseline/plan-audit.sha"; sha "$ST/$s/$PLAN/spec.md" > "$ST/$s/.stress-baseline/plan-spec.sha"; ls "$ST/$s/$PLAN/evidence" | wc -l | tr -d ' ' > "$ST/$s/.stress-baseline/plan-evidence-count"; done
mkdir -p "$ST/s4/.stress-baseline"; sha "$ST/s4/docs/adr/ADR-reporting-pipeline.md" > "$ST/s4/.stress-baseline/doc.sha"

# Sanity: canary applicability. Both fixtures are asserted, not just printed —
# s3 exists to carry an applicable class and s4 exists to carry none, and a
# fixture that has quietly stopped doing its job would otherwise be discovered
# halfway through a run. `head -1` is avoided here: it closes the pipe, and
# under `pipefail` the resulting EPIPE aborts the script.
echo "--- canary applicability"
set +e
s3out="$(node "$PLUGIN/scripts/tq-canary.js" inject "$ST/s3/docs/specs/pricing-engine.md" "$ST/cdry/" 2>&1)"; s3rc=$?
set -e
rm -rf "$ST/cdry"
s3first="${s3out%%$'\n'*}"
echo "s3: $s3first"
echo "s3 inject exit=$s3rc (expected 0: a class applies)"
[ "$s3rc" -eq 0 ] || { echo "FIXTURE CHECK FAILED: s3 inject exited $s3rc, expected 0"; exit 1; }
case "$s3first" in *"-> LINT-"*) ;; *) echo "FIXTURE CHECK FAILED: s3 must have an applicable canary class"; exit 1 ;; esac

# s3's spec CLAIMS these exist in the bound tree. If one is missing, an INFRA-GAP
# or a LINT-15/16 UNMET is about the fixture, not the document, and the scenario
# stops measuring what it exists to measure.
for p in src/reports.js tests/reports.test.js package.json; do
  [ -f "$ST/s3/$p" ] || { echo "FIXTURE CHECK FAILED: s3 spec claims $p, absent from s3"; exit 1; }
done
grep -q 'render timing log' "$ST/s3/src/reports.js" || { echo "FIXTURE CHECK FAILED: s3 spec claims a render timing log, absent from src/reports.js"; exit 1; }
grep -q '"test": "node --test' "$ST/s3/package.json" || { echo "FIXTURE CHECK FAILED: s3 spec claims node --test conventions, absent from package.json"; exit 1; }
echo "s3: claimed paths, timing log and test script present"

# s8's three fixture properties, asserted: the baseline's doc_sha256 names the
# v1 spec that sits in git history; v2 differs from v1 only inside the Phase 2
# block; and the planted prior miss is on disk as pass.
v1sha="$(sha "$RIG/fixture-template-spec.md")"
basesha="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).baseline.doc_sha256)" "$ST/s8/docs/specs/pricing-engine/gate.json")"
[ "$v1sha" = "$basesha" ] || { echo "FIXTURE CHECK FAILED: s8 baseline doc_sha256 $basesha != v1 spec $v1sha"; exit 1; }
(cd "$ST/s8" && git show "HEAD~1:docs/specs/pricing-engine.md" > "$ST/s8-v1.tmp")
[ "$(sha "$ST/s8-v1.tmp")" = "$v1sha" ] || { echo "FIXTURE CHECK FAILED: s8 HEAD~1 does not hold the v1 spec"; exit 1; }
rm -f "$ST/s8-v1.tmp"
changed="$(diff "$RIG/fixture-template-spec.md" "$RIG/fixture-template-spec-v2.md" | grep -c '^[<>]' || true)"
[ "$changed" -eq 7 ] || { echo "FIXTURE CHECK FAILED: s8 v1->v2 diff touches $changed lines, expected 7 (the Phase 2 block: 4 removed, 3 added)"; exit 1; }
grep -q 'Rollback: feature flag' "$RIG/fixture-template-spec.md" || { echo "FIXTURE CHECK FAILED: v1 has no Phase 2 rollback line to drop"; exit 1; }
! grep -q 'Rollback: feature flag' "$RIG/fixture-template-spec-v2.md" || { echo "FIXTURE CHECK FAILED: v2 still carries the Phase 2 rollback line"; exit 1; }
[ "$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).baseline.lint_results['LINT-13'])" "$ST/s8/docs/specs/pricing-engine/gate.json")" = "pass" ] || { echo "FIXTURE CHECK FAILED: s8 prior gate does not record LINT-13 pass"; exit 1; }
echo "s8: baseline sha names v1 in git history, v2 changes Phase 2 only, LINT-13 prior miss planted"

set +e
s4out="$(node "$PLUGIN/scripts/tq-canary.js" inject "$ST/s4/docs/adr/ADR-reporting-pipeline.md" "$ST/cdry/" 2>&1)"; s4rc=$?
set -e
rm -rf "$ST/cdry"
echo "s4: ${s4out%%$'\n'*}"
echo "s4 inject exit=$s4rc (expected 2: no class applies)"
[ "$s4rc" -eq 2 ] || { echo "FIXTURE CHECK FAILED: s4 must have no applicable canary class"; exit 1; }

for s in s1 s2 s3 s4 s5 s6 s8; do printf '%s: %s files, HEAD %s\n' "$s" "$(cd "$ST/$s" && git ls-files | wc -l | tr -d ' ')" "$(cd "$ST/$s" && git rev-parse --short HEAD)"; done
