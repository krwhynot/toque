# Optional inputs

Toque can use analysis another tool has already prepared. Bring useful ingredients; no separate scanner is required.

The files below add risk, dependency, integration, and feature context to planning and document generation. Toque reads them but does not write them. If they are absent, the workflows continue using available project evidence.

Their presence is not proof that they are current or correct. Check provenance and freshness before relying on an external finding. Toque no longer produces codebase-audit or AI-readiness reports.

<p align="center">
  <img src="assets/toque-tall-mascot.png" width="96" alt="Toque, the tall chef-hat reviewer.">
</p>

## The list

Paths are relative to the project being planned, not the installed plugin. The second column identifies readers in this repository.

The table format is a tested contract: one artifact per row, a bare path in column 1, and comma-separated reader paths in column 2. Only functional readers under `commands/`, `agents/`, `skills/`, and `scripts/` count. Documentation mentions are not consumers.

| Artifact | Read by |
| -------- | ------- |
| docs/audit/risk-assessment.md | plugins/toque/agents/plan-auditor.md, plugins/toque/agents/plan-scaffolder.md, plugins/toque/commands/quick-plan.md, plugins/toque/skills/documentation/SKILL.md, plugins/toque/skills/documentation/references/spec-template.md |
| docs/audit/dependency-map.md | plugins/toque/agents/plan-auditor.md, plugins/toque/agents/plan-scaffolder.md, plugins/toque/commands/quick-plan.md, plugins/toque/skills/documentation/references/spec-template.md, plugins/toque/skills/plan/stages/stage-3-build.md |
| docs/audit/integration-scan.md | plugins/toque/agents/plan-auditor.md, plugins/toque/commands/quick-plan.md, plugins/toque/skills/documentation/references/spec-template.md, plugins/toque/skills/plan/stages/stage-3-build.md |
| docs/audit/feature-inventory.md | plugins/toque/commands/quick-plan.md, plugins/toque/skills/documentation/SKILL.md, plugins/toque/skills/documentation/references/spec-template.md |
| docs/audit/readability/readability-report.md | plugins/toque/skills/documentation/references/spec-template.md |
| docs/audit/baseline/feature-inventory.json | plugins/toque/skills/documentation/references/adr-template.md, plugins/toque/skills/documentation/references/brd-template.md, plugins/toque/skills/documentation/references/prd-template.md |
| docs/audit/baseline/dependency-map.json | plugins/toque/skills/documentation/references/adr-template.md, plugins/toque/skills/documentation/references/readme-template.md |
| docs/audit/baseline/risk-assessment.json | plugins/toque/skills/documentation/references/adr-template.md |
| docs/audit/baseline/integration-map.json | plugins/toque/skills/documentation/references/adr-template.md |

## Toque's own paths under docs/audit/

Two special references share the directory but are not external analysis inputs:

- `docs/audit/plan-audit.md` is a forbidden fallback named by quick-audit. Nothing writes it; a standalone quick audit writes its gate record (`audit.md`, `evidence/`, `gate.json`) to a folder beside the audited file, named after it without the extension, and a plan's own spec is audited into its plan folder.
- `docs/audit/impact-review-*.md` is a legacy read-only location. Troubleshooting first checks the current plan's `impact-review.md`, then uses this fallback for older plans. Current Build writes into the plan folder.

## Not inputs

- Plan folders under `docs/plans/{date}-{name}/` are Toque's planning records, not external audit baselines. Humans and other tools can read them. The SubagentStop hook appends its log only when the plan's troubleshooting directory exists.
- Session markers from the retired guard plugin are not part of current operation.
- The former SessionStart audit-report staleness warning was removed in 11.0.0.
- `readability-score.json` is not a Toque input. The Markdown readability report listed above is.

Older Markdown input names in the table are still live reads. Do not discard them merely because a producer also emits JSON.

## Keeping the contract accurate

These optional reads are not a bidirectional Jira, requirements-tool, or deployment integration. See the [playbook adoption boundaries](METHODOLOGY.md#relationship-to-the-ai-native-sdlc-playbook) before assuming Toque supplies an external system of record or automatic handoffs.

`tests/layer1-repo.sh` checks both directions: every documented reader still names its input, and every functional `docs/audit/` reference is documented. It verifies the read contract, not whether an outside producer will create a file.

When adding a read, add the artifact and every reader here in the same change. When removing the final reader, remove the row. Do not alter the table format without updating its tests.

A producer lives outside this repository, so a rename needs compatibility planning. Accept old and new paths during transition rather than silently making existing analysis disappear. There is no local test that can prove every user's repository has migrated.

[Choose a workflow](documentation/when-to-use.md) · [Document templates](plugins/toque/GUIDE.md#the-7-document-templates)
