#!/usr/bin/env bash
# ============================================================================
# Toque Plugin: Layer 3 - Fixture Lint Tests
#
# Tests lint rules against fixture plans with known gaps.
# Each fixture is a plan with specific, deliberate defects.
# A test PASSES when the lint detection logic correctly identifies the gap.
# A test FAILS when the lint detection logic misses a known gap (broken logic).
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="${SCRIPT_DIR}/fixtures"

PASS_COUNT=0
FAIL_COUNT=0

# --- Helpers ----------------------------------------------------------------

pass() {
  echo "[PASS] $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "[FAIL] $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# Portable JSON value extraction.
# Uses jq when available, otherwise falls back to grep/sed.
json_array_filter() {
  local file="$1"
  local impact="$2"
  local status="$3"
  if command -v jq &>/dev/null; then
    jq -r --arg imp "$impact" --arg st "$status" \
      '[.assumptions[] | select(.impact == $imp and .status == $st)] | length' \
      "$file"
  else
    # Fallback: count lines matching both values between assumption array braces.
    # This is intentionally conservative — works for the fixture format.
    local count=0
    local in_assumption=0
    local found_impact=0
    local found_status=0
    while IFS= read -r line; do
      if echo "$line" | grep -q '"impact"' && echo "$line" | grep -q "\"$impact\""; then
        found_impact=1
      fi
      if echo "$line" | grep -q '"status"' && echo "$line" | grep -q "\"$status\""; then
        found_status=1
      fi
      # Each assumption object ends with "}" — when we hit one, check accumulators
      if echo "$line" | grep -q '}'; then
        if [[ $found_impact -eq 1 && $found_status -eq 1 ]]; then
          count=$((count + 1))
        fi
        found_impact=0
        found_status=0
      fi
    done < "$file"
    echo "$count"
  fi
}

json_field() {
  local file="$1"
  local field="$2"
  if command -v jq &>/dev/null; then
    jq -r "$field" "$file"
  else
    # Simple fallback for boolean/string fields
    grep -o "\"$(echo "$field" | sed 's/.*\.//')\"[[:space:]]*:[[:space:]]*[a-z\"]*" "$file" \
      | head -1 | sed 's/.*:[[:space:]]*//' | tr -d '"'
  fi
}

# ============================================================================
# TEST EXECUTION
# ============================================================================

echo "=== Toque Plugin: Layer 3 - Fixture Lint Tests ==="
echo ""

# ---------------------------------------------------------------------------
# Fixture: plan-all-passing (control)
# ---------------------------------------------------------------------------
echo "--- Fixture: plan-all-passing (control) ---"

FIXTURE="${FIXTURES_DIR}/plan-all-passing"
STATUS="${FIXTURE}/status.json"
APPROACH="${FIXTURE}/approach.md"

# LINT-08: Assumption Verification Gate
unverified_high=$(json_array_filter "$STATUS" "HIGH" "unverified")
if [[ "$unverified_high" -eq 0 ]]; then
  pass "LINT-08: No unverified HIGH assumptions (0 found)"
else
  fail "LINT-08: Expected 0 unverified HIGH assumptions, got $unverified_high"
fi

# LINT-13: Options Analysis Matrix
has_options=0
option_count=0
has_rationale=0

if grep -qi "Options Analysis\|Options Considered" "$APPROACH" 2>/dev/null; then
  has_options=1
fi
option_count=$(grep -c "^#### Option" "$APPROACH" 2>/dev/null || true)
option_count=${option_count:-0}
if grep -qi "Decision Rationale\|Why rejected" "$APPROACH" 2>/dev/null; then
  has_rationale=1
fi

if [[ $has_options -eq 1 && $option_count -ge 2 && $has_rationale -eq 1 ]]; then
  pass "LINT-13: Options analysis present with ${option_count} alternatives"
else
  fail "LINT-13: Expected options analysis present (has_options=$has_options, count=$option_count, rationale=$has_rationale)"
fi

# Build Gate Check
gap_checked=$(json_field "$STATUS" ".phases.audit.gap_checked")
if [[ "$unverified_high" -eq 0 && "$gap_checked" == "true" ]]; then
  pass "Build gate: OPEN (LINT-08 pass, gap_checked=true)"
else
  fail "Build gate: Expected OPEN but got BLOCKED (unverified_high=$unverified_high, gap_checked=$gap_checked)"
fi

echo ""

# ---------------------------------------------------------------------------
# Fixture: plan-missing-assumptions
# ---------------------------------------------------------------------------
echo "--- Fixture: plan-missing-assumptions ---"

FIXTURE="${FIXTURES_DIR}/plan-missing-assumptions"
STATUS="${FIXTURE}/status.json"

# LINT-08: Should detect 2 unverified HIGH assumptions
unverified_high=$(json_array_filter "$STATUS" "HIGH" "unverified")
if [[ "$unverified_high" -eq 2 ]]; then
  pass "LINT-08: Correctly detects 2 unverified HIGH assumptions -> FAIL"
else
  fail "LINT-08: Expected 2 unverified HIGH assumptions, got $unverified_high"
fi

# Build Gate: Should be BLOCKED
gap_checked=$(json_field "$STATUS" ".phases.audit.gap_checked")
if [[ "$unverified_high" -gt 0 || "$gap_checked" != "true" ]]; then
  pass "Build gate: Correctly BLOCKED"
else
  fail "Build gate: Expected BLOCKED but gate is OPEN"
fi

echo ""

# ---------------------------------------------------------------------------
# Fixture: plan-no-options
# ---------------------------------------------------------------------------
echo "--- Fixture: plan-no-options ---"

FIXTURE="${FIXTURES_DIR}/plan-no-options"
APPROACH="${FIXTURE}/approach.md"

# LINT-13: Should detect missing options analysis
has_options=0
if grep -qi "Options Analysis\|Options Considered" "$APPROACH" 2>/dev/null; then
  has_options=1
fi

option_count=$(grep -c "^#### Option" "$APPROACH" 2>/dev/null || true)
option_count=${option_count:-0}

if [[ $has_options -eq 0 && $option_count -lt 2 ]]; then
  pass "LINT-13: Correctly detects missing options analysis -> FAIL"
else
  fail "LINT-13: Expected missing options analysis but found one (has_options=$has_options, count=$option_count)"
fi

echo ""

# ---------------------------------------------------------------------------
# Fixture: plan-orphan-code
# ---------------------------------------------------------------------------
echo "--- Fixture: plan-orphan-code ---"

FIXTURE="${FIXTURES_DIR}/plan-orphan-code"
CHANGED="${FIXTURE}/changed-files.txt"
TICKET_MAP="${FIXTURE}/ticket-file-map.txt"

# LINT-11: Backward Traceability — orphan code
# Files in changed-files.txt that do NOT appear in ticket-file-map.txt column 2
orphan_files=()
while IFS= read -r changed_file; do
  # Skip empty lines
  [[ -z "$changed_file" ]] && continue
  # Check if this file appears in the second column of ticket-file-map.txt
  if ! cut -f2 "$TICKET_MAP" | grep -qxF "$changed_file"; then
    orphan_files+=("$changed_file")
  fi
done < "$CHANGED"

orphan_count=${#orphan_files[@]}
# Extract basenames for display
orphan_names=""
for f in "${orphan_files[@]}"; do
  base=$(basename "$f")
  if [[ -z "$orphan_names" ]]; then
    orphan_names="$base"
  else
    orphan_names="$orphan_names, $base"
  fi
done

if [[ $orphan_count -eq 2 ]]; then
  pass "LINT-11: Correctly detects 2 orphan files ($orphan_names)"
else
  fail "LINT-11: Expected 2 orphan files, got $orphan_count"
fi

# LINT-12: Backward Traceability — orphan tickets
# All tickets in ticket-file-map.txt should have at least one file in changed-files.txt
orphan_tickets=0
while IFS=$'\t' read -r ticket file; do
  [[ -z "$ticket" ]] && continue
  if ! grep -qxF "$file" "$CHANGED"; then
    orphan_tickets=$((orphan_tickets + 1))
  fi
done < "$TICKET_MAP"

if [[ $orphan_tickets -eq 0 ]]; then
  pass "LINT-12: No orphan tickets (all tickets have files)"
else
  fail "LINT-12: Expected 0 orphan tickets, got $orphan_tickets"
fi

echo ""

# ---------------------------------------------------------------------------
# Fixture: plan-missing-infra
# ---------------------------------------------------------------------------
echo "--- Fixture: plan-missing-infra ---"

FIXTURE="${FIXTURES_DIR}/plan-missing-infra"
MATRIX="${FIXTURE}/scenario-matrix.md"

# LINT-15: Data Source Validation — test infrastructure
# Parse the markdown table, extract test file paths from the "Tested?" column (column 4)
# For each path that is not "-", check if file exists relative to fixture dir
missing_tests=0
claimed_tests=0

while IFS='|' read -r _ scenario planned phase tested monitored status _rest; do
  # Trim whitespace
  tested=$(echo "$tested" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  # Skip header, separator, and empty/dash entries
  [[ -z "$tested" || "$tested" == "-" || "$tested" == "Tested?" || "$tested" == "-"* ]] && continue
  # Skip separator lines
  echo "$tested" | grep -q '^-*$' && continue

  claimed_tests=$((claimed_tests + 1))

  # Check if the test file exists relative to the fixture directory
  if [[ ! -f "${FIXTURE}/${tested}" ]]; then
    missing_tests=$((missing_tests + 1))
  fi
done < "$MATRIX"

if [[ $missing_tests -gt 0 && $missing_tests -eq $claimed_tests ]]; then
  pass "LINT-15: Correctly detects ${missing_tests} missing test files"
else
  fail "LINT-15: Expected all claimed test files to be missing, got $missing_tests missing out of $claimed_tests claimed"
fi

echo ""

# ============================================================================
# FIXTURE: lint-discrimination (LINT-21 to LINT-24 discrimination pair)
# ============================================================================
echo "--- Fixture: lint-discrimination ---"

# One spec with four planted defects and its repaired twin. The sealed prediction
# names the four lines, so if the files drift apart anywhere else prediction.md
# describes a test that no longer exists; and if either file changes length, the
# line numbers in prediction.md stop pointing at the plants. The rules themselves
# are judged by an auditor, not by code — this guards the fixture, not the verdict.
FIXTURE="${FIXTURES_DIR}/lint-discrimination"
DEFECT="${FIXTURE}/nightly-export.defect.md"
REPAIRED="${FIXTURE}/nightly-export.repaired.md"

if [[ -f "$DEFECT" && -f "$REPAIRED" ]]; then
  # diff exits 1 when the files differ, which they must; under pipefail that
  # status would abort the script before the assertion ran.
  changed_lines=$({ diff --unchanged-line-format='' --old-line-format='%dn ' --new-line-format='' "$DEFECT" "$REPAIRED" || true; } | sed 's/ $//')
  defect_len=$(wc -l < "$DEFECT" | tr -d ' ')
  repaired_len=$(wc -l < "$REPAIRED" | tr -d ' ')
  if [[ "$changed_lines" == "24 37 45 86" && "$defect_len" -eq 93 && "$repaired_len" -eq 93 ]]; then
    pass "LINT-21..24 pair: differs at exactly the four planted lines (24 37 45 86), 93 lines each"
  else
    fail "LINT-21..24 pair: expected changed lines '24 37 45 86' at 93 lines each, got '${changed_lines}' (${defect_len}/${repaired_len} lines)"
  fi
else
  fail "LINT-21..24 pair: fixture files missing under ${FIXTURE}"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "Results: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
else
  exit 0
fi
