# The plan workspace

One folder keeps the request, preparation, checks, and decisions together. The next person should not need to ask who had the ticket.

This page explains files and resuming. [Plan workflow](the-plan-workflow.md) explains the six stages.

<p align="center">
  <img src="../assets/toque-tall-mascot.png" width="120" alt="Toque, the tall chef-hat reviewer.">
</p>

## The folder is the homebase

For the rationale behind the artifact chain, see the [playbook relationship](../METHODOLOGY.md#relationship-to-the-ai-native-sdlc-playbook). This page defines Toque's local file and state contracts; it does not configure synchronization with an external ticketing system.

Files appear as their stages run; a new plan does not start with every artifact complete.

```text
docs/plans/YYYY-MM-DD-{plan-name}/
  manifest.md          Human-readable index and links
  status.json          Machine-readable state and approvals
  intent.md            Accepted problem, outcome, constraints
  research/
    findings.md        Combined research findings
    reference-data.json
    codebase-scan.md
    best-practices.md
    intake/            Cleaned source documents
  spec.md              Requirements, design, verification, delivery
  audit.md             Design-gate verdicts and results
  evidence/            Per-criterion evidence records
  .canary/             Temporary mutated spec; not committed
  plan.md              Approved implementation steps
  changes/             Immutable Change Records
  impact-review.md     Effects and integration findings
  test-plan.md         Test matrix and verification record
  review.md            Diff review and release checklist
  runbook.md           When the plan needs one
  troubleshooting/     Plan-linked incidents and logs
```

Stage instructions call for committing the planning records, including `audit.md` and `evidence/`. Canary scratch and the export zip are excluded. These are workflow requirements, not an automatic Git enforcement hook.

Two paths are immutable once written: `changes/CR-*.md` and `snapshots/**`. A mistake in one is corrected by adding a new record, never by editing the old one. Every other file is living state that changes only in the way its stage describes: accepted `intent.md` and approved `spec.md` are superseded by a Change Record plus one banner line, `plan.md` collects departures during Build, and `status.json` and `manifest.md` are bookkeeping that every stage updates. Toque's own repository refuses edits to the two immutable paths in CI; in your repository the rule is a workflow instruction unless you add the same check.

Design can also create project documents outside the folder:

| Document | Location |
| --- | --- |
| ADR | `docs/adr/ADR-{topic}.md` |
| PRD | `docs/prd/{feature}.md` |

Link them from `manifest.md`. Standalone documentation generation has its own [output locations](../plugins/toque/GUIDE.md#the-7-document-templates), including domain-grouped PRDs.

## manifest.md — the human index

The manifest links artifacts, project documents, Change Records, and codebase files, with status and date information.

Update it when a stage creates or links a document, alongside `status.json`. It is navigation; it is not a second authority for machine state.

## status.json — the machine state

Current plans use schema 2. The stored keys remain `current_phase` and `phases`, even though the user-facing workflow calls them stages.

Illustrative state, with placeholder dates and names:

```json
{
  "schema_version": 2,
  "plan_name": "scheduled-reports",
  "plan_dir": "docs/plans/YYYY-MM-DD-scheduled-reports",
  "created": "{ISO timestamp}",
  "current_phase": "design",
  "documents": {},
  "phases": {
    "plan": {
      "status": "complete",
      "started": "{ISO timestamp}",
      "completed": "{ISO timestamp}",
      "accepted_by": "{name}",
      "accepted_date": "{date}"
    },
    "design": { "status": "in_progress", "started": "{ISO timestamp}" },
    "build": { "status": "not_started" },
    "test": { "status": "not_started" },
    "deploy": { "status": "not_started" },
    "maintain": { "status": "not_started" }
  }
}
```

### Timestamps and gate bookkeeping

At a completed stage transition, record the completion time, the next stage's start, the new `current_phase`, and the required approver and date. Update the manifest to match.

A mid-stage approval—such as Design scope lock or approval of `plan.md`—does not complete that stage. Deploy records two events: `authorized_by` and `authorized_at` when a named human authorizes the release (status `authorized`), then `released_by` and `released_at` when a human confirms it happened (status `complete`). Maintain starts at `released_at` and stays in `steady_state` without a completion timestamp.

Recorded times support intent-to-spec, spec-to-plan, plan-to-authorization, and, once `released_at` is recorded, plan-to-release elapsed-time reporting. Required human decisions need the actual name; a timestamp alone is not approval.

## Resuming

```text
/toque:plan-status
/toque:plan scheduled-reports
```

Resume reads `status.json`, checks completed work for freshness, shows the current stage and artifacts, and offers to continue.

### Recovering a broken workspace

| Situation | Workflow response |
| --- | --- |
| Corrupt `status.json` | Reconstruct state from existing artifacts; review the reconstruction before relying on it. |
| Partially complete stage | Resume saved progress. |
| Matching plan already exists | Offer resume or a new suffixed name. |
| Referenced file deleted | Mark affected findings STALE and suggest new research. |
| Source folder unreadable | Skip document cleanup and continue with available research. |
| No MCP research tools | Use available web tools; mark external research unavailable if neither is available. |
| Missing required approver | Ask for the name; do not advance. |

## Staleness

Freshness uses **path-scoped fingerprints**: hashes of the files a stage actually referenced, not a whole-repository SHA. Unrelated commits do not automatically invalidate the plan.

| State | Meaning |
| --- | --- |
| `FRESH` | Referenced files are unchanged. |
| `WARNING` | Related files in the same directory changed; findings may be affected. |
| `STALE` | A directly referenced file changed; findings likely need rechecking. |

### The invalidation cascade

| Change | Consequence |
| --- | --- |
| Accepted `intent.md` changes | `spec.md` becomes STALE; record the scope change. |
| Approved `spec.md` changes | `audit.md` and `plan.md` become STALE. |
| Implementation departs from approved `plan.md` | Record “Departures from plan” in the same commit; Stage 5 checks it. |
| Source documents change after research | Research becomes WARNING. |

An edit to accepted intent is not a harmless wording update once downstream work relies on it. After the first spec commit, scope changes need a Change Record.

## Migrating a pre-8.0.0 plan

On resume, a schema-1 plan is migrated to schema 2 before normal continuation.

| Old phase | New stage |
| --- | --- |
| brainstorm, research | plan |
| pre_plan, plan, audit | design |
| build, impact_review | build |
| test | test |
| handoff | deploy |

The specified migration treats an old status ending in `complete` as complete. All mapped phases complete makes the stage complete; any mapped phase complete or in progress makes it in progress; otherwise it is not started.

The original `phases` object is preserved under `phases_schema1`, including unmapped keys. `schema1_migration` records the date and previous `current_phase`.

Old artifact names, including `brainstorm.md`, `approach.md`, and `confidence.md`, remain intact. Resume identifies the legacy artifacts it uses instead of silently renaming them.

If later work is complete but earlier stages are not, report that history rather than inventing sequential progress.

## After release

Released artifacts remain the record of what shipped. Maintain can add incident links, update status and recurrence bookkeeping, and draft a separate follow-up intent. It does not rewrite the released plan to pretend the new work was always included.

[Workflow](the-plan-workflow.md) · [Design gate](the-design-gate.md) · [Operator guide](../plugins/toque/GUIDE.md)
