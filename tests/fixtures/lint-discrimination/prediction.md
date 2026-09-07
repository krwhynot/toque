# Sealed prediction — LINT-21..24 discrimination test

The plant map is the diff between the two fixtures. It was fixed when fixture B
was written, which is before either auditor was launched; both auditors are blind
to the existence of the other fixture and to the fact that anything was planted.

| Rule | Line | Fixture A (defect) | Fixture B (repair) |
|---|---|---|---|
| LINT-24 | 24 | memory NFR "measured by `npm run test:unit`" | measured by a memory profiler asserting peak RSS |
| LINT-22 | 37 | ordering stated as a bare sentence | separate change sets + a deploy gate on a schema marker |
| LINT-21 | 45 | stale-cache detector counts through the same cache | count issued to the primary with the cache bypassed |
| LINT-23 | 86 | backup created inside the same migration, no existence guard | separate re-runnable step run immediately before the deploy |

Predicted verdicts:

- Fixture A: LINT-21 UNMET, LINT-22 UNMET, LINT-23 UNMET, LINT-24 UNMET
- Fixture B: LINT-21 MET,   LINT-22 MET,   LINT-23 MET,   LINT-24 MET

A result of 8/8 means the rules discriminate. All-UNMET on both fixtures would
mean the rules fire on anything; all-MET on both would mean they fire on nothing.
Either is a failure of the test, not a pass.
