# Install and upgrade Toque

Get the kitchen ready once. Then work from your project, not the plugin checkout.

<p align="center">
  <img src="../assets/toque-tall-mascot.png" width="120" alt="Toque, the tall chef-hat reviewer.">
</p>

## Prerequisites

Only two things are required; the rest are used when a specific command needs them, and each has a stated fallback.

| Dependency | Status | Used by | If absent |
| --- | --- | --- | --- |
| Claude Code (`claude --version`) | Required | Everything | Nothing runs |
| Node.js 18+ on PATH (`node --version`) | Required | The 3 hooks and the 2 design-gate tools (`tq-canary.js`, `tq-evidence-validate.js`) | Hook errors on each event; Stage 2 cannot pass. There is no fallback that turns a missing check into a pass |
| Git | Conditional | Stage 5 diff-versus-plan; Stage 3 traceability check | Those checks cannot run |
| `python3` or `python` | Conditional | `plan-status` overview and `troubleshoot` plan detection (JSON read, falls back to `grep`); `quick-cleanup` PDF, Word, and CSV extraction fallbacks | Status still reports via a weaker `grep` read; unreadable source files are marked for manual review |
| `pdftotext`, `pandoc` | Conditional | `quick-cleanup` PDF and Word extraction | Python fallback, then `[MANUAL REVIEW REQUIRED]` |
| `zip`, PowerShell `Compress-Archive`, or `tar` | Conditional | `plan-export` archive step | No archive; the staging directory is left for inspection |
| MCP search tools (Ref, Exa, Perplexity) | Optional | Stage 1 research, `troubleshoot` external context, documentation enrichment | Built-in web tools; if none, findings are tagged `[EXTERNAL RESEARCH UNAVAILABLE]` |
| `docs/audit/*` analysis from another tool | Optional | Auditor, scaffolder, quick-plan, templates (see [Interop](../interop.md)) | Workflows continue on project evidence |

Check Node separately. A working native Claude Code installation does not establish that Toque's Node scripts can run. See [Claude Code setup](https://code.claude.com/docs/en/setup).

## Install

Run these in a terminal, not in a Claude Code conversation:

```bash
claude plugin marketplace add krwhynot/toque
claude plugin install toque@toque-marketplace --scope user
```

The first command registers the catalog. The second installs `toque` from `toque-marketplace`.

Choose the scope explicitly:

| Flag | Available to |
| --- | --- |
| `--scope user` | You, across projects; also the CLI default |
| `--scope project` | Collaborators through this repository's shared settings |
| `--scope local` | You, in this repository only |

These are [Claude Code installation scopes](https://code.claude.com/docs/en/discover-plugins), not different Toque editions.

## Verify

Start Claude Code in your project:

```text
/toque:help
```

For an existing session, run `/reload-plugins` or restart first. If reload asks for confirmation through `--force`, follow its prompt. Check `/plugin` for load errors and the installed version.

Next: [complete your first workflow](quickstart.md).

## What gets installed, and what gets written

Installing adds capabilities to Claude Code; nothing is written into your project until you run a command.

| Where | What appears | When |
| --- | --- | --- |
| Claude Code's plugin cache (versioned; not your repository) | The `toque` plugin: 6 command files, 5 skills, 2 agents, `hooks/hooks.json`, 5 Node scripts, document templates | At `claude plugin install` |
| Your Claude Code settings for the chosen scope (`user`, `project`, or `local`) | The enabled-plugin entry that makes `/toque:*` available | At install; `--scope project` writes to the repository's shared settings |
| Every session in a project | Three informational hooks run on SessionStart, SubagentStop, and PreCompact; they read `docs/plans/` and never create files | Automatically, after install and reload |
| `docs/plans/YYYY-MM-DD-{name}/` in your project | The plan workspace (`intent.md`, `spec.md`, `audit.md`, `evidence/`, `plan.md`, `review.md`, …) | Only when you run `/toque:plan`, `/toque:quick-cleanup`, or a plan-linked command |
| `docs/specs/{name}.md` and `docs/specs/{name}/` | A standalone spec and its gate record (`audit.md`, `evidence/`, `gate.json`) | Only when you run `/toque:quick-plan`; `/toque:quick-audit` writes the same gate record beside whatever file it audits |
| `docs/troubleshooting/` | Standalone troubleshooting logs and `knowledge-base.md` | Only when you run `/toque:troubleshoot` without a plan |
| `{plan-name}-export.zip` at the project root | A portable plan package | Only when you run `/toque:plan-export` |
| `docs/audit/` | Nothing. Toque reads analysis another tool left there; it does not write it | Never written by Toque |

The cache path and settings file names are Claude Code's, so the table names the scope rather than a path. One hook does write: the SubagentStop handler appends a line to a plan's `troubleshooting/subagent-log.txt`, and only when that directory already exists.

## Update an installed copy

Refresh the catalog and update the plugin in a terminal:

```bash
claude plugin marketplace update toque-marketplace
claude plugin update toque@toque-marketplace --scope user
```

Use the scope you installed into. Then run `/reload-plugins` in an open session, or start a new one. Verify the version in `/plugin`.

The in-session catalog refresh is `/plugin marketplace update toque-marketplace`; it is not a substitute for updating the installed plugin.

Installed plugins use a versioned cache. Pulling this repository does not replace that cached copy. Third-party marketplace auto-update is off by default; see [Claude Code's update controls](https://code.claude.com/docs/en/discover-plugins#configure-auto-updates).

## Develop against a checkout

From the repository root:

```bash
claude --plugin-dir ./plugins/toque
```

This loads the local plugin for development. Start a new session to check edits. For published installs, use the update process above; do not edit the cache as a release workflow.

## Upgrade from before 10.0.0

The 10.0.0 rename changed the plugin and marketplace identities. Replace the old installation rather than expecting an in-place rename:

```bash
claude plugin uninstall <old-plugin-name>
claude plugin marketplace remove <old-marketplace>
claude plugin marketplace add krwhynot/toque
claude plugin install toque@toque-marketplace --scope user
```

Identify the old entries in `/plugin` first. Removing a marketplace can remove its other installed plugins too; do not remove a shared catalog blindly.

Update embedded slash commands to the `/toque:` namespace. Toque no longer reads the old `DG_*` or `TQ_*` settings used by the retired blocking hooks; check for other consumers before removing settings from shared configuration.

Installation does not rewrite plan folders. Separately, resuming a pre-8.0.0 plan performs a [schema-preserving migration](plan-workspace.md#migrating-a-pre-800-plan).

Upgrading from 10.x? Codebase-audit and AI-readiness scanning were removed in 11.0.0. There is no replacement scanner here.

## Troubleshooting installation

| Symptom | Check |
| --- | --- |
| `/toque:help` is missing | Correct catalog/plugin identity, installed scope, plugin enabled, session reloaded |
| Installed behavior differs from this checkout | Version in `/plugin`; cached install versus `--plugin-dir` |
| Node hook errors | `node --version` and the PATH visible to Claude Code |
| Design gate tools cannot start | Restore Node 18+; do not skip the checks to obtain a pass |

The three hooks are informational and fail open when their handlers run. Without Node, the handlers cannot start. The design-gate tools also require Node: Stage 2 has no fallback that turns an unavailable check into a pass.

## Optional inputs

MCP research tools and existing [external analysis files](../interop.md) are optional; the [prerequisites table](#prerequisites) states what each adds and what happens without it. No separate scanner installation is required.
