# Stage 2: DESIGN

Stage file for /toque:plan. Loaded by SKILL.md on entry; re-read after compaction. Do not read ahead.

Question: What should be in scope, how will we execute it, and what is weak or missing?
Reads: intent.md (Status: Accepted), research/findings.md, research/reference-data.json
Produces: docs/plans/{date}-{plan-name}/spec.md, audit.md, evidence/, .canary/
Gate: Design gate PASS + human review (or waiver) + spec.md Status: Approved

## Contents

- Part A: Scope and design (spec.md Requirements, Design, Standards applied, Gotchas)
- Part A: Evidence section (the confidence brief, folded into spec.md)
- Part A: Scope lock (user gate, mid-stage)
- Part B: Verification plan and Delivery (spec.md completed)
- Part C: Design gate (the audit) - checks, outputs A-D, canary, evidence validation
- Part C: the <design_gate> block and its bindings, shared with /toque:quick-plan and /toque:quick-audit
- Part C: Infrastructure verification, plan lint rules, gap summary
- Part C: Evidence reinforcement and baseline snapshot
- Part C: Gate expression, revision loop, auditor isolation
- Part C: Human review gate and waiver condition
- Exit: spec.md Status: Approved

This stage merges the old pre-plan, plan, and audit phases. The single artifact
is spec.md in the plan folder. It is written in two passes (Part A, then Part B
after scope lock), then audited in Part C. The audit is the DESIGN GATE: it runs
against spec.md, and nothing enters Stage 3 (Build) until it passes.

Do not start this stage unless intent.md Status is Accepted. If it is Draft,
return to Stage 1 (Plan) and obtain acceptance first.

Update status.json: design -> in_progress (set started timestamp)

spec.md layout (every section is required; write "None" rather than omit):

```markdown
# {Title} — Specification

- Derived from: intent.md ({commit or path})
- Author: {agent + human reviewer}
- Status: Draft
- Date: {YYYY-MM-DD}

## Requirements
### Functional
### Non-functional
## Success metrics
## Design
## Standards applied
## Gotchas
## Evidence
## Open questions
## Verification plan
## Delivery
```

---

## Part A: Scope and design

Produce the alignment checkpoint. These sections are written first because the
scope lock below is a decision about THEM; Verification plan and Delivery are
written only after scope is locked.

### Requirements

- ### Functional: what the system must do. Derive from intent.md Proposed outcome;
  every functional requirement traces to a line of the intent. Each carries a
  priority (P0 cannot ship without; P1 fast follow; P2 design must not block)
  and acceptance criteria in Given/When/Then form covering the happy path, at
  least one error or boundary case, and one thing that must NOT happen. Each
  criterion is independently testable; "fast" or "intuitive" without a number
  is not a criterion. Challenge every P0: "Would we really not ship without
  this?"
- ### Non-functional: performance, security, accessibility, compliance,
  operability. Derive from intent.md Constraints. Each is measurable.
- ## Success metrics: leading indicators (adoption, task completion, error
  rate) and lagging ones (retention, cost, support load), each with a numeric
  target, a window, a measurement method, and an evaluation date. Stage 6
  reads these; the plan-auditor returns a verdict on their presence.
- Scope: IN list and OUT list. The OUT list starts from intent.md Out of scope and
  grows with anything ruled out during options analysis. After scope lock, any
  addition comes with a removal or a timeline change, recorded in a CR.

### Design

- Options Analysis (REQUIRED): Evaluate minimum 2 approaches before selecting:

  For each option:
  - Name and approach description
  - Pros and cons
  - Risk level (LOW/MEDIUM/HIGH)
  - Rollback complexity (LOW/MEDIUM/HIGH)

  Comparison matrix scoring each option against:
  - Implementation ease, Timeline, Strategic value, Risk profile, Rollback complexity

  Decision Rationale: WHY the selected option won, referencing specific criteria.
  Losing options: document "would revisit if" conditions.

- Approach/Pattern: which pattern and WHY (strangler fig, feature flag, migration, new build, integration)
- Architecture or data flow; interfaces (APIs, data, UI)
- Constraints: timeline, team, technology
- Dependencies: internal, external, hard blockers, soft dependencies

### Standards applied

Which org standards (brand, security, UX, compliance) were applied, and how.
Cite the standard document where one exists.

### Gotchas

Top 3 Risks: each with impact level and mitigation. Add conflict points, risky
decisions, trade-offs, and what to watch during build.

### Evidence

EVIDENCE SECTION (REQUIRED — written after Design, before the scope lock):

WHY THIS EXISTS: Without external evidence backing, plan decisions rest on
the authoring agent's training data alone — which may be outdated, biased, or
hallucinated. Stakeholders reviewing plans cannot distinguish "this is industry
standard" from "this is what the AI made up." The Evidence section solves this
by requiring verifiable external evidence for every significant tool, method,
and pattern choice.

SUCCESS CRITERIA:
- Every HIGH-impact entry has at least one verifiable reference link
- A stakeholder unfamiliar with the plan can read the Evidence section and
  understand why the chosen approach is industry-proven (not just "the AI
  suggested it")
- No fabricated company examples (see SOURCE CREDIBILITY below)

TIMEBOX: The Evidence section should take no longer than the Design section itself.
- MAX ENTRIES: 10 entries per plan (prioritize by impact). If more than 10
  items are identified, defer LOW-impact items with a note: "Deferred: {item}
  (LOW impact, not blocking scope lock)"
- If entry count exceeds 10, stop and present the top 10 sorted by impact.
  User can request additional entries after scope lock.

Step breakdown (approximate effort per entry):
1. Discovery — scan the Design section, research/findings.md, and intent.md for items (~1 min total)
2. Drafting — write "what it is" and "connection to plan" (~1 min per entry)
3. Evidence gathering — search for "who uses it" and references (~2 min per HIGH, ~1 min per MEDIUM)
4. Cross-plan search — check other plans' spec.md Evidence sections (~30 sec per entry)
5. Review — verify URLs for HIGH-impact entries if web tools available (~1 min per HIGH)

If the plan is under timeline pressure, skip steps 4-5 for MEDIUM and LOW
entries and mark them with "[CROSS-PLAN CHECK DEFERRED]" and "[URL VERIFICATION
DEFERRED]". HIGH-impact entries MUST always complete steps 3-5 regardless of
timeline pressure — these entries drive scope lock decisions and cannot be deferred.

The Evidence section is a self-contained knowledge brief that grounds every
tool, method, and pattern choice in external industry evidence. It is
stakeholder-readable: someone outside the plan should be able to read it and
understand why these choices are solid.

Scan the Design section, research/findings.md, and intent.md for:
- New dependencies/packages (NuGet, npm, pip, etc.)
- Methodologies or patterns chosen (strangler fig, expand/contract, CQRS, etc.)
- Best practices referenced (DORA metrics, chaos engineering, etc.)
- Frameworks, libraries, or tools introduced

For EACH item found, write an entry under ## Evidence using this structure:

```markdown
## Evidence
Created: {date} (Stage 2)
Last reinforced: {date} (design gate, if applicable)

> This section explains WHY the tools, methods, and patterns in this plan
> are industry-proven choices. Each entry defines what it is, who uses it
> at scale, and why it works — then briefly connects it to this plan.

### Dependencies & Tools

#### {Package/Tool Name} {version} {#anchor}
**Impact:** {HIGH|MEDIUM|LOW} — {one-line rationale}

**What it is:** {1-2 sentence definition — what the tool does, what problem it solves}

**Who uses it at scale:**
- **{Company 1}** — {how they use it, what scale, what outcome}
- **{Company 2}** — {how they use it, what scale, what outcome}

**Why it works:** {1 paragraph — the engineering reason this tool is effective,
what architectural property it provides, what failure mode it prevents}

**Reference:** [{title}]({url}) ← link to official docs, conference talk, or case study

**Connection to this plan:** {1-2 sentences — why we chose this specifically,
which plan goal it serves}

**Also referenced in:** [{other-plan-name}](../{other-plan-dir}/spec.md#{anchor}) ← only if another plan uses the same tool

### Methods & Patterns

#### {Method/Pattern Name} {#anchor}
**Impact:** {HIGH|MEDIUM|LOW} — {one-line rationale}

**What it is:** {1-2 sentence definition}

**Origin:** {Who created/popularized it — e.g., "Martin Fowler (2004)",
"Netflix engineering team (2011)", "Microsoft Azure Architecture Center"}

**Who uses it at scale:**
- **{Company 1}** — {context and outcome}
- **{Company 2}** — {context and outcome}

**Why it works:** {1 paragraph — the engineering principle, what it optimizes
for, what tradeoff it makes explicit}

**Reference:** [{title}]({url})

**Connection to this plan:** {1-2 sentences linking to specific plan phases or decisions}

**Also referenced in:** [{other-plan-name}](...) ← only if applicable

### Best Practices & Standards

#### {Practice Name} {#anchor}
**Impact:** {HIGH|MEDIUM|LOW} — {one-line rationale}

**What it is:** {1-2 sentence definition}

**Advocated by:** {Organization or thought leader — e.g., "DORA/Google",
"OWASP", "12-Factor App (Heroku)"}

**Industry evidence:**
- {Specific metric or finding — e.g., "Teams using trunk-based development
  deploy 973x more frequently (DORA State of DevOps 2023)"}

**Why it works:** {1 paragraph}

**Reference:** [{title}]({url})

**Connection to this plan:** {1-2 sentences}
```

CROSS-PLAN REFERENCES:
Before writing each entry, search existing plan folders' spec.md files for the
same tool or pattern:
```bash
find docs/plans/ -name "spec.md" -exec grep -l "{tool-or-pattern-name}" {} \;
```
If found in another plan, add an "Also referenced in" link. The entry in THIS
file must still be self-contained (full context) — the link is supplemental,
not a replacement for content. A reader should never need to open another
plan's spec.md to understand this one.

ENTRY PRIORITIZATION:
- HIGH-impact items (core dependencies, primary pattern): full entry with reference link REQUIRED
- MEDIUM-impact items (supporting tools, secondary patterns): full entry, reference link optional
- LOW-impact items (dev tooling, standard practices): shorter entry, no reference link required

Impact classification criteria (rationale REQUIRED for each classification):
- HIGH: item is on the critical path, a wrong choice causes plan failure or rework
  (e.g., primary database, core framework, architectural pattern)
  Rationale example: "HIGH — Markdig is the sole markdown rendering engine; if it
  can't handle our edge cases, the entire doc pipeline fails"
- MEDIUM: item supports the plan but alternatives exist with low switching cost
  (e.g., utility libraries, secondary patterns, testing tools)
  Rationale example: "MEDIUM — YamlDotNet parses config; could swap to SharpYaml
  with ~2 days of work if needed"
- LOW: item is standard practice or dev tooling with no plan-specific risk
  (e.g., linters, formatters, common build tools)

Each entry must include a one-line rationale justifying its impact level.
This prevents gaming: downgrading a critical dependency to MEDIUM to avoid
source verification requirements is visible and reviewable.

SOURCE CREDIBILITY (required for HIGH-impact entries):
Every "Who uses it at scale" and "Industry evidence" claim must be backed by
a verifiable source. Do NOT fabricate company examples.

Source tiers:
- TIER A (preferred): Official docs, conference talks with video/slides,
  published case studies, peer-reviewed papers, DORA/ThoughtWorks reports
- TIER B (acceptable): Reputable blog posts (company engineering blogs),
  GitHub repos with usage evidence, Stack Overflow answers with high votes
- TIER C (flag): Training data recall without a specific URL — mark these as
  "[UNVERIFIED — common knowledge, no primary source found]" so the reader
  knows the claim needs manual verification

HIGH-impact entries MUST have at least one TIER A or TIER B source.
If no verifiable source can be found for a HIGH-impact claim, flag it:
"[SOURCE NEEDED — this claim requires manual verification before scope lock]"

URL VERIFICATION: When ref_read_url, web_search_exa, WebSearch, or WebFetch
tools are available, verify that reference URLs for HIGH-impact entries are
reachable before writing them.
- Prefer ref_read_url for documentation URLs (returns clean markdown, trajectory-aware)
- Use web_search_exa for general web URLs (semantic matching)
- Fall back to WebFetch if MCP tools are not available
If a URL is dead or redirects to unrelated content, downgrade to TIER C and
flag as "[LINK DEAD — needs replacement source]".

CONFLICTING EVIDENCE: If two sources disagree on a claim (e.g., one recommends
a tool, another warns against it), document both perspectives:
"[CONFLICTING] Source A says X. Source B says Y. This plan assumes X because
{rationale}." Let the stakeholder see the tension rather than hiding it.

EVIDENCE FALSIFICATION (post-scope-lock):
If an Evidence entry is later found to be wrong (e.g., a tool doesn't support
a claimed feature, a company example was fabricated, a pattern doesn't apply):
1. Create a Change Record (CR-{N}) documenting what was wrong and the impact
2. Mark the Evidence entry with: "**FALSIFIED ({date}):** {what was wrong}"
3. Mark downstream artifacts that relied on this claim as WARNING in status.json
4. If the falsified claim was HIGH-impact, trigger a scope review (return to Stage 2 (Design))
5. If Stage 3 (Build) is in progress, freeze any tickets that depend on the
   falsified claim until the scope review completes

ANCHOR IDS:
Each entry heading must include a kebab-case anchor for cross-plan linking:
`#### YamlDotNet 16.3.0 {#yamldotnet-16}` so other plans can link directly.
When searching for cross-plan references, search for both the tool/pattern
name AND common aliases (e.g., "YAML" for "YamlDotNet", "strangler" for
"strangler fig pattern").

### Open questions

Carry every intent.md open question forward with its current state: answered
(with the answer), or deferred (with owner and due date). Add questions the
design raised. A question with no owner is a gap the design gate will find.

### SCOPE LOCK (user gate, mid-stage)

Present Requirements, Design, Standards applied, Gotchas, Evidence, and Open
questions to the user for confirmation. This is the SCOPE LOCK.

GATE: User confirmation REQUIRED.
"Does this scope look right? [confirm / adjust / back to research]"

On "adjust" -> iterate on the Design section.
On "back to research" -> return to Stage 1 (Plan) research step (mark research
stale if scope changed; intent.md acceptance stands unless Problem or Proposed
outcome change).
On "confirm" -> record in status.json: phases.design.scope_locked = {ISO timestamp}.
Commit spec.md at this point; Part B extends it.

After scope lock, the locked sections are not edited in place. A change travels
as a Change Record with a SUPERSEDED banner on the original (see Stage 3 change
control), never as a silent edit.

---

## Part B: Verification plan and Delivery

Extend spec.md with the two remaining sections. Both are written against the
locked scope.

### Verification plan

TESTING METHODOLOGY SELECTION (REQUIRED):
For EACH deliverable in the spec, select the appropriate testing methodology.
Do NOT default to "unit tests" for everything. Reference the Testing Methodology
Selection Framework (docs/planning-techniques/10-testing-methodology-selection.md).

| # | Methodology | Evidence Tier | When to Use |
|---|-------------|--------------|-------------|
| 1 | TDD | ENTERPRISE-VALIDATED | New feature with clear spec, algorithms, core business logic, stored procedures |
| 2 | BDD | INDUSTRY-RECOMMENDED | User-facing features, cross-functional teams, requirements ambiguity |
| 3 | Characterization / Golden Master | ENTERPRISE-VALIDATED | Refactoring legacy code, extracting from monolith, data migration validation |
| 4 | Contract Testing | INDUSTRY-RECOMMENDED | Microservices, API integrations, database backward compatibility |
| 5 | Property-Based | INDUSTRY-RECOMMENDED | Algorithms with infinite input space, financial calculations, query performance |
| 6 | Snapshot / Approval | INDUSTRY-RECOMMENDED | UI components, serialized output, reports, config generation |
| 7 | Shadow / Parallel | ENTERPRISE-VALIDATED | Production migration, database cutover, replacing live systems |
| 8 | ATDD | INDUSTRY-RECOMMENDED | Sprint planning, user story definition, database migration sign-off |
| 9 | Mutation Testing | EMERGING PRACTICE | Pre-release quality gate, measuring test suite effectiveness |
| 10 | Exploratory | ENTERPRISE-VALIDATED | Complex UI, late-stage discovery, automation gaps |
| 11 | Expand/Contract | ENTERPRISE-VALIDATED | Database schema migration, renaming columns/tables, changing data types |

AI-specific requirements:
- The agent that writes implementation code MUST NOT write the tests (Separate Test Authorship)
- AI-generated code receives higher testing scrutiny than human code
- Every AI-generated deliverable is checked against the AI Failure Mode Checklist:
  logic drift, stale dependencies, hidden business rule violations, tautological
  tests, happy-path-only coverage

For database schema changes, use Expand/Contract (Methodology 11) with three phases:
  - Expand: add new alongside old (structural assertions)
  - Migrate: dual-write, backfill, test (data integrity + shadow comparison)
  - Contract: remove old after cutover (no orphan references)

State how this will be tested at build time and in the eval suite, per
deliverable, naming the methodology from the table.

### Delivery

Write the Delivery section with THREE views:

1. JIRA-READY TICKETS: Per phase, with title, acceptance criteria, assignable
2. LEADERSHIP SUMMARY: Executive summary, timeline table, go/no-go criteria
3. WORKING CHECKLIST: Step-by-step with verification per step

Detail level per phase based on risk:
- HIGH risk: exact files, function names, grep patterns, commit SHA, test requirements
- MEDIUM risk: file paths, approach, key decisions
- LOW risk: goals, scope, success criteria

Include, in the shapes the design gate keys on (the canary attaches to them and
the registry's rules read them; the template shows each):
- Under each phase, a line starting `Rollback:` and a line starting `Go/No-Go:`
- A Dependencies table with an Owner column naming the owning team
- An Assumption register table (`| # | Assumption | Impact If False | How to
  Verify | By When | Owner | Status |`)
- Test file paths (`tests/<name>.test.js` or the project's equivalent) in the
  Verification plan wherever a phase claims test coverage
- Timeline table with dependencies and critical path
- Operational readiness section (if deployment involved): monitoring, config rollout, incident fallback, success metrics
- Rollback plan per phase
- Go/no-go criteria per phase boundary

"Phase" here means a phase OF THE DELIVERY PLAN (Phase 1, Phase 2, ... inside
spec.md), not a stage of this workflow.

Present to user:
"Spec written with {N} delivery phases and {M} tickets over {X} weeks. Review
before the design gate runs? [Y/n]"

Commit spec.md. Update manifest.md: add spec.md to the Artifacts table with date.

---

## Part C: Design gate (the audit)

Question: What is weak or missing?

<design_gate>
This block is the design gate, defined once. /toque:plan runs it here;
/toque:quick-plan and /toque:quick-audit run this same block by reading this
file, so there is one gate and no lighter copy of it. Three bindings are set by
the caller before the block runs:

  {doc}        the document under audit
  {gate_dir}   the folder that receives audit.md, evidence/ and .canary/
  {generator}  the agent that revises {doc} on NOT PASS, or none

Stage 2 binds {doc} = docs/plans/{date}-{plan-name}/spec.md,
{gate_dir} = docs/plans/{date}-{plan-name}/, and {generator} = the spec writer
of Parts A and B. When {gate_dir} is a plan folder, the status.json and
manifest.md updates below apply; otherwise the same facts are recorded in
{gate_dir}/gate.json, which the caller owns (the auditor owns audit.md and
rewrites it on every iteration). {gate_dir}/.canary/ is scratch: never
committed, and deleted once the canary result is recorded. {gate_dir}/audit.md,
{gate_dir}/evidence/ and, for a standalone document, {gate_dir}/gate.json are
committed together with {doc}. A reaudits/{date}/ folder under a plan folder
takes the gate.json branch for the gate result, baseline and history, plus the
manifest.md row and the status.json `documents` entry the command names.

The checks key on the spec template's shapes: a `Rollback:` line and a
`Go/No-Go:` line per phase, a dependency row with an owning team, an assumption
register, a cited test file, and an Evidence section. A document written
outside the template can be audited, and its findings are the point of
auditing it; it can PASS only if it carries those shapes, because the canary
attaches to them and the registry's rules ask for them. When it cannot, the
gate reports NOT PASS with the reasons rather than skipping a check.

Run the checks below using the plan-auditor agent against {doc}.

CHECK 1 - CRITERION RECORDS:
The auditor returns criterion records, not a score; each record carries a
verdict (MET, UNMET, N_A) and the evidence it rests on, and the rubric that
produces those records lives in `agents/plan-auditor.md`, deliberately not here.

CHECK 2 - DEVIL'S ADVOCATE:
Challenge each assumption. For each challenge, cite evidence or flag [VERIFY].
Structured premortem questions:
  "If this fails in production, what is the most likely reason?"
  "What did we assume would be true but isn't?"
  "What changed in one layer but not another?"
  "What behavior works in tests but fails in browser/runtime?"

CHECK 3 - CODEBASE VERIFICATION:
Confirm file paths, line numbers, function names referenced in plan actually exist.

CHECK 4 - GAP VERIFICATION:
This check produces 4 structured outputs that catch systematic gaps.
A plan CANNOT be considered gap-checked until all 4 outputs exist.

OUTPUT A: Coverage Matrix
Map every goal, risk, dependency, and non-goal to its plan artifact:

```markdown
## A. Coverage Matrix

| Item | Type | Covered By | Status |
|------|------|-----------|--------|
| bilingual receipts | goal | Phase 1, POS-5163, tests T1/T2 | covered |
| certification timeline | dependency | Phase 4, owner TBD | partial |
| rollback | operational | plan section + handoff | covered |
| CORS handling | non-goal | explicitly excluded | ok-excluded |
| user pagination | assumption | not addressed | GAP |
```

Rules:
- Every goal must map to at least one phase AND at least one ticket
- Every risk must map to a mitigation
- Every dependency must map to an owner or blocker
- Every rollout item must map to monitoring + rollback
- Every non-goal must NOT accidentally appear in the plan
- Items marked GAP fail the gap check

OUTPUT B: Assumption Register
Every assumption the plan makes, with impact-if-false and verification:

```markdown
## B. Assumption Register

| # | Assumption | Impact If False | How to Verify | By When | Owner | Status |
|---|-----------|----------------|---------------|---------|-------|--------|
| 1 | User lookup fits in first page | Breaks onboarding flow | Check query with production data volume | Before Phase 2 | Kyle | unverified |
| 2 | triPOS SDK supports Canada | Blocks entire plan | Test API call to Canadian endpoint | Phase 1 | Kyle | verified |
| 3 | Supabase rate limit handles OTP volume | Throttles users at scale | Load test 100 concurrent OTPs | Before launch | TBD | unverified |
```

Rules:
- Every assumption must have an impact assessment
- Unverified high-impact assumptions are BLOCKERS
- Assumptions with no validation step are WARNINGS
- Assumptions that block execution must be verified before Stage 3 (Build)

AUTOMATED ASSUMPTION VERIFICATION:
After generating the Assumption Register, attempt automated verification
of all assumptions that have a verification method:

For each assumption where impact = HIGH and status = unverified:
  1. If verification method mentions file/path: run `test -f [path]`
  2. If verification method mentions API/endpoint: note as REQUIRES_MANUAL
  3. If verification method mentions schema/database: search for schema files
  4. If verification method mentions config: search config files
  5. Update assumption status in status.json when {gate_dir} is a plan folder,
     otherwise in {gate_dir}/gate.json under baseline.assumption_counts:
     - verified: automated check passed
     - unverified: automated check failed or not automatable
     - falsified: automated check proved assumption false

Track verification results:
  "Assumptions: X total, Y verified (Z automated, W manual), V unverified, F falsified"

OUTPUT C: Scenario Matrix
The auditor maps a fixed set of scenarios to implementation, test and monitoring.
The scenario list and the output table live in `agents/plan-auditor.md`; they are
not repeated here, for the same reason the rubric is not.

What the plan itself must do — state this to the generator, not the list:
the plan has to account for how the change behaves when it works, when it fails,
while old and new run side by side, under load, at permission boundaries, across
environment differences, and on the way back out. A plan written against a named
checklist tends to grow a section per checklist item; a plan written against the
requirement tends to notice which of those actually apply to it and say so.

Every scenario in the auditor's set gets an entry, including "not applicable" with
a reason. Items marked GAP fail the gap check.

OUTPUT D: Cross-Cutting Concern Sweep
The auditor checks every feature and change against a fixed set of concerns. That
set and its output table live in `agents/plan-auditor.md` and are not repeated here.

What the plan itself must do: address the concerns that cut across the change
rather than sitting inside one component — the contract it exposes, who is allowed
to call it, what differs between environments, how it behaves at the network and
data-access boundary, what it emits when running, and how it migrates and rolls
back. Concerns that genuinely do not apply are excluded explicitly with a reason.

Every concern in the auditor's set gets a verdict. Unaddressed concerns are GAPS;
partial ones are WARNINGS.

CANARY (automated, run BEFORE the auditor is spawned):

Every other check in the design gate examines the plan. This one examines the auditor.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/tq-canary.js" inject \
  {doc} {gate_dir}/.canary/
```

One known defect is injected into a working copy of the spec — a rollback line
removed, a dependency owner blanked, an unverified HIGH-impact assumption added,
go/no-go criteria deleted, or a claim of coverage from a test file that does not
exist. The class is recorded along with the single criterion it violates.

If inject exits 2 with "no canary class could be applied", the document has
none of the five shapes a canary attaches to: a `Rollback:` line, an owned
dependency row, an assumption-register row, a `Go/No-Go:` line, a cited test
file. Do not invent one and do not skip the audit. Run the auditor on the
original, record canary_found = false with reason "not-applicable", and report
NOT PASS with the auditor's unmet list: a plan without those shapes is missing
what the rollback, dependency-owner, assumption and coverage criteria require,
and the unmet list names which. The gate cannot open on a document it cannot
check the auditor against; the findings are still the audit's value. In this
case skip the mutated-copy audit, the `detected` check, the re-anchoring and
the .canary/ deletion below: inject wrote no canary.json and no .canary/, and
the auditor audits {doc} itself.

The auditor then audits the MUTATED copy, knowing nothing of any of this. Point
it at the mutated copy as the document; it cites what it reads, in its records
and in audit.md, and the caller re-anchors both afterwards (step 3 below).

If no tool in this session can spawn a fresh instance, the canary cannot
measure an independent auditor. Do not audit in the context that ran inject
and present the result as a gate: record canary_found = false with reason
"no-isolation", CANARY_OK is false, and report NOT PASS with the findings.

Afterwards, run the check on the UNMET list exactly as the auditor returned it,
before anything is re-anchored — do not perform it by eye:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/tq-canary.js" detected \
  {gate_dir}/.canary/canary.json \
  "<comma-separated UNMET criterion ids>" \
  "<comma-separated ids of EVERY criterion the audit considered>"
```

Exit 0 means found, exit 1 means missed. **Supply the applicable set.** Without
it the check falls back to plain membership, and plain membership is passed by an
audit that returned *every* criterion as UNMET — such an audit hits the canary by
construction and would "detect" a planted defect in a document with none. That
rule lived in the function for a release while the instruction here said to check
membership by hand, so nothing ever ran it.

  1. If the check reports a miss, the audit did not find a defect that was placed
     there to be found. Re-run once with a different class: pass a seed as the
     third inject argument (`inject {doc} {gate_dir}/.canary/ retry`), because
     the default seed is derived from the file and would pick the same class
     again. A second miss fails
     the gate as "audit untrustworthy" — and DOES NOT trigger the revision loop.
     Revising a plan against findings from an audit that could not see a planted
     defect is worse than not revising: it rewrites the spec to satisfy
     conclusions never derived from reading it.
  2. If it was found, strip that finding from the report — it is an artefact of
     this harness, not a property of the plan — and then RE-CHECK that one
     criterion against the unmutated original. The strip alone is unsafe: if the
     plan has a genuine gap on the same criterion, removing "the LINT-03 finding"
     would remove the real one with it. The strip removes the artefact; the
     recheck decides the truth. Both are the caller's work: the auditor cannot
     be handed the canary and stay blind to it.
  3. Re-anchor every record to {doc}: set `artifact` to {doc}'s repo-relative
     path, locate `exact_quote` in {doc} to set `line_start` and `line_end`,
     and recompute `sha256` from {doc}. A quote that cannot be found in {doc}
     came from the mutation: drop it; its criterion was re-checked in step 2.
     Apply the same line shift to the `spec:N` references in audit.md, or add
     a line-offset note at its top. A record that still cites
     {gate_dir}/.canary/ points at a file nobody commits and nobody can
     re-check.
  4. Record the result (canary_found, the class and its criterion, from
     canary.json) in the gate record, then delete {gate_dir}/.canary/. Nothing
     after this step reads it, and a consumer repository has nothing that keeps
     it out of a commit.

An audit reporting zero gaps on a document known to contain a defect is not a
clean audit. It is a broken one, and nothing in its output would tell you so.

Known limitation, stated rather than glossed: the auditor can read
`scripts/tq-canary.js`, including its defect table. This detects a lazy audit
reliably and an adversarial one only incidentally. Rotating the class per run
raises the cost of pre-empting it; it does not make the canary tamper-proof.

EVIDENCE VALIDATION (automated, run before anything is treated as MET):

The auditor returns criterion records, each carrying its evidence. Those records are
a PROPOSAL, not a result. Re-check every one of them mechanically:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/tq-evidence-validate.js" \
  {gate_dir}/evidence/
```

The validator re-reads each cited artifact, confirms its hash still matches, slices
the cited line range and asserts the quoted text is byte-identical to it. It can only
ever DEMOTE a verdict — there is no input that makes it turn an UNMET into a MET. Use
the verdicts it returns, never the verdicts the auditor claimed.

A record comes back UNMET, with a flag naming the reason, when:
  EVIDENCE-INVALID           the quote does not match the lines it cites
  EVIDENCE-MISSING           MET was claimed with no evidence at all
  EVIDENCE-STALE             the artifact changed after the record was written
  EVIDENCE-UNPINNED          the citation carries no sha256
  EVIDENCE-ARTIFACT-MISSING  the cited file does not exist
  EVIDENCE-PATH-ESCAPE       the citation is absolute, or leaves the audited tree
  EVIDENCE-RANGE-INVALID     the cited line range does not exist in the file
  EVIDENCE-QUOTE-EMPTY       the quote is empty or whitespace, evidencing nothing
  EVIDENCE-UNSUPPORTED       an executable criterion has no citation that verified
  EVIDENCE-VERDICT-INVALID   the verdict is not one of MET, UNMET, N_A
  EVIDENCE-UNPARSEABLE       the record file is not valid JSON

One flag is ADVISORY. It is printed, it does not demote, and it does not fail the
run:
  EVIDENCE-EXITCODE-IGNORED  the record supplied an exit_code; it carried no weight

`EVIDENCE-MISSING` is the flag that matters most and is easiest to soften by accident:
an externally checkable claim with no evidence is UNMET. Not PARTIAL, not a warning,
not "verified but undocumented". This project has lost that argument twice — a layer
was recorded PARTIAL with its result asserted in a commit message and no artifact in
any commit, and a whole wave was closed against greps typed at a terminal that left
nothing behind. Both are UNMET here without anyone needing to notice.

Do not re-run the auditor to "resolve" a demotion. A demotion is not a disagreement
to be settled; it means the evidence was not there, and the fix is in the plan.

COMMIT the evidence directory together with audit.md. An audit whose evidence is not committed did not happen.

This is the rule that makes an audit auditable later. A verdict is only as good as
the ability to re-derive it, and a re-check needs the records, the artifacts and the
hashes that bound them together at the time. Without them the audit degrades into
testimony — "it passed when I ran it" — which is exactly the class of claim this
project has already had to refuse twice.

Exit codes from the validator, which the gate branches on:
  0  every record survived re-checking
  1  at least one record was flagged — the gate does NOT open
  2  the evidence directory is missing or empty

Exit 1 covers more than a demoted MET. A record the validator could not read at
all — unparseable JSON, a file that parses but is not a record object, a
verdict outside MET/UNMET/N_A — demotes nothing,
because it never claimed MET in the first place. For one release those exited 0
while printing their own rejection on screen, so the gate opened on a corpus the
validator had refused. Any mark in the output is now exit 1.

Treat 2 as the most serious of the three. A missing directory is not a clean run
with nothing to report; it means the audit produced no evidence at all, and reading
it as a pass would rebuild the exact failure this replaces — a phase recorded green
on the strength of a claim that no artifact anywhere supports.

INFRASTRUCTURE VERIFICATION (automated, run after gap matrices):
Cross-reference every coverage claim against verifiable artifacts.

For each Scenario Matrix "Tested?" entry with a test file reference:
  1. Check if the test file exists: `test -f "$TEST_PATH"`
  2. If file exists, check it contains a relevant test: `grep -c "$SCENARIO_KEYWORD" "$TEST_PATH"`
  3. If file missing or no matching test: flag as INFRA-GAP

For each Scenario Matrix "Monitored?" entry with a monitoring reference:
  1. Search for dashboard configs, alert rules, or monitoring setup files
  2. If monitoring config missing: flag as INFRA-GAP

For each Coverage Matrix "Covered By" entry with a file reference:
  1. Verify the referenced file exists and contains relevant implementation
  2. If file missing or no matching implementation: flag as INFRA-GAP

INFRA-GAP is a distinct severity: the plan CLAIMS coverage but the
infrastructure to deliver that coverage does not exist. This is more
dangerous than a known gap because it creates false confidence.

Report: "Infrastructure Verification: X/Y claims verified (Z% rate)"
List all INFRA-GAPs with the claim, expected file, and actual status.

PLAN LINT RULES (automated, run before presenting results):
These are binary pass/fail checks. Any FAIL is a gap.

Rule text and the applicable rule set live in
`${CLAUDE_PLUGIN_ROOT}/docs/planning-techniques/lint-registry.md` (the plugin's
copy; the audited repository has none). Read it and apply every rule the
registry assigns to Phase 5 in the current audit mode. This file names ids only
— it does not restate what a rule means, so the two cannot drift apart. Report
one PASS/FAIL/N_A per id, using the ids exactly as the registry numbers them;
N_A only where this file or the registry says the rule does not apply, with the
reason in the record.

Apply at Phase 5: the registry's Phase 5 set.
LINT-14 is recorded N_A whenever no baseline exists in the record set this run
compares against (a first audit, or a predecessor that wrote none); it stays in
the denominator. It is the CALLER's verdict, decided by the baseline comparison
below: the auditor records it N_A with justification "caller compares", and the
caller then writes the LINT-14 record — UNMET on any regression, MET otherwise —
citing the baseline entries it compared.
LINT-11 and LINT-12 belong to Phase 7 and do not run here.

(The registry still keys its rule sets by the old phase numbers: "Phase 5" is the
design-gate set applied here; "Phase 7" is the impact-review set applied at the
end of Stage 3 (Build). The registry keys are unchanged so the two files cannot
drift apart.)

GAP SUMMARY:
After all 4 outputs + lint rules, produce:

```markdown
## Gap Summary

Lint: {N}/{applicable} passed, {M} failed, {K} N_A   <- denominator = the registry's Phase 5 set for this mode
Coverage Matrix: {N} items, {M} gaps
Assumption Register: {N} assumptions, {M} unverified high-impact
Scenario Matrix: 8 scenarios, {M} gaps
Cross-Cutting Sweep: {N} concerns, {M} gaps

Total gaps: {lint FAILs + coverage gaps + unverified HIGH-impact assumptions + scenario gaps + cross-cutting gaps + INFRA-GAPs}
Total warnings: {sum}

Gap-checked: YES / NO
```

A plan is gap-checked ONLY when:
- Every rule in the registry's Phase 5 set passes (enumerating a subset here is how
  the count drifted to four different values before PH5-001)
- Coverage matrix has zero GAPs
- No unverified HIGH-impact assumptions
- Scenario matrix has zero GAPs
- Cross-cutting sweep has zero GAPs
- Infrastructure verification has zero INFRA-GAPs

Write {gate_dir}/audit.md with: criterion records (verdict and evidence per
criterion), challenges, verification results, ALL 4 gap verification outputs,
lint results, gap summary.

When {gate_dir} is a plan folder, update manifest.md: add audit.md to the
Artifacts table with date and gate result.

EVIDENCE REINFORCEMENT (after audit, before baseline; only when a {generator}
is bound and {doc} is not yet approved):

With no generator bound, or when {doc} carries Status: Approved, the audited
document is not edited: write the notes below under `## Evidence notes` in
{gate_dir}/audit.md instead. An approved document changes only through a
Change Record (Stage 3 change control), and a document someone else owns
(quick-audit) is theirs to change.

Re-read the Evidence section of {doc} (spec.md writes it in Part A) and reinforce
it with audit findings:

1. AUDIT-DRIVEN ADDITIONS:
   - If the audit identified new dependencies, patterns, or tools not in the
     original Evidence section (e.g., from gap-filling revisions), add entries.
   - If the audit challenged an assumption about a tool/method and the
     challenge was resolved, add a "Validated by audit" note to that entry.

2. STRESS-TEST ANNOTATIONS:
   For entries where the audit found weakness or gaps, add a subsection:
   ```markdown
   **Audit note ({date}):** {What the audit found — e.g., "Devil's advocate
   challenged whether YamlDotNet handles multi-document streams. Verified:
   YamlDotNet 16.x supports multi-doc via `LoadStream()`. No gap."}
   ```
   For entries where audit found a real gap, note the gap AND how it was resolved:
   ```markdown
   **Audit note ({date}):** {Gap found and resolution — e.g., "Audit flagged
   missing error handling for malformed YAML. Added try/catch in design gate
   revision v2. Gap closed."}
   ```

3. UPDATE HEADER:
   Set "Last reinforced: {date} (design gate)" in the Evidence section header.

4. NEW CROSS-PLAN REFERENCES:
   If the audit revision introduced tools/patterns that exist in other plans,
   add "Also referenced in" links.

Reinforcement changes {doc} after the records were pinned. Re-anchor every
record to the reinforced {doc} (same quotes, recomputed lines and sha256) and
run the validator again; a quote that no longer exists is a demotion, not a
reason to re-audit.

When {gate_dir} is a plan folder, update manifest.md: update the spec.md row
with the reinforcement date.

BASELINE SNAPSHOT:
After writing the audit, capture a per-element baseline in status.json when
{gate_dir} is a plan folder, otherwise in {gate_dir}/gate.json:
```json
{
  "baseline": {
    "run_number": 1,
    "date": "{ISO date}",
    "plan_version": "v1",
    "lint_results": { "LINT-01": "pass", "LINT-02": "pass", ... },
    "coverage_items": [{ "name": "...", "status": "covered|gap" }],
    "assumption_counts": { "total": N, "verified": N, "unverified": N, "waived": N },
    "scenario_statuses": [{ "id": 1, "name": "Happy path", "status": "covered|partial|gap" }],
    "concern_statuses": [{ "name": "API contract", "status": "ok|warn|gap" }],
    "infra_gaps": N
  }
}
```

On re-audit (after revision loop or manual re-run), compare current vs baseline:
- REGRESSION: item was covered/passing, now gap/failing -> flag in audit output
- IMPROVEMENT: item was gap/failing, now covered/passing -> report as progress
- NEW: item not in previous baseline -> report for awareness

Report: "Baseline comparison: X regressions, Y improvements, Z new items"
Regressions are flagged as HIGH priority in the audit output.

This comparison is what LINT-14 is evaluated against (see the registry for its text).
Only an element that was covered/passing in the previous baseline and is now
gap/failing counts; pre-existing gaps do not trigger it. Skipped on the first audit,
when no baseline exists.

Update the baseline (status.json, or gate.json) after each comparison (append
to history array for trend tracking).

GATE: Evaluator-Optimizer Loop.

RUBRIC-FREE HOLISTIC PASS (advisory, runs alongside the gate):

RUN one additional judge with no rubric, no criterion list, and no dimension names.

Its entire prompt is: "Ignore any checklist. What would make this plan fail in
production?" Fresh instance, same input manifest as the auditor, none of the
criterion files. If no fresh instance can be spawned, skip this pass and record
it as not run; a judge that has already read the criteria is not rubric-free.

Map its findings against the criterion set afterwards. A finding that maps to an
existing criterion is discarded — the gate already covers it. A finding that maps
to NOTHING is appended to
`${CLAUDE_PLUGIN_ROOT}/docs/planning-techniques/lint-candidates.md` with the plan
name and date, as a candidate rule for owner review, when that file is writable
from this session; otherwise it is recorded under `holistic_pass.candidates` in
the gate record (status.json or gate.json), never in a new file in the audited
repository.

This pass never gates, and that is deliberate. Every other mechanism in the design
gate makes the judge honest ABOUT the criteria; none of them can notice that the
criteria are incomplete. A plan can satisfy every rule and still be bad in a way no
rule names — rubric-design failure as distinct from verifier failure. This is the
only check on that class, and its output is a proposed rule, not a verdict on the
current plan: gating on unmapped findings would just re-create the unfalsifiable
prose judgment the gate rewrite removed.

The gate reads whether the claims survived checking.

<gate_expression>
CANARY_OK   = a defect was planted AND the criterion it violates came back UNMET
              (false when canary_found is false for any reason: missed twice,
              not-applicable, no-isolation)
EVIDENCE_OK = tq-evidence-validate.js exited 0 (nothing was flagged)
VERIFIED    = every applicable criterion is MET or N_A after validation
INFRA_OK    = infra_gaps == 0

PASS = CANARY_OK AND EVIDENCE_OK AND VERIFIED AND INFRA_OK
</gate_expression>

Every term is re-derivable by someone who has the plan folder and did not run the
audit. That is the property being bought here: a gate that authorised passage on a
number the audited model chose for itself let no reader tell a plan that earned it
from one that was written to earn it.

There is no weighted sum, so a strong showing on seven criteria cannot offset a
failure on the eighth. Non-compensability is the thing a point total structurally
cannot give you.

IF PASS:
  -> The gate is open for this document. Stage 2 says "Design is solid. Ready
     for human review." and continues at its HUMAN REVIEW GATE after this block;
     a shortcut returns to its own Present Results step, where a pass is a
     design-gate pass and nothing more.

IF NOT PASS:
  -> If CANARY_OK is false after a re-run: STOP. Do not revise. The audit could not
     see a defect placed for it to find, so its other findings are not a basis for
     rewriting anything.
  -> Otherwise, when a {generator} is bound, auto-trigger revision of {doc}
     through it, using the feedback form below. With no generator bound
     (quick-audit), report NOT PASS with the list of unmet criteria and stop.
  -> Revise ONLY the failing sections (not the entire document).
  -> Re-run the audit on the revised document.
  -> Compare re-audit against baseline: flag any regressions (items that
     were passing in v1 but now fail in v2). Regressions indicate the
     revision broke something that was previously working.
  -> Maximum 2 revision iterations.

<revision_feedback>
Send the generator defects and locations. One line per unmet criterion:

  {criterion_id} UNMET: {what is missing}. Location: {file}:{line}.

Worked example:

  LINT-03 UNMET: Phase 2 database migration has no rollback step.
    Location: docs/plans/2026-07-20-plugin-hardening-v5/spec.md:142.

Never send the rubric, the totals, the bands, or how near the plan came to passing.
The generator cannot see any of that when it writes, and returning it through the
revision channel would hand back exactly what was withheld — after which the cheapest
response is prose shaped like the missing thing rather than the missing thing itself.

A defect the generator can locate is a defect it can fix. A number it can chase is a
number it will chase.
</revision_feedback>

SPAWN A NEW plan-auditor INSTANCE for every audit iteration. Do not re-audit inside
the instance that produced the previous verdict, and do not pass it the previous
audit.md, the previous score, or a summary of either.

An evaluator that already published a number for v1 is, on v2, checking its own
prior judgement. The consistent story available to it is that the revision fixed
what it said was broken, so the second audit tends to ratify the first rather than
re-derive it — and the loop's regression check is exactly the thing that cannot
work if the same evaluator grades both sides of it. The agent refuses prior-iteration
scores on its side too (see <forbidden_inputs> in agents/plan-auditor.md); both
halves are required, because either alone is a single point of failure.

The baseline comparison above is done by the CALLER, which holds both audits. The
judge sees one spec and reports on it, and never learns that a previous attempt
existed.

After revision loop completes, report against the gate, not against a band:
- PASS: "Design revised and now solid. Ready for human review."
- NOT PASS, criteria still unmet after 2 iterations: "Design has remaining unmet
  criteria. Fix manually: [list each id with its defect and location]"
- NOT PASS because evidence was demoted: "Claims in this spec are not supported by
  what they cite: [list each flag]. These are not near-misses; the cited text does
  not say what the spec says it says."
- NOT PASS because the canary was missed twice: "The audit could not be trusted and
  no revision was attempted. Re-run the design gate before reading any of its findings."

A plan does not "usably pass with known gaps". Either every applicable criterion is
satisfied and evidenced, or the specific ones that are not get named. A "proceed
with known gaps" rung was the rung most often used to proceed without reading them,
and there is nothing here for it to mean.

After the loop ends, append the revision history to audit.md. The auditor
rewrites audit.md on every iteration, so append only after the final one:
```markdown
## Revision History
| Version | Unmet criteria | Gaps | Action |
|---------|----------------|------|--------|
| v1      | LINT-03, LINT-07, SCN-4 | 7 | Auto-revised Delivery phases 2 and 4, Verification plan |
| v2      | (none)         | 0    | Accepted |
```

Record the gate result: in status.json and manifest.md when {gate_dir} is a plan
folder, otherwise in {gate_dir}/gate.json. gate.json has exactly this top-level
shape; add fields, never nest these:

```json
{
  "gate_passed": false,
  "unmet_criteria": ["LINT-03"],
  "gap_checked": false,
  "gap_count": 4,
  "canary_found": true,
  "canary_class": "rollback-strip",
  "canary_reason": "found | missed | not-applicable | no-isolation",
  "validator_exit": 0,
  "mode": "LITE",
  "baseline": {},
  "history": []
}
```
</design_gate>

HUMAN REVIEW GATE (conditionally waivable):
After the automated design gate completes, prompt for human review before Build:

"Design gate {PASS/NOT PASS} — {N} MET (passed the pass); {M} UNMET (back to the
 kitchen); {A} N_A (not on this plate); canary {found/missed}.
 Before starting Build, this spec should be reviewed by at least one person.
 [1] Enter reviewer name(s) to proceed
 [2] Waive review (solo mode) — requires documented reason, and only offered
     when the waiver condition below holds
 [3] View audit summary first"

<waiver_condition>
waiver_allowed = (infra_gaps == 0)
                 AND (canary_found == true)
                 AND (evidence_demotions == 0)
</waiver_condition>

The waiver is offered only when the automated gate itself was trustworthy: the
canary proves the auditor was reading, zero demotions prove its claims survived
mechanical re-checking, and zero infra-gaps prove the coverage it accepted exists.
A gate that missed its canary or had verdicts demoted may still have produced a
correct PASS, but nothing in its output can show that, so a human has to look. The
asymmetry is the design: a doubtful automated result can never open the gate, but
it can remove the owner's ability to SKIP review.

**Say plainly what a waiver skips.** Mechanical re-checking establishes that every
citation exists, is unchanged, and says what the record claims. It does not
establish that any quote is RELEVANT to the criterion it is filed under — that is
a judgement about meaning, and no text comparison makes those. A record citing a
closing brace passes every check in the gate.

So the reviewer this waives is the only reader who checks that the evidence
actually supports the verdicts. Waiving is defensible on small, reversible,
solo work, and the plan folder keeps every citation as file, line and quote so a
later reader can still spot-check in seconds. It is not defensible because the
gate was green — green was never a claim about relevance. When presenting option
[2], say what is being skipped rather than only that it is allowed.

If the waiver condition fails, option [2] is not offered at all. Do not present it
greyed out with the reason; a visible near-miss invites one more revision aimed at
the waiver rather than at the plan.

If [1]: Record reviewer name(s) and date in status.json:
  { "review": { "reviewers": [{"name": "...", "date": "..."}], "outcome": "accepted" } }
  Proceed to EXIT below.

If [2]: Record waiver in status.json AND stamp it visibly:
  { "review": { "waived": true, "reason": "...", "waived_by": "...",
                "waiver_condition": { "infra_gaps": 0, "canary_found": true,
                                      "evidence_demotions": 0 } } }
  Also append one line to audit.md and to the handoff document produced in a
  later stage:
  "Review waived (solo mode) by {name} on {date}: {reason}"
  A waiver recorded only in machine state is invisible to the person reading the
  plan later, which is the person it exists to warn. Proceed to EXIT below.

If [3]: Show audit-derived review checklist:
  - Criterion records (each id with MET / UNMET / N_A and its evidence)
  - Top 3 gaps identified
  - Top 5 risks identified
  - Key assumptions and their verification status
  - Cross-cutting concerns flagged as partially addressed
  Then re-prompt [1] or [2].

If [1] with reviewer names: Record review in status.json:
  { "review": {
      "reviewers": [{"name": "...", "date": "...", "decision": "accepted"}],
      "outcome": "accepted",
      "checklist_presented": true,
      "comments": 0
  }}

For team/leadership plans: review is REQUIRED (option [2] not offered unless
the plan was started in solo mode or the user explicitly requests solo mode).

For solo mode: review is recommended but waivable with documented reason.

---

## EXIT: spec.md Status: Approved

Three conditions, all required:
1. Design gate PASS (gate_expression above)
2. Human review recorded, or waiver recorded under the waiver condition
3. spec.md header set to Status: Approved, with the reviewer (or waiver holder)
   named in the Author line

Set the header, commit spec.md together with audit.md and the evidence directory.
Update status.json: design -> complete (set completed timestamp)
Update manifest.md progress table.

-> "Spec approved. Ready to plan the build."
-> Proceed to Stage 3 (Build).
