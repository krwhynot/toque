# Assumption Verification Gate

## What It Is

An Assumption Verification Gate is a hard enforcement mechanism that prevents a plan from entering the execution/build phase until all high-impact assumptions have been verified or explicitly waived with documented risk acceptance. It transforms assumptions from passive documentation ("we assume X") into active verification checkpoints ("we VERIFIED X on [date] by [method]"). The gate treats unverified high-impact assumptions as blockers, not warnings. The core principle: you cannot build on unverified foundations.

The distinction between "documented" and "verified" is critical. A plan that lists its assumptions is better than one that does not. But a plan that lists assumptions and marks them as verified, with evidence, is categorically different. The first acknowledges risk. The second eliminates it. The Assumption Verification Gate enforces the second standard for any assumption rated HIGH impact.

## Enterprise Origin

Source: BAML's iterate_plan command (Boundary ML), which enforces a strict "No Open Questions" rule: "If the requested change raises questions, ASK. Research or get clarification immediately. Do NOT update the plan with unresolved questions. Every change must be complete and actionable." This principle treats unresolved questions as plan defects, not acceptable ambiguity.

Also from NASA's fault tree analysis methodology where every assumption in a critical system must be verified before flight readiness review. NASA's Systems Engineering Handbook (NASA/SP-2016-6105 Rev2) requires that assumptions be identified, documented, and verified as part of the systems engineering process. Assumptions that cannot be verified must be explicitly accepted with documented rationale by the responsible authority.

Also from CMMI (Capability Maturity Model Integration) Level 3+ which requires assumptions to be tracked, verified, and signed off before proceeding through development gates. The CMMI Verification Process Area specifically addresses the need to ensure that selected work products meet their specified requirements, including the assumptions upon which those requirements are based.

An assumption has four states:

| State | Meaning | Can Proceed to Build? |
|-------|---------|----------------------|
| **Verified** | Confirmed true via test, data check, or stakeholder confirmation | Yes |
| **Falsified** | Confirmed false; plan must adapt before proceeding | No (plan must change) |
| **Unverified (LOW/MEDIUM impact)** | Not yet confirmed, but failure would not block or invalidate the plan | Yes (MEDIUM flagged as warning, LOW informational only) |
| **Unverified (HIGH impact)** | Not yet confirmed, and failure would block or invalidate the plan | No (hard gate) |
| **Waived** | HIGH-impact, unverified, but risk explicitly accepted with documented rationale | Yes (with documented risk acceptance) |

## How It Works

1. **During planning (Phase 4-5), every assumption is logged in the Assumption Register with:**
   - The assumption statement (clear, falsifiable, specific)
   - Impact-if-false rating (HIGH/MEDIUM/LOW)
   - Verification method (how to check if it is true)
   - Verification deadline (by when)
   - Owner (who verifies)
   - Status (unverified/verified/waived/falsified)

2. **Before Build phase entry, the gate checks:**
   - All HIGH-impact assumptions must be status=verified or status=waived
   - Waived assumptions require: documented risk, approver name, acceptance date, and contingency plan
   - MEDIUM-impact assumptions flagged as warnings but do not block
   - LOW-impact assumptions are informational only

   ```
   GATE CHECK:
     For each assumption where impact = HIGH AND status = unverified:
       -> BLOCK entry to Phase 6
       -> Present: "Cannot start Build. These HIGH-impact assumptions are unverified:"
       -> List each with its "How to Verify" column
       -> Offer: [1] Verify now  [2] Accept risk (requires documented reason)  [3] Back to research

     For each assumption where impact = HIGH AND status = verified:
       -> PASS

     For each assumption where impact = MEDIUM AND status = unverified:
       -> WARN but allow proceeding

     For each assumption where impact = LOW AND status = unverified:
       -> INFO only, no action required
   ```

3. **Automated verification where possible:**
   - "API endpoint exists" -> test the endpoint with a health check or OPTIONS request
   - "File exists at path" -> check the filesystem
   - "Database supports feature X" -> query the schema or information_schema
   - "SDK version supports method Y" -> check the dependency version and changelog
   - "Config value exists" -> search config files for the key

   | Assumption Type | Automated Verification Method |
   |-----------------|-------------------------------|
   | File/path exists | `test -f [path]` or filesystem check |
   | API endpoint available | `curl -s -o /dev/null -w "%{http_code}" [endpoint]` |
   | Database query performance | `EXPLAIN ANALYZE [query]` |
   | SDK feature support | Read SDK documentation, changelog, or type definitions |
   | Config value exists | Search config files for the key |
   | Service version requirement | Query version endpoint or package metadata |

4. **Manual verification tracked:**
   - "Client approves design" -> recorded with date and approver
   - "Legal clears data handling" -> recorded with reference number
   - "Team has capacity for 3 sprints of work" -> confirmed with team lead, recorded with date

   Assumptions that cannot be machine-verified require human confirmation with a recorded evidence trail:

   ```
   Assumption: "Team has capacity for 3 sprints of work"
   Cannot auto-verify. Requires confirmation from: [Team Lead]
   Status: BLOCKED until human confirms
   Verified: 2026-03-15 by J. Smith, confirmed sprint capacity in planning meeting
   ```

### Risk Acceptance Record (Waiver)

If a HIGH-impact assumption cannot be verified before the gate and the team chooses to accept the risk, the waiver must be formally documented:

```markdown
## Risk Acceptance: [Assumption ID]
- **Assumption:** [statement]
- **Impact if false:** [specific consequence]
- **Accepted by:** [name and role]
- **Date:** [date]
- **Reason for acceptance:** [why verification is not possible or practical before Build]
- **Contingency if assumption fails:** [what the team will do if the assumption turns out to be false]
- **Review date:** [when the assumption will be re-evaluated]
```

A waiver is not a bypass. It is explicit, documented risk acceptance by a named individual. The difference between "we didn't check" and "we couldn't check, here's why, and here's our plan if it's wrong" is the difference between negligence and risk management.

## Why It Prevents Gaps

- **Eliminates the #1 cause of plan failure:** building on assumptions that turn out to be false. The most expensive defects are not bugs in code but errors in the premises the code was built on.
- **Forces early discovery of blockers** (better to discover in planning than during build). An assumption that fails verification in Phase 5 costs hours to address. The same assumption failing during Build costs days or weeks.
- **Creates clear accountability:** every assumption has an owner. When no one owns an assumption, no one verifies it. When someone's name is on it, it gets checked.
- **Prevents "assumption drift"** where assumptions made in week 1 are forgotten by week 6. The register is a living document that persists across the project lifecycle.
- **Distinguishes between "we don't know" (blocker) and "we accept the risk" (waiver)** -- both are valid but must be explicit. The gate forces this distinction rather than allowing ambiguity.
- **Automated verification catches provable assumptions without human overhead.** Many assumptions (file exists, API responds, schema has column) can be verified in seconds by a machine. There is no reason to leave these unverified.
- **The gate is binary: you either verified it or you didn't. No gray area.** This eliminates the common failure mode of "we're pretty sure it's fine" or "someone mentioned it works" without actual verification.

## Status Before Implementation

Our Assumption Register (Audit Output B) lists assumptions with impact-if-false and verification methods. LINT-08 checks "No unverified or falsified HIGH-impact assumption exists." But LINT-08 is advisory only -- it produces a PASS/FAIL but does not actually BLOCK Phase 6 Build entry. A plan can have 5 unverified HIGH-impact assumptions and still proceed to Build. The gap-checked boolean requires LINT-08 to pass, but gap-checked itself is informational, not a hard gate.

This means a plan can enter Build with assumptions like:
- "triPOS SDK supports Canada" (unverified, blocks entire plan if false)
- "Supabase rate limit handles OTP volume" (unverified, throttles users at scale)
- "User lookup fits in first page" (unverified, breaks onboarding flow)

Each of these, if false, would invalidate significant portions of the plan. Yet under the current system, the plan proceeds as if they were true.

## Implementation (Completed)

- **Make LINT-08 a HARD GATE before Phase 6 Build entry** (not advisory). The plan cannot proceed to Build if LINT-08 fails. This is the single most important change.

- **Add automated verification step:** for each assumption with a verification method, attempt to verify programmatically (file exists? API responds? schema has column?). This should run automatically as part of Phase 5 Audit, immediately after the Assumption Register is generated.

- **Add explicit waiver mechanism:** if a HIGH-impact assumption cannot be verified, require documented risk acceptance with approver name, date, reason, and contingency plan. The waiver must be a deliberate act, not a default.

- **Add assumption status tracking to status.json:**
  ```json
  {
    "assumptions": [
      {
        "id": "A-001",
        "statement": "triPOS SDK supports Canadian payment processing",
        "impact": "HIGH",
        "status": "verified",
        "verified_date": "2026-03-15",
        "verified_by": "automated",
        "method_used": "SDK documentation check, test transaction in sandbox"
      },
      {
        "id": "A-002",
        "statement": "Team has capacity for 3 sprints",
        "impact": "HIGH",
        "status": "waived",
        "waived_by": "J. Smith",
        "waived_date": "2026-03-16",
        "waiver_reason": "Team lead on PTO until sprint start, verbal confirmation received",
        "contingency": "Reduce scope to 2 sprints if capacity insufficient"
      }
    ]
  }
  ```

- **In Phase 5 Audit, after generating the Assumption Register, immediately attempt automated verification of all verifiable assumptions.** The audit output should report verification results alongside the assumptions, not as a separate step.

- **Track assumption verification rate as a plan health metric:** "12/15 assumptions verified, 2 waived, 1 blocking." This gives stakeholders an instant read on plan readiness without reviewing every individual assumption.

## References

- BAML iterate_plan command (github.com/boundaryml/baml/blob/canary/baml_language/.claude/commands/cl/iterate_plan.md)
- BAML implement_plan verification approach (github.com/boundaryml/baml/blob/canary/baml_language/.claude/commands/cl/implement_plan.md)
- NASA Systems Engineering Handbook (NASA/SP-2016-6105 Rev2)
- CMMI Institute, "CMMI for Development" Level 3 Verification Process Area
