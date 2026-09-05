---
description: Show status of all active plans or detailed status of a specific plan. Checks for staleness, shows progress, and recommends next action. Pass a plan name for details or no argument for overview.
argument-hint: "[plan-name]"
allowed-tools: Read, Grep, Glob, Bash
---

<workflow>
## If no argument: Show all plans

```bash
# tq-test-marker: plan-status-overview
# Stable selector for tests/layer4 B6. Identifying this block by "first bash block"
# or by content let an illustrative block become the tested subject. Do not remove.
PLANS_DIR="docs/plans"
[ ! -d "$PLANS_DIR" ] && [ -d "plans" ] && PLANS_DIR="plans"
if [ ! -d "$PLANS_DIR" ]; then
  echo "No plans found. Start one with /toque:plan <name>."
  exit 0
fi

for d in "$PLANS_DIR"/*/; do
  [ ! -d "$d" ] && continue
  NAME=$(basename "$d")

  # Read status.json if it exists
  if [ -f "$d/status.json" ]; then
    # Interpreter name differs by host: Windows python.org installs ship
    # `python` only, most Linux distros ship `python3` only. Try both, then fall
    # back to grep so a missing interpreter degrades to a slightly weaker read
    # rather than an empty phase.
    PY=""
    command -v python3 >/dev/null 2>&1 && PY=python3
    [ -z "$PY" ] && command -v python >/dev/null 2>&1 && PY=python
    if [ -n "$PY" ]; then
      PHASE=$("$PY" -c "
import json, sys
with open(sys.argv[1]) as f:
  print(json.load(f).get('current_phase', 'unknown'))
" "$d/status.json" 2>/dev/null)
    fi
    if [ -z "$PHASE" ]; then
      PHASE=$(grep -o '"current_phase"[[:space:]]*:[[:space:]]*"[^"]*"' "$d/status.json" 2>/dev/null \
              | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    fi
    [ -z "$PHASE" ] && PHASE="unknown"
  else
    PHASE="no status"
  fi

  # Count files per subdirectory
  # Artifact names follow the playbook (8.0.0). A schema-1 plan still has
  # brainstorm.md/approach.md; count either so old folders do not read as empty.
  INTENT=$({ [ -f "$d/intent.md" ] || [ -f "$d/brainstorm.md" ]; } && echo "done" || echo "-")
  RESEARCH=$(ls "$d/research/" 2>/dev/null | wc -l)
  SPEC=$({ [ -f "$d/spec.md" ] || [ -f "$d/approach.md" ]; } && echo "done" || echo "-")
  AUDIT=$([ -f "$d/audit.md" ] && echo "done" || echo "-")
  PLAN=$([ -f "$d/plan.md" ] && echo "done" || echo "-")
  TEST=$([ -f "$d/test-plan.md" ] && echo "done" || echo "-")
  REVIEW=$([ -f "$d/review.md" ] && echo "done" || echo "-")

  echo "$NAME | stage: $PHASE | intent: $INTENT | research: $RESEARCH files | spec: $SPEC | audit: $AUDIT | plan: $PLAN | test: $TEST | review: $REVIEW"
done
```

Present as a summary table. For each plan, recommend the next action.

## If plan name provided: Show detailed status

Read docs/plans/{date}-{name}/status.json.

If `schema_version` is 1, map the old phase names to stages before reporting
(brainstorm+research -> plan; pre_plan+plan+audit -> design; build+impact_review
-> build; test -> test; handoff -> deploy) and say the plan predates 8.0.0.

Show:
1. Stage-by-stage status with freshness indicators
2. Any STALE or WARNING stages (check file hashes)
3. Build progress (if in build stage): tickets done/total/blocked
4. Design gate result (PASS / NOT PASS, kitchen translation, unmet criteria count)
   if audit.md exists
5. Playbook metrics from the stage timestamps: intent -> spec, spec -> plan,
   plan -> authorization (phases.deploy.authorized_at), and plan -> release
   only when phases.deploy.released_at exists; plan match from review.md if
   present. A Deploy stage with status `authorized` is shown as
   "Authorized by {name}, {date}; release not yet confirmed", never as
   Complete or Released. A Deploy stage that is `complete` with no
   `released_at` was recorded before release confirmation existed, when
   completion was written at authorization: print
   "Plan -> release: {phases.deploy.completed - phases.build.started}
   (recorded at authorization)" rather than pending.
6. Recommended next action with reasoning

```
Plan: worldpay-canada
Created: 2026-03-07
Current Stage: 3 - Build (in_progress)
Design gate: PASS — passed the pass (0 unmet criteria, canary found)
Intent -> spec: 2d 4h   Spec -> plan: 1d 1h   Plan -> authorization: pending   Plan -> release: pending

| # | Stage | Status | Freshness | Artifact |
|---|-------|--------|-----------|----------|
| 1 | Plan | Complete | Warning | intent.md (Accepted by J. Ortiz), research/findings.md |
| 2 | Design | Complete | Fresh | spec.md (Approved), audit.md (PASS) |
| 3 | Build | In Progress | - | plan.md (Approved); 2/24 tickets done, 1 blocked |
| 4 | Test | Not Started | - | - |
| 5 | Deploy | Not Started | - | - |
| 6 | Maintain | Not Started | - | - |

Warning: Research findings may be stale (related files in CreditCard/ changed).
Consider re-running research if current build work affects payment code.

Next action: Continue building. Current focus: POS-5163 (receipt strings).
Resume with: /toque:plan worldpay-canada
```
</workflow>
