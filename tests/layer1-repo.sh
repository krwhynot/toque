#!/usr/bin/env bash
# =============================================================================
# Layer 1 (repo): repo-wide sweeps that no single plugin directory can own.
#
#   - line-ending policy (§14, A1/CR-2/CR-3) — derived from the tracked tree
#   - F30 stale-reference sweep (§18) — every tracked .md
#   - the PH5 sentinels (PH5-001..PH5-060) — the verifier-gate invariants; their
#     subject files live in the toque plugin but the restatement/count sweeps
#     cover every tracked doc across all plugin dirs
#   - the root-doc claim sweep (§16) — root-level docs sit outside every plugin,
#     so the per-plugin core pass cannot see them
#
# Extracted verbatim from the monolithic layer1-config-wiring.sh (split step 4).
# Runs from the repo root; the dispatcher owns the anchored Results line.
# =============================================================================

set -u

cd "$(dirname "$0")/.." || exit 1

PASS=0
FAIL=0
WARN=0

pass() {
  echo "[PASS] $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "[FAIL] $1"
  FAIL=$((FAIL + 1))
}

warn() {
  echo "[WARN] $1"
  WARN=$((WARN + 1))
}

echo "=== Layer 1 repo-wide sweeps ==="
echo ""
# ===========================================================================
# 14. Line-ending policy covers every executable script (A1 + CR-2 + CR-3)
#
# `git ls-files --eol` is NOT usable here: it reports w/lf with no .gitattributes
# present at all, so it can never fail (that is what CR-2 corrected). Assert the
# ATTRIBUTE instead, via git check-attr, which reads the policy rather than the
# current checkout. The falsifying acceptance test remains the fresh-clone
# `file` check recorded in CR-2/CR-3.
#
# Subjects are DERIVED from the tracked tree, so a newly added script is covered
# the moment it is committed — the failure mode CR-3 exists to close was a new
# file class silently falling outside the policy.
# ===========================================================================
echo ""
echo "--- Line-ending policy (A1/CR-2/CR-3) ---"

# DERIVED BY CLASS, not by a hardcoded extension list.
#
# The comment above claimed "a newly added script is covered the moment it is committed",
# and the code below enumerated '*.sh' '*.js' 'tests/fixtures/*'. Those are not the same
# claim: it derived FILES WITHIN KNOWN EXTENSIONS, so a new script CLASS still fell
# outside silently — precisely the failure CR-3 was ratified to close. Demonstrated by
# committing tests/mutation/wave5-guards.py, the first tracked .py: it landed with
# `eol: unspecified` and this section stayed green.
#
# Now: known extensions UNION anything carrying a shebang, whatever it is called. A new
# interpreter cannot be introduced without becoming a subject here.
eol_subjects=0
eol_bad=0
eol_known=$(git ls-files '*.sh' '*.js' '*.py' '*.ps1' 'tests/fixtures/*' 2>/dev/null)
# FIRST LINE ONLY, in one batched pass.
#   - `head -c2` per file spawned a subprocess per tracked path and blew a two-minute budget.
#   - `grep -lIm1 '^#!'` was fast but WRONG: it matches a `#!` line anywhere in the file, so
#     agents/gate-generator.md — which contains a shebang inside a fenced example — was
#     classified as an executable script. A shebang is only a shebang on line 1.
# `nextfile` stops after the first record of each file, so this reads one line per path.
eol_shebang=$(git ls-files -z 2>/dev/null \
  | xargs -0 awk 'FNR==1 && /^#!/ { print FILENAME } { nextfile }' 2>/dev/null)
eol_list=$(printf '%s\n%s\n' "$eol_known" "$eol_shebang" | grep -v '^$' | sort -u)
for f in $eol_list; do
  eol_subjects=$((eol_subjects + 1))
  attr=$(git check-attr eol -- "$f" 2>/dev/null | sed 's/.*: //')
  if [ "$attr" != "lf" ]; then
    fail "A1/CR-3: $f is an executable script or fixture but its eol attribute is '$attr', not 'lf'"
    eol_bad=1
  fi
done
if [ "$eol_subjects" -lt 15 ]; then
  fail "A1/CR-3: derived only $eol_subjects policy subjects (expected >= 15) — the derivation is broken, not the policy"
elif [ "$eol_bad" -eq 0 ]; then
  pass "A1/CR-3: all $eol_subjects shell scripts, node scripts and fixtures carry eol=lf"
fi

# The rationale at the top of .gitattributes must name both extensions. It said
# "the hook guards and the test suite are shell scripts" while lane N shipped the
# guards as .js — a policy file asserting something no longer true of the tree,
# which is exactly the drift class the consistency sweep guards elsewhere.
if [ ! -f .gitattributes ]; then
  fail "A1: .gitattributes is missing entirely"
else
  head_txt=$(sed -n '1,20p' .gitattributes | tr -d '\r')
  rationale_ok=1
  # Every covered class must be NAMED in the rationale. CR-3 asserted the sentence could not
  # drift again, then CR-5 found it naming .sh and .js while the policy had to cover .py.
  # Derived from the policy file itself, so adding a class without naming it fails here.
  for _cls in $(grep -oE '^\*\.[a-z0-9]+ text eol=lf' .gitattributes | sed 's/^\*\.//; s/ .*//'); do
    echo "$head_txt" | grep -q "\.$_cls" || {
      fail "A1/CR-5: .gitattributes covers *.$_cls but its rationale never names it — the sentence has drifted from the policy again"
      rationale_ok=0
    }
  done
  if [ "$rationale_ok" -eq 1 ]; then
    pass "A1/CR-3: the .gitattributes rationale names both .sh and .js"
  else
    fail "A1/CR-3: the .gitattributes rationale does not name both .sh and .js — it will drift from the tree again"
  fi
fi
# ===========================================================================
# 18. F30 stale-reference sweep — enforced LITERALLY, no exemptions.
#
# The acceptance row is class G and absolute: "no `/toque:doc` or `commands/doc.md`
# string survives anywhere". No guard existed; I had closed F30 on having deleted the
# file, and three references survived.
#
# The first version of this guard exempted two historical documents (a CHANGELOG release
# entry, a shipped-feature spec) on the reasoning that rewriting them would falsify a
# record, and paired that with an unratified change record. Codex review (gpt-5.6-sol
# @ xhigh, 2026-07-30) found a concrete bypass in every one of those exemptions AND the
# better option I had missed: reword the two documents TRUTHFULLY. "The documentation
# command and skill" is accurate for 4.31.0, git history preserves the exact former
# spelling, and the row is then satisfiable with no exemption at all.
#
# So there is nothing to bypass here now. Every exemption mechanism is deleted, CR-4 is
# withdrawn, and the rule is the row.
# ===========================================================================
echo ""
echo "--- F30 stale-reference sweep ---"

f30_bad=0
# The deleted file must stay deleted wherever a commands/ dir lives now.
for f30_cmds in commands plugins/*/commands; do
  [ -e "$f30_cmds/doc.md" ] && { fail "F30: $f30_cmds/doc.md still exists"; f30_bad=1; }
done

# CR-6 (ratified 2026-08-03): occurrence-addressed provenance ledger, no allowlist.
#
# The two-path allowlist this replaces was the THIRD construction. The first skipped
# all of docs/plans/* while claiming "no exemptions" (Codex N1 — three stale
# references survived in an unrelated plan). The second was CR-4's exemption
# machinery, withdrawn. A directory allowlist of any width is a hiding place: a new
# stale INSTRUCTION added under an allowlisted path passes. An occurrence ledger is
# an inventory: every intentional historical mention is enumerated in
# tests/fixtures/f30-provenance-ledger.tsv as `path<TAB>sha256(line)`, and the sweep
# fails BOTH ways — an occurrence not in the ledger (new stale reference, wherever
# it lives), and an entry whose file no longer carries a matching line (the ledger
# cannot go stale and keep passing).
#
# Hash granularity is the LINE, not the file: a file-level hash would freeze every
# record that contains one mention, which punishes exactly the truthful-rewording
# practice CR-4 established. Editing the ledgered line itself changes its hash and
# fails both directions at once. The ledger stores hashes, never the tokens, so it
# is not an occurrence; this script is not swept (subjects are tracked .md).
F30_LEDGER="tests/fixtures/f30-provenance-ledger.tsv"
f30_re='/toque:doc\b|commands/doc\.md'
f30_hash() { printf '%s' "$1" | tr -d '\r' | sha256sum | cut -d' ' -f1; }

# Instruments proven before their silence is trusted: the regex must fire on the
# real token and stay quiet on the near-miss; the hasher must distinguish lines.
printf '%s\n' 'see /toque:doc for usage' | grep -qE "$f30_re" \
  || { fail "F30: token regex fails its known-positive — the sweep would be vacuous"; f30_bad=1; }
printf '%s\n' 'see /toque:documentation for usage' | grep -qE "$f30_re" \
  && { fail "F30: token regex matches the LIVE documentation skill name — it would flag legitimate references"; f30_bad=1; }
[ "$(f30_hash 'line A')" != "$(f30_hash 'line B')" ] \
  || { fail "F30: line hasher cannot distinguish lines — ledger lookups would be vacuous"; f30_bad=1; }

if [ ! -f "$F30_LEDGER" ]; then
  fail "F30: provenance ledger $F30_LEDGER is missing — every historical mention is unregistered without it"
  f30_bad=1
else
  # Direction 1: every occurrence in every tracked .md must be registered.
  # NUL-delimited: `for f in $subjects` word-splits, so a tracked path containing a
  # space would be counted toward the floor and silently skipped (Codex F2).
  f30_count=0
  f30_occurrences=0
  while IFS= read -r -d '' f; do
    [ -f "$f" ] || continue
    f30_count=$((f30_count + 1))
    while IFS= read -r f30_line; do
      [ -n "$f30_line" ] || continue
      f30_occurrences=$((f30_occurrences + 1))
      f30_h=$(f30_hash "$f30_line")
      grep -qF "$f	$f30_h" "$F30_LEDGER" \
        || { fail "F30: unregistered occurrence in $f — $(printf '%s' "$f30_line" | cut -c1-60)"; f30_bad=1; }
    done < <(grep -E "$f30_re" "$f" 2>/dev/null)
  done < <(git ls-files -z '*.md' 2>/dev/null)

  # Direction 2: every ledger entry must still be backed by a matching line.
  f30_entries=0
  while IFS=$'\t' read -r f30_lf f30_lh; do
    case "$f30_lf" in \#*|'') continue ;; esac
    f30_entries=$((f30_entries + 1))
    f30_found=0
    if [ -f "$f30_lf" ]; then
      while IFS= read -r f30_line; do
        [ "$(f30_hash "$f30_line")" = "$f30_lh" ] && { f30_found=1; break; }
      done < <(grep -E "$f30_re" "$f30_lf" 2>/dev/null)
    fi
    [ "$f30_found" -eq 1 ] \
      || { fail "F30: stale ledger entry — $f30_lf no longer carries the registered line ($(printf '%s' "$f30_lh" | cut -c1-12)...)"; f30_bad=1; }
  done < "$F30_LEDGER"

  # Floors, per the recurring vacuous-pass lesson: a subject set or a ledger that
  # collapses to nothing would sweep clean and prove nothing.
  if [ "$f30_count" -lt 10 ]; then
    fail "F30: subject set is only $f30_count files — the derivation collapsed, so a pass here would be vacuous"
    f30_bad=1
  fi
  if [ "$f30_entries" -lt 10 ]; then
    fail "F30: ledger holds only $f30_entries entries (39 registered at ratification) — the ledger read collapsed, so the stale-entry direction proved nothing"
    f30_bad=1
  fi

  [ "$f30_bad" -eq 0 ] && pass "F30: all $f30_occurrences occurrences across $f30_count tracked files are ledger-registered, and all $f30_entries ledger entries are live"
fi
# ===========================================================================
# PH5-001 / acceptance row A1: lint-registry.md is the ONLY file that states
# LINT rule text.
#
# The registry declares itself the single source of truth and nothing enforced it.
# Every one of the 18 rules had drifted into a second wording, and LINT-17/18 had
# drifted into a second MEANING. Harmless while a prose score carried the Phase 5
# gate; load-bearing once LINT verdicts ARE the gate
# (docs/specs/phase5-verifier-gate.md).
#
# Formulated as ABSENCE, deliberately. An earlier version of this guard compared
# each restatement against the registry's wording, which required deciding whether
# a given sentence was "a definition" — an intent question, and the species this
# repo has been bitten by repeatedly. Asking instead "does any prose follow a LINT
# id outside the registry?" is a question text matching answers soundly, and it
# makes collisions impossible by construction rather than merely detected.
#
# Bare references are unaffected: "LINT-08 blocks Build" and "all of LINT-01..10
# apply" carry no ':' or '|' delimiter and are not collected. Governing files may
# reference any id freely; they may not restate what it means.
# ===========================================================================
lint_hits=$(mktemp)
lint_bad=0
LINT_REGISTRY="plugins/toque/docs/planning-techniques/lint-registry.md"

# Subject set: tracked .md that GOVERNS behaviour, minus the registry itself.
# Files under docs/plans/ are records of audits that already ran; they restate the
# rule text in force at the time, and rewriting them to satisfy a guard would
# falsify a record rather than fix a defect. The split is structural (governing
# document vs. historical record), never per-file, and the floors below prove the
# set did not quietly collapse.
#
# One awk process over the set. An earlier shell-loop version spawned ~5 processes
# per matched line and blew the suite's time budget on Windows; the extraction is
# identical, the cost is not.
lint_extract() {
  xargs -0 awk '
    {
      line = $0
      pos  = 1
      while (1) {
        rest = substr(line, pos)
        if (! match(rest, /LINT-[0-9]+[ \t]*[:|]/)) break
        id = substr(rest, RSTART, RLENGTH)
        sub(/[ \t]*[:|]$/, "", id)

        after = substr(rest, RSTART + RLENGTH)
        p     = index(after, "|")
        desc  = (p > 0) ? substr(after, 1, p - 1) : after

        # Verdict placeholders are not prose.
        gsub(/\[[Pp][Aa][Ss][Ss][^]]*\]/, "", desc)
        gsub(/^[ \t]+/, "", desc); gsub(/[ \t]+$/, "", desc)

        norm = tolower(desc)
        gsub(/[^a-z0-9]+/, " ", norm)
        gsub(/^ +/, "", norm); gsub(/ +$/, "", norm)

        # Three words separates real rule text from a bare "LINT-01 |" table cell.
        if (split(norm, w, " ") >= 3) print FILENAME "\t" id "\t" desc "\t" norm

        pos += RSTART + RLENGTH - 1
      }
    }
  ' 2>/dev/null
}

lint_reg=$(mktemp)
printf '%s\0' "$LINT_REGISTRY" | lint_extract | sort -u > "$lint_reg"

# Floor 1: the extractor must find the registry's own definitions. If the pattern
# stops matching, every other file goes silent too and the guard passes vacuously —
# the recurring "answer does not depend on the truth" species.
registry_defs=$(cut -f2 "$lint_reg" | sort -u | grep -c . || true)
if [ "${registry_defs:-0}" -lt 15 ]; then
  fail "PH5-001: extractor found only ${registry_defs:-0} rule ids in $LINT_REGISTRY — the pattern collapsed, so a clean sweep elsewhere would be vacuous"
  lint_bad=1
fi

# --- A1a: machine-read files carry ids, never rule text -------------------
# commands/ and agents/ are loaded into agent context. Text that drifts here is
# text a judge actually applies, so nothing may follow a LINT id but the id.
git ls-files -z 'plugins/*/commands/*.md' 'plugins/*/agents/*.md' 'plugins/*/skills/plan/*.md' 'plugins/*/skills/plan/stages/*.md' 2>/dev/null | lint_extract | sort -u > "$lint_hits"

for must in plugins/toque/skills/plan/stages/stage-2-design.md plugins/toque/agents/plan-auditor.md; do
  git ls-files -z 'plugins/*/commands/*.md' 'plugins/*/agents/*.md' 'plugins/*/skills/plan/*.md' 'plugins/*/skills/plan/stages/*.md' 2>/dev/null | tr '\0' '\n' | grep -qxF "$must" \
    || { fail "PH5-001a: $must is not in the machine-read set — the derivation is wrong, not the repo clean"; lint_bad=1; }
done

mr_count=$(grep -c . "$lint_hits" || true)
if [ "${mr_count:-0}" -gt 0 ]; then
  lint_bad=1
  fail "PH5-001a: $mr_count restatement(s) of LINT rule text in machine-read files (commands/, agents/) — these must carry bare ids only:"
  awk -F'\t' '{ printf "           %s  %s: %s\n", $1, $2, substr($3, 1, 60) }' "$lint_hits" | head -25
  [ "$mr_count" -gt 25 ] && echo "           ... $(( mr_count - 25 )) more"
fi

# --- A1b: human-facing docs may restate, but only verbatim ----------------
# METHODOLOGY.md and the technique docs explain the rules to a reader, so bare ids
# would make them useless. They may restate — the restatement must be one the
# registry actually contains. This is equality, not intent: no judgement about
# whether a sentence "expresses" a rule, only whether it matches one.
lint_hf=$(mktemp)
git ls-files -z '*.md' 2>/dev/null \
  | grep -zv '^docs/plans/' \
  | grep -zvE '^plugins/[^/]*/commands/' \
  | grep -zvE '^plugins/[^/]*/agents/' \
  | grep -zv "^${LINT_REGISTRY}\$" \
  | lint_extract | sort -u > "$lint_hf"

git ls-files -z '*.md' 2>/dev/null | grep -zv '^docs/plans/' | grep -zvE '^plugins/[^/]*/commands/' \
  | grep -zvE '^plugins/[^/]*/agents/' | grep -zv "^${LINT_REGISTRY}\$" | tr '\0' '\n' | grep -qxF 'METHODOLOGY.md' \
  || { fail "PH5-001b: METHODOLOGY.md fell outside the human-facing set — the exclusions grew past their intent"; lint_bad=1; }

lint_drift=$(mktemp)
awk -F'\t' '
  NR == FNR { reg[$2 "\t" $4] = 1; next }
  ! (($2 "\t" $4) in reg) { print $1 "\t" $2 "\t" $3 }
' "$lint_reg" "$lint_hf" > "$lint_drift"

hf_count=$(grep -c . "$lint_drift" || true)
if [ "${hf_count:-0}" -gt 0 ]; then
  lint_bad=1
  fail "PH5-001b: $hf_count restatement(s) in human-facing docs do not match any wording in $LINT_REGISTRY:"
  awk -F'\t' '{ printf "           %s  %s: %s\n", $1, $2, substr($3, 1, 60) }' "$lint_drift" | head -25
  [ "$hf_count" -gt 25 ] && echo "           ... $(( hf_count - 25 )) more"
fi

[ "$lint_bad" -eq 0 ] && pass "PH5-001: $registry_defs rules defined in $LINT_REGISTRY; 0 rule text in machine-read files, $(grep -c . "$lint_hf" || true) doc restatement(s) all verbatim"
rm -f "$lint_hits" "$lint_reg" "$lint_hf" "$lint_drift"

# ===========================================================================
# PH5-002 / acceptance row A1: rule COUNTS live only in the registry.
#
# Rule text was not the only thing that drifted. Four different Phase 5 counts were
# in print at once — 14 in plugins/toque/skills/plan/stages/stage-2-design.md, 14 and 15 in plugins/toque/agents/plan-auditor.md,
# 16 in the registry, 15 in METHODOLOGY.md — plus a fifth ("13 in Lite mode") in the
# same METHODOLOGY sentence. A count is a claim about the rule SET, so it belongs
# where the set is defined.
#
# Decidable by absence, like PH5-001: a count is an integer bound to the word
# "rule(s)", or the denominator of an "N/M passed" tally. LINT-NN tokens are stripped
# first so the ids' own digits cannot be read as counts. No question is asked about
# what any sentence means.
# ===========================================================================
lint_counts=$(mktemp)
count_bad=0

# One scanner, used for both the sweep and its floor. Two copies of this pattern is
# exactly the drift the guard exists to prevent, and the first draft had already
# diverged: the floor stripped only LINT ids while the sweep stripped five token
# classes, so the two disagreed about whether "Phase 5 lint rules" was a count.
count_scan() {   # NUL-separated paths on stdin -> "file:line<TAB>text"
  xargs -0 awk '
    function strip(s) {
      # An identifier that merely contains a digit is not a count. "Phase 5 lint
      # rules" names a phase; "14 lint rules" claims a set size. Removing the
      # identifier tokens first keeps that distinction mechanical, not interpretive.
      gsub(/LINT-[0-9]+/, "", s)
      gsub(/PH5-[0-9]+/, "", s)
      gsub(/[Pp]hase[ \t]+[0-9]+/, "", s)
      gsub(/[Ll]ayer[ \t]+[0-9]+/, "", s)
      gsub(/[Ww]ave[ \t]+[0-9]+/, "", s)
      return s
    }
    {
      probe = strip($0)
      if (probe ~ /[0-9]+[ \t]*(lint[ \t]*)?rules?[^a-z]/ ||
          probe ~ /\/[0-9]+[ \t]+passed/) {
        printf "%s:%d\t%s\n", FILENAME, FNR, substr($0, 1, 88)
      }
    }
  ' 2>/dev/null
}

git ls-files -z '*.md' 2>/dev/null \
  | grep -zv '^docs/plans/' \
  | grep -zv "^${LINT_REGISTRY}\$" \
  | count_scan | sort -u > "$lint_counts"

# Floor, inverted: assert the pattern STILL FIRES on the one file allowed to state
# counts. A sweep for a forbidden pattern everywhere-but-here cannot otherwise tell
# "nothing to find" from "my pattern broke" — the two produce identical output.
count_probe=$(printf '%s\0' "$LINT_REGISTRY" | count_scan | grep -c . || true)
if [ "${count_probe:-0}" -lt 1 ]; then
  fail "PH5-002: the count pattern no longer fires on $LINT_REGISTRY, which states counts by design — the probe is broken, so a clean sweep elsewhere is vacuous"
  count_bad=1
fi

cnt=$(grep -c . "$lint_counts" || true)
if [ "${cnt:-0}" -gt 0 ]; then
  count_bad=1
  fail "PH5-002: $cnt lint rule count(s) stated outside $LINT_REGISTRY:"
  awk -F'\t' '{ printf "           %s  %s\n", $1, $2 }' "$lint_counts" | head -20
fi

[ "$count_bad" -eq 0 ] && pass "PH5-002: no lint rule count outside $LINT_REGISTRY (probe fires on $count_probe registry line(s))"
rm -f "$lint_counts"

# ===========================================================================
# PH5-013 / acceptance row A3: the judge is never told what passing costs.
#
# plugins/toque/agents/plan-auditor.md used to carry the band table verbatim — "Interpret: 32-40
# = Green, 24-31 = Yellow" — so the evaluator knew the exact total the plan needed.
# Naming the desired outcome to a grader is the sycophancy channel: an instruction-
# following model produces a justification for the wanted verdict rather than a
# disinterested measurement, and ambiguity resolves toward passing.
#
# The judge keeps the 1-5 dimension anchors (it still has to score) and may know the
# scale runs to 40. What it may not know is where the cut is. So this forbids band
# WORDS and explicit pass marks, not scoring vocabulary generally.
#
# Non-vacuity is established by self-test rather than by a floor over the repo: the
# pattern is run against a literal known-positive and a literal known-negative every
# time, so "no hits" cannot be produced by a broken regex.
# ===========================================================================
band_bad=0
band_re='[0-9]+[ \t]*-[ \t]*[0-9]+[ \t]*=?[ \t]*(GREEN|YELLOW|ORANGE|RED|Green|Yellow|Orange|Red)|[0-9]+/40|>=[ \t]*3[0-9]'

if ! printf '%s\n' 'Interpret: 32-40 = Green, 24-31 = Yellow, 16-23 = Orange' | grep -qE "$band_re"; then
  fail "PH5-013: band pattern fails its own known-positive — a clean sweep would be vacuous"
  band_bad=1
fi
if printf '%s\n' 'Rate each dimension 1-5 and give reasoning before the score.' | grep -qE "$band_re"; then
  fail "PH5-013: band pattern matches its known-negative — it would flag ordinary scoring vocabulary"
  band_bad=1
fi

# Judge-visible set. Anything the evaluator reads as instructions belongs here.
JUDGE_FILES="plugins/toque/agents/plan-auditor.md"
for jf in $JUDGE_FILES; do
  if [ ! -f "$jf" ]; then
    fail "PH5-013: judge file $jf not found — the subject set is wrong, not the repo clean"
    band_bad=1
    continue
  fi
  hits=$(grep -nE "$band_re" "$jf" || true)
  if [ -n "$hits" ]; then
    band_bad=1
    fail "PH5-013: $jf discloses the pass threshold to the evaluator:"
    printf '%s\n' "$hits" | sed 's/^/           /' | head -10
  fi
done

[ "$band_bad" -eq 0 ] && pass "PH5-013: no pass threshold or score band disclosed in the judge-visible set ($JUDGE_FILES)"

# ===========================================================================
# PH5-010 / acceptance row A3: audit criteria are not in the generator's reach.
#
# plugins/toque/skills/plan/stages/stage-2-design.md is what the Phase 4 generator reads. It carried a full copy of
# the scoring rubric and the gap matrices — the 1-5 anchors, the Scenario Matrix with
# its eight scenarios named, the Cross-Cutting Sweep with its concerns named. A
# generator holding that list writes sections matching the list, which is compliance
# with a checklist rather than thought about the plan in front of it.
#
# The copy was also DIVERGENT, the same species PH5-001 fixed for lint rules: plan.md
# scored 3 as "Adequate, notable gaps (section exists but incomplete)" while
# plan-auditor.md scored it "Section exists but has notable gaps. Stated without
# evidence." Two rubrics, one dimension.
#
# Checked in both directions. Absence alone would be satisfied by deleting the
# criteria outright, so the judge-side presence floor is what makes this a MOVE.
# ===========================================================================
crit_bad=0
anchor_re='^[[:space:]]*[1-5][[:space:]]*=[[:space:]]*[A-Z]'
scen_re='\| *Scenario *\| *Planned\?'
conc_re='\| *Concern *\| *Addressed\?'

# Self-tests: the anchor pattern must fire on a real anchor and stay quiet on prose
# that merely contains a digit and an equals sign.
if ! printf '%s\n' '  5 = Thorough, no gaps (evidence: direct quotes)' | grep -qE "$anchor_re"; then
  fail "PH5-010: anchor pattern fails its known-positive — a clean sweep would be vacuous"
  crit_bad=1
fi
if printf '%s\n' 'Set iterations = 2 when the loop re-runs.' | grep -qE "$anchor_re"; then
  fail "PH5-010: anchor pattern matches its known-negative — it would flag ordinary prose"
  crit_bad=1
fi

# --- generator side: the criteria must be absent -------------------------
GENERATOR_FILES="plugins/toque/skills/plan/SKILL.md plugins/toque/skills/plan/stages/*.md plugins/toque/commands/quick-plan.md plugins/toque/agents/plan-scaffolder.md"
for gf in $GENERATOR_FILES; do
  [ -f "$gf" ] || { fail "PH5-010: generator file $gf not found — the subject set is wrong, not the repo clean"; crit_bad=1; continue; }
  for probe in "$anchor_re:scoring anchor" "$scen_re:Scenario Matrix criteria" "$conc_re:Cross-Cutting criteria"; do
    re="${probe%:*}"; what="${probe##*:}"
    n=$(grep -cE "$re" "$gf" || true)
    if [ "${n:-0}" -gt 0 ]; then
      crit_bad=1
      fail "PH5-010: $gf exposes $what to the generator ($n occurrence(s)) — belongs in the judge-visible set only"
    fi
  done
done

# --- judge side: the criteria must still exist ---------------------------
# Without this the guard would go green on a repo that had simply lost its rubric.
# 8.0.0: the 1-5 anchors are gone with the score. The judge-side floor is now the
# eight review dimensions themselves (numbered H2 headings with their question
# lists), which is where the criteria moved to.
ja=$(grep -cE '^## [1-8]\. ' plugins/toque/agents/plan-auditor.md || true)
if [ "${ja:-0}" -lt 8 ]; then
  crit_bad=1
  fail "PH5-010: plugins/toque/agents/plan-auditor.md holds only ${ja:-0} of 8 review dimensions — the criteria were deleted, not moved"
fi
for probe in "$scen_re:Scenario Matrix" "$conc_re:Cross-Cutting Sweep"; do
  re="${probe%:*}"; what="${probe##*:}"
  if ! grep -qE "$re" plugins/toque/agents/plan-auditor.md; then
    crit_bad=1
    fail "PH5-010: plugins/toque/agents/plan-auditor.md no longer defines the $what — the criteria were deleted, not moved"
  fi
done

[ "$crit_bad" -eq 0 ] && pass "PH5-010: audit criteria absent from the generator set, present in the judge set ($ja dimensions + both matrices)"

# ===========================================================================
# PH5-011 / acceptance row A4: the judge's forbidden inputs are enumerated.
#
# Isolation that lives only in the calling command is isolation nobody can audit.
# The evaluator's own file has to state what it must not read, so the constraint
# travels with the agent and a reviewer can check it in one place.
#
# This is a PRESENCE check, which is the class this repo has been burned by:
# "the file instructs X" is an intent question, and a keyword probe for it stays
# green after the instruction is deleted because the surrounding prose still
# mentions the keyword. Two things make it decidable here:
#
#   1. The block is delimited (<forbidden_inputs>...</forbidden_inputs>), so its
#      presence is structural, not inferred from vocabulary.
#   2. Each entry is anchored on a SENTENCE-INITIAL imperative, "NEVER read:".
#      That is negation-proof by construction — you cannot weaken the rule to
#      "do not never read" without destroying the anchor the count depends on.
#
# The count floor is what stops an empty block from passing.
# ===========================================================================
fi_bad=0
FI_FILE="plugins/toque/agents/plan-auditor.md"
fi_open=$(grep -c '^<forbidden_inputs>$' "$FI_FILE" || true)
fi_close=$(grep -c '^</forbidden_inputs>$' "$FI_FILE" || true)
fi_rules=$(grep -cE '^NEVER read: ' "$FI_FILE" || true)

# Self-test: the anchor must fire on the real form and stay quiet on a negated or
# indented variant, so a weakened rule cannot be counted as a rule.
if ! printf '%s\n' 'NEVER read: the generation transcript' | grep -qE '^NEVER read: '; then
  fail "PH5-011: forbidden-input anchor fails its known-positive — a pass would be vacuous"
  fi_bad=1
fi
if printf '%s\n' '  You should never read the transcript, generally' | grep -qE '^NEVER read: '; then
  fail "PH5-011: forbidden-input anchor matches hedged prose — it would count a non-rule"
  fi_bad=1
fi

if [ "${fi_open:-0}" -ne 1 ] || [ "${fi_close:-0}" -ne 1 ]; then
  fail "PH5-011: $FI_FILE has no delimited <forbidden_inputs> block (open=$fi_open close=$fi_close)"
  fi_bad=1
elif [ "${fi_rules:-0}" -lt 5 ]; then
  fail "PH5-011: $FI_FILE enumerates only ${fi_rules:-0} forbidden inputs — the five isolation-critical ones are transcript, rationale, prior scores, threshold, author identity"
  fi_bad=1
fi

[ "$fi_bad" -eq 0 ] && pass "PH5-011: $FI_FILE enumerates $fi_rules forbidden inputs in a delimited block"

# ===========================================================================
# PH5-012 / acceptance row A4: every audit iteration gets an unused judge.
#
# The revision loop said only "Re-run the audit on the revised spec". Re-running it
# in the same session hands iteration 2 an evaluator that already published a number
# for iteration 1 — it is now checking its own prior judgement, and the cheapest
# consistent story is that the revision fixed what it said was broken. Anchoring on
# a stale score is the whole reason the loop caps at 2 and still drifts.
#
# Stated on both sides so neither alone is load-bearing: the command must spawn a
# new instance, and the agent must refuse prior scores (PH5-011 rule 3). Anchored on
# a sentence-initial imperative for the same negation-proofing reason as PH5-011.
# ===========================================================================
iso_bad=0
ISO_FILE="plugins/toque/skills/plan/stages/stage-2-design.md"
iso_re='^SPAWN A NEW plan-auditor INSTANCE'

if ! printf '%s\n' 'SPAWN A NEW plan-auditor INSTANCE for every audit iteration.' | grep -qE "$iso_re"; then
  fail "PH5-012: respawn anchor fails its known-positive — a pass would be vacuous"
  iso_bad=1
fi
if printf '%s\n' 'Consider whether to spawn a new plan-auditor instance if context is stale.' | grep -qE "$iso_re"; then
  fail "PH5-012: respawn anchor matches hedged prose — it would count a suggestion as a rule"
  iso_bad=1
fi

iso_n=$(grep -cE "$iso_re" "$ISO_FILE" || true)
if [ "${iso_n:-0}" -lt 1 ]; then
  fail "PH5-012: $ISO_FILE does not require a new plan-auditor instance per iteration — re-auditing in session lets iteration 2 anchor on iteration 1's score"
  iso_bad=1
fi

# Cross-side floor: the command's respawn is worth little if the agent will happily
# read the prior audit anyway. That rule is PH5-011's third entry; assert it is still
# there, so removing it cannot leave this guard green.
if ! grep -qE '^NEVER read: scores, verdicts or audit\.md files from a previous iteration' plugins/toque/agents/plan-auditor.md; then
  fail "PH5-012: plugins/toque/agents/plan-auditor.md no longer refuses prior-iteration scores — the respawn alone does not isolate the judge"
  iso_bad=1
fi

[ "$iso_bad" -eq 0 ] && pass "PH5-012: each audit iteration spawns a fresh judge, and the agent refuses prior-iteration scores"

# ===========================================================================
# PH5-014 / acceptance row A5: the verdict schema carries no total, and puts
# evidence before the verdict.
#
# Two separate properties, both structural.
#
# NO TOTAL: if the judge can emit a total it can aim at one. Verdicts are per
# criterion; the caller adds them up. A schema field is the thing that makes this
# enforceable rather than aspirational — there is nowhere to put the number.
#
# FIELD ORDER: a schema that serialises verdict first gets a verdict conditioned on
# nothing, and the evidence that follows is assembled to support it. Emitting
# evidence, then reasoning, then verdict locks the finding before the judgement.
# Order within a JSON example is decidable by line position, so this is checkable
# rather than merely requested.
# ===========================================================================
vs_bad=0
VS_FILE="plugins/toque/agents/plan-auditor.md"
vs_block=$(sed -n '/^<verdict_schema>$/,/^<\/verdict_schema>$/p' "$VS_FILE" 2>/dev/null)
forbidden_key='"(total|total_score|points|points_awarded|pass_threshold|overall)"[[:space:]]*:'

if ! printf '%s\n' '  "total_score": 34,' | grep -qE "$forbidden_key"; then
  fail "PH5-014: forbidden-key pattern fails its known-positive — a pass would be vacuous"
  vs_bad=1
fi
if printf '%s\n' '  "criterion_id": "LINT-03",' | grep -qE "$forbidden_key"; then
  fail "PH5-014: forbidden-key pattern matches an ordinary field — it would reject a valid schema"
  vs_bad=1
fi

if [ -z "$vs_block" ]; then
  fail "PH5-014: $VS_FILE has no delimited <verdict_schema> block"
  vs_bad=1
else
  for k in '"verdict"' '"evidence"' 'MET' 'UNMET' 'N_A'; do
    printf '%s\n' "$vs_block" | grep -qF "$k" \
      || { fail "PH5-014: <verdict_schema> does not mention $k"; vs_bad=1; }
  done

  offending=$(printf '%s\n' "$vs_block" | grep -nE "$forbidden_key" || true)
  if [ -n "$offending" ]; then
    vs_bad=1
    fail "PH5-014: <verdict_schema> gives the judge somewhere to put a total:"
    printf '%s\n' "$offending" | sed 's/^/           /'
  fi

  # Field order: evidence < reasoning < verdict, by first occurrence in the block.
  ln_ev=$(printf '%s\n' "$vs_block" | grep -nF '"evidence"'  | head -1 | cut -d: -f1)
  ln_rs=$(printf '%s\n' "$vs_block" | grep -nF '"reasoning"' | head -1 | cut -d: -f1)
  ln_vd=$(printf '%s\n' "$vs_block" | grep -nF '"verdict"'   | head -1 | cut -d: -f1)
  if [ -z "$ln_ev" ] || [ -z "$ln_rs" ] || [ -z "$ln_vd" ]; then
    fail "PH5-014: <verdict_schema> is missing one of evidence/reasoning/verdict, so order cannot be checked"
    vs_bad=1
  elif [ "$ln_ev" -ge "$ln_rs" ] || [ "$ln_rs" -ge "$ln_vd" ]; then
    fail "PH5-014: <verdict_schema> orders evidence=$ln_ev reasoning=$ln_rs verdict=$ln_vd — must be evidence, then reasoning, then verdict, or the verdict is rationalised rather than derived"
    vs_bad=1
  fi
fi

[ "$vs_bad" -eq 0 ] && pass "PH5-014: verdict schema has no total field and locks evidence before verdict"

# ===========================================================================
# PH5-021 / PH5-022 / acceptance row A22: the records are emitted and kept.
#
# The validator is worthless if its input never exists. PH5-014 defines the record
# shape; these two require the auditor to WRITE the records and the caller to COMMIT
# them, so an audit leaves behind something a later reader can re-check.
#
# Matched as EXACT FULL LINES with grep -qxF, not as regexes. That is a deliberate
# correction: the F06 invocation guard used a regex whose known-positive was invented
# alongside the pattern, so the self-test passed while every real invocation went
# unmatched. A known-positive authored by the same author at the same moment shares
# the blind spot it exists to catch. Literal equality removes the gap entirely —
# the pattern IS the artifact text, so the two cannot diverge and no self-test is
# needed to prove they agree.
#
# Both lines open with a sentence-initial imperative, so they stay negation-proof:
# the rule cannot be softened without destroying the string the check matches.
# ===========================================================================
emit_bad=0
PH5_021_LINE='WRITE one evidence record per criterion to evidence/{criterion_id}.json before reporting anything.'
PH5_022_LINE='COMMIT the evidence directory together with audit.md. An audit whose evidence is not committed did not happen.'

if ! grep -qxF "$PH5_021_LINE" plugins/toque/agents/plan-auditor.md; then
  fail "PH5-021: plugins/toque/agents/plan-auditor.md does not require emitting evidence records — the validator has no input, so the gate cannot open"
  emit_bad=1
fi
if ! grep -qxF "$PH5_022_LINE" plugins/toque/skills/plan/stages/stage-2-design.md; then
  fail "PH5-022: plugins/toque/skills/plan/stages/stage-2-design.md does not require committing the evidence directory — evidence that is not committed cannot be re-checked later"
  emit_bad=1
fi

[ "$emit_bad" -eq 0 ] && pass "PH5-021/022: evidence records are emitted by the auditor and committed by the caller"

# ===========================================================================
# PH5-041 / acceptance row A13: the gate expression contains no score term.
#
# This is the point of the whole change. Phase 5 used to read
# "IF score >= 32 AND gap-checked = YES -> ready to build", authorising passage on
# a number the audited model assigned to itself. The gate now keys on things that
# can be re-derived: the canary was found, evidence survived re-checking, every
# applicable criterion is MET or N_A, and infra gaps are zero.
#
# Scoped to a delimited block rather than banned outright, because the score is
# still legitimately used elsewhere — it gates the WAIVER (PH5-060), and reporting
# it is fine. The asymmetry is deliberate: a gameable signal is safe in the
# direction that ADDS friction (blocking a review waiver) and unsafe in the one
# that removes it (authorising a build). Only the gate expression is policed here.
# ===========================================================================
gate_bad=0
GATE_LINE='PASS = CANARY_OK AND EVIDENCE_OK AND VERIFIED AND INFRA_OK'
gate_block=$(sed -n '/^<gate_expression>$/,/^<\/gate_expression>$/p' plugins/toque/skills/plan/stages/stage-2-design.md 2>/dev/null)

if [ -z "$gate_block" ]; then
  fail "PH5-041: plugins/toque/skills/plan/stages/stage-2-design.md has no delimited <gate_expression> block"
  gate_bad=1
else
  printf '%s\n' "$gate_block" | grep -qxF "$GATE_LINE" \
    || { fail "PH5-041: <gate_expression> does not state the verifier-first PASS expression verbatim"; gate_bad=1; }

  # No score term inside the gate. Checked case-insensitively and including the
  # numeric forms, so "score", "34/40" and ">= 32" are all refused.
  offend=$(printf '%s\n' "$gate_block" | grep -nEi 'score|[0-9]+/40|>=[[:space:]]*[0-9]{2}' || true)
  if [ -n "$offend" ]; then
    gate_bad=1
    fail "PH5-041: <gate_expression> still keys on a score:"
    printf '%s\n' "$offend" | sed 's/^/           /' | head -6
  fi
fi

# The superseded form must be gone, not merely superseded by a newer block below it.
if grep -qE '^IF score (>=|<) [0-9]+' plugins/toque/skills/plan/stages/stage-2-design.md; then
  gate_bad=1
  fail "PH5-041: the score-based gate branch is still present in plugins/toque/skills/plan/stages/stage-2-design.md"
  grep -nE '^IF score (>=|<) [0-9]+' plugins/toque/skills/plan/stages/stage-2-design.md | sed 's/^/           /' | head -4
fi

[ "$gate_bad" -eq 0 ] && pass "PH5-041: the gate keys on canary, evidence, verdicts and infra — not on a score"

# ===========================================================================
# PH5-040 / acceptance row A12: revision feedback names defects, not dimensions.
#
# The loop used to feed back "specific findings with dimension references", which
# hands the generator the scoring structure Wave 1 removed from its view. Telling it
# "Dimension 4 scored 2" invites text shaped like dimension 4; telling it "LINT-03
# UNMET: Phase 2 migration has no rollback step" names a defect it can actually fix.
# ===========================================================================
fb_bad=0
fb_block=$(sed -n '/^<revision_feedback>$/,/^<\/revision_feedback>$/p' plugins/toque/skills/plan/stages/stage-2-design.md 2>/dev/null)
fb_forbidden='dimension|score|/40|points|threshold|GREEN|YELLOW|ORANGE'

if ! printf '%s\n' 'Dimension 4 scored 2 — improve rollback coverage.' | grep -qEi "$fb_forbidden"; then
  fail "PH5-040: forbidden-vocabulary pattern fails its known-positive"
  fb_bad=1
fi
if printf '%s\n' 'LINT-03 UNMET: Phase 2 migration has no rollback step. Location: spec.md:142.' | grep -qEi "$fb_forbidden"; then
  fail "PH5-040: forbidden-vocabulary pattern matches a well-formed defect message"
  fb_bad=1
fi

if [ -z "$fb_block" ]; then
  fail "PH5-040: plugins/toque/skills/plan/stages/stage-2-design.md has no delimited <revision_feedback> block defining what goes back to the generator"
  fb_bad=1
else
  offend=$(printf '%s\n' "$fb_block" | grep -nEi "$fb_forbidden" || true)
  if [ -n "$offend" ]; then
    fb_bad=1
    fail "PH5-040: <revision_feedback> leaks scoring vocabulary back to the generator:"
    printf '%s\n' "$offend" | sed 's/^/           /' | head -6
  fi
fi

[ "$fb_bad" -eq 0 ] && pass "PH5-040: revision feedback carries defects and locations, no scoring vocabulary"

# ===========================================================================
# PH5-060 / row A14: the waiver is conditional on the gate itself being trustworthy.
#
# 8.0.0 removed the numeric score entirely, so the old "borderline score removes
# the waiver" clause is gone with it. What remains: the waiver is only offered
# when the automated gate had nothing wrong with it (no infra gaps, canary
# found, nothing demoted by the evidence validator).
#
# The mirror image of PH5-041, and the reason that guard is scoped to a block
# rather than banning the word outright. The score cannot let a plan pass, but a
# borderline score can remove the owner's ability to skip human review. Same
# number, opposite trust: safe in the direction that adds friction, unsafe in the
# one that removes it. A guard that banned "score" file-wide would have forced an
# exemption here within one wave.
#
# The guard body checks the block STATES all three conditions, not that it merely
# mentions the word "waiver" — a mention survives the rule being deleted.
# ===========================================================================
wv_bad=0
wv_block=$(sed -n '/^<waiver_condition>$/,/^<\/waiver_condition>$/p' plugins/toque/skills/plan/stages/stage-2-design.md 2>/dev/null)
if [ -z "$wv_block" ]; then
  fail "PH5-060: plugins/toque/skills/plan/stages/stage-2-design.md has no delimited <waiver_condition> block"
  wv_bad=1
else
  for term in 'infra_gaps == 0' 'evidence_demotions == 0' 'canary_found == true'; do
    printf '%s\n' "$wv_block" | grep -qF "$term" \
      || { fail "PH5-060: <waiver_condition> does not require: $term"; wv_bad=1; }
  done
fi
[ "$wv_bad" -eq 0 ] && pass "PH5-060: review waiver is blocked by infra gaps, an evidence demotion, or a missed canary"

# ===========================================================================
# PH5-050 / row A15: something looks for what the criteria do not cover.
#
# Every other mechanism makes the judge honest ABOUT the rubric. None of them can
# notice that the rubric is incomplete — a plan can satisfy every criterion and
# still fail for a reason no criterion names. This is the only check on that, and
# it deliberately never gates: its output is a proposed new rule, not a verdict.
# ===========================================================================
hol_bad=0
HOL_LINE='RUN one additional judge with no rubric, no criterion list, and no dimension names.'
grep -qxF "$HOL_LINE" plugins/toque/skills/plan/stages/stage-2-design.md \
  || { fail "PH5-050: plugins/toque/skills/plan/stages/stage-2-design.md does not run a rubric-free pass — nothing checks the criteria for completeness"; hol_bad=1; }
[ -f plugins/toque/docs/planning-techniques/lint-candidates.md ] \
  || { fail "PH5-050: plugins/toque/docs/planning-techniques/lint-candidates.md missing — unmapped findings have nowhere to land"; hol_bad=1; }
[ "$hol_bad" -eq 0 ] && pass "PH5-050: a rubric-free pass runs and its unmapped findings land in lint-candidates.md"

# ===========================================================================
# PH5-051 / row A15 (inverted in 8.0.0, WIDENED in 11.0.0): no scoring
# NOTATION survives anywhere in the planning plugin's live surface.
#
# NOTATION, not vocabulary, and the distinction is the guard's boundary rather
# than a quibble. This matches numerals and named artifacts — "3/5", "X/40",
# scorecard, score_history, the colour bands. It does NOT match the ordinary
# words score, scores, scoring, rating or points, and it must not: METHODOLOGY
# and several technique documents use them correctly, about scoring in general
# or about systems this project only describes.
#
# So a sentence can still say a plan "scores well" and pass here. Three did,
# through the 11.0.0 removal, and were found by reading rather than by this
# guard. That is a known and accepted gap — a word-level pattern would fire on
# every legitimate use and get itself suppressed, which is worse than a narrow
# guard whose limit is written down.
#
# 8.0.0 dropped scoring from the design gate and this guard asserted the removal
# held across three hand-listed paths. That list was the hole. Two commands, an
# agent, three planning-technique docs, two fixtures and METHODOLOGY section 7
# all kept scoring while the guard reported clean, because none was on the list.
#
# The subject set is now DERIVED and the pattern is SELF-TESTED before it is
# trusted. Each alternative earns its place from a real miss:
#   [0-9]+/(40|5)               "36/40", "3/5"
#   ([A-Z]|\{[a-z_]+\})/(40|5)  "X/40", "{total}/40"  - placeholder numerators
#   score_history               a status.json field that never existed
#   scorecard                   the table quick-audit used to render
#   \b(GREEN|YELLOW|ORANGE|RED)\b   word-bounded, so REQUIRED does not match
#   scored [0-9]-[0-9] / 3[0-9]\+/40
#
# METHODOLOGY.md is split by DERIVED header bounds: section 7 is the plan audit
# and is in scope; section 8 onward is the readiness product's letter grades,
# which grade codebases on purpose. A guard reddening on those would break a
# working feature rather than protect this one.
# ===========================================================================
echo ""
echo "--- PH5-051 scoring sweep ---"

SC_RE='[0-9]+/(40|5)\b|([A-Z]|\{[a-z_]+\})/(40|5)\b|score_history|scorecard|\b(GREEN|YELLOW|ORANGE|RED)\b|scored [0-9]-[0-9]|3[0-9]\+/40'
score_bad=0
sc_subjects=0

# Instrument self-test. A sweep whose pattern is unproven reports a clean tree it
# never really checked - the vacuous pass this file guards against elsewhere.
sc_st=0
for probe in 'Score: {total}/40 (GREEN)' 'dimension at 1/5 persists' 'Overall score (X/40), reported only' 'keeps a score_history for trend-watching' 'The scorecard table (8 dimensions)'; do
  printf '%s' "$probe" | grep -qE "$SC_RE" || { fail "PH5-051: pattern missed a known positive: $probe"; sc_st=1; }
done
for probe in 'TESTING METHODOLOGY SELECTION (REQUIRED):' 'GATE: User confirmation REQUIRED.'; do
  printf '%s' "$probe" | grep -qE "$SC_RE" && { fail "PH5-051: pattern matched a known negative: $probe"; sc_st=1; }
done
[ "$sc_st" -eq 0 ] || score_bad=1

if [ "$sc_st" -eq 0 ]; then
  m_a=$(grep -nE '^## 7\.' METHODOLOGY.md 2>/dev/null | head -1 | cut -d: -f1)
  m_b=$(grep -nE '^## 8\.' METHODOLOGY.md 2>/dev/null | head -1 | cut -d: -f1)
  if [ -z "$m_a" ] || [ -z "$m_b" ]; then
    fail "PH5-051: METHODOLOGY section bounds not derivable - the sweep cannot scope itself"
    score_bad=1
  else
    m_hits=$(sed -n "${m_a},$((m_b - 1))p" METHODOLOGY.md | grep -cE "$SC_RE")
    [ "$m_hits" -gt 0 ] && { fail "PH5-051: METHODOLOGY.md section 7 carries $m_hits scoring line(s)"; score_bad=1; }
  fi

  while IFS= read -r sf; do
    # The exclusions that named toque-audit, readability-score and the mutation
    # harness are gone with 11.0.0: the subject glob below is toque-only, so they
    # could never fire again and a dead exclusion reads like a live one.
    case "$sf" in *readiness*) continue ;; esac
    [ -f "$sf" ] || continue
    sc_subjects=$((sc_subjects + 1))
    hits=$(grep -nE "$SC_RE" "$sf" || true)
    [ -n "$hits" ] && { fail "PH5-051: $sf carries scoring vocabulary: $(printf '%s' "$hits" | head -1 | cut -c1-88)"; score_bad=1; }
  done < <(git ls-files 'plugins/toque/*.md' 'plugins/toque/**/*.md' 'tests/fixtures/plan-*/status.json' 2>/dev/null)

  if [ "$sc_subjects" -lt 20 ]; then
    fail "PH5-051: derived only $sc_subjects subjects (expected >= 20) - the derivation collapsed, so a pass here is vacuous"
    score_bad=1
  fi
fi

[ "$score_bad" -eq 0 ] && pass "PH5-051: no scoring notation in the planning plugin ($sc_subjects subjects swept, pattern self-tested)"

# ===========================================================================
# 16R. Root-doc conformance (§9.2, class G) — the root-level docs.
#
# The per-plugin core pass sweeps each plugin's README and GUIDE; the files at
# the repo root (README, METHODOLOGY, CONTRIBUTING) belong to no plugin, so the
# same claims are policed here. The subject set is DERIVED — every tracked
# root-level .md except the CHANGELOG, which describes old versions truthfully
# in the past tense — with a floor so the derivation cannot collapse silently.
# ===========================================================================
echo ""
echo "--- Root-doc conformance (§9.2) ---"

DOC_FILES=$(git ls-files '*.md' 2>/dev/null | grep -v '/' | grep -v '^CHANGELOG\.md$' | tr '\n' ' ')
doc_count=$(echo $DOC_FILES | wc -w | tr -d ' ')
if [ "$doc_count" -lt 2 ]; then
  fail "§9.2: derived only $doc_count root-level doc(s) — the derivation is broken, not the docs clean"
fi

# claim_absent <label> <extended-regex> — the claim must appear NOWHERE, except on a
# line that explicitly marks it as removed, historical, or a defect.
claim_absent() {
  local label=$1 re=$2 hits
  hits=$(grep -rniE "$re" $DOC_FILES 2>/dev/null \
         | grep -viE 'no longer|removed in|was removed|reversed in|until 5\.0\.0|earlier revision|previously|used to|old design|defect|not used at all|deleted in')
  if [ -n "$hits" ]; then
    fail "§9.2: $label — still asserted as current: $(echo "$hits" | head -1 | cut -c1-110)"
    return 1
  fi
  pass "§9.2: $label"
}

conf_bad=0
claim_absent "root docs: no zero/no required dependencies claim" \
  '(zero|no) required dependenc|zero-dependency (plugin|design is)|dependencies: *none|\*\*required:\*\* *none' || conf_bad=1
claim_absent "root docs: no jq/grep+sed fallback ladder as current" \
  'falls? back to (grep|`grep`)|jq with grep|grep\+sed fallback|tries `?jq`? first|jq is optional' || conf_bad=1
claim_absent "root docs: no hooks-inline-in-plugin.json claim" \
  'hooks are (defined |declared )?inline|inline hook definitions|inline in .?plugin\.json' || conf_bad=1
claim_absent "root docs: no reference to a deleted .sh handler" \
  'scripts/tq-[a-z-]+\.sh' || conf_bad=1
claim_absent "root docs: no untrue force-with-lease claim" \
  'does not block .?--force-with-lease.? \(untrue\)' || conf_bad=1

# F04's two root-level halves, mirrored from core §9: the root docs are read by
# the same users and can reintroduce the same false claims.
root_auto=$(grep -ln "picks up changes automatically" $DOC_FILES 2>/dev/null | head -1)
if [ -n "$root_auto" ]; then
  fail "F04: false auto-update claim present in root doc $root_auto"
else
  pass "F04: no 'picks up changes automatically' claim in root docs"
fi
root_bare=$(grep -nE "/plugin install (toque|toque-readiness|toque-audit)([[:space:]]|\$)" $DOC_FILES 2>/dev/null | head -1)
if [ -n "$root_bare" ]; then
  fail "F04: unqualified install command in a root doc (missing @toque-marketplace): $root_bare"
else
  pass "F04: all install commands in root docs are marketplace-qualified"
fi

echo ""
echo "--- Split invariants ---"

# SPLIT-1 is retired. It held toque's self-audit-knowledge skill byte-identical
# to the mirror toque-audit shipped so each plugin could resolve the skill under
# its own namespace. That plugin was removed in 11.0.0 and took the mirror with
# it, so there is no second copy in this tree to drift against. A guard that
# cannot see its subject reports a pass it did not earn, so this one is retired
# rather than kept limping; CONTRIBUTING.md records what is no longer checked.

# ===========================================================================
# SPLIT-2: version lockstep across every plugin manifest.
#
# The release script enforces this at release time; this copy enforces it on
# every suite run, so a drifted manifest is caught in the PR that drifts it
# rather than on release day. The count is EXACTLY one (four until toque-guard
# was retired in 9.0.0, three until toque-audit and toque-readiness were
# removed in 11.0.0) — adding or removing a plugin is a deliberate decision that
# must update this number in the same commit.
#
# The lockstep comparison is trivially satisfied at a count of one. It is kept
# anyway: the count assertion is what has teeth now, and the moment a second
# plugin reappears the version check is already in place to catch it drifting.
# ===========================================================================
split_manifests=$(git ls-files '*/.claude-plugin/plugin.json')
split_mcount=$(echo "$split_manifests" | grep -c . || true)
if [ "$split_mcount" -ne 1 ]; then
  fail "SPLIT-2: found $split_mcount plugin manifests, expected exactly 1"
else
  split_vers=$(for m in $split_manifests; do
    grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$m" | head -1 | sed 's/.*"\([0-9][^"]*\)"$/\1/'
  done | sort -u)
  if [ "$(echo "$split_vers" | grep -c .)" -ne 1 ]; then
    fail "SPLIT-2: version lockstep broken across manifests: $(echo $split_vers | tr '\n' ' ')"
  else
    pass "SPLIT-2: the single plugin manifest is at $split_vers"
  fi
fi

# ===========================================================================
# SPLIT-3: every namespaced reference resolves to a file that exists.
#
# Until 11.0.0 this checked references ACROSS plugin boundaries — a
# `/toque-audit:codebase-audit` written inside toque was a claim about another
# plugin's directory, and nothing else verified it. Those namespaces left with
# their plugins, so the pattern is now single-namespace and the guard proves
# the narrower thing that remains true: every `/toque:x` written anywhere in
# the tree names a command or skill that is actually shipped.
#
# Retargeting rather than retiring is deliberate. The cross-plugin half is
# gone, but the failure it caught — a rename landing in one file and not the
# eleven that reference it — is unchanged, and help.md alone carries most of
# those references.
#
# Subjects: every tracked .md under plugins/ plus the root README. docs/plans
# and the CHANGELOG are historical records; docs/specs quote old namespaces by
# design.
# ===========================================================================
ns_re='toque:[a-z][a-z0-9-]*'

# Self-tests. The known-positive is drawn from the LIVE artifact (help.md), not
# authored here — a known-positive written alongside the pattern shares its
# blind spots (the F06 lesson). The known-negative proves the resolver can
# refuse: a real namespace with a sibling's command name must NOT resolve.
ns_kp=$(grep -ohE "$ns_re" plugins/toque/commands/help.md 2>/dev/null | grep -m1 '^toque:')
if [ -z "$ns_kp" ]; then
  fail "SPLIT-3: extractor finds no namespaced token in help.md, which maps every command — the pattern collapsed, so a clean sweep would be vacuous"
fi
ns_resolves() {  # ns_resolves <ns> <name> -> 0 if the name exists in that plugin
  [ -f "plugins/$1/commands/$2.md" ] || [ -f "plugins/$1/skills/$2/SKILL.md" ]
}
# The known-negative proves the resolver can still refuse. codebase-audit is a
# real command name that this repository no longer ships, which makes it a
# sharper negative than an invented string: it is exactly what a stale reference
# to the departed plugins would look like.
if ns_resolves "toque" "codebase-audit"; then
  fail "SPLIT-3: resolver accepts toque:codebase-audit, a command this repo no longer ships — it can no longer refuse anything"
fi

ns_bad=0
ns_total=0
while IFS= read -r tok; do
  [ -n "$tok" ] || continue
  ns_total=$((ns_total + 1))
  ns=${tok%%:*}
  name=${tok#*:}
  if ! ns_resolves "$ns" "$name"; then
    fail "SPLIT-3: '$tok' resolves to neither plugins/$ns/commands/$name.md nor plugins/$ns/skills/$name/SKILL.md"
    ns_bad=1
  fi
done < <(git ls-files -z 'plugins/*.md' 'README.md' 2>/dev/null | xargs -0 grep -hoE "$ns_re" 2>/dev/null | sort -u)

if [ "$ns_total" -lt 10 ]; then
  fail "SPLIT-3: only $ns_total distinct namespaced references derived (expected >= 10) — the subject set collapsed, so a pass would be vacuous"
elif [ "$ns_bad" -eq 0 ]; then
  pass "SPLIT-3: all $ns_total distinct namespaced references resolve within their declared plugin"
fi

# ===========================================================================
# SPLIT-4: the catalog entries stay INSTALLABLE.
#
# `claude plugin validate` accepts any well-formed source, and the suite's
# static checks accept any spelling of a path — so the v7.0.0 catalog shipped
# green while being uninstallable for every user without GitHub SSH keys. The
# `github` source type resolves to `git@github.com:` at install time; the
# marketplace itself clones over https, so `marketplace add` succeeded and
# every `plugin install` then failed with "Permission denied (publickey)".
# Nothing was malformed. Nothing caught it. It was found by installing.
#
# What this asserts is therefore the SHAPE the install path needs, not the
# shape a validator accepts:
#   - git-subdir + an explicit https:// url — the documented form that clones
#     without SSH and still honours path/ref/sha
#   - path points at a real plugin directory in THIS repo
#   - ref looks like a release tag, sha is a full 40-hex commit
#
# ref is NOT compared against the manifest version: the pin legitimately lags
# during a release (it is repinned after the tag exists), which release.sh
# surfaces as a warning. Encoding "pin == manifests" here would fail the suite
# in the middle of every release, and a check that must be bypassed on release
# day is the 5.0.0 process again.
# ===========================================================================
cat_bad=0
CATALOG=".claude-plugin/marketplace.json"
if [ ! -f "$CATALOG" ]; then
  fail "SPLIT-4: $CATALOG is missing — the marketplace is the install surface"
elif ! command -v jq >/dev/null 2>&1; then
  fail "SPLIT-4: jq is unavailable — the catalog shape cannot be checked, and silence here is not a pass"
else
  # Self-test: the extractor must actually read entries out of THIS file, or
  # every per-entry assertion below sweeps an empty set and reports clean.
  cat_n=$(jq '.plugins | length' "$CATALOG" 2>/dev/null | tr -d '\r')
  if [ "${cat_n:-0}" -ne 1 ]; then
    fail "SPLIT-4: catalog lists ${cat_n:-0} plugins, expected exactly 1 — an addition (or a removal) is a deliberate decision that updates this number"
    cat_bad=1
  fi

  # Entry names must be exactly the four plugin directories. A catalog naming
  # a plugin that does not ship (or omitting one that does) installs nothing
  # useful, and no other check compares these two sets.
  cat_names=$(jq -r '.plugins[].name' "$CATALOG" 2>/dev/null | tr -d '\r' | sort)
  dir_names=$(git ls-files '*/.claude-plugin/plugin.json' | sed 's|^plugins/||; s|/.claude-plugin/plugin.json$||' | sort)
  if [ "$cat_names" != "$dir_names" ]; then
    fail "SPLIT-4: catalog entry names and plugin directories differ (catalog: $(echo $cat_names | tr '\n' ' '); dirs: $(echo $dir_names | tr '\n' ' '))"
    cat_bad=1
  fi

  while IFS=$'\t' read -r c_name c_src c_url c_path c_ref c_sha; do
    [ -n "$c_name" ] || continue
    case "$c_src" in
      git-subdir) ;;
      *) fail "SPLIT-4: $c_name uses source type '$c_src' — only git-subdir clones over the url it is given; 'github' resolves to SSH at install time and fails for users without keys"; cat_bad=1 ;;
    esac
    case "$c_url" in
      https://*) ;;
      *) fail "SPLIT-4: $c_name url '$c_url' is not https:// — an SSH or shorthand url requires keys the installing user may not have"; cat_bad=1 ;;
    esac
    if [ ! -f "$c_path/.claude-plugin/plugin.json" ]; then
      fail "SPLIT-4: $c_name path '$c_path' has no plugin manifest in this repo — the entry points at nothing installable"
      cat_bad=1
    fi
    echo "$c_ref" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$' \
      || { fail "SPLIT-4: $c_name ref '$c_ref' is not a release tag (vX.Y.Z)"; cat_bad=1; }
    echo "$c_sha" | grep -qE '^[0-9a-f]{40}$' \
      || { fail "SPLIT-4: $c_name sha '$c_sha' is not a full 40-character commit — a short or absent sha is not a pin"; cat_bad=1; }
    # `// "(absent)"` on every field, because tab is IFS WHITESPACE: bash
    # collapses a run of tabs into one delimiter, so a null field (a `github`
    # entry has no url) shifts every later column left and the check reports
    # the wrong field as malformed. It still failed — with three misdiagnosed
    # messages. A guard that fires for the wrong stated reason sends the next
    # reader to the wrong line.
  done < <(jq -r '.plugins[] | [(.name // "(absent)"), (.source.source // "(absent)"), (.source.url // "(absent)"), (.source.path // "(absent)"), (.source.ref // "(absent)"), (.source.sha // "(absent)")] | @tsv' "$CATALOG" 2>/dev/null | tr -d '\r')

  # All four entries share one pin: the release is atomic, so a split pin means
  # a user can install two plugins from two different releases of a lockstep set.
  cat_pins=$(jq -r '.plugins[] | "\(.source.ref) \(.source.sha)"' "$CATALOG" 2>/dev/null | tr -d '\r' | sort -u)
  if [ "$(echo "$cat_pins" | grep -c .)" -ne 1 ]; then
    fail "SPLIT-4: catalog entries do not share one ref+sha pin: $(echo $cat_pins | tr '\n' ' ')"
    cat_bad=1
  fi

  [ "$cat_bad" -eq 0 ] && pass "SPLIT-4: all $cat_n catalog entries are git-subdir over https, resolve to real plugin dirs, and share one release pin"
fi

# ===========================================================================
# PH5-052: the documented flag vocabulary matches the flags the code emits.
#
# WHY THIS EXISTS. 11.0.0 deleted EVIDENCE-COMMAND-FAILED, added four flags, and
# changed what EVIDENCE-UNEXECUTED means. Two documents list those flags for a
# reader: the GUIDE's table and stage-2-design.md's inline list, which is what an
# agent reads mid-workflow to interpret a validator run. Both kept describing the
# old set, including a flag that no longer exists and a trigger that had changed.
# Nothing noticed, because a flag table is prose and prose is not executed.
#
# The failure is worse than cosmetic. A reader who sees EVIDENCE-COMMAND-FAILED
# in the list and never in a run concludes the check is not firing. A reader who
# hits EVIDENCE-UNPINNED and cannot find it documented concludes the tool is
# broken. Both send the next person to the wrong place.
#
# The derivation is one-way-safe: flags come FROM the code, never from the docs,
# so a flag that is deleted from the source disappears from the subject set and a
# flag added to a document without a source counterpart is caught by the reverse
# check below.
# ===========================================================================
echo ""
echo "--- Evidence flag vocabulary (PH5-052) ---"

FLAG_SRC="plugins/toque/scripts/tq-evidence-validate.js"
FLAG_DOCS="plugins/toque/GUIDE.md plugins/toque/skills/plan/stages/stage-2-design.md"
flag_bad=0

# Self-test FIRST. An extractor that finds nothing turns this whole check into a
# clean report about an empty set — the exact shape of the F07 defect this suite
# has already shipped once.
flag_probe=$(printf "%s\n" "  flags.push('EVIDENCE-EXAMPLE-ONE');" | grep -oE "EVIDENCE-[A-Z-]+")
if [ "$flag_probe" != "EVIDENCE-EXAMPLE-ONE" ]; then
  fail "PH5-052: flag extractor fails its known-positive — the sweep would be vacuous"
  flag_bad=1
fi
if printf '%s\n' "the word EVIDENCE alone" | grep -qE "EVIDENCE-[A-Z-]+"; then
  fail "PH5-052: flag extractor matches a bare mention — it would invent flags"
  flag_bad=1
fi

if [ "$flag_bad" -eq 0 ]; then
  flags_in_code=$(grep -oE "'EVIDENCE-[A-Z-]+'" "$FLAG_SRC" 2>/dev/null | tr -d "'" | sort -u)
  flag_n=$(printf '%s\n' "$flags_in_code" | grep -c .)

  # Floor: the validator has never had fewer than eight distinct flags, and a
  # collapsed extractor reporting two would otherwise sweep clean.
  if [ "$flag_n" -lt 8 ]; then
    fail "PH5-052: derived only $flag_n flags from $FLAG_SRC (expected >= 8) — the extractor is broken, not the code"
    flag_bad=1
  else
    for fdoc in $FLAG_DOCS; do
      if [ ! -f "$fdoc" ]; then
        fail "PH5-052: $fdoc is missing — the flag vocabulary is undocumented"
        flag_bad=1
        continue
      fi
      # Forward: every flag the code can emit is documented.
      for fl in $flags_in_code; do
        grep -qF "$fl" "$fdoc" \
          || { fail "PH5-052: $fdoc does not document $fl, which the validator emits"; flag_bad=1; }
      done
      # Reverse: every flag the document names still exists in the code. This is
      # the direction that caught EVIDENCE-COMMAND-FAILED outliving its removal.
      for fl in $(grep -oE "EVIDENCE-[A-Z-]+" "$fdoc" | sort -u); do
        printf '%s\n' "$flags_in_code" | grep -qx "$fl" \
          || { fail "PH5-052: $fdoc documents $fl, which the validator can no longer emit"; flag_bad=1; }
      done
    done
  fi
  [ "$flag_bad" -eq 0 ] && pass "PH5-052: all $flag_n validator flags are documented, and no document names a flag the code cannot emit"
fi

# ===========================================================================
# INTEROP: the optional inputs Toque reads but does not write.
#
# Until 11.0.0 the producers were sibling plugins here and this swept both
# directions: a stale row failed, and so did an undocumented edge. Those plugins
# left the repository, and with them any way to check that anything still writes
# these files.
#
# The consumer half is worth keeping precisely because the other half went away.
# With no producer in the tree, a toque file quietly reading docs/audit/foo.md
# has nothing to keep it honest — the path never appears in any test run, so a
# typo reads exactly like a project that was never analysed. These checks are
# what still notices.
#
#   INTEROP-1  every reader named in interop.md exists and still reads its path.
#   INTEROP-2  every docs/audit/ path a toque functional file reads has a row or
#              is declared one of Toque's own, and every row has a live reader.
#
# INTEROP-3 is RETIRED. It validated readability-score.json against its
# producer's schema block and a fixture derived from a live scan. Toque never
# read that artifact, and the producer is not here to have a schema. A revised
# version briefly asserted that every producer cell named a foreign repository;
# that column is gone too, so there is nothing left for it to hold. Its number
# is not reused — a renumbered guard makes old failure reports mean the wrong
# thing.
#
# Subjects are FUNCTIONAL files only (commands/, agents/, skills/, scripts/):
# README/GUIDE mentions are description, not consumption — the (since retired)
# guard README once shipped a whole output-table row describing a sibling's
# writer, which is exactly why prose does not count as a read.
# ===========================================================================
echo ""
echo "--- Optional inputs (INTEROP-1/2) ---"

INTEROP_DOC="interop.md"
# The character class includes '*' so a GLOB is a subject too. Without it,
# troubleshoot/SKILL.md's fallback read of docs/audit/impact-review-*.md was
# invisible: a real input, undocumented, with INTEROP-1 and INTEROP-2 both green
# and a comment above them claiming every functional read was derived.
it_path_re='docs/audit/[A-Za-z0-9_.*/-]*\.(json|md)'

# Instrument self-tests: the extractor must fire on a real spelling and stay
# quiet on a directory-only mention, or the derived set silently collapses.
if [ "$(printf 'see docs/audit/foo-bar.md now' | grep -oE "$it_path_re")" != "docs/audit/foo-bar.md" ]; then
  fail "INTEROP: path extractor fails its known-positive — the derived set would be vacuous"
fi
if printf 'the docs/audit/readability/ directory' | grep -qE "$it_path_re"; then
  fail "INTEROP: path extractor matches a bare directory mention — it would count non-artifacts as reads"
fi
if [ "$(printf 'ls docs/audit/impact-review-*.md' | grep -oE "$it_path_re")" != 'docs/audit/impact-review-*.md' ]; then
  fail "INTEROP: path extractor cannot see a glob — a wildcard read would go undocumented, which is how one already did"
fi

if [ ! -f "$INTEROP_DOC" ]; then
  fail "INTEROP: $INTEROP_DOC is missing — the optional inputs are undocumented"
else
  # --- INTEROP-1: every documented reader exists and still reads its path.
  it_rows=0
  it_bad=0
  while IFS='|' read -r _ it_art it_cons _; do
    it_art=$(echo "$it_art" | tr -d ' ')
    [ -n "$it_art" ] || continue
    it_rows=$((it_rows + 1))
    for it_c in $(echo "$it_cons" | tr ',' ' '); do
      if [ ! -f "$it_c" ]; then
        fail "INTEROP-1: reader $it_c (for $it_art) does not exist"
        it_bad=1
      elif ! grep -qF "$it_art" "$it_c"; then
        fail "INTEROP-1: reader $it_c no longer mentions $it_art — stale row, or the file moved off the input"
        it_bad=1
      fi
    done
  done < <(grep -E '^\| docs/' "$INTEROP_DOC")

  if [ "$it_rows" -lt 8 ]; then
    fail "INTEROP-1: only $it_rows rows parsed from $INTEROP_DOC (expected >= 8) — the parser or the table collapsed"
  elif [ "$it_bad" -eq 0 ]; then
    pass "INTEROP-1: all $it_rows documented inputs have live readers that still read them"
  fi

  # --- INTEROP-2: the derived read-set equals the documented one.
  #     Derived = every docs/audit/ path any toque functional file references.
  #     Documented = table rows plus Toque's own paths, parsed out of interop.md
  #     rather than repeated here so there is one place to edit.
  it_derived=$(mktemp)
  git ls-files -z 'plugins/toque/commands/*' 'plugins/toque/agents/*' \
                  'plugins/toque/skills/*' 'plugins/toque/scripts/*' 2>/dev/null \
    | xargs -0 -r grep -ohE "$it_path_re" 2>/dev/null | sort -u > "$it_derived"

  it_documented=$(mktemp)
  {
    grep -E '^\| docs/' "$INTEROP_DOC" | awk -F'|' '{gsub(/ /,"",$2); print $2}'
    awk '/^## Toque.s own paths/,/^## Not inputs/' "$INTEROP_DOC" \
      | grep -oE "$it_path_re"
  } | sort -u > "$it_documented"

  it_derived_n=$(grep -c . "$it_derived" || true)
  if [ "$it_derived_n" -lt 8 ]; then
    fail "INTEROP-2: derived only $it_derived_n docs/audit paths from toque (expected >= 8) — the derivation is broken, not the tree"
  else
    it2_bad=0
    while IFS= read -r it_miss; do
      [ -n "$it_miss" ] || continue
      fail "INTEROP-2: toque reads $it_miss but it has no row and is not declared one of Toque's own in $INTEROP_DOC"
      it2_bad=1
    done < <(comm -23 "$it_derived" "$it_documented")
    while IFS= read -r it_stale; do
      [ -n "$it_stale" ] || continue
      fail "INTEROP-2: $INTEROP_DOC lists $it_stale but no toque file reads it — delete or update the row"
      it2_bad=1
    done < <(comm -13 "$it_derived" "$it_documented")
    [ "$it2_bad" -eq 0 ] && pass "INTEROP-2: toque's derived docs/audit read-set ($it_derived_n paths) exactly matches the documented list"
  fi
  rm -f "$it_derived" "$it_documented"
fi

# ===========================================================================
# PH5-042: ONE design gate (the spec row "Same gate in commands/quick-audit.md
# and commands/quick-plan.md", docs/specs/phase5-verifier-gate.md §6).
#
# quick-plan.md claimed "the same gate as Stage 2" for two releases while
# spawning the auditor on its own terms, with no canary and no evidence
# validation; quick-audit had no gate at all. A lighter copy of a gate is the
# route around it, and the route around is the one that gets used.
#
# The gate is defined once, inside a delimited <design_gate> block in the
# Stage 2 file, and the two shortcuts run that block by reference. Decidable by
# grep: the block exists and carries the executable pieces; each shortcut
# carries the execute-by-reference directive (checked with CR stripped and lines
# joined, so a wrap or a Windows checkout cannot hide it); neither shortcut
# carries a second copy of the gate expression, spawns the auditor itself, or
# invokes the canary tool itself. A prose mention of tq-canary.js is allowed;
# an invocation (inject/detected) is not.
# ===========================================================================
echo ""
echo "--- One design gate (PH5-042) ---"

DG_STAGE="plugins/toque/skills/plan/stages/stage-2-design.md"
dg_block=$(sed -n '/^<design_gate>$/,/^<\/design_gate>$/p' "$DG_STAGE" 2>/dev/null)
dg_bad=0
if [ -z "$dg_block" ]; then
  fail "PH5-042: $DG_STAGE has no delimited <design_gate> block"
  dg_bad=1
else
  for piece in 'tq-canary.js" inject' 'tq-canary.js" detected' 'tq-evidence-validate.js' '<gate_expression>' '<revision_feedback>' '{gate_dir}' '{doc}' '{generator}' 'no canary class could be applied'; do
    printf '%s\n' "$dg_block" | grep -qF -- "$piece" \
      || { fail "PH5-042: <design_gate> block does not contain '$piece' — the shared block is missing part of the gate"; dg_bad=1; }
  done
  # The human review gate is Stage 2's own decision, not part of the shared gate.
  if printf '%s\n' "$dg_block" | grep -qF '<waiver_condition>'; then
    fail "PH5-042: <design_gate> block contains the review waiver — that belongs to Stage 2, not to every caller"
    dg_bad=1
  fi
fi
# Self-test the directive pattern on its known-positive and known-negative before trusting it.
dg_re='stages/stage-2-design\.md` and execute +its `<design_gate>` block, verbatim'
printf '%s\n' 'Read `${CLAUDE_PLUGIN_ROOT}/skills/plan/stages/stage-2-design.md` and execute' 'its `<design_gate>` block, verbatim, with these bindings:' \
  | tr '\n' ' ' | grep -qE "$dg_re" || { fail "PH5-042: directive pattern misses its known-positive — the guard would be vacuous"; dg_bad=1; }
printf '%s\n' 'See stages/stage-2-design.md for the <design_gate> block.' | tr '\n' ' ' | grep -qE "$dg_re" \
  && { fail "PH5-042: directive pattern matches a bare mention — it would pass a shortcut that only names the block"; dg_bad=1; }
for cmd in plugins/toque/commands/quick-plan.md plugins/toque/commands/quick-audit.md; do
  tr -d '\r' < "$cmd" | tr '\n' ' ' | grep -qE "$dg_re" \
    || { fail "PH5-042: $cmd does not execute the Stage 2 <design_gate> block by reference"; dg_bad=1; }
  if grep -qF 'PASS = CANARY_OK' "$cmd"; then
    fail "PH5-042: $cmd carries its own copy of the gate expression — two definitions drift"
    dg_bad=1
  fi
  if grep -qE 'tq-canary\.js"? +(inject|detected)' "$cmd"; then
    fail "PH5-042: $cmd invokes the canary itself instead of running the shared block"
    dg_bad=1
  fi
  if grep -qiE '^Spawn the plan-auditor' "$cmd"; then
    fail "PH5-042: $cmd spawns the auditor on its own terms instead of running the shared block"
    dg_bad=1
  fi
done
# The auditor side of the same decision: no caller gets a mode that writes no evidence.
grep -qF 'There is no conversation-only mode' plugins/toque/agents/plan-auditor.md \
  || { fail "PH5-042: plan-auditor.md no longer states that there is no conversation-only mode"; dg_bad=1; }
if grep -qF 'present in conversation (no file)' plugins/toque/agents/plan-auditor.md; then
  fail "PH5-042: plan-auditor.md has a conversation-only mode again — a report with no evidence directory cannot be re-checked"
  dg_bad=1
fi
tr -d '\r' < .gitignore | grep -qxF '**/.canary/' \
  || { fail "PH5-042: .gitignore does not ignore .canary/ wherever a gate folder can appear"; dg_bad=1; }
[ "$dg_bad" -eq 0 ] && pass "PH5-042: the design gate is defined once in Stage 2 and executed by reference from quick-plan and quick-audit"

# ===========================================================================
# REL-1: authorization and release are two events (decision D4).
#
# Stage 5 forbade running a release and then wrote deploy.status = complete and
# printed "Released" at authorization. The record claimed something nobody had
# observed. Decidable by grep: the stage records released_at in a separate step,
# leaves the stage "authorized" until then, and the plan skill documents both
# fields; the pre-D4 shape ("phases.deploy.status -> complete" in the same
# breath as authorization) is refused.
# ===========================================================================
echo ""
echo "--- Two release events (REL-1) ---"
S5="plugins/toque/skills/plan/stages/stage-5-deploy.md"
PSK="plugins/toque/skills/plan/SKILL.md"
rel_bad=0
for must in 'phases.deploy.status -> authorized' 'released_at' 'released_by' '## Step E: Release confirmation'; do
  grep -qF -- "$must" "$S5" || { fail "REL-1: $S5 lacks '$must'"; rel_bad=1; }
done
for must in 'released_at' 'authorized_at'; do
  grep -qF -- "$must" "$PSK" || { fail "REL-1: $PSK does not document '$must'"; rel_bad=1; }
done
if grep -qF 'After authorization is recorded, update manifest.md with final status' "$S5"; then
  fail "REL-1: $S5 marks the release final at authorization again"
  rel_bad=1
fi
[ "$rel_bad" -eq 0 ] && pass "REL-1: Stage 5 records authorization and release as two events"

# ===========================================================================
# KB-1: a knowledge-base match is a lead, not a fix (decision D6).
#
# Step 0.2 offered "Apply the same fix?" on a HIGH match before Phase 1,
# against the skill's own Iron Law. Decidable by grep.
# ===========================================================================
echo ""
echo "--- KB match is a lead (KB-1) ---"
TS="plugins/toque/skills/troubleshoot/SKILL.md"
kb_bad=0
if grep -qF 'Apply the same fix' "$TS"; then
  fail "KB-1: $TS offers to re-apply a knowledge-base fix before root-cause investigation"
  kb_bad=1
fi
grep -qF 'first hypothesis' "$TS" || { fail "KB-1: $TS does not present a HIGH match as Phase 1's first hypothesis"; kb_bad=1; }
grep -qF 'NO PERMANENT FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST' "$TS" || { fail "KB-1: the Iron Law is gone from $TS"; kb_bad=1; }
[ "$kb_bad" -eq 0 ] && pass "KB-1: a knowledge-base match is a lead for Phase 1, not a fix to re-apply"

# ===========================================================================
# RESULTS (part subtotal — the dispatcher owns the anchored Results line)
# ===========================================================================
echo "==========================================="
echo "Subtotal (repo): $PASS passed, $FAIL failed, $WARN warnings"
echo "==========================================="

if [ -n "${TQ_COUNTS_FILE:-}" ]; then
  printf 'repo %s %s\n' "$PASS" "$FAIL" >> "$TQ_COUNTS_FILE"
fi

if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
