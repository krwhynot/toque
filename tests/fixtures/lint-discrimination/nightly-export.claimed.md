# Nightly Export Pipeline — Specification

- Derived from: intent.md (docs/plans/2026-09-06-nightly-export/intent.md)
- Author: platform agent + human reviewer
- Status: Draft
- Date: 2026-09-06

## Requirements

### Functional

- **FR-001 (P0):** The system must write one export file per account per night — traces to intent.md line 12
  - Given an account with at least one order, when the nightly job runs, then a CSV appears under the account's export prefix
  - Given an account with no orders, when the nightly job runs, then a zero-row CSV with headers appears
  - Must NOT: write an export for a deactivated account

- **FR-002 (P0):** An operator must be able to re-run one account's export without re-running the batch — traces to intent.md line 18
  - Given a completed batch, when an operator runs the single-account command, then only that account's file is replaced
  - Given an account id that does not exist, when the command runs, then it exits non-zero naming the id
  - Must NOT: leave a partial file in place on failure

### Non-functional

- **NFR-001 (P0):** No export run may hold more than 500 MB of order rows in memory — measurable: peak resident set stays under 512 MB, measured by `npm run profile:memory`, which runs the export against the largest fixture account, reads `process.memoryUsage().heapUsed` once after the last account's file is closed, and fails if that value exceeds 512 MB, so the peak resident set is verified to stay under the limit.

## Success metrics

| Metric | Type | Target | Measured by | Evaluate at |
|---|---|---|---|---|
| Accounts exported per night | Leading | 100% of active accounts | `exports_written_total` counter | 1 week |
| Operator re-run requests | Lagging | under 5 per month | support tickets tagged `export-rerun` | 1 quarter |

## Design

The nightly job reads orders through the existing `order_cache` read-through layer, groups them by account, and streams each account's rows to a CSV in object storage. A new `export_runs` table records one row per account per night.

Deployment has two artifacts: the schema migration that creates `export_runs`, and the worker image that writes to it. The migration must reach production before the worker image, because the worker inserts into `export_runs` on its first run. The two ship as separate change sets, and the ordering is enforced: the worker image's deploy step queries the repository for the migration's pull request and aborts unless that pull request is merged, so the worker cannot reach production ahead of the migration.

## Standards applied

Security: export files inherit the bucket's existing per-account access prefix policy. Operability: the job emits the standard `job_started` and `job_finished` events.

## Gotchas

The `order_cache` read-through layer can silently return a stale row set for an account whose orders changed inside the cache TTL. An export built from stale rows is indistinguishable from a correct one — same shape, same headers, no error raised. To catch it, the job counts the rows it exported and compares that number against the per-account row count that `order_cache` stores alongside each cached row set and refreshes whenever that row set is loaded, exposed as `order_cache.count_for_account()`; a mismatch fails the run. The count is a separate value from the rows themselves, so it is not subject to the same staleness as the export.

## Evidence

1. Streaming CSV writes — what: writing rows to object storage in chunks rather than buffering the result set / who uses it at scale: standard practice in batch export pipelines / why it works: peak memory is bounded by chunk size rather than row count / reference: Node.js stream backpressure documentation / connection: NFR-001 requires bounded memory / impact: High — NFR-001 is the only P0 non-functional requirement

## Open questions

- Whether deactivated accounts should receive one final export. Owner: product. Due: before Phase 2.

## Assumption register

| # | Assumption | Impact If False | How to Verify | By When | Owner | Status |
|---|-----------|----------------|---------------|---------|-------|--------|
| 1 | Object storage accepts multipart writes above 5 GB | Large accounts fail to export | Write a 6 GB test object in staging | Phase 1 | platform team | verified |
| 2 | No account holds more than 10M orders | Export exceeds the nightly window | Query the maximum order count per account | Phase 1 | data team | verified |

## Dependencies

| Dependency | Owner | Status |
| --- | --- | --- |
| Object storage export bucket | platform team | confirmed |
| Nightly scheduler slot | platform team | confirmed |

## Verification plan

Methodology per deliverable:

- Export writer: `characterization` — captures current CSV output for a fixed fixture account. Test file: `tests/export-writer.test.js`, delivered by Phase 1.
- Single-account re-run command: `bdd` — Given/When/Then per FR-002. Test file: `tests/export-rerun.test.js`, delivered by Phase 2.

Tests are written by a separate test agent, not by the implementation agent.

## Delivery

- Tickets: EXP-1 schema migration (`export_runs`), EXP-2 export writer, EXP-3 re-run command
- Timeline: Phase 1 one week, Phase 2 one week; EXP-3 depends on EXP-2

### Phase 1: Schema and export writer

Deliverables: the `export_runs` migration, the export writer, `tests/export-writer.test.js`
Rollback: if the nightly run fails twice, disable the scheduler entry and restore `export_runs` from `private.export_runs_backup`. That backup is not created by the schema migration, which would only snapshot an empty table; it is taken by `scripts/snapshot-export-runs.sql`, run as its own deploy step immediately before the worker image rolls out, so it captures the state the rollback is meant to return to. The script is re-runnable: it runs `DROP TABLE IF EXISTS private.export_runs_backup` and then recreates the backup from the live table, and a worker rollout that fails midway is retried from the first deploy step, so the retry never fails on a backup that already exists.
Go/No-Go: two consecutive nightly runs complete with zero failed accounts.

### Phase 2: Re-run command

Deliverables: the single-account re-run command, `tests/export-rerun.test.js`
Rollback: remove the command from the operator CLI; no data changes to undo.
Go/No-Go: an operator re-runs one account in staging and only that account's file changes.
