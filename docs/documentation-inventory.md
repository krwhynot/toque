# Documentation rewrite inventory

Inspection baseline: 2026-09-04, plugin 11.0.1. This inventory was prepared before rewriting. Existing uncommitted changes are preserved; no commit or push is part of this task.

## Page responsibilities

| File | Intended reader | Primary question / purpose | Personality | Facts to preserve |
| --- | --- | --- | --- | --- |
| `README.md` | New visitor | What is Toque, and should I use it? | Full, selective | Claude Code plugin; six stages; artifact chain; refusing design gate; canary and evidence limits; human production authorization; Node 18+; version and install identity |
| `documentation/quickstart.md` | First-time operator | How do I complete my first workflow? | Light | Intent-only stop; approvals; artifacts; build/test actions; human release; Maintain stays open |
| `documentation/install.md` | Installer / upgrader | How do I install or upgrade? | Light opening only | Explicit scopes; marketplace and plugin update; reload; Node prerequisite; pre-10 rename; schema migration is separate |
| `documentation/when-to-use.md` | Developer choosing a tool | Which command fits? | Light | Nine entrypoints; quick-plan audit loop is not the full Stage 2 gate; no automatic production authority |
| `documentation/the-plan-workflow.md` | Workflow operator | What happens at each stage? | Light | Stage contracts; scope lock; assumptions; change records; automated/manual tests; conditional review waiver; human deployment; recurrence intake |
| `documentation/plan-workspace.md` | Returning operator | What files exist, and how do I resume? | Light | Schema 2; state versus navigation; fingerprints; stale cascade; schema-1 preservation; committed records versus canary scratch |
| `documentation/the-design-gate.md` | Reviewer | What can this gate prove or refuse? | Light | Exact formula and verdicts; retry limits; MET evidence checks; no semantic correctness proof; instructional isolation; review waiver risk |
| `plugins/toque/GUIDE.md` | Regular operator | How do I operate all capabilities? | Light | Version; 6 commands / 5 skills / 2 agents / 7 templates / 3 hooks / 2 gate tools; flags; output locations; updates; no blocking hooks |
| `METHODOLOGY.md` | Methodology reader | Why is the system designed this way? | Intro only | Formal sections, numbering, guarded rules, historical scope and citations remain intact |
| `interop.md` | Integrator / maintainer | What external analysis can Toque consume? | Light opening only | Nine optional input rows and all consumers; two special paths; read-only inputs; exact parser format |
| `plugins/toque/README.md`, command and stage instructions | Installed-plugin readers / agent | Existing operational surfaces | No rewrite in this task | Preserve prior uncommitted changes; use as evidence, not a second rewrite scope |
| `CHANGELOG.md`, `docs/plans/`, generated artifacts, fixtures, licenses, evidence/audit records | Historical / machine consumers | Stable records | None | Do not rewrite |

## Evidence and discrepancy decisions

Authority order: executable scripts and their tests for mechanical checks; command/skill instructions for agent workflow; manifests for release identity; current Claude Code documentation for installation behavior. Instruction-defined actions are not claimed as runtime security enforcement.

- `quick-plan.md` invokes the auditor and up to two revisions. Old user docs called it ungated or an eight-dimension review. Its instructions also claim parity with Stage 2, but do not explicitly orchestrate the canary and evidence tools. Document an audited draft, not a validated Stage 2 pass. Command changes are outside this rewrite. Superseded 2026-09-05 by decision D1: quick-plan and quick-audit now execute the Stage 2 `<design_gate>` block by reference, so a shortcut pass is a design-gate pass for that document, lacking only the human review and workflow around it.
- Maintain is steady state, not a sixth completion/approval gate. Incident recurrence can draft a new intent; it does not approve or implement it.
- The validator checks citations supporting `MET`, not the meaning of every claim. It does not execute quoted commands. Existing `UNMET` records can survive an exit-0 validation run, so `VERIFIED` remains a separate gate term.
- Stage 2's expression gloss says exit 0 means nothing was flagged. The executable allows advisory `EVIDENCE-EXITCODE-IGNORED`; describe no failing validation flags instead. Preserve the canonical PASS formula.
- A canary checks detection of a particular planted defect, not general auditor accuracy. Isolation is instructional, not a filesystem boundary. Blanket rejection is not sufficient when applicable criteria are supplied to detection.
- The install page incorrectly said omitting scope selects project scope. Use explicit `--scope user`, `--scope project`, or `--scope local`. Refresh catalog, update installed plugin, then reload/restart.
- Claude Code running does not prove Node is installed: native Claude Code installation and Toque's Node 18+ prerequisite are separate.
- Interop incorrectly claimed nobody outside Toque reads plan folders. Remove that claim; humans and exported plans are legitimate consumers.
- The formal methodology retains historical examples and claims about removed scanner/guard components, including in mixed sections. Its introductory scope warning points operators to current instructions; the body is deliberately not modernized in this task.
- Link checking found retired guard-script links pointed at nonexistent `main` paths. They now point to verified pre-rename files at `v8.0.0`. Obsolete Google SRE, Supabase, and GitLab URLs were repaired without rewriting their surrounding arguments. GitLab now labels the cited PRR reference deprecated; it remains historical methodological evidence, not a current operating requirement.
- The suite currently runs eight default layers although its single-layer argument parser accepts only 1–7. This is a pre-existing test-runner issue, not a documentation behavior to invent or silently fix.

## Verification — initial rewrite

- Reviewed the complete requested-document diff and checked commands, stage contracts, artifacts, verdicts, versions, and terminology against their sources. The documentation skill guided the example-first structure and links to authoritative detail rather than repeated explanations.
- `bash tests/run-all.sh`: 8/8 layers passed, zero failed, exit 0; plan consistency sweep passed. These are repository tests, not a live Claude Code delivery or deployment exercise.
- `bash tests/run-all.sh 1`: repeat passed, 118 checks, zero failed, exit 0. Includes PH5-001 (20 defined rules, 26 verbatim restatements), all 12 evidence flags, and both interop checks (9 inputs / 11 total paths).
- Temporary Node/stdlib link checker: 91 local or repository-mapped links and 2 incoming links resolved, including Markdown anchors. All 41 distinct external URLs were requested: 40 returned HTTP 200; the OpenAI Harness Engineering URL returned 403 to automated fetch but was confirmed accessible through browsing. Repository `main` links were checked against the edited checkout; publication awaits commit/push.
- `claude plugin install --help` and `claude plugin update --help`: confirmed explicit scope flags and user default. Current official Claude Code documentation confirmed reload, native installation, and marketplace update behavior. No installation or upgrade was performed.
- `git diff --check`: clean. SHA-256 comparison of 222 tracked files against the pre-rewrite snapshot found changes only in the ten requested documents. The inventory is the only newly created repository file from this task. Historical records, fixtures, licenses, manifests, executable scripts, and pre-existing unrelated edits were not rewritten.
- Methodology preservation check: after removing the added introduction and reversing the URL repairs, its SHA-256 matches the starting file exactly. Formal rule text and numbering are unchanged.
- First-reader review: the README identifies the plugin, shows the scheduled-report failure, names all six stages, explains what can refuse a design, assigns production authorization to a named human, and gives `/toque:plan intent scheduled-reports` as the first workflow command. This is an editorial check, not a timed usability study.
- No commits or pushes. Remaining source discrepancies are listed above; no command behavior was changed to make the prose true.

## Playbook follow-up — September 4, 2026

Added the requested Anthropic AI-Native SDLC playbook reference to the methodology's lifecycle section and source index. Short references in both READMEs, GUIDE, workflow, quickstart, workspace, design-gate, and interop pages point to that central explanation rather than reproducing the article.

The new stage mapping describes Toque's own implementation. It explicitly separates Toque's canary/evidence gate, informational hooks, human-performed release, and incident-record intake from the article's wider automation model. No runtime behavior or canonical status changed. Nearby claims that every stage completes at a human gate were corrected for Maintain.

This follow-up deliberately extends the methodology body at the user's request; the introduction-only preservation check above describes the earlier rewrite, not this later addition. Installation and command-selection pages needed no playbook material. Historical plans and release records remain untouched.

Verified 14 playbook references across nine user-facing documents, including the new methodology anchor; the source returned HTTP 200. `git diff --check` is clean. The prior full-suite result above belongs to the initial rewrite; this follow-up's Layer 1 documentation guards passed all 118 checks with no failures.
