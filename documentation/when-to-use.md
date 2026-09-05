# Which command fits?

Use enough preparation for the risk. Not every change needs the whole brigade.

<p align="center">
  <img src="../assets/toque-tall-mascot.png" width="120" alt="Toque, the tall chef-hat reviewer.">
</p>

## Choose by the job

| You need to… | Start with | What to expect |
| --- | --- | --- |
| Deliver a feature, migration, integration, or substantial refactor | `/toque:plan {name}` | Six-stage workflow with recorded approvals |
| Clarify an idea without starting design or build | `/toque:plan intent {name}` | Plan stage only; stops after intent work |
| Get a smaller technical draft | `/toque:quick-plan {objective}` | Spec under `docs/specs/`, the design gate, up to two revisions |
| Challenge an existing plan | `/toque:quick-audit {path}` | The design gate against one file: verdicts, canary, evidence check; not production approval |
| Find where work stopped | `/toque:plan-status` | Plan status and next-step context |
| Turn messy source documents into usable references | `/toque:quick-cleanup {folder} {topic}` | Cleaned intake files in a plan homebase |
| Hand a plan to another developer | `/toque:plan-export {name}` | Portable zip for a compatible codebase and vanilla Claude Code |
| Investigate a bug or incident | `/toque:troubleshoot {problem}` | Evidence-led troubleshooting and a persistent record |
| Write an ADR, BRD, PRD, README, runbook, release notes, or spec | `/toque:documentation {type} {topic}` | A structured document grounded in available project evidence |
| See the complete entrypoint list | `/toque:help` | Help in the conversation |

There are nine entrypoints: the intent-only form is an option of `/toque:plan`, not another command.

## Use the full workflow when a wrong assumption is expensive

Permissions, data migrations, external integrations, cross-team dependencies, rollback, or a handoff all benefit from an explicit record.

The full workflow supports implementation and testing after the required approvals. It prepares production deployment but leaves authorization and execution to a named human.

Start with the [quickstart](quickstart.md). Read the [workflow](the-plan-workflow.md) when you need the stage contracts.

## Use quick commands for a bounded job

A quick plan is useful for exploring an approach. A quick audit is useful when a plan already exists. Cleanup can be the entire task; creating a homebase does not mean you have agreed to build anything.

Quick-plan and quick-audit run the same design gate as Stage 2, from the same block of the stage file: canary, evidence validation, lint registry, gap outputs, gate expression. What they skip is everything around the gate: no intent, no research, no scope lock, no human review, no build. Remaining findings may be delivered for you to resolve.

Export prepares a package; it does not establish that another codebase is identical or that secret redaction is infallible. Inspect the archive before sharing it.

## Skip Toque when the ceremony costs more than the mistake

A spelling correction or a well-understood one-line change may only need your ordinary review and tests.

Do not choose Toque if you need:

- A codebase audit or AI-readiness scan. Those commands were removed in 11.0.0.
- A runtime security boundary. The hooks provide context, not command blocking.
- An agent that can authorize or execute its own production release.
- A guarantee that a plausible, correctly cited design is actually right.

The [design-gate limitations](the-design-gate.md#what-this-does-not-prove) are part of deciding whether the tool fits, not fine print.

## Solo developer?

You can operate the workflow alone, but the human decisions still need names and records. The separate design review has a [conditional waiver](the-design-gate.md#human-review-and-the-solo-waiver). Automated gate failures, manual test confirmation, and production authorization are not erased by working solo.

[All capabilities and output paths](../plugins/toque/GUIDE.md)
