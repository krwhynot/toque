# Stage 5: DEPLOY

Stage file for /toque:plan. Loaded by SKILL.md on entry; re-read after compaction. Do not read ahead.

Question: Is this the change the plan intended, and who authorizes its release?
Reads: intent.md (## Constraints), plan.md (## Files that change, ## Verification), test-plan.md, status.json, `git diff --name-only {base}..HEAD`
Produces: docs/plans/{date}-{plan-name}/review.md, plan.md ## Departures from plan, status.json phases.deploy, manifest.md final status
Gate: Named human release authorization. The skill never runs a deploy command.

## Contents

- Readiness check
- Step A: Diff-versus-plan check (fresh subagent)
- Step B: review.md
- Step C: Release authorization (hard rule)
- Step D: Authorization summary
- Step E: Release confirmation

READINESS CHECK before entering this stage:
- Test stage complete (status.json phases.test.status = complete, test_gate has no pending manual items)
- No BLOCKED tickets remaining (or explicitly deferred, with the deferral recorded in plan.md)
- Rollback plan documented (spec.md ## Delivery or plan.md ## Risks)

If any item fails, report what is missing and stay in Stage 4.

## Step A: Diff-versus-plan check

This is the drift control. It is run by a FRESH subagent (not the agent that
did the Build) so the comparison is not biased by memory of why files changed.

Subagent brief:
```
Objective: Compare what changed against what was planned. Report, do not judge.
Tools: Read, Grep, Bash
Inputs:
  - docs/plans/{date}-{plan-name}/plan.md (## Files that change)
  - docs/plans/{date}-{plan-name}/intent.md (## Constraints)
  - git diff --name-only {base}..HEAD   ({base} = status.json phases.build.base if that optional field is present, else merge-base with main)
Output: write to docs/plans/{date}-{plan-name}/.deploy-diff-check.md

1. FILE DELTA
   - UNPLANNED: every file in the diff that is not listed in plan.md ## Files that change
   - UNTOUCHED: every file listed in plan.md ## Files that change that is not in the diff
   - MATCHED: count of files in both
   Match on path; treat a planned glob or directory as matching any file under it.

2. CONSTRAINT CHECK
   For each bullet in intent.md ## Constraints, inspect the diff for auth, data scope,
   and external dependencies:
   - auth: new or changed auth checks, roles, tokens, public endpoints
   - data scope: new tables/columns/queries, widened selects, PII handling, retention
   - external dependencies: new packages, new network calls, new services, version bumps
   List every constraint the diff APPEARS to violate, with file:line evidence.
   "Appears" is deliberate: the human decides; you supply evidence.
```

When the subagent returns:
- A non-empty delta is NOT automatically a rejection. It MUST be acknowledged:
  append a `## Departures from plan` section to plan.md listing every UNPLANNED
  and UNTOUCHED file with a one-line reason each (or "unexplained" if the
  reason is not known; an unexplained departure is a Finding in Step B).
- The `## Departures from plan` append lands in the SAME commit as the release
  candidate, before any release. Drift that is not written down is drift that
  did not get reviewed.
- Delete .deploy-diff-check.md after its content is folded into review.md.

## Step B: review.md

Write docs/plans/{date}-{plan-name}/review.md using `${CLAUDE_SKILL_DIR}/templates/review.md`.
Evidence before opinions. Sections, in order:

1. Summary — what is being released, in three sentences or fewer.
2. Diff-versus-plan — MATCHED / UNPLANNED / UNTOUCHED lists from Step A, and a
   pointer to plan.md ## Departures from plan.
3. Constraint check — each intent.md constraint with VERIFIED / APPEARS VIOLATED /
   NOT APPLICABLE and the evidence from Step A.
4. Findings — each cites file:line and the evidence. Order by severity:
   Important (would break behavior, leak data, or breach a policy) first, then
   nits. At most 5 nit-level comments; summarize the rest as a count.
   Do not report generated files or anything CI already enforces.
5. Release checklist — follow the Pre-deploy / Deploy / Post-deploy / Rollback
   structure in the review.md template:
   - Link the plan's runbook if one exists (`/toque:documentation runbook
     {plan}` writes it); otherwise the deployment sequence lives inline, one
     verification step after each step (what to run, what healthy output looks
     like; reuse plan.md ## Verification)
   - Rollback triggers as numeric thresholds over a window (error rate, latency,
     a failing smoke test, a data-integrity count). "Looks wrong" is not a
     trigger. These thresholds are what Stage 6 uses to classify SEV1/SEV2.
   - Rollback steps, each with its own verification
   - Monitoring: where to look, for how long, and the thresholds above
   - Mark checklist items N/A with a reason rather than deleting them
   - Owner of the release window
6. Release authorization — name, date, decision (Authorized | Rejected | Deferred).
   Leave blank until Step C.

Update manifest.md (review.md row) and status.json documents.

## Step C: Release authorization (HARD RULE)

The agent never crosses the production gate. It prepares everything, then STOPS.

- No deploy, publish, release, tag-push, merge-to-production, or migration
  command is run by this skill, in any approval tier, even if the user says
  "just do it" in passing. A deliberate release is a human action.
- Present review.md and ask a NAMED human for authorization:

```
Stage 5 — Ready for release authorization

review.md: docs/plans/{date}-{plan-name}/review.md
Plan match: {N} of {M} planned files changed, {K} unplanned
Constraint check: {count} verified, {count} appear violated
Findings: {important} important, {nits} nits

Two questions for the reviewer:
  1. Is this the change the plan intended?
  2. Is the risk acceptable?

Who is authorizing this release, and what is the decision? (name, Authorized | Rejected | Deferred)
```

- Record the answer in review.md ## Release authorization and in
  status.json phases.deploy.authorized_by (name), authorized_at (ISO), decision.
- Rejected or Deferred: stay in Stage 5; list what must change; do not re-ask
  until it has.
- Authorized: the human performs the release using the review.md checklist.
  The skill may run the VERIFICATION steps from the checklist after the human
  confirms each deployment step is done; it never runs the deployment steps.

## Step D: Authorization summary

Authorization and release are two events, recorded separately. Authorization is
the human's decision; release is the human's later report that the deployment
happened. Neither is inferred from the other.

After authorization is recorded, update manifest.md with the decision and
lessons learned so far. Update status.json: phases.deploy.status -> authorized
(NOT complete; the release has not happened yet). Then present:

```
Plan: {name} - Release authorized

Stages: 5/6 (Maintain is the steady state)
Duration so far: {phases.plan.started} to {phases.deploy.authorized_at}
Plan match: {N} of {M} planned files changed, {K} unplanned
Intent -> spec: {phases.design.started - phases.plan.started}
Spec -> plan: {phases.build.started - phases.design.started}
Plan -> authorization: {phases.deploy.authorized_at - phases.build.started}
Plan -> release: pending (recorded when you confirm the release)
Tickets: {done}/{total}
Authorized by: {name}, {date}

Key decisions: [from spec.md ## Gotchas and change records]
Change records: {count} (see changes/ folder)
Departures from plan: {count} (see plan.md)
What is ready to ship: [summary]
What's deferred: [if anything]
```

Elapsed values are computed from status.json ISO timestamps; print "n/a" for
any stage missing a timestamp rather than guessing.

## Step E: Release confirmation

The human performs the release. When they report that it is done, in this
session or on a later `/toque:plan {name}` resume, ask for the name of the
person confirming and the release time, then record:

- status.json phases.deploy: released_by (name), released_at (ISO),
  status -> complete, completed -> the same ISO as released_at
- status.json phases.maintain: status -> steady_state, started -> released_at;
  current_phase -> maintain (this is the stage transition; authorization was
  not one)
- review.md ## Release authorization: one line "Released by {name} on {date}"
- manifest.md: the review.md row reads Released

Then present the same summary with the title `Plan: {name} - Released` and
`Plan -> release: {phases.deploy.released_at - phases.build.started}`.

Until that confirmation arrives, the plan stays in Stage 5 with status
`authorized`. A plan authorized but never confirmed is reported that way by
/toque:plan-status; it is not rounded up to released. If the release was
abandoned, record the decision as Deferred or Rejected in Step C instead.

Proceed to Stage 6 after the release is confirmed.
