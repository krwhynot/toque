# Stage 3: BUILD

Stage file for /toque:plan. Loaded by SKILL.md on entry; re-read after compaction. Do not read ahead.

Question: What exactly will change, in what order, and what else does the change affect?
Reads: spec.md (Status: Approved), audit.md, status.json assumptions
Produces: docs/plans/{date}-{plan-name}/plan.md (build plan), changes/CR-{N}.md, impact-review.md, codebase changes on approval
Gate: plan.md approved before any implementation; impact review confirmed by user to close the stage

## Contents

- Step 1: Write the build plan (plan.md) and get it approved
- Step 2: Hard gate: assumption verification (LINT-08)
- Step 2: Parallel execution rule, document and codebase actions
- Step 2: Change control and change record template
- Step 3: Impact review (exit check) - dimensions 1-7, parallel subagents, impact-review.md
- Gate

Do not start this stage unless spec.md Status is Approved. If it is Draft, return
to Stage 2 (Design).

Update status.json: build -> in_progress (set started timestamp)

---

## Step 1: Write the build plan

Nothing is implemented without an approved plan.md. The spec says WHAT and WHY;
plan.md says exactly WHICH FILES, in WHAT ORDER, and HOW WE WILL KNOW. It is
written for an engineer (or agent) who never saw this conversation.

Read spec.md Delivery and Verification plan, then write
docs/plans/{date}-{plan-name}/plan.md:

```markdown
# {Title} — Build Plan

- Derived from: spec.md ({commit or path})
- Status: Draft
- Date: {YYYY-MM-DD}

## Files that change

{Files to create and modify. One line each: path, create|modify|delete, which
spec.md ticket authorizes it.}

## Order of work

1. {Step with concrete commands where relevant. Each step names its ticket and
   the delivery phase it belongs to.}

## Risks

{What could go wrong and how we de-risk it; e.g., "the claims-core API
rate-limits at 50 rps; the panel must cache."}

## Proof

{The tests that prove the change, and the visual evidence where relevant; e.g.,
"test_status.py covers the four claim states; screenshot matches the approved
mock." Test authorship is separate from implementation authorship for
AI-generated code (spec.md Verification plan).}

## Verification

{Commands to run and what healthy output looks like; e.g., `make build` ends
with "Build succeeded", `make test` with all green.}

## Parallelization

{Which sessions/subagents can work in isolation, and how changes stay
separated. Derive from the ticket dependency graph (Step 2).}

- Each session/subagent has a functional name, a defined scope, and a visible
  report; no silent or unbounded background work.
```

DONE WHEN: an engineer who never saw the conversation could implement from
plan.md alone. If a step needs a decision the reader cannot make from plan.md
and spec.md, the step is not written yet.

REVIEW (user gate). Present plan.md and ask the reviewer three questions:
  1. "What could this break?"
  2. "Which step is riskiest?"
  3. "What was ruled out, and why?"

Record the answers under ## Risks (questions 1 and 2) and as a "Ruled out"
list under ## Order of work (question 3). Then:

"Build plan ready. Approve plan.md? [approve / adjust]"

On "adjust" -> revise and re-ask.
On "approve" -> set plan.md Status: Approved, commit plan.md,
record status.json phases.build.plan_approved = {ISO timestamp}.

LIVING DOCUMENT RULE: when implementation departs from plan.md, update plan.md
in the SAME commit as the code change. A plan that describes what was intended
rather than what was done is worse than no plan: the impact review (Step 3) and
Stage 4 (Test) read plan.md as the record of what changed. Material departures
also need a Change Record (see change control below); the CR explains why, the
plan.md edit records what.

---

## Step 2: Build

HARD GATE: ASSUMPTION VERIFICATION (LINT-08)
Before ANY build work begins, check assumptions in status.json:

```
For each assumption where impact = HIGH:
  If status = unverified:
    -> BLOCK entry to build work
    -> Present: "Cannot start Build. These HIGH-impact assumptions are unverified:"
    -> List each with its verification method
    -> Offer: [1] Verify now  [2] Accept risk (waiver)  [3] Back to research

  If status = verified: -> PASS
  If status = waived: -> PASS (with documented risk acceptance)
  If status = falsified: -> BLOCK and return to Stage 2 (Design) (approach is invalid)

For each assumption where impact = MEDIUM and status = unverified:
  -> WARN but allow proceeding

For each assumption where impact = LOW and status = unverified:
  -> INFO only
```

If user chooses [2] Accept risk (waiver), require:
- Documented risk statement
- Approver name
- Contingency plan if assumption fails
- Update assumption status to "waived" in status.json

This gate is NOT advisory. It is a hard block. The plan CANNOT proceed to
build work with unverified HIGH-impact assumptions unless explicitly waived.

This step actively assists with implementation.

PARALLEL EXECUTION RULE:
Before starting tickets, analyze the dependency graph from the plan:
- Tickets with NO dependencies on other tickets can run IN PARALLEL as subagents
- Tickets that depend on other tickets must wait until dependencies complete
- Group independent tickets into parallel batches

```
Example dependency graph:
  POS-5160 (no deps)     -> Batch 1 (parallel)
  POS-5161 (no deps)     -> Batch 1 (parallel)
  POS-5162 (no deps)     -> Batch 1 (parallel)
  POS-5163 (needs 5160)  -> Batch 2 (after 5160 completes)
  POS-5164 (needs 5162)  -> Batch 2 (after 5162 completes)
  POS-5165 (needs 5163, 5164) -> Batch 3 (after Batch 2)
```

Present the batch plan to the user:
"I can run {N} tickets in parallel (Batch 1: {tickets}).
Batch 2 ({tickets}) depends on Batch 1. Execute Batch 1 in parallel? [Y/n]"

For each parallel batch, deploy subagents:
- Each subagent gets: ticket description, relevant plan sections, codebase context
- Each subagent writes to a separate branch or file set
- Orchestrator tracks progress and resolves conflicts between parallel work

DOCUMENT ACTIONS (no approval needed):
- Track ticket progress (update status.json with per-ticket notes)
- Answer questions about the plan ("what file for POS-5162?")
- Provide code context from research
- Suggest next ticket to work on based on dependencies

CODEBASE ACTIONS (approval required per action):
- "Generate code scaffold for CcReceiptStrings.cs? [Y/n]"
- "Run characterization tests on Printing.FormatReceipt? [Y/n]"
- "Create branch description for Phase 1 tickets? [Y/n]"

CHANGE CONTROL (backward flow rules with immutable records):
Two paths in the plan folder are immutable once written: `changes/CR-*.md` and
`snapshots/**`. They are never edited, renamed, or deleted; a mistake in one is
corrected by adding a new record. Everything else is living state, and each file
changes only in the way its stage names:
- intent.md after acceptance and spec.md after approval: not edited in place.
  A change travels as a Change Record, and the original receives one
  SUPERSEDED banner line at the top and nothing else.
- plan.md: living during Build. Departures are appended in the same commit as
  the code (see below); the approved steps themselves are superseded by a CR.
- status.json, manifest.md, and the audit baseline: bookkeeping, updated by
  every stage and by Maintain.
Changes to accepted content require a formal Change Record, not silent edits.

- Minor discovery during build:
  1. Create docs/plans/{date}-{name}/changes/CR-{N}.md with:
     - What changed and why
     - Which document/section it supersedes
     - The NEW content (the CR is the authoritative version going forward)
     - Impact on other phases
  2. Add a status line to the TOP of the original document: "SUPERSEDED by CR-{N} on {date}"
     Do NOT modify the original document's content. The CR contains the new version.
  3. Update manifest.md with link to the Change Record
  4. Update status.json: { "change_records": [{ "id": "CR-001", "date": "...", "summary": "..." }] }

- Scope change discovered -> "This changes the scope. Go back to Design? [Y/n]"
  If yes: create CR-{N} documenting the scope change reason, mark design
  and build as STALE, return to Stage 2 (Design). Original spec.md preserved.

- New blocker found -> mark current build ticket as BLOCKED with reason,
  create CR-{N} documenting the blocker and its impact.

- Implementation diverges from plan -> create CR-{N} documenting the divergence
  and rationale, and update plan.md in the same commit (living document rule).
  This replaces informal ADR/change notes.

Change Record template:
```markdown
# CR-{N}: {Title}
Date: {date}
Author: {name}
Supersedes: {document or section}

## What Changed
## Why It Changed
## Impact on Other Phases
```

Update status.json with build progress, manifest.md.

No gate on build work itself. User stays in build until ready for the impact
review, which is the exit check for this stage.

---

## Step 3: Impact review (exit check)

Question: What else does this change affect across layers?

This is a cross-cutting verification gate. Code that works locally and passes
targeted tests can still break integration edges, scale behavior, transition-state
UX, and downstream consumers. This step explicitly asks "what did we miss?"

WHAT IT CHECKS:

1. INTEGRATION EDGES
   - What other modules call the code we changed?
   - Did we update all callers, or just the ones we knew about?
   - Are there event handlers, webhooks, or async consumers that depend on
     the old behavior?
   ```bash
   # Find all callers of changed functions
   grep -rn "{function-name}" --include="*.cs" --include="*.vb" --include="*.ts" \
     . 2>/dev/null | grep -v node_modules | grep -v test
   ```

2. CROSS-LAYER EFFECTS
   - Database: did schema changes affect other queries or stored procedures?
   - API: did response format changes break downstream consumers?
   - UI: did state changes affect other screens or components?
   - Config: did new settings need to be added to all environments?

3. SCALE AND PERFORMANCE
   - Will this change behave differently at production load?
   - Did we add queries inside loops? New N+1 patterns?
   - Did we add memory-intensive operations without limits?

4. TRANSITION-STATE BEHAVIOR
   - During rollout, old and new code may run simultaneously.
   - Feature flags: is the off-state still safe?
   - Database migrations: is the schema compatible with both old and new code?
   - What happens to in-flight requests during deployment?

5. TEST DELTA
   - What tests existed before vs after?
   - Did we add tests for the new behavior?
   - Did existing tests need updating and did we miss any?
   - Are there integration tests that cover the cross-cutting paths?

6. STRING PATH REFERENCES (critical for file moves/renames)
   If ANY files were moved or renamed during build, scan for stale
   string-based path references that don't auto-update. This is a KNOWN gap:
   TypeScript/VSCode updates import statements on file move, but does NOT
   update string literals.

   Patterns to scan for old file paths:
   - vi.mock("old/path") and jest.mock("old/path")
   - require("old/path") string arguments
   - eslint.config.js ignore arrays
   - tsconfig.json paths and includes
   - vite.config.ts resolve.alias
   - webpack.config.js alias/resolve
   - storybook stories globs
   - jest.config moduleNameMapper
   - package.json scripts that reference file paths
   - .env files with path values
   - CLAUDE.md or README references to file locations

   ```bash
   # For each moved/renamed file, find stale string references
   OLD_PATH="{old-file-path-without-extension}"
   grep -rn "$OLD_PATH" --include="*.ts" --include="*.tsx" --include="*.js" \
     --include="*.json" --include="*.config.*" --include="*.md" \
     . 2>/dev/null | grep -v node_modules | grep -v ".git/"
   ```

   Any match is a potential stale reference that needs updating.
   TypeScript Issue #62835 (open): This is a known gap in all major IDEs.

7. BACKWARD TRACEABILITY (does every change serve a goal?)
   For every file changed during build, verify the reverse coverage chain:
   - Changed file -> Ticket that authorized the change -> Goal it serves

   Orphan detection:
   - Files changed with no ticket mapping = SCOPE CREEP (flag)
   - Tickets with no changed files = DELIVERY GAP (flag unless explicitly deferred)

   ```bash
   # For each changed file, check if it maps to a plan ticket
   # Compare git diff file list against ticket-file mapping in status.json
   git diff --name-only HEAD~{N}..HEAD | while read FILE; do
     grep -q "$FILE" docs/plans/{date}-{name}/status.json || echo "ORPHAN: $FILE"
   done
   ```

   Also compare the diff against plan.md ## Files that change. A file in the
   diff but not in plan.md means plan.md was not kept current (living document
   rule); fix plan.md before proceeding.

   Any orphan file must be either:
   - Linked to an existing ticket (developer forgot to log it)
   - Justified as necessary infrastructure (added to a new ticket)
   - Flagged as scope creep for review

   This traceability check is what LINT-11 and LINT-12 are evaluated against;
   the registry holds their text and marks both as Phase 7 (its key for the
   impact-review set), Full mode only.

PROCESS:
PARALLELIZATION RULE: The check dimensions are independent. Deploy parallel
subagents for each dimension to speed up the review.

Deploy up to 3 subagents in parallel (scale to the size of the change):

SUBAGENT A - Integration & Cross-Layer (Sonnet):
Objective: Find all callers of changed code, check integration edges and cross-layer effects
Tools: Read, Grep, Glob, Bash
Checks: dimensions 1 (Integration Edges) and 2 (Cross-Layer Effects)

SUBAGENT B - Scale & Transition State (Sonnet):
Objective: Analyze performance impact and transition-state safety
Tools: Read, Grep, Glob
Checks: dimensions 3 (Scale) and 4 (Transition-State)

SUBAGENT C - Test Delta, String Paths & Backward Trace (Sonnet):
Objective: Compare test coverage before vs after, scan for stale string path references, AND verify backward traceability of all changed files
Tools: Read, Grep, Glob, Bash
Checks: dimensions 5 (Test Delta), 6 (String Path References), and 7 (Backward Traceability)

Each subagent writes its section to a temp file. Orchestrator synthesizes.

Steps:
1. Read the changed files from status.json and plan.md ## Files that change
2. Deploy subagents with the list of changed files + relevant audit data
3. Each subagent scans for its dimensions
4. Cross-reference with docs/audit/dependency-map.md (if exists)
5. Cross-reference with docs/audit/integration-scan.md (if exists)
6. Synthesize all subagent findings
7. Flag any untested integration path
8. Present findings as a checklist

OUTPUT: Written to docs/plans/{date}-{plan-name}/impact-review.md with:

```markdown
# Impact Review: {Plan Name}
Date: {date}
Changed files: {count}
Integration edges checked: {count}

## Cross-Cutting Findings

| # | Finding | Severity | File | Checked? |
|---|---------|----------|------|----------|
| 1 | OrderReceipt.tsx also formats receipt strings | HIGH | src/features/orders/ | [VERIFY] |
| 2 | CCApproval.vb has hardcoded receipt text | MEDIUM | POSetcPOS/CreditCard/ | [VERIFY] |
| 3 | Print preview doesn't use new string table | LOW | POSetcPOS/Printer/ | [VERIFY] |

## Integration Paths Not Covered by Tests
- [list of caller->callee paths that have no test coverage]

## Scale Concerns
- [any performance-related observations]

## Transition-State Risks
- [anything that could break during partial rollout]

## Checklist Before Test Stage
- [ ] All callers of changed functions verified
- [ ] No untested integration paths remaining (or explicitly accepted)
- [ ] Scale behavior reviewed for production load
- [ ] Feature flag off-state tested
- [ ] Database migration compatible with old and new code
- [ ] No orphan code changes (all changes traced to tickets) [LINT-11]
- [ ] No orphan tickets (all tickets have implementation or are deferred) [LINT-12]
- [ ] plan.md ## Files that change matches the diff (living document rule)

TESTING METHODOLOGY VERIFICATION:
For each deliverable with an assigned testing methodology (from spec.md Verification plan):
- [ ] Methodology is appropriate for the type of change (not defaulting to "unit tests")
- [ ] Test authorship is separate from implementation authorship for AI-generated code
- [ ] Database changes use Expand/Contract with forward AND backward migration scripts
- [ ] API changes have contract tests covering old code + new schema AND new code + old schema
- [ ] Characterization tests captured BEFORE refactoring (not after)
- [ ] AI Failure Mode Checklist applied to all AI-generated deliverables

Database Migration Testing (if applicable):

| Phase | What to Test | Method |
|-------|-------------|--------|
| Expand | New columns/tables exist, old untouched | Structural assertions |
| Migrate | Row counts, checksums, referential integrity preserved | Characterization + Shadow |
| Contract | Old structures removed, no orphan refs, all code uses new schema | Structural assertions |
| Rollback | Backward migration restores original state | Apply -> verify -> rollback -> verify |
| Backward compat | Old code + new schema works, new code + old schema works | Contract Testing |
| Performance | Queries under threshold, indexes present, no N+1 | Property-Based + Profiling |
```

---

## Gate

GATE: User confirmation required.
"Impact review complete. {N} cross-cutting findings, {M} untested integration
paths. Review the findings and confirm before proceeding to Test."

If HIGH severity findings exist:
"HIGH severity: {finding}. This should be addressed before Stage 4 (Test).
Fix it now, or accept the risk and proceed? [fix / accept with reason]"

On "fix": return to Step 2, make the change (update plan.md in the same commit),
re-run the affected impact-review dimension.
On "accept with reason": record the accepted finding and reason in
impact-review.md and status.json.

On confirm:
Commit impact-review.md and plan.md together.
Update status.json: build -> complete (set completed timestamp)
Update manifest.md progress table.
-> Proceed to Stage 4 (Test).
