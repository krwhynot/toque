#!/usr/bin/env bash
# Launch one fresh plan-auditor as a `claude -p` subprocess for the stress rig.
#
# Two things run 3 learned at the cost of a launch each, fixed here so a fourth
# run cannot re-learn them (stress-run3-critic.md §4b, rows 2 and 8):
#
#   - The prompt goes on STDIN, never as an argument. The frozen agent file opens
#     with a `---` frontmatter fence; passed on argv the CLI parses that as an
#     option and exits with "error: unknown option '---'" before any auditor
#     starts. Three of three subprocess scenarios lost their first launch to it.
#   - The grant matches the shipped agent. plan-auditor.md's frontmatter declares
#     Bash, Read, Write, Grep, Glob, Agent and Skill. Run 3 withheld Agent and
#     Skill after --dangerously-skip-permissions was refused by the auto-mode
#     classifier, and so tested a differently-equipped auditor from the one the
#     plugin ships. The dangerous flag is not used here and is not accepted.
#
# One thing run 6 learned (R6-01): the subprocess reads the operator's
# ~/.claude/settings.json, and its outputStyle rode into every auditor's system
# prompt, so the auditor under test was not the one the plugin ships. Fixed by
# --settings '{"outputStyle":"default"}', which overrides that one key and
# nothing else. --setting-sources project,local was measured and rejected: it
# strips the style but also drops every toque: skill, because the plugin is
# enabled in the same user settings file (10 of 10 skills present with
# --settings, 0 with --setting-sources). --output-style does not exist in CLI
# 2.1.267. The .meta records the override so the isolation is provable from
# disk.
#
# One thing run 7 learned (R7-02): --settings only overrode outputStyle — both
# ~/.claude/CLAUDE.md and ~/.claude/rules/*.md still loaded, and a rule asking
# for a "[Confidence: NN%]" line rode into the auditor's own text unprompted
# (s10-auditor-1.txt:44). A first fix attempt, --bare plus --plugin-dir, failed
# outright: --bare requires API-key auth and this operator uses OAuth (exit 1,
# "Not logged in"). The working fix is --restricted --tools "$TOOLS"
# --strict-mcp-config --plugin-dir "$PLUGIN_DIR" --add-dir "$PLUGIN_DIR":
# --restricted drops ~/.claude/CLAUDE.md, rules/*.md and every other user/
# project/local setting (managed settings and --settings still apply); --tools
# restores exactly the plugin's declared grant, which --restricted otherwise
# removes; --plugin-dir loads the plugin's own agent/skill definitions without
# depending on the operator's enabledPlugins setting; and --add-dir is required
# alongside --plugin-dir because --restricted confines file-tool reads to the
# working directory by default, and a fresh auditor cannot read the plugin's
# own lint registry or SKILL.md without it — measured directly: the first real
# audit attempt without --add-dir made zero writes and refused to fabricate a
# report ("Without the registry, the records would be made up") rather than
# work around the limit. With --add-dir, a full real s10 audit ran clean: 12
# MET / 9 UNMET / 1 N_A, evidence validator 0 flagged, and zero occurrences of
# the "[Confidence:" tracer anywhere in its output or the gate folder it wrote.
# Only measured for the auditor launch; the holistic judge (a separately
# composed prompt through this same script) was not independently re-run under
# these flags.
#
#   bash launch-auditor.sh <prompt-file> <scenario-repo> <out-file>
#
# The executor composes the prompt file: the frozen agent text, the bindings
# ({doc}, {gate_dir}, mode), and the sequential-specialist instruction the
# subprocess branch requires. cwd is the scenario repo, so relative paths in the
# prompt resolve there. stdout and stderr go to <out-file>; <out-file>.meta
# records the exact argv, cwd, start and end time and exit code, so the launch
# and its route are provable from disk afterwards without relying on the CLI
# failing, which is what established the route in run 3.
#
#   MODEL=opus        model passed to the subprocess (default opus, the run-3 pin)
#   PLUGIN_DIR=<path> frozen plugin root (default: derived from <scenario-repo>
#                     as <the part before "/stress/...">/frozen/plugins/toque,
#                     the layout every run in this rig uses; pass explicitly
#                     for any other layout)
#   DRY_RUN=1         print the argv and write the .meta, launch nothing, exit 0
set -euo pipefail

PROMPT="${1:?usage: launch-auditor.sh <prompt-file> <scenario-repo> <out-file>}"
REPO="${2:?usage: launch-auditor.sh <prompt-file> <scenario-repo> <out-file>}"
OUT="${3:?usage: launch-auditor.sh <prompt-file> <scenario-repo> <out-file>}"
MODEL="${MODEL:-opus}"
TOOLS="Bash,Read,Write,Grep,Glob,Agent,Skill"
PLUGIN_DIR="${PLUGIN_DIR:-${REPO%/stress/*}/frozen/plugins/toque}"
# R6-01 + R7-02: --restricted drops the operator's CLAUDE.md/rules/settings;
# --tools restores the plugin's own declared grant; --plugin-dir/--add-dir load
# the plugin and let the auditor read its own reference files. See above.
SETTINGS='{"outputStyle":"default"}'

[ -f "$PROMPT" ] || { echo "launch-auditor: no prompt file at $PROMPT"; exit 64; }
[ -d "$REPO" ] || { echo "launch-auditor: no scenario repo at $REPO"; exit 64; }
[ -d "$PLUGIN_DIR" ] || { echo "launch-auditor: no plugin dir at $PLUGIN_DIR (set PLUGIN_DIR explicitly)"; exit 64; }
[ "$#" -eq 3 ] || { echo "launch-auditor: takes exactly three arguments; extra CLI flags are not accepted"; exit 64; }

ARGV="claude -p --restricted --tools $TOOLS --strict-mcp-config --plugin-dir $PLUGIN_DIR --add-dir $PLUGIN_DIR --model $MODEL --permission-mode acceptEdits --allowedTools \"$TOOLS\" --settings '$SETTINGS' < $PROMPT"
START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_EPOCH="$(date -u +%s)"
# Generated before the launch, recorded after it. Its only job is to make two
# .meta files from one run distinguishable from one file copied twice.
NONCE="$(node -e "console.log(require('crypto').randomBytes(8).toString('hex'))")"
RC=0
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY RUN: (cd $REPO && $ARGV) > $OUT"
else
  set +e
  (cd "$REPO" && claude -p --restricted --tools "$TOOLS" --strict-mcp-config --plugin-dir "$PLUGIN_DIR" --add-dir "$PLUGIN_DIR" --model "$MODEL" --permission-mode acceptEdits --allowedTools "$TOOLS" --settings "$SETTINGS" < "$PROMPT") > "$OUT" 2>&1 &
  CHILD=$!
  wait "$CHILD"
  RC=$?
  set -e
fi
END="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  echo "ROUTE claude-p (subprocess, prompt on stdin)"
  echo "ARGV $ARGV"
  echo "CWD $REPO"
  echo "SETTINGS_OVERRIDE $SETTINGS"
  echo "PROMPT_SHA256 $(node -e "const f=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))" "$PROMPT")"
  echo "START $START"
  echo "END $END"
  echo "EXIT $RC"
  # Process identity. Run 4 established isolation from a launch record in one
  # scenario and could only CORROBORATE it in the other, because the .meta
  # carried nothing that came from a process: argv, cwd, hashes and timestamps
  # are all things a person could type. A wrapper PID, a distinct child PID and
  # a launch nonce are still not proof against a determined forger — nothing
  # written by the wrapper itself can be — but they are the difference between
  # "this file describes a launch" and "this file was written by one".
  echo "WRAPPER_PID $$"
  echo "CHILD_PID ${CHILD:-none}"
  echo "PPID $PPID"
  echo "LAUNCH_NONCE $NONCE"
  echo "HOST $(hostname 2>/dev/null || echo unknown)"
  echo "CLAUDE_SESSION_ID ${CLAUDE_SESSION_ID:-unset}"
  echo "START_EPOCH $START_EPOCH"
  echo "END_EPOCH $(date -u +%s)"
  if [ -f "$OUT" ]; then
    echo "OUT_BYTES $(wc -c < "$OUT" | tr -d ' ')"
    echo "OUT_MTIME_EPOCH $(date -u -r "$OUT" +%s 2>/dev/null || echo unknown)"
    echo "OUT_SHA256 $(node -e "const f=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))" "$OUT")"
  fi
  [ "${DRY_RUN:-0}" = "1" ] && echo "DRY_RUN 1"
} > "$OUT.meta"
exit "$RC"
