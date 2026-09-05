# Your first workflow

Start with one real request: **“Add scheduled reports.”** Toque's first job is to find out what that means, not to build the scheduler.

This walkthrough assumes Toque is [installed](install.md). Run slash commands inside Claude Code, in the project you intend to change. The full workflow writes planning records and, after approval, can change code and run tests. Use a branch and review the working tree first.

<p align="center">
  <img src="../assets/toque-tall-mascot.png" width="120" alt="Toque, the tall chef-hat reviewer.">
</p>

## 1. Capture the request

```text
/toque:plan intent scheduled-reports
```

Toque asks about the problem, desired outcome, affected people, constraints, exclusions, and unknowns. Answer in normal language. For example:

> Account managers need a weekly summary without exporting it manually. Reports must respect access permissions at delivery time. We have not decided how recipients choose their schedule.

The Plan stage researches the codebase and available references. Expect a workspace under:

```text
docs/plans/YYYY-MM-DD-scheduled-reports/
```

It contains `intent.md`, research, `manifest.md`, and `status.json`. A named product owner must accept the intent. Unknowns stay visible; research does not silently replace the owner's problem statement.

**Intent-only mode stops here**, even after acceptance. Nothing is being cooked yet.

## 2. Resume into Design

```text
/toque:plan scheduled-reports
```

Toque reads the saved state and asks before continuing. It develops `spec.md`: requirements, design, constraints, verification, and delivery steps.

For scheduled reports, this is where schedule rules, recipients, permission checks, retries, and rollout decisions belong. Unresolved choices are not permission for the agent to guess.

After scope lock, the design goes to a separate auditor. The workflow creates `audit.md` and `evidence/`, checks a planted defect in a temporary copy, and validates citations supporting passing verdicts.

If the gate fails, read the unmet criterion and its location. Toque can revise failing sections up to twice. A canary missed twice stops the audit instead: an unreliable check is not a useful recipe for revisions.

An automated pass still needs recorded human review, or the narrowly eligible [design-review waiver](the-design-gate.md#human-review-and-the-solo-waiver). The spec must be marked approved before Build.

## 3. Approve the implementation plan, then build

Toque writes `plan.md` before changing implementation code. Check the affected files, sequence, assumptions, risks, verification steps, and any parallel work.

Approve the plan only when you are ready for those changes. “Continue researching” and “implement this” are different instructions.

Build also asks for approval of individual codebase actions and proposed parallel batches.

During Build, departures from the approved plan must be recorded. Toque produces `impact-review.md`; review and confirm the effects before advancing.

## 4. Test what was built

Toque creates `test-plan.md` and collects results.

Automated tests must pass. A human must perform and confirm the manual checks; the agent cannot confirm them for you. For scheduled reports, a useful check might be removing a recipient's access before delivery and verifying the expected behavior from the approved spec.

A generated test plan is not a test result. Read the recorded outcomes, including what was not exercised.

## 5. Make the production decision

Toque compares the actual diff with the plan and prepares `review.md`, release steps, and rollback triggers.

A **named human authorizes and performs the production release**. The agent may prepare instructions and verify a step after the human confirms it was performed. It must not run production deployment, publishing, release-tag pushes, production merges, or production migrations.

> **Nothing leaves the kitchen yet.** A passed design gate is not production authorization.

If you are only rehearsing this workflow, stop at release preparation. Do not manufacture a deployment approval to complete the exercise.

## 6. Maintain the released work

Maintain stays open. Use plan-linked troubleshooting for incidents:

```text
/toque:troubleshoot --plan scheduled-reports Reports are being sent twice
```

Qualifying incidents or recurring patterns can produce a new draft `intent.md`. That draft returns to Plan for human acceptance; it does not authorize an automatic fix or release.

## Pause and resume

```text
/toque:plan-status
/toque:plan scheduled-reports
```

Status shows where the work stands. Resume reads `status.json` and checks whether referenced files changed. Resolve stale dependencies before relying on old approvals.

See [Plan workspace](plan-workspace.md) for file contracts and recovery.

## Want a smaller first step?

```text
/toque:quick-plan Add scheduled reports
```

This produces `docs/specs/{name}.md`, runs the same design gate as Stage 2, and allows up to two revisions. The gate record lands beside the spec in `docs/specs/{name}/`; commit it with the spec. Review any remaining findings. It does not create a full six-stage workspace, and a pass is not human review. `--plan {name}` can link the draft to an existing plan.

Already have a plan? Try `/toque:quick-audit path/to/plan.md`.

Curious about the wider lifecycle? Read the [playbook background and Toque's boundaries](../METHODOLOGY.md#relationship-to-the-ai-native-sdlc-playbook). This walkthrough operates Toque; it does not set up the article's broader automation platform.

[Choose a workflow](when-to-use.md) · [Stage details](the-plan-workflow.md) · [Design-gate limits](the-design-gate.md#what-this-does-not-prove)
