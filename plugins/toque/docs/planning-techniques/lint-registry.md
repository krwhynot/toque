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
| LINT-20 | Confidence brief has all 3 sections and each entry has required fields | 5 (Audit) | Full + Lite |

LINT-19 and LINT-20 were numbered 17 and 18 in `commands/plan.md` and `agents/plan-auditor.md`
until PH5-001, colliding with the two testing-methodology rules above. Audit reports written before
that renumbering (under `docs/plans/`) refer to the confidence-brief checks by their old ids; those
records are left as they were rather than rewritten, because they record what ran at the time.

## Phase Ownership

- **Phase 4 (Plan):** LINT-17, LINT-18 (enforced during plan creation, audited at Phase 5)
- **Phase 5 (Audit):** LINT-01 through LINT-10, LINT-13, LINT-14, LINT-15, LINT-16, LINT-17, LINT-18, LINT-19, LINT-20 (18 rules)
- **Phase 7 (Impact Review):** LINT-11, LINT-12 (2 rules, Full mode only)
- **Total:** 20 active rules

## Audit Modes

- **Full mode** (`/toque:plan`, `/toque:quick-audit` with plan context): All 20 rules apply. Phase 7 rules run during Impact Review.
- **Lite mode** (`/toque:quick-plan`, standalone `/toque:quick-audit`): 18 rules apply. LINT-11 and LINT-12 are skipped (no build phase, no changed files to trace).

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
| LINT-20 | Audit quality (Phase 5) | Fails if spec.md has no Evidence section (the confidence brief), the brief has none of the 3 sections, or an entry is missing "What it is" / "Why it works" / "Connection to this plan". A plan started before 8.0.0 carries the brief as a separate `confidence.md`. |
| All others | Audit quality | Contribute to gap-checked status. Plan is gap-checked only when all applicable lint rules pass. |

## Lint Count by Context

| Context | Lint Rules | Count |
|---------|-----------|-------|
| Phase 5 Audit (Full mode) | 01-10, 13-20 | 18 |
| Phase 5 Audit (Lite mode) | 01-10, 13-20 | 18 |
| Phase 7 Impact Review | 11, 12 | 2 |
| Total (Full mode) | All active | 20 |
| Total (Lite mode) | Minus 11, 12 | 18 |
