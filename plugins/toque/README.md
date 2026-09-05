# Toque (planning core)

<p align="center">
  <img src="assets/toque-tall-mascot.png" width="160" alt="Toque, the tall chef-hat reviewer.">
</p>

**Nothing leaves the pass until the chef has tasted it.** The pass is where a
finished plate gets its final inspection — and where a bad one gets sent back.
Toque puts that inspection between your design and your build: a fresh,
isolated auditor re-reads every cited file and returns a machine-readable
`MET`, `UNMET`, or `N_A` per criterion. No points. No vibes.

Toque's planning plugin: a six-stage workflow adapted from
[Anthropic's AI-Native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook)
(intent.md, spec.md, plan.md, review.md) with an
adversarial, verifier-first design gate, plan-linked troubleshooting, and
documentation generation. Stack-agnostic. Works on any codebase.

Toque prepares release; a named human authorizes and performs production deployment.
See the [adaptation boundaries](https://github.com/krwhynot/toque/blob/main/METHODOLOGY.md#relationship-to-the-ai-native-sdlc-playbook): the playbook's broader automation is not all provided by this plugin.

Toque reads codebase-analysis files from `docs/audit/` when a project has them
and works without them. The full reference is [GUIDE.md](GUIDE.md).

## Install

**Prerequisite:** Claude Code installed ([claude.ai](https://claude.ai))

```bash
claude plugin marketplace add krwhynot/toque
claude plugin install toque@toque-marketplace --scope user
```

Verify inside a Claude Code session:

```
/toque:help
```

## Commands (6)

### Planning

| Command | Description |
| ------- | ----------- |
| `/toque:plan` | Plan, Design, Build, Test, Deploy, Maintain. Recorded human approvals; Maintain stays open |
| `/toque:quick-plan` | Spec for a small change, run through the same design gate as Stage 2 |
| `/toque:plan-status` | Check plan progress and stage status |
| `/toque:plan-export` | Export a plan as a portable package |

### Auditing and Review

| Command | Description |
| ------- | ----------- |
| `/toque:quick-audit` | Run the design gate against any technical plan or spec: verdicts with evidence, canary, evidence validation |

### Documentation and Support

| Command | Description |
| ------- | ----------- |
| `/toque:documentation` | Generate ADRs, BRDs, PRDs, READMEs, runbooks, release notes, specs |
| `/toque:quick-cleanup` | Clean a folder of messy documents into reference material |
| `/toque:troubleshoot` | 4-phase debugging framework with incident triage, containment, status updates, and postmortems |
| `/toque:help` | Show all commands and usage |

`/toque:plan`, `/toque:troubleshoot`, and `/toque:documentation` are skill surfaces; the other entries are command files.

## The Six Stages

Think ticket rail, prep list, brigade, temperature probe, expeditor, and dish
pit feedback. Each stage below names the actual artifact and approval it needs.

| Stage | Commits | Gate |
| ----- | ------- | ---- |
| 1. Plan | `intent.md` | Intent accepted |
| 2. Design | `spec.md`, `audit.md`, `evidence/` | Scope lock, then the design gate |
| 3. Build | `plan.md`, code, `impact-review.md` | `plan.md` approved before code; impact review confirmed |
| 4. Test | `test-plan.md`, results | Automated tier passes; every manual check confirmed by a human |
| 5. Deploy | `review.md` with a release checklist | Release authorization, then a separate human confirmation that the release happened. The agent never crosses the production gate |
| 6. Maintain | A new `intent.md` from incidents | Intent accepted or declined |

## The Design Gate

Stage 2 ends in an audit with no score. A fresh, isolated plan-auditor returns
criterion records, each with a verdict and byte-addressed evidence. Two tools
in `scripts/` decide whether that audit counts:

- **`tq-canary.js`** checks the auditor. Before the audit runs, it injects one
  known defect (five rotating classes) into a working copy of the spec. An
  audit that misses it twice fails as untrustworthy and does not trigger the
  revision loop.
- **`tq-evidence-validate.js`** checks the evidence. It re-reads every cited
  file, verifies the hash, slices the cited lines, and compares them to the
  quote byte-for-byte. It can only demote a verdict, never promote one.

```
PASS = CANARY_OK AND EVIDENCE_OK AND VERIFIED AND INFRA_OK
```

There is no weighted sum. Known limitation: the auditor can read the canary's
defect table, so this reliably detects a lazy audit and only incidentally an
adversarial one. Details in [GUIDE.md](GUIDE.md#the-design-gate).

## Plan-Context Hooks (3)

The plugin includes 3 plan-context hooks that activate automatically. They are
declared in `hooks/hooks.json` and run as Node scripts from `scripts/`, one file
per handler. **Requires Node.js 18 or later** — the same runtime Claude Code
itself needs. All three are informational and fail open. There are no blocking
hooks: use Claude Code permission rules in `settings.json` for force-push,
migration, and database-deploy protection.

| Hook | Event | What It Does |
| ---- | ----- | ------------ |
| Active Plan Display | SessionStart | Reports the active plan, its phase, and that phase's status |
| Subagent Log | SubagentStop | Logs subagent completions to the active plan's troubleshooting folder |
| Plan Context | PreCompact | Preserves plan name and stage on compact |

## Dependencies

**Required:** [Node.js](https://nodejs.org/) 18 or later on PATH. A native Claude
Code installation does not establish that Node is available to Toque's scripts;
check it separately.

```bash
node --version   # must print v18.0.0 or higher
```

**Optional:** MCP search tools (Ref, Exa, Perplexity) enrich research when
present; every stage and template works without them. There are no other
optional dependencies.

**What happens without Node.** The hooks cannot start, and Claude Code reports a
hook error on each guarded event. That is deliberate: absent and loud beats
present and wrong. The design-gate tools fail the same way, and Stage 2 cannot
pass without them.

## File Output Locations

| Output | Location | Committed? |
| ------ | -------- | ---------- |
| Plan workspace | `docs/plans/{date}-{name}/` | Yes |
| Audit evidence | `docs/plans/{date}-{name}/evidence/` | Yes |
| Canary working copy | `docs/plans/{date}-{name}/.canary/` | No |
| Troubleshooting logs, postmortems, knowledge base | `docs/troubleshooting/` or the plan's `troubleshooting/` | Yes |
| Specifications and quick plans | `docs/specs/{name}.md` | Yes |
| Gate record for a standalone spec or audited file | `{dir}/{name}/audit.md`, `evidence/`, `gate.json` beside the document (`docs/specs/{name}/` for a quick-plan spec) | Yes |
| Canary working copy for a standalone gate run | `{dir}/{name}/.canary/`, deleted by the gate once used | No |
| ADRs, BRDs, PRDs | `docs/adr/`, `docs/brd/`, `docs/prd/` | Yes |
| Runbooks | `docs/runbooks/` or the plan folder | Yes |
| Plan export | `{plan-name}-export.zip` at project root | No |

## Architecture

[How the pieces connect](GUIDE.md#how-the-pieces-connect) draws which entrypoints call the agents and gate tools.

- **2 agents** - plan-auditor (the isolated judge) and plan-scaffolder
- **5 skills** - plan and troubleshoot (each a router plus one file per stage or phase), documentation, MCP research, self-audit knowledge
- **7 doc templates** - ADR, BRD, PRD, README, runbook, release notes, spec, each with a fill-in document skeleton
- **3 hook handlers** - `scripts/tq-session-start.js`, `tq-subagent-stop.js`, `tq-pre-compact.js`
- **2 design-gate tools** - `scripts/tq-canary.js` and `tq-evidence-validate.js`, run by the Stage 2 `<design_gate>` block, which `/toque:plan`, `/toque:quick-plan`, and `/toque:quick-audit` all execute; never by hooks

## Version History

See the monorepo [CHANGELOG](https://github.com/krwhynot/toque/blob/main/CHANGELOG.md).

Current: v11.0.1

## License

MIT.
