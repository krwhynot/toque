# The six-stage workflow

Preparation has an order. You do not discover the missing ingredient after service.

`/toque:plan {name}` takes a change through **Plan, Design, Build, Test, Deploy, and Maintain**. It writes connected records, asks for the required approvals, and can implement and test after approval. It prepares deployment; a human authorizes and performs production release.

For your first run, use the [quickstart](quickstart.md). This page explains the stage contracts. [Plan workspace](plan-workspace.md) owns the file layout and resume rules.

This workflow adapts [Anthropic's AI-Native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook). The [methodology comparison](../METHODOLOGY.md#relationship-to-the-ai-native-sdlc-playbook) distinguishes the broader playbook from Toque's actual gates and automation.

<p align="center">
  <img src="../assets/toque-tall-mascot.png" width="120" alt="Toque, the tall chef-hat reviewer.">
</p>

## Start, import, or resume

```text
/toque:plan scheduled-reports
/toque:plan intent scheduled-reports
/toque:plan scheduled-reports from docs/vendor-specs/
```

The normal form creates or resumes a plan. The `intent` form runs only Stage 1 and stops, even after acceptance. The `from` form supplies source documents for intake.

An existing workspace is resumed from `status.json`, with a freshness check before continuing. `/toque:plan-status` shows progress without starting the next stage.

## Rules across the workflow

- Approval must be explicit and recorded; the agent does not infer it from silence.
- No implementation before approval of `plan.md`.
- Verify work before presenting it for review. A proposed command is not a result.
- Changes to locked scope require a Change Record.
- The agent must not authorize or perform production deployment.

These are instructions to the agent. Informational hooks do not enforce a security boundary; production permissions and deployment controls remain your responsibility.

### Approval tiers

Read-only research and planning-document updates need no separate action approval. Codebase writes and side-effect commands—Git operations, package installs, and builds—require approval. The stage-specific test procedure below distinguishes its automated run from human confirmation. Production release is not an approval tier the agent can execute.

### Reads, writes, and decisions

Each stage reads the previous artifact, writes its own, and stops at a decision a named human records.

| Stage | Reads | Writes | Executable check | Human decision |
| --- | --- | --- | --- | --- |
| Plan | Your idea, ticket, or `from` folder; the codebase; search tools | `intent.md`, `research/findings.md`, `research/reference-data.json`, `research/intake/` | None | Named product owner sets `Status: Accepted` |
| Design | `intent.md` (Accepted), `research/findings.md`, `research/reference-data.json` | `spec.md`, `audit.md`, `evidence/`, `.canary/` (scratch) | `tq-canary.js` and `tq-evidence-validate.js`, run by the caller | Scope lock; reviewer name or eligible solo waiver; `Status: Approved` |
| Build | `spec.md` (Approved), `audit.md`, assumptions in `status.json` | `plan.md`, `changes/CR-{N}.md`, `impact-review.md`; code only on approval | None (the assumption gate is an instruction) | Approve `plan.md`; approve each codebase action; waive a HIGH assumption; confirm impact review |
| Test | `spec.md` Verification plan, `plan.md` Proof and Verification, `audit.md`, `impact-review.md`, `status.json` | `test-plan.md`, `status.json` test gate | Tier 1 automated tests, run with approval | Confirm every Tier 2 manual check by name |
| Deploy | `intent.md` Constraints, `plan.md`, `test-plan.md`, `status.json`, `git diff` | `review.md`, `plan.md` Departures from plan | Fresh subagent compares diff with plan (a report, not a check) | Named human records Authorized, Rejected, or Deferred, performs the release, then confirms it; `status.json` records authorization and release as two separate events |
| Maintain | The plan folder, `troubleshooting/` logs, `docs/troubleshooting/knowledge-base.md` | `status.json` maintain metrics; a new draft `intent.md` when the trigger fires | None | Accept or reject the new intent back in Plan; never auto-accepted |

The canary and evidence validator are the only executable checks in the workflow; every other gate is an instruction to the agent plus a recorded human decision. A recorded release authorization is the instruction to a human, not proof that a deployment happened; the deployment is recorded separately, as `released_at`, when a human confirms it, and Deploy stays `authorized` until then.

## Stage 1 — Plan

**Question:** What problem are we agreeing to solve?

**Produces:** `intent.md`, research findings, structured reference data, and intake material.

The ticket rail: capture the request once, in the originator's words.

### Capture intent

The interview covers six subjects, one question at a time:

1. The problem.
2. The desired outcome.
3. Affected people, systems, and owners.
4. Constraints.
5. What is out of scope.
6. Unknowns.

When source documents are supplied, Toque extracts a draft first and asks about gaps rather than making the originator repeat everything.

### Research the request

Three tracks can run in parallel: codebase analysis, source-document cleanup, and external best practices. Research links findings to the files or sources behind them.

MCP research tools are optional. Available web tools are the fallback; if no external research is possible, output is tagged `[EXTERNAL RESEARCH UNAVAILABLE]`.

Synthesis updates Constraints and Open questions. It does not silently rewrite the originator's Problem or Proposed outcome. Questions are answered or explicitly deferred to Design with reasons; remaining unknowns must not block a viable path.

### Acceptance

A named product owner accepts, requests changes, or rejects the intent. The originator may accept if they own that decision. Design cannot start from a draft: `intent.md` must reach `Status: Accepted`.

## Stage 2 — Design

**Question:** What exactly must the system do, and does the design hold up?

**Produces:** `spec.md`, `audit.md`, and `evidence/`.

The prep list belongs in `spec.md`. Project instructions such as `CLAUDE.md`, where present, remain the house rules—not a replacement for the spec.

### Define and lock scope

The spec records requirements, design, standards applied, gotchas, evidence, and open questions. Deferred questions retain an owner and due date.

The user confirms scope before delivery detail is added. The locked sections are not edited in place afterwards; a change travels as a Change Record with a supersession notice on the original. This is a **mid-stage gate**, not completion of Design.

### Plan verification and delivery

Choose a testing methodology per deliverable, not one method for every job:

| Method | Typical fit |
| --- | --- |
| TDD | Clear behavior, algorithms, core logic |
| BDD | User-facing behavior and shared understanding |
| Characterization / Golden Master | Legacy refactoring |
| Contract testing | API and compatibility boundaries |
| Property-based | Large input spaces and invariants |
| Snapshot / Approval | Structured output, reports, UI |
| Shadow / Parallel | Comparing an existing and replacement system |
| ATDD | Acceptance examples and sign-off |
| Mutation testing | Checking test-suite effectiveness |
| Exploratory | Interaction risks and automation gaps |
| Expand/Contract | Compatible schema changes |

For AI-generated work, the workflow requires separate implementation and test authorship, higher testing scrutiny, and checks for AI failure modes such as tautological tests, logic drift, and happy-path-only coverage.

Delivery is presented as Jira-ready tickets, a leadership summary, and a working checklist. These are document views, not a claim that Toque publishes tickets to an external service. Detail scales with risk.

### Challenge the design

The separate auditor and gate tools must establish:

```text
PASS = CANARY_OK AND EVIDENCE_OK AND VERIFIED AND INFRA_OK
```

Read [Design gate](the-design-gate.md) for the checks, revision limits, and known limitations.

After an automated pass, record human review or an eligible solo waiver. Mark `spec.md` approved and name the reviewer or waiver holder. A waiver does not turn a failed automated gate into a pass.

## Stage 3 — Build

**Question:** What changes, in what order, and what else does it affect?

**Produces:** `plan.md`, implementation changes, `impact-review.md`, and Change Records when needed.

The brigade can work in parallel only after the stations know their jobs.

### Approve the build plan first

`plan.md` defines affected files, sequence, risks, supporting proof, verification steps, and parallelization. Approval precedes implementation.

Resolve assumptions before relying on them:

| Assumption state | Consequence |
| --- | --- |
| Verified | Record the evidence. |
| Unverified, HIGH risk | Block or obtain the documented waiver required by the workflow. |
| Unverified, MEDIUM risk | Warn; proceeding is allowed. |
| Unverified, LOW risk | Informational notice. |
| Falsified, HIGH risk | Block and return to Design; do not build on it. |

A HIGH-risk waiver needs a risk statement, a named approver, a contingency plan, and a `waived` status in `status.json`.

### Implement and record departures

Present parallel batches for approval. Independent tickets can use separate file sets or branches. Dependent work waits. The orchestrator owns conflict resolution; parallelism is not a promise of zero overlap.

Codebase actions require approval per action, including generating scaffolding and running the proposed tests. Updating planning notes and answering questions do not require that extra approval.

A scope change gets an immutable `changes/CR-{N}.md`. The Change Record carries the new content; the original receives a supersession notice rather than a silent rewrite. A scope change can mark Design and Build STALE and return the work to Design. Update the living `plan.md` in the same commit as an implementation departure so the later diff review can account for it.

### Review impact

The impact review examines seven dimensions in three groups, including cross-cutting effects and integration edges. Present `impact-review.md` and obtain user confirmation before Test.

HIGH-severity findings require a choice: fix and rerun the affected review, or accept the risk with a recorded reason. New blockers mark the ticket BLOCKED and receive a Change Record.

## Stage 4 — Test

**Question:** Did the implementation work, including the failure paths?

**Produces:** `test-plan.md` and recorded results.

Automated checks are the temperature probe, not a substitute for every kind of inspection.

The test matrix has two tiers:

- **Tier 1, automated:** all required tests pass.
- **Tier 2, manual:** a human performs and confirms the required checks.

Tier 1 covers critical-path tests, a clean compile, no lint errors in changed files, required characterization baselines, the recorded design-gate pass, and healthy output from the verification commands in `plan.md`.

Tier 2 confirms no open P0/P1 defects, rollback validated in staging or reviewed by operations, key staging user flows, manual edge cases, and runbook review by someone other than its author. The agent must not mark these complete on the user's behalf. Nothing required may remain pending; record who confirmed and when.

TDD is one supported method, not a mandatory description of every test stage. A failed test calls for investigation and correction—not automatic deletion of the implementation.

## Stage 5 — Deploy

**Question:** Does the actual change match the plan, and should it reach production?

**Produces:** `review.md` and the release checklist; a linked runbook when needed.

A fresh reviewer compares the actual diff with planned files and constraints. Unplanned departures must be acknowledged in `plan.md`. The release checklist includes numeric rollback triggers, not “roll back if things look bad.”

The comparison lists changed-but-unplanned files, planned-but-untouched files, and matches. It cites apparent constraint violations for human judgment. Record each departure and its reason (or “unexplained”) under `Departures from plan`, in the same commit as the release candidate. An unexplained departure becomes a finding, not an invisible exception. Rollback thresholds specify both a measurement and a window.

### Production authorization

A named human authorizes **and performs** the release. The agent may prepare commands and verify completed steps after human confirmation.

The skill must not run deploy or publish commands, push release tags, merge into production, or perform production migrations, regardless of task tier.

> **Chef's rule: preparing the release is not permission to serve it.**

Approval and execution belong in the record. Do not invent either to advance the stage.

## Stage 6 — Maintain

**Question:** What is production teaching us?

**Produces:** plan-linked incident records and, when warranted, a new draft intent.

The feedback loop watches what comes back from service. It does not automatically rewrite the recipe.

`/toque:troubleshoot --plan {name}` links incidents to the released work. A SEV1/SEV2 incident, a known pattern with knowledge-base recurrence count of at least three, or a recurrence/guardrail alert can trigger a new draft intent.

That draft must return to Stage 1 for acceptance. Maintain does not silently accept it, change code, or release a fix.

Maintain enters `steady_state` and **never completes**. Preserve the released artifacts as the record of that delivery; status, manifest links, incident logs, and recurrence bookkeeping can continue to change.

## Where to go next

[Your first workflow](quickstart.md) · [Workspace and resume](plan-workspace.md) · [Gate mechanics and limits](the-design-gate.md) · [All plugin capabilities](../plugins/toque/GUIDE.md)
