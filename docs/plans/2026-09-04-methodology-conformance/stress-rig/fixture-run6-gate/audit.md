# Plan Audit Report
Generated: 2026-09-09
Plan reviewed: Extract Pricing Arithmetic from `render()` into `src/pricing.js`
Document under audit: `docs/specs/move-the-pricing-arithmetic-out-of-render-into-its-own-module-with-tests.md` (audited via a canary-mutated working copy; see the caller note below)
Auditor: Toque Plan Auditor v1.0
**Audit mode: LITE (spec-only). For full gap matrices, run `/toque:plan`.**

**Caller note — canary and strip (design gate; not part of the audit).** This audit ran on
a canary-mutated working copy, as the gate requires: one defect was planted before the
auditor was spawned, the auditor was not told, and it found it (class `owner-strip`,
criterion LINT-04 — the Owner cell of the first Dependencies row was blanked). The caller
has since stripped that finding and re-derived it on the committed document, where all
seven Dependencies rows name an owning team: LINT-04 UNMET to MET, the Coverage Matrix row
for the npm-registry dependency GAP to COVERED, one Top-5-Risks row removed, and the GO-If,
Recommendation, Gaps and Suggested Modifications entries that named it struck. Every
evidence record was re-anchored to the committed document. The planted defect replaced one
line rather than inserting one, so no line numbers moved and every reference below is
already a coordinate in the committed document.

## Executive Summary

This is a high-evidence plan for a small, well-bounded refactor: one 90-character
expression moved out of an HTML renderer into a dependency-free module, guarded by
characterization tests written against the unmodified source before any code moves.
Its biggest strength is that its factual claims survive independent re-checking — I
re-ran every codebase and runtime claim I could reach and 41 of 42 held exactly as
written, including both `TypeError` messages, the `0.30000000000000004` float
artifact, and the red baseline (`Cannot find module 'pg'`, `pass 0 / fail 1`). The
one finding it recorded as a gap — a blank Owner cell in the
Dependencies table's first row — was the design gate's own planted canary, and the
committed document names an owner in every row, so no applicable criterion is unmet.
The remaining items are warnings rather than gaps, chiefly that the post-merge
control quotes `pass N / fail 0` without pinning `N`, so a deleted test still reads
green.

Notes on inputs: a `.canary/canary.json` file sits beside the document I was handed.
My forbidden inputs bar reading the gate's canary record, and I did not open it. The
document carries no `**Audit note:**` blocks and no `Last reinforced:` line, so no
prior verdict reached me.

## Criterion Verdicts

Records live in `evidence/{criterion_id}.json` beside this report, one per applicable
criterion. Applicable set: the registry's Phase 5 rules for Lite mode — LINT-01
through LINT-10 and LINT-13 through LINT-24 (22 rules; LINT-11 and LINT-12 are
Full-mode only).

| Criterion | Verdict | Record |
|---|---|---|
| LINT-01 | MET | `evidence/LINT-01.json` |
| LINT-02 | MET | `evidence/LINT-02.json` |
| LINT-03 | MET | `evidence/LINT-03.json` |
| LINT-04 | MET | `evidence/LINT-04.json` — caller re-derived after the canary strip |
| LINT-05 | MET | `evidence/LINT-05.json` |
| LINT-06 | MET | `evidence/LINT-06.json` |
| LINT-07 | MET | `evidence/LINT-07.json` |
| LINT-08 | MET | `evidence/LINT-08.json` |
| LINT-09 | MET | `evidence/LINT-09.json` |
| LINT-10 | MET | `evidence/LINT-10.json` |
| LINT-13 | MET | `evidence/LINT-13.json` |
| LINT-14 | MET | `evidence/LINT-14.json` — caller-decided |
| LINT-15 | MET | `evidence/LINT-15.json` |
| LINT-16 | MET | `evidence/LINT-16.json` |
| LINT-17 | MET | `evidence/LINT-17.json` |
| LINT-18 | MET | `evidence/LINT-18.json` |
| LINT-19 | MET | `evidence/LINT-19.json` |
| LINT-20 | MET | `evidence/LINT-20.json` |
| LINT-21 | MET | `evidence/LINT-21.json` |
| LINT-22 | MET | `evidence/LINT-22.json` |
| LINT-23 | MET | `evidence/LINT-23.json` |
| LINT-24 | MET | `evidence/LINT-24.json` |

## Verdict Summary

- MET: 22
- UNMET: 0
- N_A: 0

(As the auditor returned them: MET 20, UNMET 1, N_A 1. The caller then stripped the
planted canary and re-derived its criterion on the committed document, and decided LINT-14
from the baseline comparison, which the auditor is never given.)

UNMET criteria — one row per witness:

(none — the single witness the auditor returned was the gate's own planted canary,
stripped by the caller and re-derived on the committed document.)

The counts and the UNMET list above are the audit result. I have not been told where
the pass cut sits and do not state whether this document clears it; the caller owns
the gate.

## Detailed Findings

### What the Plan Gets Right

1. **Every expected test value was produced by execution, not prediction, and it
   holds.** I re-ran the current expression over the cases the plan pins and
   reproduced `0.30000000000000004` (cases 11 and 12), `6.6000000000000005` (case
   13), `NaN` (case 18), `0` for `NaN` seats (case 19), and both `TypeError`
   messages. `HIGH [A]: executed \`(report.rows || []).reduce((sum,r) => sum +
   (r.seats||0)*(r.unit_price||0), 0)\` on Node v24.12.0 over each case; output
   matched the table at lines 493–515 in all checked rows.`
2. **The one case where extraction genuinely changes observable behaviour is found,
   explained and correctly pinned.** Case 21 notes V8 builds `… .reduce is not a
   function` from the callee's source text, so the message necessarily changes on
   extraction; the plan pins type plus a suffix regex instead of the literal string.
   `HIGH [A]: ran both forms — inline yields "(report.rows || []).reduce is not a
   function", extracted yields "(rows || []).reduce is not a function", exactly as
   line 515 states.` This is the kind of detail that normally surfaces mid-Phase-2
   as an unexplained red test.
3. **The red baseline is disclosed rather than papered over.** Lines 32–35 state the
   suite fails today with `Cannot find module 'pg'`, `pass 0 / fail 1`. `HIGH [A]:
   ran \`npm test\` — reproduced \`pass 0 / fail 1\`, duration 121.7ms.` Phase 0
   exists solely to fix that before anything is characterized.
4. **Phase ordering is load-bearing and the plan says why.** Characterization tests
   land in their own commit before the extraction, because a suite written after the
   refactor "proves only that the new code agrees with itself" (line 99–100). The
   Phase 2 entry criteria, the critical path and the NO-GO list all enforce it.
   `HIGH [B]: lines 97–100, 254–256, 421–424, 583–585, full file read.`
5. **The comparison artifact is a committed, re-runnable test, not a terminal
   observation.** Case 22 is captured in Phase 1 against unmodified `render()` and
   re-run by `node --test tests/render.characterization.test.js` in Phase 3.
   `HIGH [B]: lines 220–226, 313–315.`
6. **Options analysis rejects alternatives on repository facts, not taste.** The
   feature-flag row cites that the only `process.env` uses in the repo are
   `DATABASE_URL` and `PORT` — which I confirmed at `src/db.js:2` and
   `src/server.js:18`. `HIGH [A]: read all four \`src/\` files; those are the only
   two \`process.env\` reads.`
7. **The measurement critique is built in.** The plan rules out an epsilon
   comparison (it would pass `0.3` against `0.30000000000000004`) and rules out a
   bare `assert.throws` (it "passes on *any* thrown value and would not measure
   Success Criterion 5"). `HIGH [B]: lines 514, 517–521.`
8. **Confidence reporting is derived, not asserted.** The headline is stated as the
   floor of its components with a coverage derivation (7/7 files, 21/21 values),
   and every Tier C row carries `[VERIFY WITH AUTHOR]`. `HIGH [B]: lines 784–814.`

### Gaps That Must Be Addressed

1. **[MEDIUM severity, warning] `pass N / fail 0` does not detect a deleted test.**
   Risk 11's interim control requires a reviewer to quote "a `pass N / fail 0` run
   of the full suite" (line 356), but `N` is unpinned. Removing
   `tests/render.characterization.test.js` lowers `N` and still prints `fail 0`.
   *Suggested addition:* pin the expected count — "`pass 42 / fail 0` or higher,
   and any decrease is a blocking review comment" — in the README line Phase 3
   writes. `HIGH [B]: line 356, full file read.`
2. **[MEDIUM severity, warning] Three dependencies are "not requested yet" against a
   timeline with no slack.** Staging schema read access, a seeded database for the
   Phase 3 smoke check, and product confirmation all sit at "not requested yet"
   (lines 595–597), while the timeline concedes "3 working days … with no slack to
   spare" (line 430) and Phase 0 starts 2026-09-10 AM. *Suggested addition:* a lead
   time and a request date per row, raised before Phase 0 rather than at the phase
   that needs them. `HIGH [B]: lines 414–417, 430, 595–597.`
3. **[LOW severity, warning] The lockfile's re-run command is never named.**
   `package-lock.json` is committed "so the baseline is reproducible" (line 170),
   but no phase names `npm ci` — the command that actually consumes a lockfile
   deterministically. Phase 0 names `npm install`, which can still update it.
   *Suggested addition:* one clause in Phase 0's exit criteria — after the lockfile
   is committed, the reproducible install is `npm ci`. `MEDIUM [B]: lines 156–188;
   \`npm ci\` appears nowhere in the document (grep).`
4. **[LOW severity, warning] No volume case in the characterization table.** All 21
   cases use 0–3 rows; nothing exercises a large `rows` array. The plan's own
   argument covers this — a verbatim copy preserves the reduction shape, so
   behaviour at any length is identical by construction (Design Decision 2) — so
   this is not a correctness gap. *Suggested addition:* one case with a few hundred
   generated rows, purely so the accumulated float sum is pinned too. `MEDIUM [C]:
   absence-based; read the full case table at lines 493–515. [PLAN-GAP-INFERRED]`

### Top 5 Risks

| # | Risk | Likelihood | Impact | In Plan? | Mitigation |
|---|------|-----------|--------|----------|-----------|
| 1 | Post-merge erosion: no CI exists, and the interim human control quotes `pass N / fail 0` with `N` unpinned, so removing the characterization file still reads green | HIGH | MEDIUM | PARTIAL (Risk 11 names the human gate and its automated replacement, but not a pinned count) | Pin the expected pass count in the README line, and treat any decrease as a blocking review comment until the platform team's CI lands (Open Question 5, due 2026-09-25) |
| 2 | Phase 3 cannot run: the seeded database and staging schema access are unrequested, unscheduled, and owned outside the team, against a zero-slack 3-day plan | MEDIUM | MEDIUM | PARTIAL (both are Dependencies rows with owners; neither has a lead time or request date) | Raise both requests before Phase 0 starts; define what Phase 3 degrades to if the database is unavailable, as Phase 1 already does for the fixture |
| 4 | Transcription drift in the expression — `\|\|` becomes `??`, or the reduction is re-associated — shifting customer totals | MEDIUM | HIGH | YES (Risks 1–3) | Already strong: copy/paste mandated, `NaN`/string/float-artifact cases pinned as literal strings, characterization suite must pass unedited or Phase 2 is a hard stop |
| 5 | Assumptions 1 and 2 close in Phase 0 against a schema nobody has access to yet, so the fixture degrades to hand-written and case 22's realism is lost | MEDIUM | LOW | YES (line 214–219 pre-authorises the degraded path and says only realism, not function, is lost) | Accept as written; the plan's own argument that extraction correctness is row-shape-independent is sound and I verified the expression is pure |

*(One row was removed by the caller: it rested entirely on the canary-blanked Owner
cell, which the committed document does not contain. Four risks remain.)*

## Go / No-Go Assessment

This section assesses readiness to *execute the project*. It is not a verdict on
whether the document clears the audit gate — that is the caller's to apply.

### GO If:
- The staging schema request and the seeded-database request are raised and
  acknowledged before Phase 0 starts, or Phase 3 is explicitly re-scoped to the
  degraded path the plan already pre-authorises for the fixture.
- Phase 0 ends at the literal `pass 2 / fail 0` the plan requires.
- The assigned engineer is named (Open Question 1) and has the three consecutive
  days (Assumption 6).

### NO-GO If:
- `npm install` cannot resolve the three dependencies — the plan's own first NO-GO,
  and correct: a billing-path refactor with no green baseline has no safety net.
- A characterization test has to be edited in Phase 2 to make the extraction pass.
- Scope grows to include rounding, currency formatting or tax.
- The timing log at `src/reports.js:21` cannot be preserved byte-identically.

### Recommendation: CONDITIONAL-GO
The design is sound and unusually well evidenced; the conditions above are
administrative, not architectural. No applicable criterion is unmet once the gate's
own planted defect is removed, and the warnings are one-line additions. Nothing found
here questions the approach, the phasing, or the safety argument.

## Leadership Presentation Outline

1. **The problem in one line.** The line deciding what a customer is billed lives
   inside an HTML renderer and has zero test coverage. Show `src/reports.js:19`.
2. **What we are and are not changing.** Move the line; change no output. Show the
   before/after diagram at lines 105–118 and state plainly that
   `Total: 0.30000000000000004` stays exactly as it is today.
3. **How we will know it worked.** ~21 tests written against today's code, before
   anything moves, that must pass unedited afterwards. Editing one is a stop.
4. **What it costs and when.** 3 working days, one engineer, sequential; 2.9 days
   estimated with 30% buffer, so the constraint is met with no slack.
5. **What could go wrong and what we do about it.** One slide: a wrong total is
   emailed to a customer and nothing detects it automatically — which is exactly
   why the characterization suite exists. Name the revert: one `git revert`, no data
   component.
6. **The ask, and the follow-up.** Staging schema read access and a seeded database
   for the smoke check; and the real finding — there is no CI at all, which is why a
   broken `npm test` went unnoticed. That is the highest-value next investment and
   is not costed into these three days.

## Suggested Modifications

Ordered by priority:

1. Pin the expected pass count in Risk 11's interim control and in the README line
   Phase 3 writes, so a removed test file is detectable by the human gate.
2. Add a lead time and a request date to the three "not requested yet" Dependencies
   rows, and raise them before Phase 0 rather than at the phase that consumes them.
3. Name `npm ci` in Phase 0's exit criteria as the reproducible-install command the
   committed lockfile enables.
4. Add one high-row-count case to the characterization table, so the accumulated
   float sum is pinned alongside the small cases.
5. Optional: state a Phase 3 fallback if the seeded database does not arrive, in the
   same style as the fixture fallback already written at lines 214–219.

## Gap Verification (CHECK 4)

### A. Coverage Matrix

| Item | Type | Covered By | Status |
|------|------|-----------|--------|
| SC1: `npm test` exits 0, two `canView` tests pass | Goal | Phase 0 exit criteria (:164), Phase 2 exit (:265–266) | COVERED |
| SC2: byte-identical HTML for ~20 inputs, `strictEqual` | Goal | Phase 1 exit (:201–207), Phase 2 (:282–284), case table (:493–515) | COVERED |
| SC3: `src/reports.js:21` unchanged in the diff | Goal | Phase 2 exit (:260), Phase 2 Go/No-Go (:293–295), NO-GO (:586) | COVERED |
| SC4: zero `require`s in `src/pricing.js`, deps unchanged | Goal | Phase 2 exit (:258, :267) | COVERED |
| SC5: null-row `TypeError` message preserved | Goal | Case 20 object matcher (:514), Phase 1 exit (:207) | COVERED |
| Desired: `src/pricing.js` is a pure, dependency-free module | Goal | Phase 2 deliverable (:270), Design Decision 4 (:87–90) | COVERED |
| Non-goal: no rounding, `toFixed`, or currency formatting | Non-goal | Design Decision 3 (:81–85), Risk 2, Open Question 4, NO-GO (:580–582) | COVERED |
| Non-goal: no new dependencies | Non-goal | SC4, Evidence §Dependencies (:623), AI check "Stale deps" (:474) | COVERED |
| Non-goal: no schema or data migration | Non-goal | Data Rollback (:398–400), DB Migration Testing (:485–487) | COVERED |
| Non-goal: CI is not in scope | Non-goal | Open Question 5 (:767–775), owner and date assigned | COVERED |
| Risk 1–3 (arithmetic drift) | Risk | Phase 1 suite; cases 11–13, 16–19 | COVERED |
| Risk 4 (timing-log span) | Risk | Phase 2 exit (:261–263), Go/No-Go (:294) | COVERED |
| Risk 5 (no green baseline) | Risk | Phase 0 hard gate, NO-GO (:573–576) | COVERED |
| Risk 6–7 (lockfile, `node_modules`) | Risk | Phase 0 deliverables (:170–171), exit (:166) | COVERED |
| Risk 8–9 (row shape, `pg` types) | Risk | Assumptions 1–2, Phase 0 | COVERED |
| Risk 10 (out-of-repo `render` consumers) | Risk | Assumption 4, Phase 3; self-flagged `[CODEBASE-CLAIM-NOT-VERIFIED]` | COVERED (limits stated) |
| Risk 11 (no CI enforces the tests) | Risk | Phase 3 README control + Open Question 5 | PARTIAL — control cannot detect a removed test (Gap 2) |
| Dep: npm registry reachable | Dependency | Dependencies row (:593), owner platform team | COVERED |
| Dep: Node ≥ 18 for `node:test` | Dependency | Dependencies row (:594), owner platform team, verified v24.12.0 | COVERED |
| Dep: staging `reports` schema read access | Dependency | Dependencies row (:595), owner data / platform team | PARTIAL — "not requested yet", no lead time (Gap 3) |
| Dep: reachable seeded database for Phase 3 | Dependency | Dependencies row (:596), owner data / platform team | PARTIAL — "not requested yet", no lead time (Gap 3) |
| Dep: product confirmation of current totals | Dependency | Dependencies row (:597), owner product owner | PARTIAL — "not requested yet" |
| Dep: three consecutive engineer-days | Dependency | Dependencies row (:598), owner engineering manager | COVERED (unconfirmed, owned) |
| Dep: repository write access on `master` | Dependency | Dependencies row (:599), owner repository owner | COVERED |

**24 items, 1 gap, 5 partial.**

### B. Assumption Register

| # | Assumption | Impact If False | How to Verify | By When | Owner | Status |
|---|-----------|----------------|---------------|---------|-------|--------|
| 1 | `report.rows` is an array of `{seats, unit_price}` objects | MEDIUM — fixtures unrealistic; extraction correctness unaffected | Staging schema + one real row | Phase 0 | assigned engineer | unverified |
| 2 | `pg` returns `NUMERIC` as JS strings | MEDIUM — string/`NaN` branches are dead cases | Column type + `pg` type-parser OID behaviour | Phase 0 | assigned engineer | unverified |
| 3 | Declared ranges resolve into a coherent tree | Would have been HIGH — no baseline, nothing to characterize | `npm install --dry-run` | closed at plan time | assigned engineer | **verified** (plan records exit 0, 85 packages; not re-run by this audit — no registry access) |
| 4 | `render()` has no callers outside this repository | MEDIUM-LOW — signature is preserved regardless | Search the wider org's repos | Phase 3 | assigned engineer | unverified, self-flagged `[CODEBASE-CLAIM-NOT-VERIFIED]` |
| 5 | Existing rendered totals are correct, not merely current | MEDIUM — a pre-existing billing bug is faithfully preserved (status quo, not a new defect) | Product confirms totals are trusted | Phase 3 | product owner | unverified |
| 6 | One engineer available three consecutive days | MEDIUM — timeline slips; phases cannot be parallelised | Confirm with the engineer's manager | Before Phase 0 | engineering manager | unverified |

**6 total, 0 unverified-or-falsified HIGH-impact.** Auditor note: assumption 5 is the
only register row whose impact the document leaves unrated in the cell itself; the
Gate status paragraph (:374–383) classes it as a Phase 3 confirmation. I concur that
it is not HIGH — if it is false, the system behaves exactly as it does today, and the
plan routes the finding to a separate ticket (Open Question 3) rather than absorbing
it. `MEDIUM [C]: judgment on impact rating, from the document's own reasoning.`

### C. Scenario Matrix

| Scenario | Planned? | Which Phase? | Tested? | Monitored? | Status |
|----------|----------|-------------|---------|-----------|--------|
| Happy path | YES | Phase 1, 2 | YES — cases 4, 5 | NO (no CI; stated) | COVERED |
| Failure path | YES | Phase 1, 2 | YES — cases 18 (`NaN`), 20, 21 (both `TypeError` forms) | NO (stated) | COVERED |
| Partial rollout (mixed state) | YES — ruled out by construction | Options Analysis (:130–140), Rollback (:393–396) | N/A — one atomic deploy unit, one call site | N/A | COVERED |
| Backward compatibility | YES | Risk 10, Assumption 4; signature and return type preserved | YES — full-HTML golden master is the compat check | NO (stated) | COVERED |
| Scale/volume edge | PARTIAL | Design Decision 2 argues identity by construction | NO — max 3 rows in the case table | NO | WARNING (Gap 5) |
| Auth/permission edge | YES | Unchanged; `canView` re-run as regression (:285) | YES — the two existing tests | NO | COVERED |
| Config/environment difference | YES | Phase 0 exit: `node -e "require('./src/reports')"` with `DATABASE_URL` unset (:165) | YES — that command is the check | NO | COVERED |
| Rollback path | YES | Every phase (:182, :237, :287, :334); Kill Switch (:391–396) | PARTIAL — revert is described but not rehearsed | N/A | COVERED |

**8 scenarios, 0 gaps, 1 warning.**

### D. Cross-Cutting Concern Sweep

| Concern | Addressed? | Where? | Status |
|---------|-----------|--------|--------|
| API contract | YES | Risk 10 (:355), Assumption 4 — `render` signature, async-ness and return type preserved | COVERED |
| UI behavior | YES | SC2 — full HTML string pinned byte-for-byte, `${total}` stringification included (:204) | COVERED |
| Auth/authz | YES | Untouched; `canView` regression in Phase 2 (:285); blast radius excludes `GET /api/reports` (:404) | COVERED |
| Config | YES | Only `DATABASE_URL` and `PORT` exist (:134); Phase 0 exit proves load without a DB (:165, :604–611) | COVERED |
| CORS/network/browser | N/A | Server-side pure-function extraction; no network or browser surface changes | PASS (condition absent) |
| Data model/query limits | YES | Two `SELECT`s only, both untouched (:398–400, :486–487) | COVERED |
| Pagination | N/A | No listing or paging surface is touched; `rows` is consumed whole today and after | PASS (condition absent) |
| Caching | N/A | No cache exists in the repo and none is introduced | PASS (condition absent) |
| Observability | YES | The timing `console.log` is a byte-identical constraint (:45, :260–262, Risk 4); the absence of CI is stated, not claimed away | COVERED |
| Migration/backward compat | YES | No schema change, no data movement (:398–400); compat via golden master | COVERED |
| Rollout/rollback | YES | Per-phase rollback, Kill Switch, commit-per-phase so a Phase 2 revert keeps the Phase 1 net (:287–291) | COVERED |
| Tests | YES | Testing Strategy table, 21-case characterization table, methodology justified against the framework | COVERED |

**12 concerns, 0 gaps.**

### Plan Lint Results

Rule and Description columns copied verbatim from
`${CLAUDE_PLUGIN_ROOT}/docs/planning-techniques/lint-registry.md`. Lite mode set:
LINT-01–10, LINT-13–24 (22 rules).

| Rule | Description | Result |
|------|-----------|--------|
| LINT-01 | Every goal has at least one mapped ticket | PASS |
| LINT-02 | Every HIGH risk has a mitigation | PASS |
| LINT-03 | Every deployment phase has a rollback plan | PASS |
| LINT-04 | Every external dependency has an owner | PASS — caller re-derived: all seven Dependencies rows (:593–:599) name an owning team |
| LINT-05 | Every new endpoint/API has a contract or test entry | PASS — no new endpoint; the one new module API, `computeTotal`, has `tests/pricing.test.js` |
| LINT-06 | Backward compatibility claimed but no mixed-state scenario | PASS — compat claimed and the reachable mixed state (Phase 1 kept, Phase 2 reverted) is described |
| LINT-07 | Every new behavior has a test or test delta | PASS |
| LINT-08 | No unverified or falsified HIGH-impact assumption exists | PASS — the one HIGH-impact assumption (3) was closed at plan time |
| LINT-09 | No unaddressed cross-cutting concern for in-scope features | PASS |
| LINT-10 | Every phase has go/no-go criteria | PASS |
| LINT-13 | Approach has options analysis with min 2 alternatives evaluated | PASS — three alternatives evaluated |
| LINT-14 | No regressions from previous baseline | PASS (caller-decided) — compared against the run-1 baseline: 0 regressions, 14 improvements, 2 degradations, 0 auditor-variance flips |
| LINT-15 | All "Tested" claims have verified test infrastructure | PASS — the only test path claimed as existing today, `tests/reports.test.js`, exists; no phase relies on a path created by a later phase |
| LINT-16 | All "Monitored" claims have verified monitoring infrastructure | PASS — no monitoring is claimed; the absence of CI is stated and the Risk 11 control is labelled a human gate |
| LINT-17 | Every deliverable in Phase 4 spec must have a testing methodology assigned | PASS |
| LINT-18 | AI-generated code deliverables must specify a separate test writer | PASS — the AI case is named with the human-owned suite the agent may not edit; the one-engineer case is separated temporally and by commit, and stated as such |
| LINT-19 | Confidence brief exists with no unresolved HIGH-impact markers | PASS — the one unresolved marker sits on a LOW-impact entry (warning) |
| LINT-20 | Confidence brief exists and each entry has its required fields | PASS — 5 entries, each with "What it is", "Why it works", "Connection to this plan" |
| LINT-21 | Every mitigation for a silent-failure risk names a signal not derived from the same filtered source as the failure | PASS — expected values captured from the unmodified code before the change; tolerance comparison explicitly forbidden |
| LINT-22 | Every stated ordering between deployable artifacts names the mechanism that enforces it | PASS — entry criteria, commit boundaries and a NO-GO condition all enforce Phase 1 before Phase 2 |
| LINT-23 | Every rollback artifact the plan itself creates is re-runnable and created at the point whose state it preserves | PASS — case 22 is created in Phase 1 before code moves and re-runs on demand from a committed path |
| LINT-24 | Every named measurement exercises the property its requirement states | PASS — bare `assert.throws` and epsilon comparison are both named and rejected as non-measuring |

### Gap Summary

- Lint: 22/22 passed, 0 failed, 0 N_A (LINT-14 caller-decided MET against the run-1 baseline)
- Coverage Matrix: 24 items, 0 gaps (5 partial)
- Assumptions: 6 total, 0 unverified or falsified high-impact
- Scenarios: 8 total, 0 gaps
- Cross-Cutting: 12 concerns, 0 gaps
- Total gaps: 0 (the LINT-04 FAIL and the one coverage gap were the same planted canary,
  stripped by the caller and re-derived on the committed document)
- Total warnings: 5 (Risk 11's unpinned `pass N`; three unrequested dependencies with
  no lead time; the unnamed `npm ci`; the missing volume case; the LOW-impact
  `[URL VERIFICATION DEFERRED]` marker)
- **Gap-checked: YES** — every applicable lint rule passes, and the coverage, scenario,
  cross-cutting and infrastructure outputs each carry zero gaps. Five warnings remain and
  are listed above; a warning is not a gap.

## Confidence Summary

| Tier | Count | Meaning |
|------|-------|---------|
| HIGH [A] (Deterministic) | 14 | Binary keyword check, file existence, or executed command |
| HIGH [B] (Verified) | 21 | Direct evidence from plan text or codebase, full file read |
| MEDIUM [B] (Inferred) | 3 | Indirect evidence, likely correct |
| LOW [C] (Speculated) | 2 | Agent judgment, verify with author |
| UNVERIFIED | 0 | No evidence found, excluded from verdicts |

No finding in this report rests on an unverifiable claim, so there is no
`[UNVERIFIED]` section. Two findings carry judgment flags:
`[PLAN-GAP-INFERRED]` on the missing volume case (Gap 5, absence-based detection),
and the assumption-5 impact rating in Register note B (`MEDIUM [C]`).

**[Confidence: 93%] — High.**
Derivation: 22/22 applicable criteria evaluated against the full document (840 lines,
read in full); 41/42 externally checkable plan claims re-verified by execution or by
reading the cited file (98%); 7/7 tracked repository files read in full; 22/22
evidence records written with LF-normalised `sha256` pins before this report.
Headline is the floor of its components, not an average.

| Component | Confidence | Basis |
|---|---|---|
| Codebase and runtime claim verification | 98% | Every line reference, the expression text, both `TypeError` messages, the float artifacts, the red baseline and the absent-infrastructure claims re-checked directly |
| Lint verdicts on structurally checkable rules (01–05, 07, 10, 13, 17, 20) | 97% | Presence/absence checks against the full document; the Owner column was extracted by command rather than read by eye |
| Lint verdicts on judgment rules (06, 08, 09, 15, 16, 18, 19, 21–24) | 93% | Each rests on quoted text, but the trigger-condition reading is mine; LINT-18 and LINT-21 are the two where a reasonable second auditor could differ |
| Gap matrices | 90% | Built from the spec alone — Lite mode has no `intent.md`, so goals are inferred from Success Criteria rather than read from a stated intent |

`Assumption:` the Lite-mode rule set is LINT-01–10 and LINT-13–24 — verified against
the registry's Lite-mode row (22 rules, minus LINT-11 and LINT-12).
`Assumption:` no prior audit baseline exists for LINT-14 — this was the auditor's reading
of an empty gate folder, and it is superseded: the caller held the run-1 baseline outside
the repository, as the gate requires, and LINT-14 is decided from it in the Baseline
comparison section below.

**To increase (each names its exact test):**
- Assumption 3's dry-run result (85 packages, `express 4.22.2`, `pg 8.23.0`) is the
  one plan claim I did not re-run — it needs npm registry access this sandbox does
  not have. Re-run `npm install --dry-run` to close it.
- LINT-18 turns on whether temporal-plus-commit separation counts as "a separate test
  writer" at one-engineer scale. A second auditor's independent verdict on lines
  459–467 would settle it.
- LINT-21 turns on whether Risk 11's human reviewer counts as a signal independent of
  the test suite it reads. Pinning the expected pass count (Gap 2) makes the question
  moot.

**Risk (reported separately from confidence):** LOW. This audit writes only
`audit.md` and `evidence/*.json` into the gate folder; it modifies no source, no
test and no plan document, and every artifact is reproducible from the pinned hashes.

## Verification Statistics

- Candidate findings generated: 15
- Confirmed after verification pass: 3 warnings (4 as the auditor returned them, less the
  canary finding the caller stripped)
- Dropped (false positives prevented): 11
- False positive prevention rate: 11/15 = 73%
- Codebase claims verified: 41/42 (98% verification rate)

Dropped candidates, and where the document already answered them: "no CI" (Risk 11 +
Open Question 5, with owner and date); "owners are all one unnamed engineer"
(:552–555 + Open Question 1); "no rollback for Phase 0's new files" (:182–184); "no
mixed-state / partial-rollout scenario" (:289–291, :523–525); "auth untouched but
unverified" (:285); "assumption 5 may be HIGH impact" (:374–383); "out-of-repo
`render` callers unverifiable" (self-flagged `[CODEBASE-CLAIM-NOT-VERIFIED]` at
:355); "pagination", "caching", "CORS" (out of scope by construction); "Phase 1
fixture depends on staging access" (:214–219 pre-authorises the degraded path).

Cross-specialist contradictions investigated: the risk pass flagged Risk 11 as an
unmitigated silent failure while the quality pass found the Phase 1 suite fully
specified. Resolved by separating the two failure modes — the suite is a strong
control against arithmetic drift (Risks 1–3) and a weak one against its own deletion,
which is Gap 2, not a testing-strategy gap.

## Baseline comparison

Caller-decided, not the auditor's. Produced by `tq-gate-baseline.js compare`.

- Previous baseline: run 1, read from `C:/scratch/toque-run6/logs/s9-prior-records/iter1/gate.json` (2026-09-09)
- Previous document: `C:/scratch/toque-run6/logs/s9-prior-records/iter1/doc-at-baseline-1.md`, sha256 `4e00826635c27667204211c1d457a98b22ff7b325c496fdd66c04c1d24a0a673`
- Current document: `docs/specs/move-the-pricing-arithmetic-out-of-render-into-its-own-module-with-tests.md`, sha256 `4fd13fb06eb303d69a6427c235883a912acaeaab6395304a8be76938c2c692eb`
- Diff: 127 of 841 current lines changed
- Line sources filled from evidence records: LINT-01, LINT-02, LINT-03, LINT-04, LINT-05, LINT-06, LINT-07, LINT-08, LINT-09, LINT-10, LINT-13, LINT-15, LINT-16, LINT-17, LINT-18, LINT-19, LINT-20, LINT-21, LINT-22, LINT-23, LINT-24

Baseline comparison: 0 regressions, 14 improvements, 0 new items, 0 auditor-variance flips

Also: 2 degradations, 0 dropped elements, 0 not comparable, 0 uncompared, 55 unchanged. A DROPPED element beside a NEW one is usually a renamed row, not a lost one.

**LINT-14: MET** — caller-decided from the baseline comparison: no element that was passing now fails on text the revision changed (0 auditor-variance flip(s) discounted).

| Element | Baseline | Now | Lines cited | Line source | Diff scope | Class |
| --- | --- | --- | --- | --- | --- | --- |
| concern: API contract | pass | pass | 355 | audit.md Cross-Cutting Concerns | — | UNCHANGED |
| concern: Auth/authz | pass | pass | 285 | audit.md Cross-Cutting Concerns | — | UNCHANGED |
| concern: CORS/network/browser | pass | pass | 402-404 | audit.md Cross-Cutting Concerns | — | UNCHANGED |
| concern: Caching | pass | pass | 398-400 | audit.md Cross-Cutting Concerns | — | UNCHANGED |
| concern: Config | pass | pass | 134 | audit.md Cross-Cutting Concerns | — | UNCHANGED |
| concern: Data model/query limits | pass | pass | 398-400 | audit.md Cross-Cutting Concerns | — | UNCHANGED |
| concern: Migration/backward compat | pass | pass | 398 | audit.md Cross-Cutting Concerns | — | UNCHANGED |
| concern: Observability | partial | pass | 260-262 | audit.md Cross-Cutting Concerns | unchanged | IMPROVEMENT |
| concern: Pagination | pass | pass | 404 | audit.md Cross-Cutting Concerns | — | UNCHANGED |
| concern: Rollout/rollback | pass | pass | 287-291 | audit.md Cross-Cutting Concerns | — | UNCHANGED |
| concern: Tests | fail | pass | 436-441 | audit.md Cross-Cutting Concerns | unchanged | IMPROVEMENT |
| concern: UI behavior | pass | pass | 203-204 | audit.md Cross-Cutting Concerns | — | UNCHANGED |
| coverage: Artifact: pre-change render capture | fail | pass | 220-226 | audit.md Criterion Verdicts (LINT-23 record); not a separate Coverage Matrix row in run 2 | changed | IMPROVEMENT |
| coverage: Dep: Node >= 18 | pass | pass | 594 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Dep: npm registry | pass | pass | 593 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Dep: product confirmation | pass | partial | 597 | audit.md Coverage Matrix | unchanged | DEGRADATION |
| coverage: Dep: repo write access | pass | pass | 599 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Dep: running database for Phase 3 smoke check | fail | partial | 596 | audit.md Coverage Matrix (row "Dep: reachable seeded database for Phase 3") | changed | IMPROVEMENT |
| coverage: Dep: staging schema read access | pass | partial | 595 | audit.md Coverage Matrix | unchanged | DEGRADATION |
| coverage: Dep: three consecutive engineer-days | pass | pass | 598 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Desired: src/pricing.js exports a pure function | pass | pass | 41-42 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Desired: tests/pricing.test.js covers the ugly parts | pass | pass | 46-47 | audit.md Coverage Matrix (folded into the SC4 and Phase 2 deliverable rows in run 2) | — | UNCHANGED |
| coverage: Non-goal: no CI in this change | pass | pass | 767-775 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Non-goal: no new dependencies | pass | pass | 59-60 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Non-goal: no rounding / currency formatting | pass | pass | 81-85 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Non-goal: no schema/data migration | pass | pass | 398-400 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Risk 10: out-of-repo render consumer | pass | pass | 355 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Risk 11: no CI enforcing tests | fail | partial | 356 | audit.md Coverage Matrix | changed | IMPROVEMENT |
| coverage: Risk 1: \|\| -> ?? transcription | pass | pass | 346 | audit.md Coverage Matrix (row "Risk 1-3 (arithmetic drift)") | — | UNCHANGED |
| coverage: Risk 2: toFixed cleanup | pass | pass | 347 | audit.md Coverage Matrix (row "Risk 1-3 (arithmetic drift)") | — | UNCHANGED |
| coverage: Risk 3: re-association | pass | pass | 348 | audit.md Coverage Matrix (row "Risk 1-3 (arithmetic drift)") | — | UNCHANGED |
| coverage: Risk 4: timing log reflowed | pass | pass | 349 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Risk 5: dependencies unresolvable | pass | pass | 350 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: Risk 6: no lockfile | pass | pass | 351 | audit.md Coverage Matrix (row "Risk 6-7") | — | UNCHANGED |
| coverage: Risk 7: node_modules committed | pass | pass | 352 | audit.md Coverage Matrix (row "Risk 6-7") | — | UNCHANGED |
| coverage: Risk 8: unrealistic row shape | pass | pass | 353 | audit.md Coverage Matrix (row "Risk 8-9") | — | UNCHANGED |
| coverage: Risk 9: pg returns strings | pass | pass | 354 | audit.md Coverage Matrix (row "Risk 8-9") | — | UNCHANGED |
| coverage: SC1: npm test exits 0, two canView tests pass | pass | pass | 53 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: SC2: byte-identical HTML for ~20 inputs | pass | pass | 54-56 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: SC3: src/reports.js:21 unchanged in diff | pass | pass | 57-58 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: SC4: zero require in pricing.js, deps unchanged | pass | pass | 59-60 | audit.md Coverage Matrix | — | UNCHANGED |
| coverage: SC5: null-row TypeError same message | fail | pass | 61 | audit.md Coverage Matrix | unchanged | IMPROVEMENT |
| lint: LINT-01 | pass | pass | 53-61, 258-267 | evidence/LINT-01.json | — | UNCHANGED |
| lint: LINT-02 | fail | pass | 344-351, 356 | evidence/LINT-02.json | changed | IMPROVEMENT |
| lint: LINT-03 | pass | pass | 182-184, 237-239, 287-291, 334-335 | evidence/LINT-03.json | — | UNCHANGED |
| lint: LINT-04 | fail | pass | 591-599 | evidence/LINT-04.json | changed | IMPROVEMENT |
| lint: LINT-05 | pass | pass | 263-264, 402-404 | evidence/LINT-05.json | — | UNCHANGED |
| lint: LINT-06 | pass | pass | 355, 393-396, 523-525 | evidence/LINT-06.json | — | UNCHANGED |
| lint: LINT-07 | pass | pass | 279-285, 438-441 | evidence/LINT-07.json | — | UNCHANGED |
| lint: LINT-08 | fail | pass | 369, 374-380 | evidence/LINT-08.json | changed | IMPROVEMENT |
| lint: LINT-09 | pass | pass | 398-408, 484-487 | evidence/LINT-09.json | — | UNCHANGED |
| lint: LINT-10 | pass | pass | 186-188, 241-244, 293-295, 337-340 | evidence/LINT-10.json | — | UNCHANGED |
| lint: LINT-13 | pass | pass | 130-140 | evidence/LINT-13.json | — | UNCHANGED |
| lint: LINT-15 | pass | pass | 32-35, 179-180, 265-266 | evidence/LINT-15.json | — | UNCHANGED |
| lint: LINT-16 | pass | pass | 356, 405-408 | evidence/LINT-16.json | — | UNCHANGED |
| lint: LINT-17 | pass | pass | 436-441 | evidence/LINT-17.json | — | UNCHANGED |
| lint: LINT-18 | pass | pass | 459-467, 479-481 | evidence/LINT-18.json | — | UNCHANGED |
| lint: LINT-19 | fail | pass | 641-643, 669-676, 696-704, 711-712, 722-724 | evidence/LINT-19.json | changed | IMPROVEMENT |
| lint: LINT-20 | pass | pass | 627-648, 729-745 | evidence/LINT-20.json | — | UNCHANGED |
| lint: LINT-21 | pass | pass | 346-348, 489-491, 517-521 | evidence/LINT-21.json | — | UNCHANGED |
| lint: LINT-22 | pass | pass | 254-256, 421-424, 583-585 | evidence/LINT-22.json | — | UNCHANGED |
| lint: LINT-23 | fail | pass | 220-226, 313-315 | evidence/LINT-23.json | changed | IMPROVEMENT |
| lint: LINT-24 | fail | pass | 55-58, 514, 517-521 | evidence/LINT-24.json | changed | IMPROVEMENT |
| scenario: 1 Happy path | pass | pass | 498-499 | audit.md Scenario Matrix | — | UNCHANGED |
| scenario: 2 Failure path | pass | pass | 512-515 | audit.md Scenario Matrix | — | UNCHANGED |
| scenario: 3 Partial rollout (mixed state) | pass | pass | 393-396 | audit.md Scenario Matrix | — | UNCHANGED |
| scenario: 4 Backward compatibility | pass | pass | 355 | audit.md Scenario Matrix | — | UNCHANGED |
| scenario: 5 Scale/volume edge | fail | partial | 489-491 | audit.md Scenario Matrix | unchanged | IMPROVEMENT |
| scenario: 6 Auth/permission edge | pass | pass | 285 | audit.md Scenario Matrix | — | UNCHANGED |
| scenario: 7 Config/environment difference | pass | pass | 165 | audit.md Scenario Matrix | — | UNCHANGED |
| scenario: 8 Rollback path | fail | pass | 391-396 | audit.md Scenario Matrix | unchanged | IMPROVEMENT |

## Revision History

| Version | Unmet criteria | Gaps | Action |
|---------|----------------|------|--------|
| v1      | LINT-02, LINT-04, LINT-08, LINT-19, LINT-23, LINT-24 | 14 | Auto-revised: Risk 11's mitigation and Open Question 5's ownership, the Dependencies table and the paragraph beneath it, Assumption 3, the two HIGH-impact Evidence references, Phase 1's pre-change capture and Phase 3's comparison against it, and the case 20 / case 21 assertions |
| v2      | (none)         | 0    | Accepted |

Six criteria were unmet in v1 and all six are met in v2. Each version was audited by a
fresh auditor instance that was given no previous audit, no previous verdict and no
statement that an earlier attempt existed. The v1 figures are the caller's post-strip
figures: both iterations planted a defect for the auditor to find, both auditors found it,
and in each case the planted finding was removed and its criterion re-derived on the
committed document before these counts were taken.
