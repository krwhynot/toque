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
#   MODEL=opus   model passed to the subprocess (default opus, the run-3 pin)
#   DRY_RUN=1    print the argv and write the .meta, launch nothing, exit 0
set -euo pipefail

PROMPT="${1:?usage: launch-auditor.sh <prompt-file> <scenario-repo> <out-file>}"
REPO="${2:?usage: launch-auditor.sh <prompt-file> <scenario-repo> <out-file>}"
OUT="${3:?usage: launch-auditor.sh <prompt-file> <scenario-repo> <out-file>}"
MODEL="${MODEL:-opus}"
TOOLS="Bash,Read,Write,Grep,Glob,Agent,Skill"

[ -f "$PROMPT" ] || { echo "launch-auditor: no prompt file at $PROMPT"; exit 64; }
[ -d "$REPO" ] || { echo "launch-auditor: no scenario repo at $REPO"; exit 64; }
[ "$#" -eq 3 ] || { echo "launch-auditor: takes exactly three arguments; extra CLI flags are not accepted"; exit 64; }

ARGV="claude -p --model $MODEL --permission-mode acceptEdits --allowedTools \"$TOOLS\" < $PROMPT"
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
  (cd "$REPO" && claude -p --model "$MODEL" --permission-mode acceptEdits --allowedTools "$TOOLS" < "$PROMPT") > "$OUT" 2>&1 &
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
