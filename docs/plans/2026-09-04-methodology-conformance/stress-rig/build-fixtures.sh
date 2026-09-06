#!/usr/bin/env bash
# Build isolated scratch repositories for the quick-plan / quick-audit stress test.
#
# Set two variables before running:
#   ST  a scratch directory OUTSIDE this repository; the six scenario repos are
#       created as $ST/s1 .. $ST/s6 and nothing is written anywhere else.
#   SRC a checkout of this repository (scenarios s2, s3 and s5 audit a copy of it).
# Run with Git Bash. Requires node, git, tar.
set -euo pipefail
ST="${ST:-$(mktemp -d)/stress}"
SRC="${SRC:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
mkdir -p "$ST"
RIG="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="$SRC/plugins/toque"
PLAN="docs/plans/2026-09-03-plan-centerpiece-alignment"
rm -rf "$ST/s1" "$ST/s2" "$ST/s3" "$ST/s4" "$ST/s5" "$ST/s6" "$ST/base-small" "$ST/base-toque"

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
async function render(report) { return `<h1>${report.title}</h1>`; }
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
(cd "$SRC" && tar --exclude='./.git' --exclude='./assets' --exclude='./node_modules' --exclude='./docs/plans/2026-07-20-plugin-hardening-v5' -cf - .) | (cd "$ST/base-toque" && tar -xf -)
for s in s2 s3 s5; do cp -r "$ST/base-toque" "$ST/$s"; done

# s3: a standalone template-shaped spec beside which quick-audit must write its gate folder
mkdir -p "$ST/s3/docs/specs"; cp "$RIG/fixture-template-spec.md" "$ST/s3/docs/specs/pricing-engine.md"

for s in s2 s3 s5; do gitinit "$ST/$s"; mkdir -p "$ST/$s/.stress-baseline"; sha "$ST/$s/$PLAN/audit.md" > "$ST/$s/.stress-baseline/plan-audit.sha"; sha "$ST/$s/$PLAN/spec.md" > "$ST/$s/.stress-baseline/plan-spec.sha"; ls "$ST/$s/$PLAN/evidence" | wc -l | tr -d ' ' > "$ST/$s/.stress-baseline/plan-evidence-count"; done
mkdir -p "$ST/s4/.stress-baseline"; sha "$ST/s4/docs/adr/ADR-reporting-pipeline.md" > "$ST/s4/.stress-baseline/doc.sha"
sha "$ST/s3/docs/specs/pricing-engine.md" > "$ST/s3/.stress-baseline/doc.sha"

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

set +e
s4out="$(node "$PLUGIN/scripts/tq-canary.js" inject "$ST/s4/docs/adr/ADR-reporting-pipeline.md" "$ST/cdry/" 2>&1)"; s4rc=$?
set -e
rm -rf "$ST/cdry"
echo "s4: ${s4out%%$'\n'*}"
echo "s4 inject exit=$s4rc (expected 2: no class applies)"
[ "$s4rc" -eq 2 ] || { echo "FIXTURE CHECK FAILED: s4 must have no applicable canary class"; exit 1; }

for s in s1 s2 s3 s4 s5 s6; do printf '%s: %s files, HEAD %s\n' "$s" "$(cd "$ST/$s" && git ls-files | wc -l | tr -d ' ')" "$(cd "$ST/$s" && git rev-parse --short HEAD)"; done
