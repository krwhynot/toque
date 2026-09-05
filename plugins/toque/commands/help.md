---
description: Show all Toque commands, agents, and capabilities. Use when you need to see what's available or explain the plugin to someone new.
---

# Toque

Structured planning for engineering work. Stack-agnostic: works on
React/TypeScript, C#/.NET, Python, Rust, and Go projects.

The centrepiece is `/toque:plan` — a six-stage workflow with an adversarial
design gate between deciding what to build and building it. Everything else
here either feeds that workflow or is a standalone shortcut for one part of it.

A toque is the chef's hat; the pass is where a plate gets its final inspection
or gets sent back. The gate results and criterion verdicts are canonical, and
this is how to read them:

| Result | In the kitchen |
| ------ | -------------- |
| `PASS` | Passed the pass. |
| `NOT PASS` | Back to the kitchen. |
| `MET` | Passed the pass. |
| `UNMET` | Back to the kitchen. |
| `N_A` | Not on this plate. |

## Commands

### Planning (the six-stage workflow)

| Command | What It Does |
|---------|-------------|
| `/toque:plan` | Start or resume a guided plan on the AI-Native SDLC playbook. Six stages: Plan (intent.md), Design (spec.md + verifier gate), Build (plan.md), Test, Deploy (review.md), Maintain. `intent {name}` captures intent only. |
| `/toque:plan-status` | Show all active plans or detailed status of one plan with staleness checks. |
| `/toque:plan-export` | Export a plan as a self-contained zip. Includes all docs, redacts secrets, adds CLAUDE.md for vanilla Claude Code bootstrap. |

### Quick Shortcuts (standalone, no guided workflow)

| Command | What It Does |
|---------|-------------|
| `/toque:quick-plan` | Create a spec directly from an objective and run it through the design gate (skips intent/research/review). |
| `/toque:quick-audit` | Run the design gate against any spec or plan file. Reports PASS or NOT PASS with the criteria that failed, plus the canary and evidence results. |
| `/toque:quick-cleanup` | Clean up a folder of messy docs into structured reference files. |
| `/toque:troubleshoot` | AI-guided debugging. Suggests diagnostics, logs every step tried, builds a knowledge base. Auto-links to active plan. |

### /toque:plan vs /toque:quick-plan: Which Do I Use?

| | `/toque:plan` | `/toque:quick-plan` |
|--|-----------|-----------------|
| **What** | Guided six-stage workflow | One-shot plan generation |
| **Stages** | All 6 (Plan through Maintain) | None — a one-shot spec, outside the stage workflow |
| **Asks questions?** | Yes, walks you through interactively | No, takes objective and generates immediately |
| **Creates plan folder?** | Yes: `docs/plans/2026-03-07-{name}/` | No; writes `docs/specs/{name}.md` plus its gate record in `docs/specs/{name}/` (`audit.md`, `evidence/`, `gate.json`) |
| **Research?** | Yes, scans codebase + docs + web | No, uses existing context |
| **Audit?** | Yes, the design gate plus human review | Yes, the same design gate with a revision loop (up to 2 iterations); no human review |
| **Build help?** | Yes, tracks tickets and assists | No, plan is delivered |
| **Resumes?** | Yes, come back anytime | No, one and done |
| **Time** | 30-60 min full workflow | 5-10 min |

**When to use each:**

| Situation | Use |
|-----------|-----|
| New project, vague idea, need to think it through | `/toque:plan` |
| Got docs from someone, need the full treatment | `/toque:plan {name} from {folder}` |
| Already know what to build, just need it written down | `/toque:quick-plan` |
| Someone asks "write up a plan for X" and you need it fast | `/toque:quick-plan` |
| Plan needs leadership approval | `/toque:plan` (includes the gate) |
| Quick internal plan for yourself | `/toque:quick-plan` |

Same pattern applies: `/toque:quick-audit` = audit one file without the workflow.
`/toque:quick-cleanup` = clean up docs without the workflow.

### Documentation

| Command | What It Does |
|---------|-------------|
| `/toque:documentation` | Generate any document: ADR, BRD, PRD, README, release notes, spec. Part of the plan workflow (Stage 2 ADRs, Stage 5 runbook) and usable standalone. |

### Utility

| Command | What It Does |
|---------|-------------|
| `/toque:help` | This command. |

## Agents (2)

Create and review technical plans for any engineering initiative.

| Agent | What It Does |
|-------|-------------|
| plan-auditor | Reviews a plan against the gate's criteria. Emits one verdict per criterion (MET, UNMET, N_A) with the evidence it rests on, and every verdict is mechanically re-checked afterwards. |
| plan-scaffolder | Creates structured plans from vague objectives. Reads the codebase, and any audit data present, to generate evidence-based phased plans. |

## Knowledge Skills (5)

Auto-loaded contextual knowledge that guides behavior during planning.

| Skill | What It Provides |
|-------|-----------------|
| plan | The `/toque:plan` workflow: a router plus one file per stage, loaded on entry so late stages survive compaction |
| documentation | Document generation templates (ADR, BRD, PRD, README, release notes, spec) |
| troubleshoot | Plan-linked debugging: diagnostic suggestions, a log of every step tried, and a knowledge base built from what worked |
| mcp-research | When and how to use external MCP search tools (Ref, Exa, Perplexity): tool selection heuristics, token budget rules, graceful degradation |
| self-audit-knowledge | LLM epistemic transparency, claim verification tiers (A/B/C), failure mode flags, cascade risk classification, evidence basis formatting |

## Documentation Skill (7 templates)

Generate any project document. Auto-loaded when you mention documentation.
Powered by audit data when available. Suggests which document to create if you're unsure.

| Type | Command Example | What It Creates |
|------|----------------|----------------|
| ADR | `/toque:documentation adr credential rotation` | Architecture Decision Record |
| BRD | `/toque:documentation brd Ordering` | Business Requirements Document |
| PRD | `/toque:documentation prd refund processing` | Product Requirements Document |
| README | `/toque:documentation readme BusinessLogic` | Project README |
| Runbook | `/toque:documentation runbook prod-deploy` | Step-by-step operational procedure with rollback and escalation |
| Release Notes | `/toque:documentation release-notes v2.5.0` | Release notes from git history |
| Spec | `/toque:documentation spec pricing engine extraction` | Technical Specification / Engineering Plan |

Don't know which format? Just say "I need to document X" and the skill will recommend the right type based on your context and audit data.

## Typical Workflow

**For planning any new work (the six-stage workflow):**
```
/toque:plan {name}
```
Walks you through: Plan (intent.md) -> Design (spec.md, gate) -> Build (plan.md, code) -> Test -> Deploy (review.md) -> Maintain

All artifacts go to `docs/plans/{date}-{name}/`. Check progress with `/toque:plan-status`.

**For standalone tasks (experienced users):**
- `/toque:quick-plan [objective]` to generate a plan directly
- `/toque:quick-audit [file]` to audit any spec or plan
- `/toque:quick-cleanup [folder]` to clean up messy docs
- `/toque:documentation [type] [topic]` to generate a specific document

## Codebase analysis

Toque does not analyse codebases. The codebase-audit, security-scan, delta and
AI-readiness commands were removed in 11.0.0 and nothing replaces them here.

It does *read* analysis when something else has produced it. If `docs/audit/`
holds a risk assessment, dependency map, feature inventory or integration scan,
the planning commands and the documentation templates use them to ground their
output. If it does not, everything still works — the files make plans
better-informed, and none is required. `interop.md` lists exactly which paths
are read and by which file.

## Output Locations

| What | Where |
|------|-------|
| Plan homebase (intent, research, spec, plan, review) | `docs/plans/YYYY-MM-DD-{name}/` |
| Plan manifest (links to everything) | `docs/plans/YYYY-MM-DD-{name}/manifest.md` |
| Specs | `docs/specs/` |
| ADRs | `docs/adr/` |
| PRDs | `docs/prd/` |
| Plan audits (gate record) | The plan folder's `audit.md` + `evidence/`, or `{dir}/{name}/` beside a standalone file |
| Codebase analysis Toque reads but does not write | `docs/audit/` |
