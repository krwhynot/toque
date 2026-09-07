# Plan Lint Registry

Single source of truth for all plan lint rules. Referenced by `agents/plan-auditor.md`,
`skills/plan/stages/stage-2-design.md`, and `skills/plan/stages/stage-3-build.md`.

**This file is the only place rule text or rule counts may be written.** The claim used to be
aspirational: every one of the rules had drifted into a second wording elsewhere, and LINT-17/18
had drifted into a second *meaning* — the confidence-brief rules now numbered LINT-19/20 below were
occupying those ids in `commands/plan.md` and `agents/plan-auditor.md`. Enforced since PH5-001 by
`tests/layer1-repo.sh` (dispatched by `tests/layer1-config-wiring.sh`), in two halves:

- `commands/**` and `agents/**` are read into agent context, so they carry **bare ids only**. Text
  that drifts there is text a judge actually applies.
- Human-facing docs (`METHODOLOGY.md`, the rest of `docs/planning-techniques/`) may restate a rule,
  but the restatement must match a wording on this page **verbatim**.

Counts live here too, for the same reason: `commands/plan.md` claimed 14 Phase 5 rules while this
file defined 16, and `agents/plan-auditor.md` claimed 14 in one place and 15 in another.

## Rules

| Rule | Description | Phase | Applies In |
|------|-------------|-------|------------|
| LINT-01 | Every goal has at least one mapped ticket | 5 (Audit) | Full + Lite |
| LINT-02 | Every HIGH risk has a mitigation | 5 (Audit) | Full + Lite |
| LINT-03 | Every deployment phase has a rollback plan | 5 (Audit) | Full + Lite |
| LINT-04 | Every external dependency has an owner | 5 (Audit) | Full + Lite |
| LINT-05 | Every new endpoint/API has a contract or test entry | 5 (Audit) | Full + Lite |
| LINT-06 | Backward compatibility claimed but no mixed-state scenario | 5 (Audit) | Full + Lite |
| LINT-07 | Every new behavior has a test or test delta | 5 (Audit) | Full + Lite |
| LINT-08 | No unverified or falsified HIGH-impact assumption exists | 5 (Audit) | Full + Lite |
| LINT-09 | No unaddressed cross-cutting concern for in-scope features | 5 (Audit) | Full + Lite |
| LINT-10 | Every phase has go/no-go criteria | 5 (Audit) | Full + Lite |
| LINT-11 | Every code change maps to a plan ticket | 7 (Impact) | Full only |
| LINT-12 | Every plan ticket maps to at least one code change (or deferred) | 7 (Impact) | Full only |
| LINT-13 | Approach has options analysis with min 2 alternatives evaluated | 5 (Audit) | Full + Lite |
| LINT-14 | No regressions from previous baseline | 5 (Audit) | Full + Lite |
| LINT-15 | All "Tested" claims have verified test infrastructure | 5 (Audit) | Full + Lite |
| LINT-16 | All "Monitored" claims have verified monitoring infrastructure | 5 (Audit) | Full + Lite |
| LINT-17 | Every deliverable in Phase 4 spec must have a testing methodology assigned | 4 (Plan) / 5 (Audit) | Full + Lite |
| LINT-18 | AI-generated code deliverables must specify a separate test writer | 4 (Plan) / 5 (Audit) | Full + Lite |
| LINT-19 | Confidence brief exists with no unresolved HIGH-impact markers | 5 (Audit) | Full + Lite |
| LINT-20 | Confidence brief exists and each entry has its required fields | 5 (Audit) | Full + Lite |
| LINT-21 | Every mitigation for a silent-failure risk names a signal not derived from the same filtered source as the failure | 5 (Audit) | Full + Lite |
| LINT-22 | Every stated ordering between deployable artifacts names the mechanism that enforces it | 5 (Audit) | Full + Lite |
| LINT-23 | Every rollback artifact the plan itself creates is re-runnable and created at the point whose state it preserves | 5 (Audit) | Full + Lite |
| LINT-24 | Every named measurement exercises the property its requirement states | 5 (Audit) | Full + Lite |

LINT-19 and LINT-20 were numbered 17 and 18 in `commands/plan.md` and `agents/plan-auditor.md`
until PH5-001, colliding with the two testing-methodology rules above. Audit reports written before
that renumbering (under `docs/plans/`) refer to the confidence-brief checks by their old ids; those
records are left as they were rather than rewritten, because they record what ran at the time.

LINT-21 through LINT-24 were promoted on 2026-09-06 out of the Phase 5 rubric-free
holistic pass: a judge given no rubric says what it expects to fail in production,
and whatever maps to no existing criterion is filed as a candidate. All four
arrived from a single angle — the registry checks that a control is NAMED, never
that it WORKS — and they are deliberately kept apart rather than merged. One rule
covering all four would have to be stated so generally that no auditor could
return a falsifiable verdict on it, which is the vacuity the holistic pass exists
to find rather than to create. Their disposition is in
[lint-candidates.md](lint-candidates.md); the runs that produced them live in the
gate records of the plans concerned, not here.

## Phase Ownership

- **Phase 4 (Plan):** LINT-17, LINT-18 (enforced during plan creation, audited at Phase 5)
- **Phase 5 (Audit):** LINT-01 through LINT-10, LINT-13, LINT-14, LINT-15, LINT-16, LINT-17, LINT-18, LINT-19, LINT-20, LINT-21, LINT-22, LINT-23, LINT-24 (22 rules)
- **Phase 7 (Impact Review):** LINT-11, LINT-12 (2 rules, Full mode only)
- **Total:** 24 active rules

## Audit Modes

- **Full mode** (`/toque:plan`, `/toque:quick-audit` with plan context): All 24 rules apply. Phase 7 rules run during Impact Review.
- **Lite mode** (`/toque:quick-plan`, standalone `/toque:quick-audit`): 22 rules apply. LINT-11 and LINT-12 are skipped (no build phase, no changed files to trace).

## Gate Behavior

| Rule | Gate Type | Behavior |
|------|-----------|----------|
| LINT-08 | **Hard gate** (Phase 6 entry) | Blocks Build if any HIGH-impact assumption is unverified or falsified. Waiver requires documented risk acceptance; a falsified assumption is not waivable, the plan changes. |
| LINT-11 | Advisory (Phase 7) | Flags orphan code changes for review. Does not block. |
| LINT-12 | Advisory (Phase 7) | Flags orphan tickets for review. Does not block. |
| LINT-14 | Audit quality (Phase 5) | Fails if any previously-passing element now fails. Skipped on first audit (no baseline). |
| LINT-17 | Audit quality (Phase 5) | Fails if any deliverable has no testing methodology or uses "unit tests" without justification. |
| LINT-18 | Audit quality (Phase 5) | Fails if AI-generated code has the same agent as both implementation author and test author. |
| LINT-19 | Audit quality (Phase 5) | Blocks on any HIGH-impact confidence entry marked [SOURCE NEEDED], [LINK DEAD], or [UNVERIFIED]. The same markers on MEDIUM/LOW entries are warnings. |
| LINT-20 | Audit quality (Phase 5) | Fails if spec.md has no Evidence section (the confidence brief), the brief has no entries, or an entry is missing "What it is" / "Why it works" / "Connection to this plan". A plan started before 8.0.0 carries the brief as a separate `confidence.md`. |
| All others | Audit quality | Contribute to gap-checked status. Plan is gap-checked only when all applicable lint rules pass. |

## Rule Scope Notes

- **LINT-20 counts entries, not subsections.** It used to be stated two ways in
  this file: "all 3 sections" in the rules table and "none of the 3 sections" in
  Gate Behavior. Those give opposite verdicts on a brief with two subsections, and
  two independent auditors split on exactly that document during the September 2026
  stress test. No shipped template produces three: `skills/plan/templates/spec.md`
  emits one subsection, `agents/plan-scaffolder.md` emits two, and no file anywhere
  names a third. A rule the plugin's own generators cannot satisfy is a rule that
  fails honest work, so the count is gone and the entry fields are what is checked.

These say WHEN a rule applies. They do not restate what a rule checks; the table
above is the only wording for that.

- **A rule whose triggering condition is absent is PASS, not N_A.** No
  backward-compatibility claim (LINT-06), no external dependency (LINT-04), no
  new endpoint (LINT-05): the rule passes, with the reason in the record. N_A is
  reserved for LINT-14 with no baseline. A vacuous rule recorded N_A on one run
  and PASS on the next reads as a regression under LINT-14, on a document nobody
  changed.
- **LINT-15 and LINT-16 judge claims about infrastructure asserted to exist
  today.** A test file or monitoring target the plan names as its own deliverable
  of a phase that has not run is PLANNED, not a failure — the spec template asks
  for those names on purpose, and a pre-build plan that withheld them would be
  worse. A path relied on by a phase that runs BEFORE the phase that creates it
  is a claim about today, and fails. See the classification step under
  INFRASTRUCTURE VERIFICATION in `skills/plan/stages/stage-2-design.md`.

- **LINT-21 through LINT-24 each have a triggering condition, and a plan that
  does not meet it PASSES.** LINT-21 needs a risk whose failure mode is silent —
  one where the wrong outcome and the right one look the same to whatever is
  watching. LINT-22 needs a stated ordering between two separately deployable
  artifacts. LINT-23 needs a rollback that depends on an artifact the plan itself
  creates. LINT-24 needs a requirement that names a command, query or check as
  its measurement. A plan meeting none of those conditions is not exempt and not
  N_A; each rule passes, with the absent condition as the recorded reason, under
  the vacuous-rule note above.

## Lint Count by Context

| Context | Lint Rules | Count |
|---------|-----------|-------|
| Phase 5 Audit (Full mode) | 01-10, 13-24 | 22 |
| Phase 5 Audit (Lite mode) | 01-10, 13-24 | 22 |
| Phase 7 Impact Review | 11, 12 | 2 |
| Total (Full mode) | All active | 24 |
| Total (Lite mode) | Minus 11, 12 | 22 |
