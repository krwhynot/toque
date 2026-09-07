# Result — LINT-21..24 claimed-mechanism test, 2026-09-06

8 of 8 verdicts match the sealed prediction in `prediction-claimed.md`. Two
blind auditors, one fixture each, launched in parallel under one prompt that
named the fixture, the registry and nothing else; neither was told that
anything was planted or that another fixture exists. Both read rule text from
the working-tree registry by absolute path. The installed plugin is still
11.1.0 and stops at LINT-20, so the slash command could not have run this.

| Rule | Line | Fixture B (repair, control) | Fixture C (claimed) | Predicted | Match |
|---|---|---|---|---|---|
| LINT-21 | 45 | MET | UNMET | MET / UNMET | yes |
| LINT-22 | 37 | MET | UNMET | MET / UNMET | yes |
| LINT-23 | 86 | MET | UNMET | MET / UNMET | yes |
| LINT-24 | 24 | MET | UNMET | MET / UNMET | yes |

Every citation landed on the planted line and no other. On fixture C each
UNMET named the specific gap the plant was built around, in the auditor's own
words:

- LINT-21: the count is "cached in the same entry, refreshed on the same
  load", so it "carries the same TTL as the rows" and the mismatch never fires.
- LINT-22: "merge status is repository state; the ordering claim is about
  production state."
- LINT-23: the retried snapshot "drops the pre-worker backup and recreates it
  from a table that now contains rows from the failed rollout."
- LINT-24: "a single sample is not a peak under any definition", and
  `heapUsed` is V8 heap, not resident set.

Fixture B's auditor returned MET on all four with the mechanism as the reason
in each case, not the sentence asserting the property.

## What this establishes

With `result.md`, the three fixtures now span three states of one spec. A
(defect, all UNMET), B (working repair, all MET) and C (claimed repair, all
UNMET) differ pairwise at exactly the four planted lines. B and C both state
the property in as many words; only the mechanism differs. The rules, read
by a blind auditor, separated them. That closes the gap `result.md` named.

## What this does not establish

Both auditors said the same thing about the reading they applied. Fixture C's
auditor wrote that under "a strictly name-only reading, LINT-22 would flip to
MET", and that it read the rule as requiring effectiveness because the
registry's own paragraph on the four rules says the registry used to check
"that a control is NAMED, never that it WORKS". The discrimination on LINT-22
and LINT-23 therefore rests partly on that paragraph, which every auditor
reading the registry also reads, and not on the rule row alone. LINT-21 and
LINT-24 failed on either reading, because fixture C's text contradicts its own
claim within the sentence.

Fixture B's auditor flagged, without changing its verdict, that B's line 86
uses `CREATE TABLE IF NOT EXISTS`, so a re-run after a partial deploy keeps the
original snapshot rather than refreshing it, and called that "the desired
semantics" for a pre-deploy snapshot. That is the reading fixture C's line 86
was built to violate from the other direction, and it means B's repair is
correct by that auditor's account rather than merely stated; it is also a
fifth judgement the sealed prediction did not ask for.

One run each. A second pair of auditors on the same two files would say
whether the verdicts are stable across instances; this run does not.
