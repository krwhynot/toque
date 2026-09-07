# Scheduled report delivery — Specification

- Derived from: product request, August 2026
- Author: platform team
- Status: Draft
- Date: 2026-09-06

## Requirements

### Functional

- **FR-001 (P0):** A report can be sent asynchronously: the send route enqueues a job and returns 202 within 200 ms
  - Given a report the user may view, when they POST to the send route, then a job is enqueued and the response is 202
  - Given a report the user may not view, when they POST, then the response is 403 and nothing is enqueued
- **FR-002 (P1):** A report can be scheduled daily at a fixed UTC hour
  - Given a schedule row, when the hour arrives, then one job is enqueued for that report

### Non-functional

- **NFR-001 (P0):** A queued job is sent at most once even if the worker is retried — measured by a send-log unique index

## Success metrics

| Metric | Type | Target | Measured by | Evaluate at |
|---|---|---|---|---|
| Send-route p95 latency | Leading | under 200 ms | server timing log | end of Phase 1 |
| Duplicate sends | Lagging | 0 per month | send_log table | 1 month after Phase 2 |

## Design

Add a `jobs` table in Postgres and a worker process (`src/worker.js`) that polls it. The send route in `src/server.js` enqueues; the worker calls `reports.send`. Permissions are re-checked in the worker with `reports.canView` at run time. Phase 2 adds `src/scheduler.js` using node-cron to enqueue scheduled reports.

## Standards applied

Repository test conventions (`node --test`, one file per module); node-cron is already a dependency.

## Gotchas

`reports.send` currently renders inline; the worker must import it without pulling in `express`.

## Evidence
Created: 2026-09-06 (Stage 2)

### Methods & Patterns

#### Transactional outbox {#outbox}
**Impact:** HIGH — at-most-once delivery depends on the send being recorded in the same transaction as the job acknowledgement

**What it is:** Writing the side-effect record and the state change in one database transaction so a crash between them cannot produce a duplicate.

**Origin:** Chris Richardson, Microservices Patterns (2018)

**Who uses it at scale:**
- **Shopify** — outbox tables for webhook delivery

**Why it works:** The database's atomicity does the coordination.

**Reference:** [Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)

**Connection to this plan:** The worker writes `send_log` and marks the job done in one transaction.

## Open questions

- Which time zone scheduled hours are stored in — owner: product, due before Phase 2

## Assumption register

| # | Assumption | Impact If False | How to Verify | By When | Owner | Status |
|---|-----------|----------------|---------------|---------|-------|--------|
| 1 | Postgres polling every 5 s is fast enough for current volume | Users wait longer than today | Count sends per hour in production logs | Phase 1 | platform | unverified |
| 2 | `reports.send` has no other callers | The worker changes behaviour for a hidden caller | grep for `send(` outside src/server.js | Phase 1 | platform | verified |

## Dependencies

| Dependency | Owner | Status |
| --- | --- | --- |
| Postgres migration for `jobs` and `send_log` | platform team | confirmed |
| Time-zone decision | product team | open |

## Verification plan

Unit tests for enqueue and worker in `tests/jobs.test.js` (written before the worker exists); the existing `tests/reports.test.js` keeps covering `canView`. Both run in `npm test`.

## Delivery

- Tickets: RPT-1 jobs table and migration; RPT-2 worker; RPT-3 scheduler (depends on RPT-2)
- Timeline: Phase 1 week 1; Phase 2 week 2

### Phase 1: Asynchronous send

Deliverables: migration, `src/worker.js`, send route enqueuing, `tests/jobs.test.js`
Rollback: revert the route change; the worker can stay deployed idle
Go/No-Go: p95 under 200 ms on staging and zero duplicate sends in a 1,000-job soak

### Phase 2: Scheduling

Deliverables: `src/scheduler.js`, schedule table, `tests/scheduler.test.js`
Rollback: disable the cron entry; queued jobs still drain
Go/No-Go: time-zone decision recorded and one scheduled report delivered on staging
