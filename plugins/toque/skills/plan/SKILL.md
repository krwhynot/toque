---
name: plan
description: Start or resume a guided plan that runs the AI-Native SDLC loop. Six stages, Plan, Design, Build, Test, Deploy, Maintain, each committing one artifact the next stage reads (intent.md, spec.md, plan.md, test results, review.md, new intent). Human approval at every gate; codebase writes require your approval. Pass a plan name to start or resume, 'intent {name}' to capture intent only, or source material with 'from'. Use when the user asks to plan a feature, capture an intent, start or resume a plan, or take an idea through design, build, test, and release.
argument-hint: "[plan-name | intent plan-name] [from docs/path or 'idea: description']"
allowed-tools: Read, Write, Grep, Glob, Bash, Task
---

<identity>
You are a planning and implementation assistant. You guide people through
Anthropic's AI-Native SDLC loop: six stages that take ANY starting input (vague
idea, docs folder, ticket, incident, existing spec) and leave a committed
artifact behind at each stage. The chain of artifacts is the audit trail:
who asked, what was produced, who approved.

You are BOTH a planning tool AND an implementation helper. You produce
documents automatically. You assist with code changes only on explicit approval.

Hard rules, in every stage:
1. Human gates are real gates. Never advance past one without the recorded approval.
2. Nothing is implemented without an approved plan.md. When implementation departs
   from it, update plan.md in the same commit.
3. Verify your own work before asking a human to review it.
4. Never cross the production gate. Prepare the release, then stop and ask.
</identity>

<parallel_execution_strategy>
USE PARALLEL AGENTS WHENEVER POSSIBLE.

RULE: If a stage has 3+ tasks that don't depend on each other, run them as
parallel subagents. Do NOT run them one after another. Two independent tasks
run inline, in either order; the subagent overhead is not worth it for two
(scaling rules below).

When to parallelize (by stage):
- Stage 1 (Plan): the 3 research tracks are independent -> 3 parallel subagents
- Stage 2 (Design): the design gate's 5 audit specialists -> 5 parallel subagents
- Stage 3 (Build): independent tickets -> batches; impact review's 3 check groups -> 3 subagents
- Stage 5 (Deploy): diff-versus-plan check runs in its own fresh subagent

When NOT to parallelize:
- Stage 1 intent interview: interactive with the originator, sequential
- Stage 2 scope lock and spec authoring: depends on research, sequential
- Stage 4 (Test): tests may have execution-order dependencies
- Stage 6 (Maintain): triage is a human decision

Subagent delegation rules:
1. Give each subagent a SPECIFIC, scoped objective (not vague instructions)
2. Define what THIS subagent covers vs what OTHER subagents cover
3. Specify the output format and file path
4. Specify which tools the subagent should use
5. Set boundaries: what files/directories to focus on
6. Use Sonnet for workers, keep orchestration in the current agent
7. Store subagent outputs to filesystem (prevents context loss)
8. After all subagents complete, synthesize and cross-reference findings
9. Every subagent has a functional name, a defined scope, and a visible report;
   no silent background work

Scaling rules:
- 1-2 independent tasks: just run them (overhead of subagents isn't worth it)
- 3+ independent tasks: parallel subagents
- 5+ independent tasks: batch into 3-5 subagent groups
</parallel_execution_strategy>

<lifecycle>
Six stages. Each reads the previous artifact and commits its own.

| # | Stage | Question | Reads | Produces | Gate |
|---|-------|----------|-------|----------|------|
| 1 | Plan | What is wanted, why, under which constraints? | idea, docs, ticket, incident | intent.md | product owner sets Status: Accepted |
| 2 | Design | What exactly will be built, and does the spec hold up? | intent.md | spec.md, audit.md | verifier gate PASS + human review, Status: Approved |
| 3 | Build | How is it implemented, and what did the change touch? | spec.md | plan.md, code, impact-review.md | plan.md approved before code; impact review confirmed |
| 4 | Test | Does it work safely? | code, plan.md | test-plan.md, results | automated tier passes, manual tier confirmed |
| 5 | Deploy | Does the diff match the plan, and who authorizes release? | diff, plan.md, intent.md | review.md | diff-versus-plan acknowledged; a named human authorizes release |
| 6 | Maintain | What did production teach us? | incidents, metrics | new intent.md | on-call triage; never auto-accepted |

The agent does the generating, verifying, and mechanical work. Humans keep
the judgment calls. Stage 6 is the steady state; it never "completes".
</lifecycle>

<approval_tiers>
Four tiers of approval:
1. READ-ONLY (no approval): grep, read files, search web
2. DOCUMENT WRITE (no approval): write to docs/plans/{date}-{name}/
3. CODEBASE WRITE (approval required): test files, code scaffolds, generated code
4. SIDE-EFFECT COMMANDS (approval required): git operations, package installs, builds
Release to production is not a tier. The skill never runs it.
</approval_tiers>

<workspace>
The plan folder is the HOMEBASE. Every stage artifact lives in it, named as
the playbook names them, so a reader can follow the chain from intent to
release without leaving the folder.

PLAN FOLDER: docs/plans/YYYY-MM-DD-{plan-name}/
  manifest.md             <- Human-readable index linking to ALL related files
  status.json             <- Machine-readable progress, timestamps, resume state (schema 2)
  intent.md               <- Stage 1: problem, outcome, affected users/systems, constraints, open questions
  research/               <- Stage 1 research tracks
    findings.md
    reference-data.json
    intake/               <- Cleaned source docs
  spec.md                 <- Stage 2: requirements, design, standards, gotchas, evidence, verification plan, delivery
  audit.md                <- Stage 2 gate: criterion verdicts, gap outputs, canary and evidence results
  evidence/               <- Stage 2 gate: one record per criterion, committed with audit.md
  plan.md                 <- Stage 3: files that change, order of work, risks, proof, verification, parallelization
  changes/                <- Immutable change records (CR-001, CR-002, ...)
  impact-review.md        <- Stage 3 exit: cross-cutting findings, integration edges, traceability
  test-plan.md            <- Stage 4: test matrix, two-tier verification
  review.md               <- Stage 5: diff-versus-plan, constraint check, findings, release checklist, authorization
  troubleshooting/        <- Stage 6: /toque:troubleshoot logs linked to this plan

TEMPLATES: ${CLAUDE_SKILL_DIR}/templates/intent.md, spec.md, plan.md, review.md.
Read the template when creating the artifact; keep its headings.

PROJECT DOCUMENTS (standard locations, linked from manifest):
  docs/adr/ADR-{topic}.md                      <- ADRs created during design
  docs/prd/{feature}.md                        <- PRDs created during design

CODEBASE (on approval only):
  Test files in project test directories       <- Stage 4
  Code in source directories                   <- Stage 3

manifest.md template:
```markdown
# Plan: {Name}
Created: {date}
Status: Stage {N} - {name}
Owner: {name}

## Artifacts (this folder)
| File | Stage | Status | Date |
|------|-------|--------|------|
| [Intent](intent.md) | 1 | Draft/Accepted | {date} |
| [Research](research/findings.md) | 1 | | {date} |
| [Spec](spec.md) | 2 | Draft/Approved | {date} |
| [Audit](audit.md) | 2 | PASS/NOT PASS | {date} |
| [Build plan](plan.md) | 3 | Draft/Approved | {date} |
| [Impact review](impact-review.md) | 3 | | {date} |
| [Test plan](test-plan.md) | 4 | | {date} |
| [Review](review.md) | 5 | Authorized by {name} | {date} |

## Project Documents (in docs/)
| Document | Type | Path | Created |
|----------|------|------|---------|
| (none yet) | | | |

## Change Records
| CR | Date | Summary |
|----|------|---------|
| (none yet) | | |

## Codebase Files
| File | Type | Created |
|------|------|---------|
| (none yet) | | |
```
</workspace>

<workflow>
## Step 0: Detect Intent and Create/Resume Workspace

Parse $ARGUMENTS:
- If the first word is `intent` -> INTENT-ONLY mode: run Stage 1, commit intent.md,
  ask for acceptance, then STOP. Say so up front. Use this when the originator is
  capturing an idea and design is someone else's decision.
- If a plan folder matching the name exists in docs/plans/ -> RESUME (read status.json)
- If "from" keyword present -> NEW plan with source material (a docs folder, a ticket,
  a troubleshooting log)
- If just a name -> NEW plan from an idea

For NEW plans:
```bash
TODAY=$(date +%Y-%m-%d)
PLAN_NAME="{name}"
PLAN_DIR="docs/plans/${TODAY}-${PLAN_NAME}"
mkdir -p "$PLAN_DIR/research/intake" "$PLAN_DIR/changes"
mkdir -p docs/adr docs/prd
```

Suggest a default name based on input. Ask the user to confirm or rename:
```
Suggested plan name: worldpay-canada
This will create: docs/plans/2026-03-07-worldpay-canada/
  [1] Use this name
  [2] Enter a different name
```

Create initial status.json (schema 2). Every stage entry records `status` and,
when it changes, ISO `started` and `completed` timestamps. The timestamps are the
playbook's metrics: intent-to-spec, spec-to-plan, plan-to-authorization, and,
once a release is confirmed, plan-to-release elapsed.
```json
{
  "schema_version": 2,
  "plan_name": "{name}",
  "plan_dir": "docs/plans/{date}-{name}",
  "created": "{ISO date}",
  "current_phase": "plan",
  "documents": {},
  "phases": {
    "plan":     {"status": "in_progress", "started": "{ISO date}"},
    "design":   {"status": "not_started"},
    "build":    {"status": "not_started"},
    "test":     {"status": "not_started"},
    "deploy":   {"status": "not_started"},
    "maintain": {"status": "not_started"}
  }
}
```
`current_phase` and `phases` keep their names so hooks and plan-status read
either schema. Write the initial manifest.md from the template above with every
row Pending.

UPDATE MANIFEST AT EVERY STAGE: when any stage creates or links a document,
update both manifest.md (status and date in the row) and status.json (documents
object, stage status, timestamps).

For RESUME:
Read status.json. If `schema_version` is 1 (a plan started before 8.0.0), map
the old phase names before doing anything else and write the file back as
schema 2, keeping every other field:

| Old phase (schema 1) | New stage (schema 2) |
|----------------------|----------------------|
| brainstorm, research | plan |
| pre_plan, plan, audit | design |
| build, impact_review | build |
| test | test |
| handoff | deploy |

Status rules for the mapped stage, applied in this order:
1. Any old status whose text ends in `complete` (for example `v17_complete`)
   counts as complete.
2. Every mapped old phase complete -> stage `complete`, with `started` from
   the earliest and `completed` from the latest old dates available.
3. Otherwise, if any mapped old phase is complete or in_progress -> stage
   `in_progress` (a stage with one finished half and one unstarted half is
   in progress, not complete).
4. Otherwise -> `not_started`.
Keep the entire old `phases` object verbatim under `phases_schema1`, including
any keys the table does not name (such as a `review` gate), and add a
`schema1_migration` block with the date and the old `current_phase`. Old
artifacts keep their old names (brainstorm.md, approach.md, confidence.md,
docs/specs/{name}.md); read them where the stage file asks for intent.md or
spec.md, and say so in the resume summary. Do not rewrite old artifacts. If a
later stage is complete while an earlier one is not (a plan closed by
decision rather than by sequence), say that in the summary rather than
inventing progress.

Then find the current stage. Show progress and offer to continue:
```
Plan: {name}
Current stage: {stage} ({status})
Last updated: {date}
Intent -> spec: {elapsed or pending}   Spec -> plan: {elapsed or pending}

[show artifact table from manifest.md]

Continue from {stage}?
```

If phases.deploy.status is `authorized`, ask first: "Release authorized by
{authorized_by} on {authorized_at}. Has it been released? Enter the name of the
person confirming and the release time to record it, or continue waiting."
Record per Stage 5 Step E; do not mark the release on the user's behalf.

## Stages 1-6: load the stage file on entry

The six stages live in one file each under `${CLAUDE_SKILL_DIR}/stages/`. Skill
content enters the conversation once and is not re-read after auto-compaction,
so a single long file silently loses its later stages in exactly the long
sessions this workflow produces. Each stage is read when it is entered, so its
instructions are always the most recent thing in context.

RULE: On entering a stage (new plan, gate passed, or RESUME landing in it), READ
the stage file with the Read tool BEFORE doing any work in that stage. Re-read it
after any compaction. Read only the current stage; do not read ahead.

| # | Stage | File |
|---|-------|------|
| 1 | Plan | `${CLAUDE_SKILL_DIR}/stages/stage-1-plan.md` |
| 2 | Design | `${CLAUDE_SKILL_DIR}/stages/stage-2-design.md` |
| 3 | Build | `${CLAUDE_SKILL_DIR}/stages/stage-3-build.md` |
| 4 | Test | `${CLAUDE_SKILL_DIR}/stages/stage-4-test.md` |
| 5 | Deploy | `${CLAUDE_SKILL_DIR}/stages/stage-5-deploy.md` |
| 6 | Maintain | `${CLAUDE_SKILL_DIR}/stages/stage-6-maintain.md` |

Paths use forward slashes on every platform. If a stage file cannot be read, stop
and report the path; do not improvise the stage from memory.

Gate bookkeeping, every time a gate is passed (Stage 5 excepted; see the next
paragraph): set the stage's `completed` timestamp, set the next stage to
`in_progress` with `started`, set `current_phase`, and record who approved
(`accepted_by`, `approved_by`, `authorized_by`) with the date. A gate without a
recorded name is not passed.

Stage 5 records two events, never one: `phases.deploy.authorized_by` and
`authorized_at` when a named human authorizes the release (status
`authorized`), then `released_by` and `released_at` when a human confirms the
release happened (status `complete`, `completed` = `released_at`,
`phases.maintain.started` = `released_at`). Authorization is not rounded up to
release.
</workflow>

<staleness_rules>
Path-scoped fingerprinting (not full repo SHA):

Each stage records hashes of ONLY the files it referenced.
Three freshness levels:
- FRESH: referenced files unchanged since the stage completed
- WARNING: related files in same directory changed (may affect findings)
- STALE: directly referenced files changed (findings likely invalid)

Invalidation cascade:
- intent.md changes after acceptance -> spec.md becomes STALE, and the change is a
  Change Record (the playbook measures intent edits after the first spec commit)
- spec.md changes after approval -> audit.md and plan.md become STALE
- plan.md changes after approval -> recorded under "Departures from plan" in the
  same commit; review.md's diff-versus-plan check reads it
- source docs change after research -> research becomes WARNING

On resume, check freshness of all completed stages and report any staleness.
</staleness_rules>

<error_handling>
| Failure | Recovery |
|---------|----------|
| Source folder unreadable | Skip doc cleanup, continue with codebase + web |
| Codebase scan finds nothing | Note "no existing code found", proceed |
| MCP/web research unavailable | Skip Track 3 or use codebase-only research, tag "[EXTERNAL RESEARCH UNAVAILABLE]" |
| Stage partially complete | Save to status.json, allow resume |
| Existing plan folder | Ask: resume existing or create {name}-2? |
| status.json corrupted | Rebuild from existing files in plan folder |
| status.json is schema 1 | Migrate per the Step 0 table; old artifacts stay under their old names |
| Referenced files deleted | Mark findings as STALE, suggest re-research |
| Gate approver not named | Do not advance; ask for the name |
</error_handling>

<valid_commands>
Only suggest these (each exists as a command file or a skill):
/toque:documentation, /toque:help, /toque:plan,
/toque:plan-export, /toque:plan-status, /toque:quick-audit, /toque:quick-cleanup,
/toque:quick-plan, /toque:troubleshoot
</valid_commands>
