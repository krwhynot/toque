# LINT-21 to LINT-24 discrimination fixtures

Three copies of one 93-line spec. `nightly-export.defect.md` carries one planted
instance of each of the four rules promoted on 2026-09-06.
`nightly-export.repaired.md` is the same file with those four lines repaired and
nothing else changed. `nightly-export.claimed.md` is the repaired file with the
same four lines rewritten so that each still asserts the property while the
mechanism it describes fails. The first two exist because a rule that fires on
everything is indistinguishable from a rule that works when it is only ever
shown defects; the third exists because a rule that passes on the sentence
stating the property is indistinguishable from one that checks the mechanism.

| File | Role |
|---|---|
| `nightly-export.defect.md` | Fixture A. Expected verdict on all four rules: UNMET. |
| `nightly-export.repaired.md` | Fixture B. Expected verdict on all four rules: MET. |
| `nightly-export.claimed.md` | Fixture C. Expected verdict on all four rules: UNMET. |
| `prediction.md` | The plant map and predicted verdicts, fixed before either auditor ran. |
| `result.md` | What two blind auditors returned on 2026-09-06 for A and B, and what that result does not establish. |
| `prediction-claimed.md` | The plant map for C and the predicted verdicts, fixed before either auditor of the second run was launched. |
| `result-claimed.md` | What two blind auditors returned on 2026-09-06 for C and for B as the control, and what remains open. |

Plant map. Line numbers are identical in all three files:

- line 24 — LINT-24, the named measurement
- line 37 — LINT-22, the deployment ordering
- line 45 — LINT-21, the stale-cache signal
- line 86 — LINT-23, the rollback artifact

## Guard

`tests/layer3-fixture-lint.sh` asserts that A and B are 93 lines each and differ
at exactly those four lines, and that C is 93 lines and differs from B at exactly
those four lines. A fixture that drifted anywhere else would leave
`prediction.md` or `prediction-claimed.md` describing a test that no longer exists.

## Re-running it

Launch one auditor per fixture, blind: neither is told that anything was
planted or that the other file exists. Each reads rule text from the registry by
absolute path — `plugins/toque/docs/planning-techniques/lint-registry.md` in this
checkout — because the installed plugin under `~/.claude/plugins/cache/` may be
older than the working tree, and an auditor reached through a `/toque:*` command
reads that copy. Compare the verdicts and the cited lines against `prediction.md`
for A and B, and against `prediction-claimed.md` for C. Every verdict as predicted with every
citation on its planted line is a pass. The same verdict on every fixture is a
failure of the rules, not a pass of the test.

The first 2026-09-06 run, A and B, is recorded in `result.md`. Its `prediction.md` is the sealed
text with one change made at check-in: the Line and Rule columns of the plant-map
table are swapped, because the repository's PH5-001b check reads a rule id followed
by prose as a restatement of the rule. `result.md` has one edit of the same
kind: its parenthetical registry rule count is now prose, because PH5-002 allows a
rule count only inside the registry. The second run, C with B as the control, is
recorded in `result-claimed.md`; `prediction-claimed.md` is checked in as sealed.

## Known gap

The pair A and B showed that the rules separate a stated mechanism from a stated
intention. Fixture C, run on the same day with B as the control, showed that they
also separate a mechanism that works from one merely claimed to work; the record
is `result-claimed.md`. What remains open is in that file: the LINT-22 and
LINT-23 verdicts rested partly on the registry paragraph that explains where the
four rules came from, and each fixture has been judged by one auditor instance.
