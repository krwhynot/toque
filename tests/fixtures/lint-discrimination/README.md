# LINT-21 to LINT-24 discrimination pair

Two copies of one 93-line spec. `nightly-export.defect.md` carries one planted
instance of each of the four rules promoted on 2026-09-06, and
`nightly-export.repaired.md` is the same file with those four lines repaired and
nothing else changed. The pair exists because a rule that fires on everything is
indistinguishable from a rule that works when it is only ever shown defects.

| File | Role |
|---|---|
| `nightly-export.defect.md` | Fixture A. Expected verdict on all four rules: UNMET. |
| `nightly-export.repaired.md` | Fixture B. Expected verdict on all four rules: MET. |
| `prediction.md` | The plant map and predicted verdicts, fixed before either auditor ran. |
| `result.md` | What two blind auditors returned on 2026-09-06, and what that result does not establish. |

Plant map. Line numbers are identical in both files:

- line 24 — LINT-24, the named measurement
- line 37 — LINT-22, the deployment ordering
- line 45 — LINT-21, the stale-cache signal
- line 86 — LINT-23, the rollback artifact

## Guard

`tests/layer3-fixture-lint.sh` asserts that the two files are 93 lines each and
differ at exactly those four lines. A fixture that drifted anywhere else would
leave `prediction.md` describing a test that no longer exists.

## Re-running it

Launch two auditors, one fixture each, blind: neither is told that anything was
planted or that the other file exists. Each reads rule text from the registry by
absolute path — `plugins/toque/docs/planning-techniques/lint-registry.md` in this
checkout — because the installed plugin under `~/.claude/plugins/cache/` may be
older than the working tree, and an auditor reached through a `/toque:*` command
reads that copy. Compare the verdicts and the cited lines against `prediction.md`.
Eight of eight with every citation on its planted line is a pass. All-UNMET or
all-MET on both fixtures is a failure of the rules, not a pass of the test.

The 2026-09-06 run is recorded in `result.md`. Its `prediction.md` is the sealed
text with one change made at check-in: the Line and Rule columns of the plant-map
table are swapped, because the repository's PH5-001b check reads a rule id followed
by prose as a restatement of the rule.

## Known gap

Fixture B's repairs state, in so many words, the property they restore. The pair
therefore shows that the rules separate a stated mechanism from a stated
intention. It does not show that they separate a mechanism that works from one
merely claimed to work. A third fixture whose repairs claim the property while the
described mechanism still fails is needed for that, and is not yet written.
