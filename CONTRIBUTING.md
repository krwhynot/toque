# Contributing to Toque

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/toque.git`
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Make changes
5. Test with Claude Code: `claude --plugin-dir /path/to/toque/plugins/<plugin>` (live-edit: your
   working tree is read directly, so changes take effect on the next session). To test the *installed*
   path instead: `/plugin install <plugin>@toque-marketplace --scope user`
6. Run the suite: `bash tests/run-all.sh` (all layers must pass)
7. Submit a pull request

## Repository Structure

One plugin lives here. `.github/release.sh` discovers every tracked manifest
rather than hardcoding a list, so the lockstep machinery still runs — it just
has one member. It was three until 11.0.0, when the audit and readiness
plugins were removed.

```
.claude-plugin/marketplace.json    # One catalog entry, pinned to a ref+SHA
plugins/toque/                 # Planning core (6 commands, 2 agents, 5 skills, 3 hooks)
tests/                             # One suite for the whole monorepo
```

Each plugin directory holds its own `.claude-plugin/plugin.json`, `README.md`,
`GUIDE.md`, and its `commands/`, `agents/`, `skills/`, `hooks/`, `scripts/` as
applicable. Toque is the only plugin here since 11.0.0, and it is the one that
carries hooks and scripts — layer 1 enforces per-plugin expectations from a
profile, so a plugin that grows a surface it should not have fails there.

## Adding a Command

1. Pick the plugin it belongs to and create `plugins/<plugin>/commands/your-command.md`
2. Add YAML frontmatter with `description`, `argument-hint`, `allowed-tools`
3. Write the command workflow in markdown
4. Test: `/<plugin>:your-command` — the namespace is the plugin name

## Adding an Agent

1. Create `plugins/<plugin>/agents/your-agent.md`
2. Follow the existing agent pattern (role, context, instructions)
3. Set `name:` to match the filename, and update every caller in the same commit
4. `tools:` is a closed allowlist — anything absent is unavailable to the
   subagent. If the body tells the agent to write a file, `Write` must be listed;
   if it runs shell pipelines, `Bash`; if it spawns subagents, `Agent`; if it
   references a knowledge skill, `Skill`.
5. Reference from a command using `Task` tool

## MCP Tool Names

<!-- CANONICAL-MCP-CONVENTION -->
MCP tools register under server-qualified names — `mcp__<server>__<tool>`, or
`mcp__plugin_<plugin>_<server>__<tool>` for plugin-bundled servers. The
`<server>` segment is chosen by the installing user, so this plugin never
hardcodes an MCP identifier in `tools:` or `allowed-tools:`. Determine
availability by matching the **tool-name suffix** against the connected tool
list, never by bare-name equality.
<!-- /CANONICAL-MCP-CONVENTION -->

Bare names such as `ref_search_documentation` or `web_search_exa` in a `tools:`
or `allowed-tools:` list resolve to nothing. In `allowed-tools:` they are inert
no-ops; in an agent's `tools:` they silently withhold access the agent was meant
to have. `claude plugin validate --strict` does not catch either case — it reads
`plugin.json`, `marketplace.json` and `hooks/hooks.json`, but never agent, command
or skill frontmatter — so `tests/layer1-config-wiring.sh` guards this instead.
The boundary is declared JSON config versus markdown frontmatter, not "manifests
versus components": a broken `hooks/hooks.json` fails validation, while an agent
file missing its `name:` passes clean.

The same rule applies to **skill** names, which are not MCP tools but fail the
same way: plugin skills address as `plugin:skill`, so an agent that says
"reference the `self-audit-knowledge` skill" is naming something unresolvable.
Qualify with the plugin namespace — `toque:self-audit-knowledge`. Layer 1's F27
sweep catches an unqualified name in an agent file; nothing catches one in a
command or skill body.

Until 11.0.0 a second plugin shipped a byte-identical mirror of that skill so
it resolved under both namespaces, and a layer 1 guard held the two copies
identical. The mirror left with that plugin, and the guard was retired rather
than relocated — there is no second copy here to compare against.

The block above is byte-identical to the one in `skills/mcp-research/SKILL.md`
and a test asserts they stay that way. Edit both or neither.

## Modifying Hooks

Hooks are declared in `plugins/toque/hooks/hooks.json` — the plan-context
handlers (SessionStart, SubagentStop, PreCompact) — and implemented as one Node
script per handler under that plugin's `scripts/`. Requires Node.js 18+. The
safety rails (PreToolUse, PostToolUse, Stop) and their TMPDIR marker bus shipped
in `toque-guard` until 9.0.0 and are retired; do not reintroduce a blocking
hook without the fail-closed rules below and a corpus of falsifying cases.

**Never add a `hooks` key back to `.claude-plugin/plugin.json`.** With both a
`hooks/` folder and a manifest `hooks` key present, Claude Code silently ignores
the **folder** — so an inline key does not merely duplicate config, it disables
every shipped handler while looking correct. `layer1` asserts the key's absence.

Each handler:
- parses stdin with `JSON.parse` and reads the **named** field it needs, when it
  needs one — `tq-pre-compact.js` reads the payload and discards it
- emits JSON on exit 0 — **never stderr on exit 0**, which is not surfaced
- exits 0 on every path; none of the three can deny, prompt, or block

The rules the retired rails were held to come back with any blocking hook, and
none of them apply to what ships today:
- split commands into shell words before matching, so quoted text is data
  (`git commit -m "no git push --force"` must be allowed; `git push "--force"`
  must not)
- deny with exit 2, ask with `permissionDecision: "ask"` at exit 0
- a Stop hook must use exit 0 (never exit 2, causes an infinite loop)

When editing hooks:
- add a falsifying case to `tests/layer2-ledger-rows.js` first; a change that
  fails a row fails regardless of how it is written
- security guards must never fail open; informational hooks must never fail closed
- every file in a plugin's `scripts/` must be referenced by that plugin's
  `hooks/hooks.json` (or invoked as `node .../scripts/NAME` from its commands,
  agents, or skills — `tq-canary.js` and `tq-evidence-validate.js` are wired from
  `skills/plan/stages/stage-2-design.md`), and every reference must resolve —
  `layer1` sweeps both directions

## Versioning

One manifest, one catalog entry, one tag+SHA, and `.github/release.sh` is the
only supported way to cut a release. The lockstep checks still run over every
manifest `git ls-files` finds, so adding a second plugin needs no change to
the release script — only a new profile block in `tests/layer1-core.sh`, which
refuses to run on an unrecognised profile, and a new `PARTS` entry in
`tests/layer1-config-wiring.sh`. Follow
semantic versioning (MAJOR.MINOR.PATCH):
- PATCH: Bug fixes, hook improvements
- MINOR: New commands, agents, or hooks
- MAJOR: Breaking changes to command interfaces or output locations

## Code Style

- Commands and agents: Markdown with XML sections
- Hook handlers: one Node script per handler, JSON.parse on stdin
- File paths: Forward slashes only (even for Windows patterns)
- JSON: 2-space indent

## Testing

Before submitting a PR:
1. `bash tests/run-all.sh` — all layers must pass; layer 1 covers every plugin
   directory plus the repo-wide sweeps
2. `claude plugin validate . --strict` and `claude plugin validate plugins/<plugin> --strict`
   (schema only — it never reads agent, command, or skill frontmatter)
3. For hook changes, add the falsifying case to `tests/layer2-ledger-rows.js` FIRST
