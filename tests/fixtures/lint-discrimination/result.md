# Result — LINT-21..24 discrimination test, 2026-09-06

8 of 8 verdicts match the sealed prediction. Two blind auditors, one fixture each,
both reading rule text from the working-tree registry, which defines all four; the installed
plugin is 11.1.0 and stops at LINT-20, so the slash command could not have run this.

| Rule | Line | Fixture A (defect) | Fixture B (repair) | Predicted | Match |
|---|---|---|---|---|---|
| LINT-21 | 45 | UNMET | MET | UNMET / MET | yes |
| LINT-22 | 37 | UNMET | MET | UNMET / MET | yes |
| LINT-23 | 86 | UNMET | MET | UNMET / MET | yes |
| LINT-24 | 24 | UNMET | MET | UNMET / MET | yes |

Every citation landed on the planted line and no other. No cross-talk: no rule
cited a line belonging to a different rule's plant.

LINT-23's UNMET caught both halves of its condition unprompted — not re-runnable
AND taken at the wrong point in the sequence.

## What this does not establish

Fixture B's repairs are self-declaring: the repaired text says in so many words
that the signal bypasses the cache and that the script is re-runnable. An auditor
could return MET by trusting that sentence rather than reasoning about the
mechanism behind it. This test shows the rules separate text that states a working
mechanism from text that states only an intention. It does not show they separate
a mechanism that works from one merely CLAIMED to work — which is the same angle
these four rules came from, one level up.

Closing that needs a third fixture whose repairs assert the property while the
described mechanism still fails.
