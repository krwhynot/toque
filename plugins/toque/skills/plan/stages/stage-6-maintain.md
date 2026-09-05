# Stage 6: MAINTAIN

Stage file for /toque:plan. Loaded by SKILL.md on entry; re-read after compaction. Do not read ahead.

Question: What did production teach us, and does any of it need a new plan?
Reads: docs/plans/{date}-{plan-name}/ (the record), troubleshooting/ logs, docs/troubleshooting/knowledge-base.md
Produces: status.json phases.maintain metrics; new intent.md files under docs/plans/ when the trigger rule fires
Gate: None. This stage never completes; it is the steady state.

Purpose: close the loop. Everything learned after release flows back to Stage 1
as a new intent, through the same acceptance gate as the original.

## 1. The record

After release the plan folder is the record of what was intended, specified,
planned, built, tested, and authorized. Nothing in it is rewritten after
Stage 5; new facts go in new files. status.json and manifest.md are the
bookkeeping exception: they keep recording release confirmation, linked
incidents, and proposed intents.

Incidents against this release are handled by `/toque:troubleshoot` with
`--plan {plan-name}`, which writes its log under the plan's troubleshooting/
folder and links it from manifest.md. This stage reads those logs; it does
not investigate.

## 2. Trigger rule

When troubleshoot logs an incident against this plan that is EITHER
- severity SEV1 or SEV2, OR
- a recurrence of a known pattern (knowledge-base Recurrence count >= 3, or a
  RECURRENCE ALERT / Guardrail pattern message for this plan's code paths),

propose a new intent. Write docs/plans/{date}-{new-name}/intent.md from
`${CLAUDE_SKILL_DIR}/templates/intent.md`, pre-filled from the incident:

| intent.md field | Filled from |
|---|---|
| Problem | Root Cause plus impact (what users saw, blast radius) |
| Proposed outcome | The fix or guard recommended by the log (Recommended Actions, Prevention) |
| Affected users and systems | Incident scope: Service/Module, Code Path, Affected users |
| Constraints | What must not change (the released behavior that is working, data compatibility, existing guardrails) |
| Out of scope | Containment already applied; anything the log rules out |
| Open questions | Every unverified hypothesis and every "unverified" claim in the log |
| Status | Draft |
| Source | incident {path to troubleshooting log} |
| Date | today |

Then stop. The new intent re-enters Stage 1 for a human to accept or reject.
It is NEVER auto-accepted, and this stage never edits code. Say:

```
Stage 6 — Incident {log path} met the trigger rule ({SEV1|SEV2|recurrence}).
Proposed intent: docs/plans/{date}-{new-name}/intent.md (Status: Draft)
Review it with: /toque:plan {new-name}
```

Incidents below the trigger (SEV3/SEV4, first occurrence) are linked and
counted only.

## 3. Metrics

Record in status.json phases.maintain, updated on every linked incident:

```json
"maintain": {
  "status": "steady_state",
  "started": "{ISO, = phases.deploy.released_at, set when the human confirms the release}",
  "incidents_linked": 0,
  "intents_proposed": [],
  "repeat_incidents": 0
}
```

intents_proposed entries are {intent path, source log, date}. A repeat is an
incident sharing a knowledge-base category or guardrail token with an earlier
incident on this plan.

## 4. Steady state

There is no "completed" timestamp for this stage. `/toque:plan-status`
reports it as Maintain with the metrics above; "done" is observed, not declared.
