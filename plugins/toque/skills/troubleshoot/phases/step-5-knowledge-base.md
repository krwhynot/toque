# Step 5: Log and Update Knowledge Base

Phase file for /toque:troubleshoot, loaded by SKILL.md on entry.

## Contents

- Create Troubleshooting Log (location rules and the full log template: Timeline, Duration Metrics, Phase sections, Guardrail Evaluation, Prevention)
- Update Knowledge Base (KB entry template)
- Update Plan Manifest
- Detect Patterns
- Detect Guardrail Patterns
- Detect Recurrence (Correlation-Driven)
- Flag Impact Review Gaps
- Write a Postmortem (SEV1/SEV2 only)
- Close the Loop: Propose a New Intent

## Step 5: Log and Update Knowledge Base

### Create Troubleshooting Log

Location:
- Plan-linked: `docs/plans/{date}-{name}/troubleshooting/YYYY-MM-DD-{issue-slug}.md`
- Standalone: `docs/troubleshooting/YYYY-MM-DD-{issue-slug}.md`

```markdown
# Troubleshooting: {Issue Title}

**Date:** {date}
**Severity:** SEV{N}
**Plan:** {plan name or "standalone"}
**Bug Category:** {logic | boundary | error handling | data flow | integration | timing}
**Status:** {investigating | resolved | workaround | escalated}
**Containment:** {mitigation applied, or "N/A" if SEV3/SEV4 or none needed}
**Resolution:** {summary once resolved}

## Timeline
| Timestamp | Event |
|-----------|-------|
| {T_START} | Troubleshooting started (before plan detection) |
| {T_TRIAGED} | Severity classified as SEV{N} |
| {T_CONTAINED} | Containment applied: {mitigation} (or N/A) |
| {T_CATEGORIZED} | Bug categorized as {category} |
| {T_REPRODUCED} | Issue reproduced (or N/A) |
| {T_ISSUE_LOCATED} | Phase 1 complete: issue located in {file}:{function} |
| {T_ESCALATED} | Multi-agent mode entered (or N/A if single-agent) |
| {T_DEAD_END_N} | Dead end: {hypothesis disproved} |
| {T_SYNTHESIS_COMPLETE} | Multi-agent synthesis complete (or N/A if single-agent) |
| {T_HYPOTHESIS} | Phase 3 complete: root cause hypothesis confirmed (N/A if multi-agent — use T_SYNTHESIS_COMPLETE) |
| {T_FIX_VERIFIED} | Fix verified, tests passing, no regressions |
| {T_GUARDRAILS} | Guardrail evaluation complete |
| {T_LOGGED} | Log and KB updated |

## Duration Metrics
Derived from raw timestamps above. Do not estimate — calculate from the timeline.

- **Total time:** T_LOGGED - T_START
- **Time to issue located:** T_ISSUE_LOCATED - T_START
- **Time to root cause:** T_HYPOTHESIS - T_ISSUE_LOCATED (single-agent) or T_SYNTHESIS_COMPLETE - T_ESCALATED (multi-agent)
- **Time to verified fix:** T_FIX_VERIFIED - T_HYPOTHESIS (single-agent) or T_FIX_VERIFIED - T_SYNTHESIS_COMPLETE (multi-agent)
- **Dead end time:** sum of time spent on disproved hypotheses
- **Guardrail eval time:** T_GUARDRAILS - T_FIX_VERIFIED

## Issue Description
{what the user reported}

## Environment
- Branch: {git branch}
- Last commit: {git log --oneline -1}
- Recent changes: {git diff --name-only HEAD~3}

## Phase 1: Root Cause Investigation
{what was found, which files, where data goes wrong}

## Investigation Path
{which path was taken: single-agent or multi-agent}

### If Single-Agent:
## Phase 2: Pattern Analysis
{how working code differs, what assumptions broke}

## Phase 3: Hypothesis
{the theory, Five Whys if used, what was tested}

### If Multi-Agent:
## Specialist Findings
### Code Tracer
{findings, files read, data flow traced}

### Git Historian
{recent changes, commits, bisect results}

### Data Inspector
{database state, config values, feature flags}

### Integration Checker
{API boundaries tested, schema mismatches found}

## Orchestrator Synthesis
{where findings agreed, where they conflicted, how hypothesis was formed}

## Phase 4: Fix
{what was changed, the failing test, verification results}

## Root Cause
{one sentence}

## Guardrail Evaluation
| Guardrail | Classification | Finding |
|-----------|---------------|---------|
| {type} | {type}:{classification} | {specific finding} |

### Recommended Actions
1. {concrete action with file paths}

## Prevention
{1-2 sentence summary of architectural or process-level prevention beyond guardrails}

## Status Updates
{SEV1/SEV2 only: each Incident Update block from the pre-flow, in order. N/A otherwise.}

## Postmortem
{SEV1/SEV2 only: path to the postmortem file. N/A otherwise.}
```

### Update Knowledge Base

Append to `docs/troubleshooting/knowledge-base.md`:

```markdown
### {Issue Title} ({date})
**Severity:** SEV{N}
**Category:** {bug type}
**Service/Module:** {affected file, module, or service — e.g., src/payment/charge.ts}
**Error Signature:** {exact error message, exception type, or error code}
**Code Path:** {function call chain — e.g., checkout → payment → charge → processResponse}
**Containment:** {mitigation applied, or "N/A"}
**Symptom:** {what the user saw}
**Root Cause:** {what was actually wrong}
**Contributing Factors:** {conditions that made the incident possible — e.g., missing null check, no timeout config}
**Investigation:** {single-agent or multi-agent (which specialists)}
**Fix:** {what resolved it}
**Prevention:** {architectural or process-level prevention beyond guardrails}
**Guardrails missed:** {type:classification, type:classification}
**Guardrails added:** {what was added after this fix, or "none yet"}
**Five Whys depth:** {if used, how many levels deep}
**Recurrence count:** {how many times this pattern has occurred — start at 1}
**Related incidents:** {titles/dates of correlated past incidents, or "none"}
**Plan:** {plan name if linked}
**Log:** {path to full troubleshooting log}
```

Create the knowledge base file if it doesn't exist.

### Update Plan Manifest

If linked to a plan, add to manifest.md Project Documents table.

### Detect Patterns

If the knowledge base has 2+ entries with the same bug category:
"Pattern detected: this is the {N}th {category} bug in this project.
Consider adding a {check/test/gate} to catch these earlier."

### Detect Guardrail Patterns

If the knowledge base has 2+ entries with the same `{type}:{classification}` token:
"Guardrail pattern detected: this is the {N}th bug missed by
{guardrail type} ({classification}). This suggests a SYSTEMIC gap in
{guardrail type} coverage, not individual omissions. Consider a targeted
review of {guardrail type} configuration across the project."

Key on the combined token (e.g., `unit-tests:not-present`), not classification
alone. "3 bugs missed by unit-tests:not-present" is actionable.
"3 bugs with not-present guardrails" across different guardrail types is not.

### Detect Recurrence (Correlation-Driven)

When a new KB entry has a HIGH correlation (>= 50) with a past entry AND Phase 1
confirmed the same root cause:

1. Increment the `Recurrence count` on both the new and matched entries.
2. Add bidirectional links in `Related incidents` on both entries.

A HIGH match whose Phase 1 found a different cause gets the `Related incidents`
link only; leave `Recurrence count` unchanged. Correlation says the symptoms
rhyme; the count records that the same cause came back.
3. If recurrence count reaches 3+:

"RECURRENCE ALERT: This is the {N}th occurrence of this pattern:
- {date}: {title} — fixed with {fix}
- {date}: {title} — fixed with {fix}
- NOW: same pattern recurring

Previous point fixes were INSUFFICIENT. This needs systemic remediation:
- A guardrail that prevents this CLASS of bug (test, lint rule, CI gate)
- Addressing the underlying architectural condition
- Escalating to tech debt remediation if root cause is known but unfixed"

Recurrence detection keys on the correlation dimensions, not just bug category.
Two "data flow" bugs in different services are not recurrence. Two bugs with the
same service/module AND same error signature ARE recurrence.

### Flag Impact Review Gaps

If the issue reveals something the Impact Review missed:
"This wasn't caught by the Impact Review. Consider adding
'{check}' to future reviews for changes in this area."

### Write a Postmortem (SEV1/SEV2 only)

SEV3/SEV4: skip. For SEV1/SEV2, write a blameless postmortem beside the log
at `{log directory}/YYYY-MM-DD-{issue-slug}-postmortem.md`. Blameless means
the subject of every sentence is a system, a process, or a gap, never a
person. Assemble Timeline from the log's Timeline table and the Status
Updates; assemble Root Cause and 5 Whys from Phase 3; assemble Contributing
Factors from the KB entry.

```markdown
# Postmortem: {Incident Title}

**Date:** {date} · **Duration:** {T_FIX_VERIFIED - T_START, or user-facing impact window if longer}
**Severity:** SEV{N} · **Status:** Draft | Reviewed
**Plan:** {plan name or "standalone"} · **Log:** {path}

## Summary
{2-3 sentences in plain language: what broke, who felt it, how it was fixed.}

## Impact
- Users affected: {who and roughly how many}
- Duration of impact: {from first symptom to restored service}
- Business impact: {quantified if possible: failed orders, lost hours, SLA breach}

## Timeline
| Time | Event |
|------|-------|
| {HH:MM} | {first symptom, detection, containment, root cause found, fix verified} |

## Root Cause
{From Phase 3. One paragraph. What was actually wrong, not what the symptom was.}

## 5 Whys
1. Why did {symptom}? Because {cause 1}.
2. Why {cause 1}? Because {cause 2}.
3. Why {cause 2}? Because {cause 3}.
4. Why {cause 3}? Because {cause 4}.
5. Why {cause 4}? {Root cause: the systemic condition.}

## Contributing Factors
{Conditions that made the incident possible or slower to resolve: missing
guardrails, gaps in monitoring, unclear ownership, stale runbook.}

## What Went Well
- {detection, containment, or communication that worked, and why}

## What Went Poorly
- {what was slow, missing, or misleading, stated as a gap in a system or process}

## Action Items
| Action | Owner | Priority | Due | Tracked in |
|--------|-------|----------|-----|------------|
| {guardrail, fix, or process change} | {person or role} | P0 / P1 / P2 | {date} | {intent path, ticket, or "none yet"} |

## Lessons Learned
{What this incident teaches that applies beyond this one bug.}
```

Every P0 action item either becomes part of the proposed intent below or is
tracked somewhere named in the table. An action item with no owner and no
tracker is a wish.

### Close the Loop: Propose a New Intent (Stage 6 of /toque:plan)

The playbook's Maintain stage feeds incidents back into planning as intent, never
as a silent patch. When BOTH hold: (a) the incident is linked to a plan
(`--plan {name}` or detected via plan_detection) and (b) severity is SEV1 or SEV2,
OR the recurrence count for this pattern reached 3+:

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/plan/templates/intent.md`.
2. Write `docs/plans/{today}-{issue-slug}/intent.md` pre-filled from this log:
   Problem = root cause and impact; Proposed outcome = the fix or the guardrail
   that prevents the class; Affected users and systems = the incident scope;
   Constraints = what must not change; Open questions = every hypothesis that
   was not verified; header `Status: Draft`, `Source: incident {log path}`.
3. Append to the originating plan's status.json `phases.maintain`:
   `incidents_linked`, `intents_proposed` (path), `repeat_incidents`.
4. Tell the user: "Proposed a new intent at {path}. It re-enters Stage 1 of
   /toque:plan for acceptance; nothing is accepted automatically."

