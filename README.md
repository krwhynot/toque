# Toque

[![suite](https://github.com/krwhynot/toque/actions/workflows/suite.yml/badge.svg)](https://github.com/krwhynot/toque/actions/workflows/suite.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![release](https://img.shields.io/github/v/tag/krwhynot/toque?label=release&color=2ECC71)](CHANGELOG.md)

<p align="center">
  <img src="assets/toque-tall-mascot.png" width="200" alt="Toque, a tall chef's hat with a quietly unimpressed expression formed from fabric folds.">
</p>

**Good software starts before the dinner rush.**

Toque is a **Claude Code planning and delivery plugin**. It takes an idea through release preparation: clarify the request, connect the planning documents, challenge the design, build, test, and prepare the handoff. A human authorizes production. The AI never gets to approve its own release.

Think of an experienced head chef: helpful at every station, unimpressed by “probably fine.”

## The problem: the code works. The request didn't.

“Add scheduled reports.”

The agent builds a scheduler. It chooses a time zone, sends reports to everyone on the account, and retries failed sends. Nobody asked whether permissions must be checked again at delivery time.

The tests pass. The wrong people get the report.

That is an expensive time to discover a missing question.

## What changes with Toque

Toque makes the request, design, implementation plan, and review point back to one another. These connected files form an **artifact chain**: a record of what was requested, what changed, and who approved it.

Before build, a separate auditor challenges the design. The **design gate can refuse it**. A convincing summary cannot cancel an unmet requirement.

<p align="center">
  <img src="assets/toque-tall-design-gate.png" width="320" alt="Toque checks two design cards: a complete card has a green check; an incomplete card has a missing requirement and a red return mark. This is not production authorization.">
</p>

Toque also checks the checker. It plants a known defect in a temporary copy of the design—a **canary**—and checks whether the auditor finds it. **Evidence validation** then checks that citations supporting passing verdicts match the files on disk.

Neither check proves the design is correct. They make unsupported approval harder to hide. [The limits matter.](documentation/the-design-gate.md#what-this-does-not-prove)

## Without Toque / with Toque

| Without Toque | With Toque |
| --- | --- |
| “Add scheduled reports.” Then start coding. | Capture the problem and get a named owner to accept it. |
| Guess the schedule, recipients, permissions, retries, and rollout. | Resolve those decisions in a spec; challenge missing or unsupported answers. |
| “Tests passed. Ship it?” | Keep test results, review the actual diff, and ask a named human for the production decision. |

For that same request, the full workflow produces:

1. `intent.md` — What problem are scheduled reports solving?
2. `spec.md` — Which schedules, recipients, permissions, and failure behavior are required?
3. Design gate, recorded in `audit.md` and `evidence/` — Does the design survive an independent challenge and the mechanical checks?
4. `plan.md` — How will it be built? Approve this before code changes.
5. `impact-review.md`, `test-plan.md`, and results — What changed, and did it work?
6. `review.md` and a human production decision — Does the actual change match the plan, and should it ship?

## Six stages, one connected record

The lifecycle draws on [Anthropic's AI-Native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook). Toque's [adaptation and boundaries](METHODOLOGY.md#relationship-to-the-ai-native-sdlc-playbook) explain what ships here—and what does not.

| Stage | Work | Required handoff |
| --- | --- | --- |
| **Plan** | Capture `intent.md` and research the request. | Named product owner accepts the intent. |
| **Design** | Write `spec.md`; record the audit and evidence. | Scope lock, automated design gate, and recorded review or eligible waiver; approved spec. |
| **Build** | Approve `plan.md`, implement, write `impact-review.md`. | Approval before code; user confirms impact review afterward. |
| **Test** | Write `test-plan.md` and collect results. | Automated tests pass; a human confirms manual checks. |
| **Deploy** | Write `review.md` and prepare the release checklist. | Named human authorizes, performs, and then confirms the production release. |
| **Maintain** | Link incidents and draft follow-up intent when thresholds are met. | Stays open; new work returns to Plan for acceptance. |

[Walk through each stage →](documentation/the-plan-workflow.md)

## Non-negotiable gates

> **Chef's rule: no approved `plan.md`, no implementation.**

- A failed automated design gate stays failed. There is no compensating score or “strong overall.”
- Manual test confirmation is human work. The agent cannot mark it complete on someone's behalf.
- The agent may prepare the release and verify completed steps. It must not deploy, publish, push release tags, merge into production, or run production migrations.
- Production authorization belongs to a named human. A design-review waiver is not a deployment waiver.

These are workflow instructions, **not a security sandbox**. Toque's three hooks provide plan context; they do not block commands. Enforce production access separately with permissions and your deployment controls.

## Should you use it?

Use the full workflow for changes with meaningful scope, dependencies, risk, or a handoff: a feature, migration, integration, or substantial refactor.

Use a lighter command for an early draft, a document, or an existing plan review. A one-line correction may need none of this. The kitchen does not need a prep meeting to replace a napkin.

Do not use Toque as a codebase scanner, a security certification, or an autonomous deployment service. The codebase-audit and AI-readiness commands were removed in 11.0.0.

[Choose the right command →](documentation/when-to-use.md)

## Quick start

Already installed? Start in your project:

```text
/toque:plan intent scheduled-reports
```

Answer the intent questions. This mode stops after Plan, even after acceptance; it does not start designing or coding.

When ready for the full workflow:

```text
/toque:plan scheduled-reports
/toque:plan-status
```

For a smaller draft that still goes through the design gate, try `/toque:quick-plan Add scheduled reports`. It is not a substitute for human review or production approval.

[Complete your first workflow →](documentation/quickstart.md)

## Installation

Requires Claude Code and **Node.js 18+ on PATH** for Toque's hooks and gate tools. Check Node separately, even if Claude Code already runs.

In a terminal:

```bash
claude plugin marketplace add krwhynot/toque
claude plugin install toque@toque-marketplace --scope user
```

Start Claude Code in your project and run `/toque:help`. Reload or restart an already-open session.

[Scopes, updates, and upgrades →](documentation/install.md)

## Documentation map

| Your question | Read |
| --- | --- |
| How do I finish my first workflow? | [Quickstart](documentation/quickstart.md) |
| How do I install or upgrade? | [Install](documentation/install.md) |
| Which command fits this task? | [When to use Toque](documentation/when-to-use.md) |
| What happens at each stage? | [Plan workflow](documentation/the-plan-workflow.md) |
| What files exist, and how do I resume? | [Plan workspace](documentation/plan-workspace.md) |
| How does the design gate work? | [Design gate](documentation/the-design-gate.md) |
| How do I operate every capability? | [Plugin guide](plugins/toque/GUIDE.md) |
| Why these methods? | [Methodology](METHODOLOGY.md) — includes historical material |
| What outside analysis can it read? | [Interop](interop.md) — optional, read-only inputs |

## Technical and repository details

One plugin, `toque`. Six command files, five skills, two agents, seven document templates, three informational hooks, and two Node gate tools. Nine user-facing entrypoints; some are skills rather than command files.

```text
.claude-plugin/marketplace.json   Catalog with a release ref and SHA pin
plugins/toque/                   Shipped plugin
documentation/                  User documentation
tests/                          Eight-layer suite: bash tests/run-all.sh
docs/                           Development plans, specs, and records
METHODOLOGY.md                   Formal reference, not shipped in the plugin
interop.md                      Optional external input contract
```

Plans live under `docs/plans/YYYY-MM-DD-{name}/`. Optional `docs/audit/` inputs can add context; Toque neither requires nor produces those external analyses.

Current: v11.0.1

[Version history](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE)
