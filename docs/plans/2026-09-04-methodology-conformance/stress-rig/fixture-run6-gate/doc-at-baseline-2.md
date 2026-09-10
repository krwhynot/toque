# Extract Pricing Arithmetic from `render()` into `src/pricing.js`

## Problem Statement

**What:** Move the inline pricing calculation at `src/reports.js:19` into a new
dependency-free module `src/pricing.js`, and give it the test coverage it has
never had.

**Why:** The line that decides what a customer is billed is a single anonymous
expression buried inside an HTML renderer, and it has **zero test coverage**
(verified: `tests/reports.test.js:3` imports only `canView`; `render` is one of
four exports at `src/reports.js:25` with no test). Any future change to pricing
— proration, discounts, tax, a currency column — has to be made inside a
function whose job is string building, with no safety net proving the total did
not move. The cost of not doing it is that the next pricing change ships
unverified.

**Current State:**

- The arithmetic is one line, `src/reports.js:19`:
  ```js
  const total = (report.rows || []).reduce((sum, r) => sum + (r.seats || 0) * (r.unit_price || 0), 0);
  ```
- It lives inside `async function render(report)` (`src/reports.js:16-23`),
  between a `Date.now()` capture (`:17`) and a timing `console.log` (`:21`).
- It has exactly **one** in-repo consumer: `send()` at `src/reports.js:13`,
  reached from `POST /api/reports/:id/send` (`src/server.js:10-16`). `render` is
  also exported (`src/reports.js:25`), so out-of-repo callers are possible but
  none exist in this repository.
- The computed total is interpolated raw into the HTML at `src/reports.js:20` —
  no rounding, no formatting, no currency symbol.
- **The test suite is red today.** `npm test` fails with
  `Error: Cannot find module 'pg'` (verified by running it: `tests 1 / pass 0 /
  fail 1`, Node v24.12.0). There is no `node_modules/`, no `package-lock.json`
  and no `.gitignore` in the repo (all verified by `test -f`).
- There is no CI configuration of any kind (verified: no `.github/`, no
  `.travis.yml`, `.circleci`, `.gitlab-ci.yml`, `Jenkinsfile`).

**Desired State:**

- `src/pricing.js` (new) exports a pure function computing the total from a
  report's rows, with no `require` statements at all.
- `src/reports.js:19` becomes a call to that function, positioned between
  `:17` and `:21` so the timing log still spans the whole render.
- `src/reports.js:21` — the render timing log — is **byte-identical** to today.
- `tests/pricing.test.js` (new) covers the arithmetic's real behaviour,
  including the ugly parts.
- The rendered HTML total is unchanged for every possible input, including the
  float-artifact and `NaN` cases.

**Success Criteria:**

1. `npm test` exits 0 with the pre-existing two `canView` tests still passing.
2. For all ~20 characterization inputs in the Testing Strategy, `render()`
   returns a byte-identical HTML string before and after the extraction —
   asserted with `assert.strictEqual`, never a tolerance.
3. `src/reports.js:21` is unchanged in the diff (verified by
   `git diff -- src/reports.js` showing that line untouched).
4. `src/pricing.js` contains zero `require` calls and `package.json`
   dependencies are unchanged.
5. `render()`'s null-row `TypeError` still throws with the same message.

## Architecture

**Approach: Refactor-in-Place (pure function extraction, direct cutover).**

**Key Design Decisions:**

1. **Copy the expression character-for-character, including `|| 0`.** Do not
   modernise it. `(r.seats || 0)` coerces `null`, `undefined`, `""`, `false`,
   `0` and `NaN` all to `0`; `(r.seats ?? 0)` would let `NaN`, `""` and `false`
   through and silently change totals. The `|| 0` idiom matches the codebase's
   existing defaulting style (`src/reports.js:9`, `(report.shared_with || [])`).

2. **Preserve the reduction shape, not just the formula.** The expression is a
   left-to-right `reduce` seeded with `0` (`src/reports.js:19`). Re-associating
   it (map-then-sum, sorting, pairwise or Kahan summation) changes low-order
   float bits. Verified: `[{seats:3,unit_price:0.1}]` currently renders
   `Total: 0.30000000000000004`. That string is today's customer-facing output.

3. **No rounding, ever, in this change.** Introducing `toFixed`, `Math.round`,
   integer-cents conversion, or a decimal library would be a *behaviour change
   with a customer-visible diff*, not a refactor. If the team wants formatted
   currency, that is a separate change with its own approval and its own test
   diff. This is recorded in Open Questions, not smuggled in here.

4. **The new module takes rows, not the report.** `computeTotal(rows)` keeps
   `pricing.js` ignorant of the report shape, HTML, and the DB. The `|| []`
   guard stays at the boundary inside `pricing.js` so `computeTotal(undefined)`
   still returns `0` exactly as `(report.rows || [])` does today.

5. **CommonJS, `function` declaration, trailing `module.exports = {...}`.**
   Matches every file in `src/` (`src/reports.js:25`, `src/auth.js:9`). No
   JSDoc — the codebase has zero `/**` blocks anywhere, so adding them would be
   a new convention, not the existing one.

6. **Characterization tests land in their own commit, before the extraction.**
   They must be observed passing against the *unmodified* `render()`. A test
   suite written after the refactor proves only that the new code agrees with
   itself.

**Component Diagram:**

```
BEFORE
  server.js:14  send()  ──▶  reports.js:13  render()
                                            ├─ :17  started = Date.now()
                                            ├─ :19  ▓ inline reduce ▓   ← untested
                                            ├─ :20  html template
                                            └─ :21  console.log(timing)

AFTER
  server.js:14  send()  ──▶  reports.js:13  render()
                                            ├─ :17  started = Date.now()
                                            ├─ :~19 computeTotal(report.rows) ──▶ src/pricing.js  ← unit tested
                                            ├─ :~20 html template                  (no requires)
                                            └─ :~21 console.log(timing)  ← byte-identical
```

**Follows Existing Pattern:** **No.** There is no prior art for this in the
repository, and the plan does not claim any. `src/db.js` wraps `pg`
infrastructure, `src/auth.js:2-8` is Express middleware, `src/server.js` is
routing. No existing module exports a dependency-free pure computation;
`src/pricing.js` will be the first. What it *does* follow is the file-level
convention set (module system, export shape, naming, comment style) documented
in Design Decision 5.

### Options Analysis

| Pattern | Implementation ease here | Timeline | Risk profile | Rollback complexity | Proportionate to a 70-line repo? |
|---|---|---|---|---|---|
| **Refactor-in-Place (chosen)** | Trivial — 1 line moved, 1 call site (`src/reports.js:13` is the only caller of `render`) | ~0.75 day for the cutover | Low: behaviour-identical by construction if the expression is copied verbatim; the residual risk is human transcription, which the characterization tests catch | `git revert` of one commit | Yes |
| **Strangler Fig** (runner-up) | Needs an old/new coexistence seam and a migration window for a function with exactly one call site | +1 day of scaffolding | Lower divergence risk in theory, but doubles the live code paths and the surface where totals can drift | Remove the seam, then revert | No — no monolith to strangle |
| **Feature Flag Rollout** | No config plumbing exists; only `process.env` uses in the repo are `DATABASE_URL` (`src/db.js:2`) and `PORT` (`src/server.js:18`) | +1 day, plus flag-retirement debt | Keeps both arithmetic paths alive indefinitely — *increases* the chance of a divergence nobody notices | Flip the flag (fast), then still revert | No |
| **New Component** | No service or interface boundary to justify one; risks disturbing the log line at `src/reports.js:21` | +1.5 days | Over-abstracts a 90-character expression | High | No |

**Winner: Refactor-in-Place.** The extraction is behaviour-identical by
construction, the blast radius is one line with one caller, and the undo is a
single `git revert`. Any coexistence mechanism costs more than the risk it
removes at this codebase size.

**Would revisit Strangler Fig if:** a second pricing consumer appears — the
`node-cron` dependency is declared at `package.json:3` but is `require`d
nowhere in the repo (verified), which hints at a scheduled job that may arrive —
or if pricing rules must diverge per account. At that point a parallel-run
comparison earns its cost.

**Would revisit Feature Flag if:** the change ever grows to include rounding or
currency formatting. A customer-visible numeric change deserves a flag; a
verbatim extraction does not.

## Phases

### Phase 0: Green Baseline (LOW risk)

**Scope:** Get `npm test` passing before touching anything. Install
dependencies, add `.gitignore`, and confirm the module loads without a
database. Resolve the two data-shape assumptions (Assumptions 1 and 2).

**Entry Criteria:** Working tree clean (verified clean at plan time, commit
`856a0bf`). Engineer has npm registry access.

**Exit Criteria:**
- `npm test` exits 0 with `pass 2 / fail 0`.
- `node -e "require('./src/reports')"` exits 0 with `DATABASE_URL` unset.
- `node_modules/` is git-ignored and `git status --short` is clean.
- Assumptions 1 and 2 in the register are marked verified or escalated.

**Deliverables:**
- `package-lock.json` (new) — committed, so the baseline is reproducible.
- `.gitignore` (new) — containing `node_modules/`.
- A written note of the real `reports.rows` column type and one sample row
  (recorded in this document's Open Questions section, not a new file).

**Estimated Effort:** 0.25 day (2 hours). Basis: three commands
(`npm install`, `npm test`, one `node -e`) plus a schema lookup against
staging. The dependency set is three packages (`package.json:3`).

**Tests Required:** No new tests. The gate is the *existing* suite —
`tests/reports.test.js` — going green for the first time.

Rollback: `rm -rf node_modules package-lock.json .gitignore` and
`git checkout -- .`. No source file is modified in this phase, so there is
nothing to revert in `src/`.

Go/No-Go: `npm test` prints `pass 2` and `fail 0`. If dependencies cannot be
resolved offline, stop — see the NO-GO criteria; the whole plan is blocked
without a green baseline.

---

### Phase 1: Characterization Tests on `render()` (LOW risk)

**Scope:** Pin the *current* behaviour of `render()` before any code moves.
Write golden-master tests asserting the full HTML string for every input class
in the Testing Strategy table. No production code is touched in this phase.

**Entry Criteria:** Phase 0 exit criteria met.

**Exit Criteria:**
- `tests/render.characterization.test.js` (new) exists with ≥20 cases and all
  pass against the **unmodified** `src/reports.js`.
- Every case asserts the whole HTML string via `assert.strictEqual`, not the
  number alone, so `${total}` stringification is pinned too.
- The float-artifact case asserts the literal string
  `<h1>t</h1><p>Total: 0.30000000000000004</p>`.
- The `NaN` and null-row cases are present and passing.
- `tests/fixtures/report-real.json` (new) exists, and case 22 — the pre-change
  capture — passes against the **unmodified** `src/reports.js`.
- `git diff -- src/` is empty.

**Deliverables:**
- `tests/render.characterization.test.js` (new), committed on its own, green
  against unmodified source.
- `tests/fixtures/report-real.json` (new) — the real report row captured in
  Phase 0, with customer identifiers replaced but the `rows` column left exactly
  as the database returned it. If staging access is not granted (see
  Dependencies), the fixture is a hand-written row in the same shape, recorded
  as such; only its realism degrades, not its function.
- **Case 22, the pre-change capture:** an assertion, with `assert.strictEqual`,
  of the full HTML string that **unmodified** `render()` returns for that
  fixture. This is the artifact Phase 3 compares against. It lives at a known
  path in the repository rather than in someone's terminal scrollback, and
  `node --test tests/render.characterization.test.js` re-runs the comparison on
  demand — it is created here, in the last phase before any code moves, because
  this is the state it exists to preserve.

**Estimated Effort:** 0.75 day (6 hours). Basis: ~20 cases at ~4 lines each in
`node:test` style (`tests/reports.test.js:4-9` is the template), plus the
`console.log` noise decision and one review pass. All 20 expected values are
already computed and listed in this plan's Testing Strategy — the engineer is
transcribing, not deriving.

**Tests Required:** `tests/render.characterization.test.js` — the deliverable
*is* the tests. Also re-run `tests/reports.test.js` to confirm no interference.

Rollback: `git revert` the single commit, or delete
`tests/render.characterization.test.js`. Zero production impact — this phase
adds only a test file.

Go/No-Go: all characterization tests pass against unmodified `src/reports.js`,
and `git diff -- src/` returns empty output. A characterization test that fails
here means the expected value in this plan is wrong — fix the *expectation*
after re-deriving it from the running code, never the source.

---

### Phase 2: Extract `src/pricing.js` and Cut Over (MEDIUM risk)

**Scope:** Create `src/pricing.js` with the expression copied verbatim, replace
`src/reports.js:19` with a call to it, and add unit tests for the new module.
This is the only phase that modifies production code.

**Entry Criteria:** Phase 1 green and committed. The characterization suite is
the safety net for this phase and must exist before it starts.

**Exit Criteria:**
- `src/pricing.js` (new) exists, contains zero `require` statements, exports via
  a trailing `module.exports = { ... }`.
- `src/reports.js:21` is untouched — proven by `git diff -- src/reports.js`.
- The `computeTotal` call sits between the `Date.now()` capture and the
  `console.log`, so the measured timing span is unchanged.
- `tests/pricing.test.js` (new) mirrors the characterization table as unit
  tests on `computeTotal` directly.
- The **entire** suite is green: `tests/reports.test.js`,
  `tests/render.characterization.test.js`, `tests/pricing.test.js`.
- `package.json` dependencies are byte-identical to `856a0bf`.

**Deliverables:**
- `src/pricing.js` (new)
- modified `src/reports.js`
- `tests/pricing.test.js` (new)

**Estimated Effort:** 0.75 day (6 hours). Basis: the code change is ~6 new
lines and 1 modified line; the bulk of the time is porting ~20 assertions to
the new module and reviewing the diff line by line against the constraint that
`:21` must not move.

**Tests Required:**
- `tests/pricing.test.js` (new) — unit tests on `computeTotal`, same input
  table.
- `tests/render.characterization.test.js` — must still pass **unmodified**.
  This is the load-bearing check: if a characterization test needs editing to
  pass, the extraction changed behaviour and the change is wrong.
- `tests/reports.test.js` — regression check on `canView`.

Rollback: `git revert` the extraction commit. `src/reports.js` returns to the
inline expression; `src/pricing.js` disappears with it. The characterization
tests from Phase 1 survive the revert and keep guarding the restored code.
Because Phase 1 and Phase 2 are separate commits, reverting the extraction does
not cost the test coverage.

Go/No-Go: all three test files pass with zero edits to
`tests/render.characterization.test.js`, **and** `git diff -- src/reports.js`
shows the timing log line unchanged. Either condition failing is a hard stop.

---

### Phase 3: Verify, Document, Close (LOW risk)

**Scope:** Prove the end-to-end path still works, update the README, and record
what was deliberately not changed.

**Entry Criteria:** Phase 2 green and committed.

**Exit Criteria:**
- The `POST /api/reports/:id/send` path (`src/server.js:10-16`) is exercised —
  manually or by an added smoke test — against a database seeded with the row in
  `tests/fixtures/report-real.json`, and the `Total:` in the returned HTML is
  byte-identical to the string pinned by case 22 of
  `tests/render.characterization.test.js`, which was captured against unmodified
  `render()` in Phase 1, before any code moved.
- `node --test tests/render.characterization.test.js` passes unedited, so the
  comparison is repeatable by anyone at any later date rather than resting on a
  one-time observation.
- `README.md` mentions `src/pricing.js` as the home of pricing arithmetic, and
  records `npm test` as a required pre-merge step (the interim control for
  Risk 11).
- Open Questions in this document are answered or explicitly deferred with an
  owner and a date.

**Deliverables:** modified `README.md`; a short cutover note appended to this
spec; answers recorded for Assumptions 1 and 2.

**Estimated Effort:** 0.5 day (4 hours). Basis: seeding one row from
`tests/fixtures/report-real.json`, one manual request against a locally-run
server (`src/server.js:18` supports `PORT`), a two-line README edit, and writing
up findings.

**Tests Required:** No new automated tests required, but if the manual smoke
check is easy to automate against the exported app (`src/server.js:17`), add it
to `tests/`. Re-run the full suite one final time.

Rollback: `git revert` the documentation commit. Nothing in this phase affects
runtime behaviour, so rollback is cosmetic.

Go/No-Go: the total rendered through `POST /api/reports/:id/send` for the seeded
fixture report is byte-identical, character for character, to the string pinned
in case 22 of `tests/render.characterization.test.js`, and that file passes with
zero edits.

## Risk Assessment

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| 1 | The expression is retyped rather than copied and a `\|\|` becomes `??`, or an operand order changes — totals shift for rows with `NaN`, `""` or `false` fields | MEDIUM | HIGH | Copy/paste the line from `src/reports.js:19`; Phase 1 characterization tests cover `NaN`, empty-string and falsy cases and run unmodified in Phase 2 |
| 2 | Someone "cleans up" `0.30000000000000004` with `toFixed(2)` during review, changing every fractional customer total | MEDIUM | HIGH | Design Decision 3 forbids it; the characterization test asserts the literal artifact string, so the change fails CI-equivalent locally |
| 3 | Summation is re-associated (map+sum, sort, Kahan) and low-order float bits differ | LOW | HIGH | Design Decision 2; the multi-row fractional case (`0.1 + 0.2 → 0.30000000000000004`) is in the test table |
| 4 | The timing log at `src/reports.js:21` is reflowed, or `computeTotal` is called outside the `started`/`console.log` span, changing the measured duration | MEDIUM | MEDIUM | Explicit exit criterion in Phase 2; verified by `git diff -- src/reports.js` |
| 5 | Phase 0 cannot resolve dependencies (no lockfile, no `node_modules`, no registry access) and the plan has no green baseline | LOW | HIGH | Phase 0 is first and is a hard gate; the NO-GO criteria stop the plan rather than proceeding on a red suite |
| 6 | No lockfile means `npm install` resolves `express ^4.19.2` to a newer 4.x than the author had, making the baseline irreproducible | HIGH | LOW | Phase 0 commits `package-lock.json`. Pricing does not touch express, so blast radius is baseline reproducibility only |
| 7 | `node_modules/` is committed by accident (no `.gitignore` exists today) | MEDIUM | LOW | Phase 0 deliverable adds `.gitignore` before `npm install` output can be staged |
| 8 | Production rows are not shaped `{seats, unit_price}` and the test table is unrealistic — tests pass but exercise cases that never occur | MEDIUM | MEDIUM | Assumption 1, verified in Phase 0 against a real row. Note this does *not* threaten correctness: a verbatim copy is identity-preserving for any input |
| 9 | `pg` returns `NUMERIC` columns as JS strings, so the string-coercion and `NaN` paths are live in production, not theoretical | MEDIUM | MEDIUM | Assumption 2, verified in Phase 0. The test table already covers string operands (`'3' × 10 → 30`, verified) and non-numeric strings (`→ NaN`, verified) |
| 10 | An out-of-repo consumer imports `render` from `src/reports.js:25` and depends on internals | LOW | MEDIUM | The extraction does not change `render`'s signature or return type, so any external caller is unaffected. `[CODEBASE-CLAIM-NOT-VERIFIED]` — only this repository was searched |
| 11 | Nothing enforces the tests: there is no CI (verified), so a later change can silently break the new coverage | HIGH | MEDIUM | Interim control in place from Phase 3: `README.md` records `npm test` as a required pre-merge step, and the repository owner (Dependencies table) declines any merge to `master` whose review does not quote a `pass N / fail 0` run of the full suite. It is a human gate, not automation, and is named as such; the automated replacement is Open Question 5, owned by the platform team with a decision due 2026-09-25 |

**Cascade note:** pricing is a payment-flow path, which is a
**CASCADE** category per the self-audit framework regardless of fan-out count.
Risks 1, 2 and 3 all land on the same customer-visible number and should be
spot-checked together during review, not treated as independent.

## Assumption Register

| # | Assumption | Impact If False | How to Verify | By When | Owner | Status |
|---|-----------|----------------|---------------|---------|-------|--------|
| 1 | `report.rows` is an array of objects carrying `seats` and `unit_price` | Test fixtures are unrealistic; coverage looks thorough but exercises cases production never produces. Extraction correctness is unaffected (verbatim copy is identity-preserving for any input) | Query the `reports` table schema on staging and inspect one real row's `rows` column. There is **no** schema, migration or fixture in this repo defining it (verified) | Phase 0 | assigned engineer | unverified |
| 2 | `pg` returns `NUMERIC`/`DECIMAL` columns as JS strings, so string operands reach `src/reports.js:19` in production | The string-coercion and `NaN` branches of the test table are dead cases; a real non-numeric value would render `Total: NaN` to a customer today and nobody would know | Check the column type of `unit_price` in the real schema; confirm `pg`'s type-parser behaviour for that OID | Phase 0 | assigned engineer | unverified |
| 3 | The declared ranges `express ^4.19.2`, `pg ^8.11.3`, `node-cron ^3.0.3` (`package.json:3`) resolve against the public npm registry into a coherent tree | Would have been HIGH: no green baseline, nothing to characterize, Phase 1 cannot start. Now closed. What remains is whether the *engineer's own machine* can reach the registry — a different failure, tracked as Risk 5 and as the first Dependencies row, and recoverable by installing on any reachable machine and committing the lockfile | `npm install --dry-run` (resolves and prints the tree without writing `node_modules/`) | closed at plan time | assigned engineer | **verified** — exit 0, 85 packages resolved, including `express 4.22.2`, `pg 8.23.0`, `node-cron 3.0.3` (run 2026-09-09 on Node v24.12.0; no `node_modules/` or lockfile written, working tree confirmed clean afterwards) |
| 4 | `render()` has no callers outside this repository | An external consumer could be relying on `render` internals. Low concern: the extraction preserves `render`'s signature, async-ness and return type | Search the wider org's repos for `require('.../reports')`. Only this repository was searched (7 tracked files) | Phase 3 | assigned engineer | unverified |
| 5 | The existing rendered totals are *correct*, not merely current | If today's arithmetic is already wrong, this plan faithfully preserves a bug. That is the intended behaviour of a characterization refactor, but it should be a conscious choice | Product confirms billing totals are trusted today | Phase 3 | product owner | unverified |
| 6 | One engineer is available for three consecutive working days | Timeline slips; phases are sequential and cannot be parallelised by one person | Confirm with the engineer's manager before Phase 0 | Before Phase 0 | engineering manager | unverified |

**Gate status:** no HIGH-impact assumption is unverified. Assumption 3 was the
one that would have blocked the gate — a dependency set that does not resolve
stops every later phase — and it was closed at plan time by running the
dry-run, which cost less than arguing about it. The assumptions still open are
MEDIUM or lower and are scoped accordingly: 1 and 2 govern how *realistic* the
test fixtures are (Risks 8 and 9, both MEDIUM, and neither touches whether the
extraction is behaviour-preserving), 4 and 5 are Phase 3 confirmations, and 6 is
a scheduling question. Also note that resolution today does not pin resolution
tomorrow: `express ^4.19.2` floated to 4.22.2 in this run, which is exactly why
Phase 0 commits a lockfile (Risk 6).

## Rollback Strategy

**Feature Flag:** None, deliberately. See the Options Analysis — a flag would
keep two arithmetic paths live and *increase* the chance of an unnoticed
divergence, which is precisely the stated risk. Rollback is by revert.

**Kill Switch:** `git revert <phase-2-commit>`. This restores the inline
expression at `src/reports.js:19` and removes `src/pricing.js` in one
operation. Because Phase 1 (tests) and Phase 2 (extraction) are separate
commits, reverting the extraction **retains** the characterization tests, which
then guard the restored inline code. No redeploy sequencing is required beyond
the project's normal deploy of `src/`.

**Data Rollback:** Not applicable. No data migration, no schema change, no
writes. The only DB access in the whole repo is two `SELECT` statements
(`src/reports.js:3`, `src/reports.js:5`) and this change touches neither.

**Blast Radius:** One HTTP route — `POST /api/reports/:id/send`
(`src/server.js:10-16`) — and the emailed report body it produces via
`send()` (`src/reports.js:11-15`). `GET /api/reports` (`src/server.js:6-9`)
never reaches the pricing arithmetic. If the arithmetic drifts, the visible
symptom is a wrong `Total:` in a report emailed to a customer — user-visible,
externally sent, and not automatically detectable. That is what makes Risks 1–3
worth the characterization suite.

## Timeline

| Phase | Start | End | Dependencies | Owner |
|-------|-------|-----|-------------|-------|
| Phase 0: Green baseline | 2026-09-10 AM | 2026-09-10 AM | npm registry access; staging DB read access for Assumptions 1–2 | assigned engineer |
| Phase 1: Characterization tests | 2026-09-10 PM | 2026-09-11 AM | Phase 0 green | assigned engineer |
| Phase 2: Extract + cut over | 2026-09-11 AM | 2026-09-11 PM | Phase 1 committed green | assigned engineer |
| Phase 3: Verify + document | 2026-09-14 AM | 2026-09-14 PM | Phase 2 committed green; product available for Assumption 5 | assigned engineer |

(2026-09-12 and 2026-09-13 are Saturday and Sunday and are excluded.)

**Critical Path:** Fully sequential — 0 → 1 → 2 → 3. Nothing parallelises,
because there is one engineer and each phase's exit criterion is the next
phase's entry criterion. Phase 1 *must* precede Phase 2: characterization tests
written after the extraction only prove the new code agrees with itself.

**Buffer:** Base estimate is 2.25 days (0.25 + 0.75 + 0.75 + 0.5). Adding 30%
for unknowns — chiefly the two unverified data-shape assumptions and the
possibility that `npm install` needs troubleshooting — gives **2.9 days**.

**Total Estimated Duration:** 3 working days, matching the stated constraint
with no slack to spare. If Assumption 3 fails, the three-day constraint does not
hold and the plan needs re-scoping, not compressing.

## Testing Strategy

| Phase | Methodology | Test Type | Count | Coverage Target |
|-------|------------|----------|-------|----------------|
| Phase 0 | Baseline regression detection | Existing suite must go green | 2 (existing) | `canView` only — unchanged from today |
| Phase 1 | **Characterization / Golden Master** | Golden-master on `render()`'s full HTML output | ~20 | 100% of the arithmetic's input classes; `render()` goes from 0% to covered |
| Phase 2 | **Characterization (unchanged) + TDD** | Unit tests on `computeTotal` + Phase 1 suite re-run unmodified | ~20 new + 20 re-run + 2 regression | 100% of `src/pricing.js` branches |
| Phase 3 | Manual smoke / ATDD sign-off | End-to-end through `POST /api/reports/:id/send` | 1 | The real request path (`src/server.js:10-16`) |

**Methodology Selection** (reference:
`${CLAUDE_PLUGIN_ROOT}/docs/planning-techniques/10-testing-methodology-selection.md`,
the plugin's copy — read at plan time):

The framework's combination table gives *"Refactor legacy + add feature →
Characterization primary, TDD for new code, Snapshot tertiary"*, and
Characterization's trigger is *"Refactoring legacy code, extracting from
monolith, behavior unknown"* — which is exactly this deliverable. Its key
principle applies directly: **characterization tests document what code DOES,
not what it SHOULD do; they are change detectors, not correctness validators.**
That is why the `NaN` case and the `0.30000000000000004` artifact are *pinned*
rather than fixed. TDD is secondary, for `src/pricing.js` itself once the
target behaviour is known from the golden master. Property-based testing is a
tempting fit for "financial calculations", but is excluded because it needs a
generator library and the constraint is no new dependencies.

**Separate Test Authorship (LINT-18):** The characterization tests in Phase 1
must be authored from *observed behaviour of the running code* — by executing
the expression and recording actual output — before the extraction exists, and
committed separately. If an AI agent performs the Phase 2 extraction, the
Phase 1 suite is the human-owned gate it must satisfy, and the agent must not
be permitted to edit `tests/render.characterization.test.js` to make its own
change pass. With one engineer, the separation is temporal and by commit
boundary rather than by person; this is the achievable form of the rule at this
team size and is called out rather than silently skipped.

**AI Failure Mode Checks:**
- *Logic drift* — an AI asked to "extract pricing" will reach for training-data
  patterns (currency rounding, `Number()` coercion, input validation, throwing
  on bad rows). None exist in `src/reports.js:19`. Reviewer diffs the expression
  against `856a0bf`.
- *Stale deps* — check `package.json` is byte-identical after Phase 2; the
  constraint is no new dependencies.
- *Hidden business rules* — the `|| 0` defaulting *is* the business rule for
  missing fields, undocumented anywhere but that line. It is preserved
  deliberately, not by accident.
- *Tautological tests* — the Phase 2 unit tests must assert the ~20 values
  listed below (derived from the *old* code), not values re-derived by reading
  the new `computeTotal`.
- *Happy-path-only* — the table below is majority negative/edge cases by
  construction: 2 happy paths, 18 edge cases.

**Database Migration Testing:** Not applicable. No schema change, no migration
script, no data movement. The only DB access is two `SELECT`s
(`src/reports.js:3`, `:5`), untouched by this plan.

**Characterization Tests — required cases.** Every expected value below was
produced by running the current expression from `src/reports.js:19`, not
predicted:

| # | Input (`report`) | Actual current result | Why it matters |
|---|---|---|---|
| 1 | `{rows: []}` | `0` | empty |
| 2 | `{title:'x'}` (no `rows` key) | `0` | `\|\| []` guard |
| 3 | `{rows: null}` | `0` | `\|\| []` guard |
| 4 | `{rows:[{seats:3,unit_price:10}]}` | `30` | happy path |
| 5 | two normal rows | sum | happy path, multi-row |
| 6 | `{rows:[{unit_price:10}]}` | `0` | **missing `seats`** — named risk |
| 7 | `{rows:[{seats:3}]}` | `0` | **missing `unit_price`** — named risk |
| 8 | `{rows:[{}]}` | `0` | both missing |
| 9 | `{rows:[{seats:3,unit_price:null}]}` | `0` | null field |
| 10 | `{rows:[{seats:3,unit_price:undefined}]}` | `0` | undefined field |
| 11 | `{rows:[{seats:3,unit_price:0.1}]}` | **`0.30000000000000004`** | **float artifact, customer-visible** |
| 12 | rows of `1×0.1` and `1×0.2` | **`0.30000000000000004`** | summation order |
| 13 | three rows of `2×1.1` | **`6.6000000000000005`** | summation order |
| 14 | `{rows:[{seats:-3,unit_price:10}]}` | `-30` | negative seats |
| 15 | `{rows:[{seats:3,unit_price:-10}]}` | `-30` | negative price (credit) |
| 16 | `{rows:[{seats:'3',unit_price:10}]}` | `30` (number) | string coercion — no concatenation |
| 17 | `{rows:[{seats:'3',unit_price:'10'}]}` | `30` (number) | both strings |
| 18 | `{rows:[{seats:'abc',unit_price:10}]}` | **`NaN`** | renders `Total: NaN` to a customer |
| 19 | `{rows:[{seats:NaN,unit_price:10}]}` | `0` | `\|\|` coerces `NaN` to `0` — this is why `??` is forbidden |
| 20 | `{rows:[null]}` | **throws `TypeError: Cannot read properties of null (reading 'seats')`** | the message comes from the property access, not from the source text, so it survives extraction verbatim (verified both ways). Pin it with the object matcher `assert.throws(fn, { name: 'TypeError', message: "Cannot read properties of null (reading 'seats')" })`. A bare `assert.throws(fn)` passes on *any* thrown value and would not measure Success Criterion 5 |
| 21 | `{rows:{a:1}}` (non-array) | **throws `TypeError: (report.rows \|\| []).reduce is not a function`** | V8 builds this message from the **source text** of the callee, so the extraction necessarily changes it to `(rows \|\| []).reduce is not a function` (both strings verified by running them). What must be preserved is the error type and the failure mode, not the literal string: assert `assert.throws(fn, { name: 'TypeError' })` **and** `assert.match(err.message, /\.reduce is not a function$/)` on the caught error. Written that way from the start, the case needs no edit in Phase 2 — pinning the full message would force one, which the NO-GO criteria forbid |

**Assertion style: `assert.strictEqual`, never a tolerance.** The stated risk is
"a total changes for a customer." An epsilon comparison would pass
`0.3` against `0.30000000000000004` — which is exactly the bug class this plan
exists to prevent. Note `assert.equal(NaN, NaN)` passes in Node's assert
(verified), so case 18 is assertable normally.

**Shadow Mode:** Not applicable, and not proportionate. There is one call site
and the change is a verbatim expression move; the characterization suite gives
the same divergence signal for a fraction of the cost.

**Golden Master Fixtures:** No external fixture files. Each case is inline in
`tests/render.characterization.test.js` in the same style as
`tests/reports.test.js:4-9`, keeping the expected values readable in the diff —
which matters, because reviewing those values *is* the safety check.

## Team & Resources

**Required Skills:** Working JavaScript/Node.js, familiarity with CommonJS and
`node:test`. No specialist knowledge needed — the change is 1 line moved plus
~40 assertions. Read access to the staging database schema is needed for
Assumptions 1 and 2.

**Headcount:** 1 engineer, as constrained. All four phases are sequential, so a
second engineer would not compress the timeline.

**Impact on Other Work:** 3 engineer-days. Phase 0 additionally lands a
`package-lock.json` and `.gitignore`, which will conflict with any concurrent
branch that adds either — worth a heads-up if anyone else is working in this
repo. Nothing else in the repo is touched.

**Key Person Risk:** Low. The plan is self-contained: every expected test value
is written down in this document, so a replacement engineer can resume from any
phase boundary without re-deriving anything. The commit-per-phase structure
means partial work is always in a revertible, described state.

**Single Accountable Owner:** The assigned engineer. No name was supplied with
the constraints — see Open Questions. Every phase and dependency row in this
plan resolves to that same person plus the two external owners named in the
Dependencies table.

## Go / No-Go Criteria

### GO If:

- Phase 0 leaves `npm test` at `pass 2 / fail 0` (Assumption 3 closed).
- Assumptions 1 and 2 are answered from the real schema, or explicitly deferred
  by the owner with the acknowledgement that test realism — not correctness —
  is what is at stake.
- The engineer has three consecutive working days (Assumption 6 closed).
- Product confirms current totals are trusted (Assumption 5), so preserving
  them verbatim is the right goal.
- All ~21 characterization tests pass against unmodified source at the end of
  Phase 1.

### NO-GO If:

- `npm install` cannot resolve the three dependencies. Without a green
  baseline there is nothing to characterize, and a refactor with no safety net
  on a billing path is not acceptable at any timeline. Re-plan with vendored
  dependencies instead.
- A characterization test cannot be made to pass against the *unmodified*
  source — that means the behaviour is not what this plan documents, and the
  plan's premises must be re-derived before any code moves.
- Scope grows to include rounding, currency formatting, or tax. That is a
  customer-visible numeric change requiring product sign-off, a flag, and its
  own plan — not three days of extraction.
- A characterization test has to be *edited* in Phase 2 to make the extraction
  pass. Editing the change-detector to accept the change defeats the entire
  exercise.
- The timing log at `src/reports.js:21` cannot be preserved byte-identically —
  it is an explicit constraint from the requirements.

## Dependencies

| Dependency | Owner | Status |
| --- | --- | --- |
| npm registry reachable to install `express ^4.19.2`, `pg ^8.11.3`, `node-cron ^3.0.3` (`package.json:3`) | platform team | unverified — no `node_modules/` and no lockfile in the repo (verified by `test -f`) |
| Node.js ≥ 18 for the built-in `node:test` runner (`package.json:2`) | platform team | available — v24.12.0 verified in the plan-authoring environment |
| Read access to the staging `reports` table schema, to close Assumptions 1 and 2 | data / platform team | not requested yet |
| A reachable database — local Postgres or a staging instance — holding one seeded `reports` row with a populated `rows` column, for the Phase 3 smoke check. `POST /api/reports/:id/send` (`src/server.js:10-16`) calls `reports.get`, which issues a real `SELECT` (`src/reports.js:5`), so the check cannot run without one. The row is seeded from `tests/fixtures/report-real.json` | data / platform team | not requested yet |
| Product confirmation that current rendered totals are trusted (Assumption 5) | product owner | not requested yet |
| Three consecutive working days of the assigned engineer (Assumption 6) | engineering manager | not confirmed |
| Repository write access on `master` (current branch, HEAD `856a0bf`) | repository owner | available — working tree clean, verified |

No external APIs, vendors or licenses are involved, and there is no CI/CD system
to integrate with (verified: no CI config of any kind in the repo).

A database **is** required, but only for Phase 3. Phases 0–2 need none: the
characterization and unit tests call `render()` and `computeTotal()` with
literal objects, and while `require('../src/reports')` pulls in `src/db.js`,
that file only constructs a lazy `pg` `Pool` (`src/db.js:2`) and never connects
until a query runs — which is why Phase 0's exit criterion `node -e
"require('./src/reports')"` passes with `DATABASE_URL` unset. Phase 3 is
different: it drives the real HTTP route, which issues the `SELECT` at
`src/reports.js:5`, so it needs the seeded database in the row above.

## Evidence

Created: 2026-09-09 (quick-plan)

> This section explains WHY the tools, methods, and patterns in this plan
> are industry-proven choices. Each entry defines what it is, who uses it
> at scale, and why it works — then briefly connects it to this plan.

### Dependencies & Tools

This plan introduces **no new dependencies** — that is an explicit constraint.
The one tool it leans on more heavily than the repo does today is already
built into the runtime.

#### `node:test` (Node.js built-in test runner) — Node.js ≥ 18, Stability 2 (Stable) since v20

**Impact:** HIGH — the entire safety argument rests on this runner executing the
characterization suite; if it is unavailable or unstable, there is no net.
**What it is:** Node.js's built-in testing module and its `node --test` CLI
runner, requiring no third-party framework, plugin, or configuration file.
**Who uses it at scale:** It ships in every Node.js LTS release and is marked
*Stability: 2 – Stable* as of v20.0.0 — the Node.js project's highest
non-experimental designation, meaning API compatibility is maintained across
majors.
**Why it works:** Zero dependencies means zero supply-chain surface and zero
version drift between the test harness and the runtime under test. For a repo
with no lockfile and no CI, the fewer moving parts between "I wrote a test" and
"the test ran", the better.
**Reference:** [Test runner | Node.js Documentation](https://nodejs.org/api/test.html)
— fetched and verified at plan time; confirms both the `node:test` module and
the `--test` flag, and the Stability 2 designation.
**Connection to this plan:** Already the project's runner
(`package.json:2`: `"test": "node --test tests/"`) and already the style of
`tests/reports.test.js:1-2`. Phases 1 and 2 add files to `tests/` in that same
style, so no tooling change is needed to satisfy the no-new-dependency
constraint.

### Methods & Patterns

#### Characterization Testing / Golden Master

**Impact:** HIGH — this is the primary control against the single named risk
(a total changing for a customer); without it the extraction is unverifiable.
**What it is:** Tests written to capture what existing code *currently does*,
including its bugs and quirks, so that a subsequent refactor can be proven
behaviour-preserving. They are change detectors, not correctness validators.
**Origin:** Michael Feathers, *Working Effectively with Legacy Code* (2004) —
the standard enterprise reference for the technique, cited as
ENTERPRISE-VALIDATED in the plugin's own methodology framework alongside
ThoughtWorks' "test-first modernization" and Mechanical Orchard's Imogen
platform (banking, insurance, retail).
**Why it works:** It makes the tradeoff explicit — you *deliberately* freeze
current behaviour, bugs included, so that "did the refactor change anything?"
becomes a mechanical yes/no rather than a judgement call. The cost is that you
also freeze the bugs; the benefit is you find out immediately when you unfreeze
one.
**Reference:** `${CLAUDE_PLUGIN_ROOT}/docs/planning-techniques/10-testing-methodology-selection.md`,
§3 "Characterization / Golden Master Testing [ENTERPRISE-VALIDATED]" — read on
disk at plan time and quoted verbatim above; it carries both the trigger
("Refactoring legacy code, extracting from monolith, behavior unknown") and the
key principle, and lists the enterprise evidence (Feathers 2004, ThoughtWorks
test-first modernization, Mechanical Orchard's Imogen). The underlying primary
source is the print reference Michael Feathers, *Working Effectively with Legacy
Code*, Prentice Hall, 2004 — a book, so there is no URL to verify.
**Connection to this plan:** Phase 1 in full. It is why `NaN`
(case 18) and `0.30000000000000004` (case 11) are *pinned as expected values*
rather than treated as bugs to fix — fixing them here would be an unapproved
customer-visible change hiding inside a refactor.

#### Refactor-in-Place (pure function extraction)

**Impact:** HIGH — it is the chosen architecture; the alternatives were rejected
on proportionality grounds.
**What it is:** Improving internal structure without changing external
behaviour, here by lifting a self-contained expression into a named pure
function and calling it from the original site.
**Origin:** Martin Fowler, *Refactoring* (1999, 2nd ed. 2018) — "Extract
Function" is the canonical first refactoring in the catalogue.
**Why it works:** The tradeoff it makes explicit is *coupling vs. ceremony*.
Because the extracted expression is pure — no I/O, no state, no `this` — the
transformation is provably behaviour-preserving when the expression is copied
verbatim, so no coexistence machinery is needed to de-risk it. The cost is that
there is no gradual rollout: it is correct on merge or it is not.
**Reference:** Martin Fowler, "Extract Function", in *Refactoring: Improving the
Design of Existing Code*, 2nd ed., Addison-Wesley, 2018 — a print reference, so
there is no URL to verify. The behaviour-preservation claim is not left resting
on the catalogue's authority either: both forms of the expression — inline as
`(report.rows || []).reduce(...)` and extracted as `(rows || []).reduce(...)` —
were executed over all 21 cases of the Testing Strategy table at plan time, and
agree on 20 of 21. The one divergence is case 21's source-text-derived `TypeError`
message, which is why that case is pinned by error type and message suffix
rather than by literal string.
**Connection to this plan:** Phase 2, and the Options Analysis rationale for
rejecting Strangler Fig and Feature Flag as disproportionate to a 70-line
codebase with one call site.

#### Parallel Change / Strangler Fig (considered and rejected)

**Impact:** LOW — documented because it is the runner-up and the plan states the
condition for revisiting it, not because it is used.
**What it is:** Introducing a new implementation alongside the old, migrating
consumers incrementally, then removing the old one.
**Origin:** Martin Fowler ("Parallel Change", "Strangler Fig Application"),
cited as ENTERPRISE-VALIDATED in the plugin's methodology framework.
**Why it works:** It buys safety for changes with many consumers or a live
migration window, at the cost of temporarily doubling the surface area. Here
that tradeoff runs the wrong way: `render()` has exactly one in-repo caller
(`src/reports.js:13`), so the coexistence period would add divergence risk
rather than remove it.
**Reference:** Martin Fowler, "Parallel Change",
https://martinfowler.com/bliki/ParallelChange.html [URL VERIFICATION DEFERRED]
— fetch was attempted at plan time and not completed.
**Connection to this plan:** The Options Analysis, and the "would revisit if"
condition — a second pricing consumer, plausibly the currently-unused
`node-cron` dependency at `package.json:3`.

#### Separate Test Authorship

**Impact:** MEDIUM — it shapes the phase ordering and the Phase 2 stop
condition, but with one engineer it can only be enforced temporally.
**What it is:** The rule that whoever (or whatever) writes the implementation
does not write the tests that verify it.
**Origin:** Long-standing QA practice; codified for AI-assisted work as LINT-18
in the plugin's methodology framework, citing Anthropic's multi-agent code
review pattern.
**Why it works:** A single author converges on self-consistency — the test
encodes the same misunderstanding as the code. Separating authorship keeps the
test an independent statement of intent. The tradeoff is coordination cost.
**Reference:** `${CLAUDE_PLUGIN_ROOT}/docs/planning-techniques/10-testing-methodology-selection.md`,
§"Separate Test Authorship" and LINT-18 — read at plan time.
**Connection to this plan:** Why Phase 1 must be committed green *before* Phase
2 starts, and why "a characterization test had to be edited" is a NO-GO rather
than a nuisance.

## Open Questions

1. **Who is the assigned engineer?** The constraints specify "one engineer" but
   no name. Every Owner cell in this plan resolves to that one person plus the
   external owners in the Dependencies table. Needs a name before Phase 0.
2. **What is the real shape and column type of `reports.rows`?** No schema,
   migration, fixture or type definition exists anywhere in this repository
   (verified across all 7 tracked files) — `seats` and `unit_price` appear
   only at `src/reports.js:19` itself. Answer during Phase 0; record here.
3. **Does `Total: NaN` or `Total: 0.30000000000000004` reach customers today?**
   Both are reachable with the current code and would render literally into the
   email body (`src/reports.js:20`, `:14`). This plan preserves them
   deliberately. If they are in fact occurring in production, that is a real bug
   worth its own ticket — but fixing it inside this refactor would defeat the
   characterization suite. Flag to product; do not fix here.
4. **Should totals be rounded or currency-formatted?** Explicitly out of scope.
   It is a customer-visible numeric change needing product sign-off and its own
   test diff. If the answer is yes, sequence it as a *follow-up* change on top
   of the now-tested `src/pricing.js` — which is much of the point of extracting
   it.
5. **Should CI be added?** There is no CI of any kind (verified), which is why
   a broken `npm test` went unnoticed. It is the highest-value follow-up after
   this plan, and adding it is not costed into the three days. **Owner: the
   platform team**, who already own the registry and runtime rows in the
   Dependencies table. The assigned engineer raises the ticket at Phase 3 close
   (2026-09-14); the platform team returns a scope and a schedule by
   **2026-09-25**. Until that lands, the enforcement is the pre-merge `npm test`
   step written into `README.md` in Phase 3 and honoured by the repository owner
   at review — see Risk 11.
6. **Is there a planned `node-cron` job?** The dependency is declared at
   `package.json:3` and `require`d nowhere. If a scheduled report-sender is
   coming, it would become the second pricing consumer and would change the
   "would revisit Strangler Fig" calculus. Worth a five-minute check with
   whoever added it.

## Plan Confidence

**[Confidence: 90%] — Med-High.** Design is verified against a fully-read
codebase; execution confidence is capped by the two data-shape assumptions,
which close inside Phase 0, and by the absence of team velocity data.

Derivation: 7/7 tracked files read in full (100%); 21/21 characterization
expected values produced by executing the actual expression, not predicted;
7/7 referenced existing file paths confirmed present via `test -f`; baseline
test state confirmed by running `npm test` and observing the failure.
Headline is the floor of its components below, not an average.

| Section | Evidence Basis | Basis |
|---------|---------------|-------|
| Problem Statement | A-HIGH | All 7 tracked files read in full; `npm test` executed and its failure output recorded; `test -f` confirmed the absence of `.gitignore`, `package-lock.json`, `node_modules/` and any CI config |
| Architecture — chosen pattern | B-HIGH | `render()`'s single call site traced by reading every file (`src/reports.js:13` is the only caller); purity of the expression confirmed by reading `src/reports.js:16-23` |
| Architecture — "no prior art" claim | A-HIGH | Negative claim verified by reading all 4 `src/` files; none exports a dependency-free pure computation. The plan explicitly does *not* claim to follow an existing pattern |
| Options Analysis | B-HIGH | Rejections rest on verified facts (one call site; no config plumbing beyond `DATABASE_URL` at `src/db.js:2` and `PORT` at `src/server.js:18`) rather than on general preference |
| Phase 0 scope | A-HIGH | The red baseline was reproduced: `Cannot find module 'pg'`, `pass 0 / fail 1`, exit 1 |
| Phase 1 & 2 scope | A-HIGH | Line numbers, the exact expression, and the export list verified by reading `src/reports.js`; every expected test value computed by running the real expression |
| Characterization value table | A-HIGH | All 21 values produced by executing `(report.rows \|\| []).reduce(...)` directly and recording actual output, including both `TypeError` messages and the `assert.equal(NaN, NaN)` behaviour |
| Testing methodology selection | A-HIGH | The plugin's methodology framework was read in full (345 lines); Characterization's trigger and the "Refactor legacy" combination row match this deliverable directly |
| Timeline estimates | C-MEDIUM | Derived from a line-count proxy (70-line codebase, 1 line moved, ~40 assertions) and confirmed weekday arithmetic. **No historical velocity data for this team exists.** `[VERIFY WITH AUTHOR]` |
| Team & Resources | C-LOW | Only the stated constraint ("one engineer, three days") is known. No name, no calendar, no competing commitments. `[VERIFY WITH AUTHOR]` |
| `report.rows` shape (Assumptions 1–2) | C-LOW | **No evidence in the repository at all** — no schema, migration, fixture or type. Inferred solely from the field names read at `src/reports.js:19`. `[VERIFY WITH AUTHOR]` |
| "No external callers of `render`" (Assumption 4) | B-MEDIUM | Verified across all 7 tracked files of *this* repository only. `[CODEBASE-CLAIM-NOT-VERIFIED]` for anything outside it — coverage of a known set is not proof the set is complete |
| Dependency resolvability (Assumption 3) | A-HIGH | `npm install --dry-run` executed at plan time: exit 0, 85 packages, `express 4.22.2` / `pg 8.23.0` / `node-cron 3.0.3`. No `node_modules/` or lockfile written; working tree verified clean afterwards |

**Tier distribution:** 3 sections Tier C of 13 (23%), confined to timeline,
team, and the two data-shape unknowns — none of them touching the correctness of
the extraction itself. That is inside the framework's 30% threshold, and every
Tier C row carries `[VERIFY WITH AUTHOR]`. The headline is held below the
design-evidence tier by execution unknowns, not by evidence gaps.

**Cascade classification:** CASCADE. Pricing is a payment-flow path, which the
self-audit framework classes as CASCADE regardless of fan-out count. Risks 1–3
all resolve to the same customer-visible number and should be reviewed as one
group.

**Risk:** MEDIUM impact / LOW likelihood / LOW reversibility cost. Reported
separately from confidence. Blast radius is one HTTP route and the emailed
report body; a wrong total is externally visible and not auto-detectable, which
raises impact. Reversibility is a single `git revert` with no data component,
which keeps the cost low.

**De-risking factors verified present and effective:** every expected test value
derived from executing the real code rather than predicted (removes the largest
class of characterization error); the extraction is identity-preserving by
construction for any input, so the unknown row shape does not threaten
correctness; commit-per-phase means a Phase 2 revert retains the Phase 1 safety
net; and the exact anti-patterns that would break it (`??`, `toFixed`,
re-association) are each named with the test case that catches them.

**Remaining headroom, and how each closes:**
- Assumptions 1–2 (row shape and `pg` type parsing) — close by reading the
  staging `reports` table schema and one real row, Phase 0.
- Timeline (Tier C) — would close with historical velocity data for this team,
  which does not exist. It will not close before execution; treat 3 days as a
  constraint the plan fits, not a measurement.
