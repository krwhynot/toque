#!/usr/bin/env bash
# Toque Plugin Test Runner
# Run from plugin root: bash tests/run-all.sh
#
# Layers:
#   1. Config/Wiring   - Parse plugin.json, check consistency
#   2. Hook Simulation - Feed canned payloads, assert block/allow
#   3. Fixture Lint    - Known-gap plans, verify detection
#   4. Behavioral      - Command structure and cross-references
#   5. Evidence Validator - PH5-020 record validation (node)
#   6. Canary - PH5-030 auditor liveness check (node)
#   7. Release Preflight - lockstep release script guards (bash)
#
# Usage:
#   bash tests/run-all.sh              # Run all layers
#   bash tests/run-all.sh 1            # Run only layer 1
#   bash tests/run-all.sh 1 3          # Run layers 1 and 3
#   bash tests/run-all.sh --quick      # Layers 1-3 only (skip behavioral)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PLUGIN_ROOT"

TOTAL_PASS=0
TOTAL_FAIL=0
LAYERS_RUN=0
LAYERS_FAILED=0

run_layer() {
    local LAYER=$1
    local NAME=$2
    local SCRIPT=$3
    local RUNNER=${4:-bash}

    echo ""
    echo "╔══════════════════════════════════════════╗"
    echo "║  Layer $LAYER: $NAME"
    echo "╚══════════════════════════════════════════╝"
    echo ""

    if [[ ! -f "$SCRIPT" ]]; then
        echo "[ERROR] $SCRIPT not found"
        LAYERS_FAILED=$((LAYERS_FAILED + 1))
        return 1
    fi

    # A layer whose interpreter is unavailable must FAIL, never silently skip —
    # a skipped layer that reports success is indistinguishable from a passing one.
    if ! command -v "$RUNNER" >/dev/null 2>&1; then
        echo "[ERROR] interpreter '$RUNNER' not found on PATH — Layer $LAYER cannot run"
        LAYERS_FAILED=$((LAYERS_FAILED + 1))
        return 1
    fi

    "$RUNNER" "$SCRIPT"
    local EXIT_CODE=$?

    LAYERS_RUN=$((LAYERS_RUN + 1))
    if [[ $EXIT_CODE -ne 0 ]]; then
        LAYERS_FAILED=$((LAYERS_FAILED + 1))
        echo ""
        echo ">>> Layer $LAYER FAILED (exit $EXIT_CODE) <<<"
    else
        echo ""
        echo ">>> Layer $LAYER PASSED <<<"
    fi

    return $EXIT_CODE
}

# Determine which layers to run
RUN_LAYERS=""
QUICK=false

for arg in "$@"; do
    case $arg in
        --quick) QUICK=true ;;
        [1-8]) RUN_LAYERS="$RUN_LAYERS $arg" ;;
        *) echo "run-all.sh: unknown argument: $arg (expected --quick or a layer number 1-8)" >&2; exit 2 ;;
    esac
done

# Default: run all (or 1-3 if --quick)
if [[ -z "$RUN_LAYERS" ]]; then
    if $QUICK; then
        RUN_LAYERS="1 2 3"
    else
        RUN_LAYERS="1 2 3 4 5 6 7 8"
    fi
fi

# Layer-count assertion (PHV5-002 / matrix row A2 negative case): the number of layers that
# actually ran must equal the number requested. Without this, a layer that vanishes from the
# case statement disappears silently and the suite still reports success.
EXPECTED_LAYERS=$(echo $RUN_LAYERS | wc -w | tr -d ' ')

echo "============================================"
echo "  Toque Plugin Test Suite"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Layers: $RUN_LAYERS"
echo "============================================"

OVERALL_EXIT=0

for layer in $RUN_LAYERS; do
    case $layer in
        1) run_layer 1 "Config/Wiring" "$SCRIPT_DIR/layer1-config-wiring.sh" || OVERALL_EXIT=1 ;;
        2) run_layer 2 "Hook Simulation" "$SCRIPT_DIR/layer2-hook-suite.sh" || OVERALL_EXIT=1 ;;
        3) run_layer 3 "Fixture Lint" "$SCRIPT_DIR/layer3-fixture-lint.sh" || OVERALL_EXIT=1 ;;
        4) run_layer 4 "Behavioral Smoke" "$SCRIPT_DIR/layer4-behavioral-smoke.sh" || OVERALL_EXIT=1 ;;
        5) run_layer 5 "Evidence Validator" "$SCRIPT_DIR/evidence-validate-test.js" node || OVERALL_EXIT=1 ;;
        6) run_layer 6 "Canary" "$SCRIPT_DIR/canary-test.js" node || OVERALL_EXIT=1 ;;
        7) run_layer 7 "Release Preflight" "$SCRIPT_DIR/release-preflight-test.sh" || OVERALL_EXIT=1 ;;
        8) run_layer 8 "Protected Artifacts" "$SCRIPT_DIR/protected-artifacts-test.sh" || OVERALL_EXIT=1 ;;
    esac
done

if [[ $LAYERS_RUN -ne $EXPECTED_LAYERS ]]; then
    echo ""
    echo ">>> LAYER-COUNT ASSERTION FAILED: requested $EXPECTED_LAYERS layer(s), only $LAYERS_RUN ran <<<"
    OVERALL_EXIT=1
fi

# ---------------------------------------------------------------------------
# expected-failures.txt comparator.
#
# That file declares a contract — "the CI wrapper parses the suite's failure list
# and passes IFF that list equals exactly the entries below" — and NOTHING read it.
# A grep of the whole repository found no consumer: the contract was documentation,
# not enforcement, so the header's own warning against re-adding entries was
# unbacked. The file has been empty since Wave 3, which is exactly when a tolerated
# failure would slip in unnoticed.
#
# Enforced here rather than in CI because CI does not exist yet (PHV5-005). When it
# does, it inherits this because it runs this script.
# ---------------------------------------------------------------------------
EXPECTED_FAILURES_FILE="$SCRIPT_DIR/expected-failures.txt"
if [[ -f "$EXPECTED_FAILURES_FILE" ]]; then
    ef_entries=$(grep -vE '^[[:space:]]*(#|$)' "$EXPECTED_FAILURES_FILE" | grep -c . || true)
    if [[ "$ef_entries" -ne 0 ]]; then
        echo ""
        echo ">>> EXPECTED-FAILURES CONTRACT VIOLATED <<<"
        echo "    $EXPECTED_FAILURES_FILE holds $ef_entries tolerated failure(s):"
        grep -vE '^[[:space:]]*(#|$)' "$EXPECTED_FAILURES_FILE" | sed 's/^/      /'
        echo ""
        echo "    Zero failures are tolerated. A genuine defect belongs in a fix, not in"
        echo "    this file — recording one here enshrines it as correct behaviour, which"
        echo "    is the anti-pattern that made the pre-existing suite untrustworthy."
        echo "    If a red build genuinely must ship, say so in the commit, not here."
        OVERALL_EXIT=1
    fi
fi

# ---------------------------------------------------------------------------
# Plan consistency sweep, when a plan directory is present.
#
# The sweep is the plan's own acceptance gate and it was wired to nothing — not this
# script, not CI. It passed only because it was run by hand, which is not a gate. Run
# it here so it cannot silently stop being enforced while a plan is active; it is
# skipped (not failed) once no plan directory exists, so an archived plan does not
# hold the suite hostage.
# ---------------------------------------------------------------------------
for sweep in "$SCRIPT_DIR"/../docs/plans/*/consistency-sweep.sh; do
    [[ -f "$sweep" ]] || continue
    echo ""
    echo "--- Plan consistency sweep: $(basename "$(dirname "$sweep")") ---"
    if bash "$sweep" >/dev/null 2>&1; then
        echo "    sweep PASS"
    else
        echo ">>> PLAN CONSISTENCY SWEEP FAILED — run it directly for the reconciliation list:"
        echo "    bash ${sweep#"$SCRIPT_DIR"/../}"
        OVERALL_EXIT=1
    fi
done

echo ""
echo "============================================"
echo "  FINAL SUMMARY"
echo "  Layers run: $LAYERS_RUN / $EXPECTED_LAYERS requested"
echo "  Layers failed: $LAYERS_FAILED"
if [[ $OVERALL_EXIT -eq 0 ]]; then
    echo "  Status: ALL PASSED"
else
    echo "  Status: FAILURES DETECTED"
fi
echo "============================================"

exit $OVERALL_EXIT
