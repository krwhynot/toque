# Pricing engine extraction — Specification

- Derived from: intent.md (standalone quick-audit fixture)
- Author: agent + human reviewer
- Status: Draft
- Date: 2026-09-05

## Requirements

### Functional

- **FR-001 (P0):** Report pricing rules are evaluated by one module, `src/pricing.js`, instead of inline in `src/reports.js` — traces to intent.md line 12
  - Given a report with a per-seat price, when it is rendered, then the total equals seats times unit price
  - Given a report with no price rows, when it is rendered, then the total is 0 and no error is raised
  - Must NOT: change any total for existing reports (golden-master comparison)
- **FR-002 (P1):** Discounts apply in a fixed order (volume, then promotional) — traces to intent.md line 18
  - Given both discounts, when the total is computed, then the volume discount is applied first

### Non-functional

- **NFR-001 (P0):** Rendering a 10,000-row report completes within 2 seconds on the staging database — measured by the existing `render` timing log

## Success metrics

| Metric | Type | Target | Measured by | Evaluate at |
|---|---|---|---|---|
| Golden-master mismatches | Leading | 0 across 500 archived reports | tests/pricing.golden.test.js | before Phase 2 |
| Pricing-related support tickets | Lagging | 50% fewer within 1 quarter | support tracker tag `pricing` | 1 quarter |

## Design

Extract the pricing arithmetic from `src/reports.js` into `src/pricing.js` behind a `computeTotal(report)` function. `render` calls it; nothing else changes in Phase 1. Phase 2 adds the discount ordering. Characterization tests capture current totals before any code moves.

## Standards applied

Repository test conventions (`node --test`, one file per module); no new dependencies.

## Gotchas

Existing reports may contain rows with a null unit price that today render as 0 by accident; the extraction must preserve that until Phase 2 decides otherwise.

## Evidence
Created: 2026-09-05 (Stage 2)

> This section explains WHY the tools, methods, and patterns in this plan
> are industry-proven choices.

### Methods & Patterns

#### Characterization testing {#characterization}
**Impact:** HIGH — the extraction is only safe if current totals are pinned first

**What it is:** Tests that record the current behavior of code before changing it, so that a refactor is checked against what the code did rather than what it should have done.

**Origin:** Michael Feathers, Working Effectively with Legacy Code (2004)

**Who uses it at scale:**
- **GitHub** — the Scientist library compares old and new code paths on production traffic before cutover
- **Shopify** — golden-master fixtures guard checkout arithmetic during refactors

**Why it works:** It turns "did I break anything" into a diff against recorded outputs, which catches the accidental behaviors a spec never wrote down.

**Reference:** [Working Effectively with Legacy Code](https://www.informit.com/store/working-effectively-with-legacy-code-9780131177055)

**Connection to this plan:** Phase 1 records 500 archived report totals before `computeTotal` exists; Phase 2 reruns them.

## Open questions

- Whether null unit prices should become validation errors in Phase 2 — owner: product team, due before Phase 2

## Assumption register

| # | Assumption | Impact If False | How to Verify | By When | Owner | Status |
|---|-----------|----------------|---------------|---------|-------|--------|
| 1 | The 500 archived reports cover every pricing rule in use | A rule with no fixture is silently changed | Group archived reports by rule id and compare with the rule table | Phase 1 | Dana | unverified |
| 2 | No caller other than `render` reads pricing fields directly | A hidden caller breaks when fields move | grep for `unit_price` outside src/reports.js | Phase 1 | Dana | verified |

## Dependencies

| Dependency | Owner | Status |
| --- | --- | --- |
| Archived report fixtures from the staging database | platform team | confirmed |
| Decision on null unit prices | product team | open |

## Verification plan

Characterization for Phase 1 (`tests/pricing.golden.test.js`, captured before the move); TDD for Phase 2 discount ordering (`tests/pricing.test.js`, written by a separate agent from the implementer). Both run in `npm test` at build time and in Stage 4.

## Delivery

- Tickets: PRC-1 capture golden master; PRC-2 extract `computeTotal`; PRC-3 discount ordering (depends on PRC-2)
- Timeline: Phase 1 week 1; Phase 2 week 2; critical path PRC-1 → PRC-2 → PRC-3

### Phase 1: Extract without behavior change

Deliverables: `src/pricing.js`, `tests/pricing.golden.test.js`, `render` calling `computeTotal`
Rollback: revert the extraction commit; `render` still contains the inline arithmetic until PRC-2 merges
Go/No-Go: 500 of 500 golden-master totals identical before PRC-3 starts

### Phase 2: Discount ordering and promotional codes

Deliverables: ordered discount application in `src/pricing.js`; promotional-code lookup in `src/pricing.js` against a new `promotions` table created by a migration in this phase; `tests/pricing.test.js` covering both discount orders and an expired code
Go/No-Go: no golden-master regression, the product decision on null prices recorded, and one expired code rejected on staging
