# Sealed prediction — LINT-21..24 claimed-mechanism test

Fixture C, `nightly-export.claimed.md`, is fixture B with the same four lines
rewritten so that each repair still asserts the property the rule wants, in as
many words as fixture B does, while the mechanism it describes does not deliver
that property. The plant map is the diff between B and C. It was fixed when
fixture C was written, before either auditor was launched; both auditors are
blind to the existence of the other fixture and to the fact that anything was
planted.

| Rule | Line | What fixture C claims | Why the mechanism fails |
|---|---|---|---|
| LINT-24 | 24 | "the peak resident set is verified to stay under the limit" | one `heapUsed` sample taken after the last file is closed measures neither the peak nor the resident set |
| LINT-22 | 37 | "the worker cannot reach production ahead of the migration" | the gate checks that the migration's pull request is merged; a merged migration has not necessarily run in production |
| LINT-21 | 45 | "not subject to the same staleness as the export" | the count is refreshed whenever the cached row set is loaded, so it is a field of the same stale snapshot |
| LINT-23 | 86 | "re-runnable", "captures the state the rollback is meant to return to" | the retry drops and recreates the backup after the worker has begun writing, so a re-run replaces the pre-deploy state with the partial-deploy state |

Predicted verdicts:

- Fixture C: LINT-21 UNMET, LINT-22 UNMET, LINT-23 UNMET, LINT-24 UNMET
- Fixture B, run again as the control under the same prompt: LINT-21 MET, LINT-22 MET, LINT-23 MET, LINT-24 MET

A result of 8 of 8 means the rules separate a mechanism that works from one
that is only claimed to work. All-MET on both fixtures would mean an auditor
returns MET on the sentence that states the property, which is the gap
`result.md` names. All-UNMET on both would mean the rules fire on any
mechanism an auditor can find fault with, which is as useless. Either is a
failure of the test, not a pass.
