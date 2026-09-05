# Evaluator-Optimizer Loop

## What It Is

The Evaluator-Optimizer Loop is a two-agent iterative refinement pattern from Anthropic's "Building Effective Agents" research. The pattern separates generation from evaluation into two distinct agents with distinct roles:

- **The Optimizer (Generator)**: Produces output — a plan, a document, code, or any structured artifact.
- **The Evaluator**: Scores that output against defined quality criteria and identifies specific deficiencies.

If the evaluation fails, the generator receives the evaluator's specific feedback and revises. The loop continues until the evaluator passes the output or a maximum iteration count is reached.

This is fundamentally different from "generate once, score once." A single-pass system produces output and grades it, but the grade has no effect — it's a report card delivered after graduation. The Evaluator-Optimizer Loop is a closed-loop quality system where the grade drives revision. The output improves because the feedback loop exists, not because either agent is individually better.

The key insight underlying this pattern is that generation and evaluation are cognitively different tasks. An agent generating a plan is focused on coverage, structure, and coherence. An agent evaluating a plan is focused on gaps, inconsistencies, and omissions. A single agent doing both tends toward self-confirmation bias — it evaluates what it intended to write, not what it actually wrote. Separating the roles eliminates this bias.

## Enterprise Origin

**Source:** Anthropic's "Building Effective Agents" cookbook (anthropic-cookbook/patterns/agents), which documents five agent workflow patterns for production AI systems:

1. **Prompt Chaining** — sequential transformation of output through multiple focused prompts
2. **Routing** — classifying input and dispatching to specialized handlers
3. **Multi-LLM Parallelization** — running multiple agents in parallel on the same input and aggregating results
4. **Orchestrator-Subagents** — a coordinating agent that delegates subtasks to specialized agents
5. **Evaluator-Optimizer** — the iterative refinement loop described in this document

The Evaluator-Optimizer is specifically designed for tasks where quality can be measured against a rubric and iterative improvement is possible. It is not suitable for tasks where output is binary (correct/incorrect) or where the evaluation criteria are subjective and unstable.

This pattern also relates to Anthropic's evaluation framework, which uses LLM-based grading with rubrics and reasoning-before-scoring. The eval framework establishes that LLMs can reliably score structured output when given explicit criteria, and that requiring the evaluator to reason before assigning a score produces more accurate and consistent evaluations. These same principles apply when the evaluator is not just grading for a benchmark but driving a revision loop.

## How It Works

### 1. Generator Agent creates the initial plan (plan-scaffolder)

The generator receives the source material (codebase analysis, brainstorm goals, user requirements) and produces a structured plan. This is the first draft — it will contain gaps, because first drafts always do.

### 2. Evaluator Agent judges it per criterion across 8 dimensions + 4 gap matrices (plan-auditor)

The evaluator receives the generated plan and judges it against defined criteria. In Toque's case that means one verdict per criterion — MET, UNMET or N_A — each resting on evidence that is re-read and byte-compared afterwards, plus 4 gap verification matrices (coverage, dependency, risk, cross-cutting). The evaluator produces localized findings, not a total. The eight-dimension rating this section originally described was removed in 11.0.0: it permitted a compensating sum, where seven strong dimensions outvoted one fatal one.

### 3. If the gate fails: Evaluator produces specific, actionable feedback

Since the verifier-first rewrite (docs/specs/phase5-verifier-gate.md), "fails" means
a criterion came back UNMET after mechanical evidence validation, an infra gap
exists, or the seeded canary was missed — never that a numeric total fell short.
The findings are reported, but they authorize nothing.

The evaluator's feedback is not "try again" or "needs improvement." It is targeted: "Section 4 (Phase 2: Database Migration) has no rollback strategy. The migration adds 3 non-nullable columns but the rollback section only mentions dropping 2. The third column (user_preferences.locale) has no rollback path." This specificity is what makes revision productive rather than random.

### 4. Generator Agent receives feedback and revises ONLY the failing sections

The generator does not regenerate the entire plan. It receives the evaluator's findings and revises only the sections that were flagged. This preserves the parts of the plan that passed evaluation while fixing the parts that didn't. Targeted revision is faster, cheaper, and less likely to introduce new gaps than full regeneration.

### 5. Evaluator re-judges the revised plan

The evaluator re-judges the revised plan against the same criteria. This is a full re-evaluation, not just a check of the previously failing sections — revision can sometimes fix one gap while introducing another.

### 6. Loop terminates when the gate passes, OR max iterations reached (recommend cap at 2)

The termination conditions are:
- **Success**: The verifier-first gate passes — the canary was found, every evidence
  record survived re-checking, every applicable criterion is MET or N_A, and infra
  gaps are zero. The plan is accepted and proceeds to user review. The earlier
  design terminated on a score threshold; that was retired because a self-assigned
  total is exactly the quantity an optimizing generator learns to hit without the
  plan improving.
- **Untrustworthy audit**: The canary was missed twice. The loop STOPS without
  revising — findings from an audit that could not see a planted defect are not a
  basis for rewriting anything.
- **Max iterations**: The loop has run the maximum number of revision cycles (recommended: 2). The plan is accepted at its current quality level with the audit findings attached. Diminishing returns are observed after 2 iterations — the gains from a third pass rarely justify the cost.

### 7. Track iteration history: v1 -> audit1 -> v2 -> audit2 -> final

Every iteration is recorded. The history shows what the plan looked like at each version, what the evaluator found, and how the generator responded. This audit trail is valuable for two reasons: it demonstrates that quality assurance occurred, and it reveals patterns in what the generator consistently gets wrong (informing future prompt improvements).

```
v1 (NOT PASS, gaps: 7) -> audit1 -> v2 (NOT PASS, gaps: 1) -> audit2 -> final (PASS, accepted)
```

## Why It Prevents Gaps

- **Eliminates "generate once, hope for the best"**: Every plan gets at least one revision cycle. The default assumption is that the first draft is insufficient. This is not pessimism — it is empirically validated. First-draft plans consistently score lower than revised plans across all quality dimensions.

- **Evaluator feedback is targeted**: The evaluator doesn't say "try again." It says "section 4 needs rollback strategy for Phase 2" or "dependency matrix is missing the Redis cache cluster that auth-service requires." This specificity means the generator knows exactly what to fix, not just that something is wrong.

- **Catches gaps the generator missed on first pass because it has different focus areas**: The generator is optimized for coverage and structure — making sure all goals are addressed and the plan is coherent. The evaluator is optimized for gap detection and consistency — making sure nothing is missing and nothing contradicts. These are complementary viewpoints that catch different classes of errors.

- **Each iteration narrows the gap count**: Empirically, most plans improve 30-50% on the second pass. A plan with 7 gaps after v1 typically has 1-2 gaps after v2. The improvement is not linear — the first revision cycle captures the majority of addressable gaps.

- **Max iteration cap prevents infinite loops while ensuring minimum quality**: Without a cap, a perfectionist evaluator could keep finding minor issues indefinitely. The cap (recommended: 2 iterations) ensures the loop terminates in bounded time while still capturing the high-value first revision cycle.

- **Creates an audit trail of what was weak and how it was fixed**: The iteration history is itself a quality artifact. It shows stakeholders that the plan was not accepted on first draft, that specific gaps were identified and addressed, and what the plan's quality trajectory looked like. This is particularly valuable in regulated environments where evidence of quality process is required.

## Status Before Implementation

Our plan-scaffolder writes once and self-audits. Our plan-auditor scores once. These are completely disconnected tools.

The scaffolder's self-audit is inherently biased — it is grading its own work. When the scaffolder checks "did I include a rollback strategy?", it checks whether it wrote a section called "Rollback Strategy," not whether that section is actually complete and correct. Self-evaluation consistently overestimates quality because the evaluator shares the generator's blind spots.

The auditor produces findings but never triggers a revision. It writes an audit report to `docs/audit/` and that report sits there. The score, the gap findings, the specific recommendations — none of them flow back into the plan. The auditor is a sensor with no actuator.

You have to manually read the audit, fix the plan, and re-audit. This manual loop is where gaps survive. A developer reads the audit, mentally translates "Dimension 5 UNMET — rollback strategy is incomplete" into specific edits, makes those edits, and then may or may not re-run the auditor. In practice, the re-audit step is frequently skipped because it takes time and the developer believes their fixes are sufficient. The gaps that survive are the ones that the developer didn't fully understand from the audit report or the ones introduced by the revision itself.

## Implementation (Completed)

- **Wire plan-auditor output back into plan-scaffolder as a revision loop.** The auditor's findings become the scaffolder's revision instructions. This is a mechanical connection, not an architectural change — the auditor already produces structured findings, and the scaffolder already accepts instructions.

- **In `/toque:quick-plan`**: After the scaffolder completes, run the shared `<design_gate>` block of the Stage 2 file with the scaffolder bound as the generator. The revision loop is part of that block: if any applicable criterion is UNMET after evidence validation, or gap-checked = NO, the scaffolder receives one line per unmet criterion — "{criterion_id} UNMET: {defect}. Location: {file}:{line}." — never the rubric, totals, or bands. It revises only the failing sections and resubmits to a fresh auditor instance. The command restates none of this; the block is the single definition.

- **In `/toque:plan` Phase 5**: If audit finds gaps, auto-suggest revisions to Phase 4 spec before proceeding to Phase 6. This catches gaps before Build begins, when they are cheapest to fix. A gap caught in Phase 5 costs one revision cycle. A gap caught in Phase 7 (after Build) costs a code change, a re-test, and a re-audit.

- **Cap at 2 revision iterations** (diminishing returns observed after that). The first revision captures 70-80% of addressable gaps. The second captures most of the remainder. A third iteration rarely finds new issues and risks introducing revision fatigue where the generator makes unnecessary changes to satisfy an evaluator that has already been mostly satisfied.

- **Track iteration metadata in status.json**: Record plan_version, verdict_counts_per_version, and gaps_closed_per_iteration. This data serves two purposes: it provides the audit trail for the current plan, and it provides aggregate data over time to measure whether plan quality is improving across projects.

```json
{
  "plan_iterations": [
    {
      "version": 1,
      "verdicts": {"MET": 11, "UNMET": 6, "N_A": 1},
      "gap_checked": false,
      "gaps_found": 7,
      "gaps_by_type": {"coverage": 2, "dependency": 3, "risk": 1, "cross_cutting": 1}
    },
    {
      "version": 2,
      "verdicts": {"MET": 17, "UNMET": 0, "N_A": 1},
      "gap_checked": true,
      "gaps_found": 0,
      "gaps_by_type": {"coverage": 0, "dependency": 0, "risk": 0, "cross_cutting": 0}
    }
  ],
  "accepted_version": 2,
  "total_iterations": 2
}
```

- **Add a "Revision History" section to the plan** showing what changed between versions. This section is appended to the plan document and records: the version number, the verdict counts at that version, the specific gaps identified, and the changes made in response. Stakeholders reviewing the final plan can see not just what the plan says, but what it used to say and why it changed.

## References

- Anthropic, "Building Effective Agents" (anthropic.com/research/building-effective-agents)
- Anthropic Cookbook, Evaluator-Optimizer Workflow (github.com/anthropics/anthropic-cookbook/blob/main/patterns/agents/evaluator_optimizer.ipynb)
- Anthropic, "Create Strong Empirical Evaluations" (docs.anthropic.com/en/docs/test-and-evaluate/develop-tests)
