---
description: Create a structured technical plan from a vague objective. Analyzes the codebase, identifies risks, generates phased approach with timeline estimates, testing strategy, and rollback plan. The output is a plan built to survive the design gate. Pass an objective or requirement description.
argument-hint: "[objective description] [--plan plan-name]"
allowed-tools: Read, Write, Grep, Glob, Bash, Task
---

<plan_awareness>
The spec is written to docs/specs/{name}.md. Its gate record lives beside it in
the gate folder docs/specs/{name}/: audit.md, evidence/ (committed with the
spec) and .canary/ (scratch, never committed).

If $ARGUMENTS contains --plan {name}:
  1. Write spec to docs/specs/{name}.md; the gate folder is still docs/specs/{name}/
  2. If docs/plans/*-{name}/ exists: add a row for the spec and its audit.md to
     that plan's manifest.md and add both paths to that status.json's
     `documents` object (the object every stage writes linked documents to).
     Do NOT write into the plan folder's own audit.md or evidence/; those
     belong to the plan's Stage 2 run of the gate against its spec.md, and the
     auditor runs in Lite mode against this spec, not the plan's.
  3. If docs/plans/*-{name}/ does NOT exist: do NOT create a plan folder.
     Quick-plan is a spec generator, not a plan workflow. The spec and its gate
     folder are the only output. If the user wants a full plan folder, use
     /toque:plan.
  4. Note in output: "Spec linked to plan: {name}" or "Spec created standalone"

If no --plan flag, use the default docs/specs/ location.
</plan_awareness>

<context>
You orchestrate the creation of a structured technical plan. The user knows
what they want to accomplish but needs a plan that will survive leadership
review and engineer scrutiny.

This command works for any objective:
- "Extract pricing logic from Order.vb"
- "Add authentication to the API"
- "Migrate from VB.NET to C# for the reporting module"
- "Set up CI/CD for the project"
- "Integrate with the new payment processor"
</context>

<workflow>
## Step 1: Clarify the Objective

If $ARGUMENTS is clear enough, proceed.
If vague, ask up to 3 clarifying questions:
1. What is the desired end state?
2. Are there constraints (timeline, team, technology)?
3. What is the biggest risk you're worried about?

## Step 2: Check for Existing Audit Data

Look for audit data in `docs/audit/` that would inform the plan. Toque does not
produce it; a codebase-analysis tool may have left it:
```bash
ls docs/audit/risk-assessment.md docs/audit/feature-inventory.md \
   docs/audit/dependency-map.md docs/audit/integration-scan.md 2>/dev/null
```

If audit data exists, pass it to the scaffolder agent. The audit tells you
what's risky, what's safe, and what depends on what. Plans informed by audit
data are significantly better.

## Step 3: Deploy Plan Scaffolder

Spawn the plan-scaffolder agent with:
- The objective from $ARGUMENTS
- The codebase root path
- Any audit data found in Step 2
- Clarifications from Step 1 (if any)

## Step 4: Design gate (the same gate as /toque:plan Stage 2)

After the scaffolder completes, run the design gate. Do NOT ask the user to run
/toque:quick-audit separately, and do NOT spawn the auditor on your own terms.

This is the same gate as `/toque:plan` Stage 2 (Design), not a lighter one. It
has to be: a command that accepted a plan on a review the model shaped for
itself would be a way around the gate rather than a lighter version of it, and
the way around is the one that gets used. So the gate is defined once, in the
stage file, and this command runs that definition:

Read `${CLAUDE_PLUGIN_ROOT}/skills/plan/stages/stage-2-design.md` and execute
its `<design_gate>` block, verbatim, with these bindings:

  {doc}        docs/specs/{name}.md
  {gate_dir}   docs/specs/{name}/
  {generator}  the plan-scaffolder agent

The block spawns the plan-auditor on a canary-mutated working copy, checks that
the planted defect was found, validates every evidence record mechanically,
applies the lint registry and the gap outputs, and derives PASS or NOT PASS
from its gate expression. Nothing in this command restates any of that; if the
block and this description ever disagree, the block wins.

## Step 5: Revision loop

The revision loop is part of the block: on NOT PASS it sends the
plan-scaffolder one line per unmet criterion (id, what is missing, location),
never the rubric or the totals, and re-runs the auditor as a FRESH instance on
the revised spec. Maximum 2 revision iterations. After 2 iterations, deliver
the plan at its current quality with the unmet criteria named; a plan does not
"usably pass with known gaps". The block writes the revision history into
docs/specs/{name}/audit.md after the loop; do not keep a second copy in the
spec.

## Step 6: Present Results

After the loop completes:
1. Show the plan summary (problem, phases, timeline, key risks)
2. Show the final gate result (`PASS` — passed the pass, or `NOT PASS` — back to
   the kitchen), the MET/UNMET/N_A counts, canary found, missed, not applicable
   or no-isolation, evidence validation exit code, and whether gap-checked
3. If revisions occurred, note: "Plan was revised {N} time(s). {X} criteria moved from UNMET to MET."
4. Show the Revision History table from docs/specs/{name}/audit.md
5. Note evidence basis distribution (should be <40% Tier C)
6. Point at the gate record: docs/specs/{name}/audit.md, evidence/ and
   gate.json. Commit them with the spec; an audit whose evidence is not
   committed did not happen. The .canary/ scratch is already deleted.
7. Note: "This spec passed the design gate; it has not been reviewed by a person
   and nothing here authorizes a build or a release."
</workflow>
