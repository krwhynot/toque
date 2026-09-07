# CHANGELOG draft for the next release

This repository writes the CHANGELOG entry at release time, as its own commit (`.github/release.sh` refuses to release without a `## {version}` heading, and the mutation harness treats a `## Unreleased` heading as a non-pristine tree). This file holds the draft until then. Everything drafted here before 2026-09-06 shipped in 11.1.0 and 11.2.0 and now lives in `CHANGELOG.md`; the draft below is what has landed on `main` since the 11.2.0 release commit. A patch bump is enough: nothing here changes what the installed plugin does.

## Internal

- **A third discrimination fixture closes the gap 11.2.0 named.** The repaired fixture's text stated the property each of LINT-21 through LINT-24 restores, so the pair could not show that the rules separate a mechanism that works from one merely claimed to work. `tests/fixtures/lint-discrimination/nightly-export.claimed.md` is the repaired spec with the same four lines rewritten so that each still asserts the property while the mechanism it describes fails: a single end-of-run `heapUsed` sample offered as a peak, a merged-pull-request check offered as proof a migration ran in production, a cache-stored row count offered as independent of the cached rows, and a drop-and-recreate snapshot whose retry after a partial rollout replaces the state it was meant to preserve. Under one neutral prompt, two blind auditors returned UNMET on all four for the new fixture and MET on all four for the repaired one, 8 of 8 against a prediction sealed before either launched, every citation on its planted line. Layer 3 asserts the new file is 93 lines and differs from the repaired twin at exactly lines 24, 37, 45 and 86, and was falsified in both directions. Still open, recorded in `result-claimed.md`: the LINT-22 and LINT-23 verdicts rested partly on the registry's paragraph about where the four rules came from, and each fixture has been judged by one auditor instance.

## Housekeeping

- Merged branch `gate/holistic-candidates-in-gate-record` deleted locally; its remote was already gone.
