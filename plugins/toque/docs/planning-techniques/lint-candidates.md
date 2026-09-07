# Lint Rule Candidates

Findings from the Phase 5 rubric-free holistic pass that mapped to no existing
criterion. Each entry is a candidate for promotion into
[lint-registry.md](lint-registry.md) — or for explicit rejection, recorded here so
the same candidate is not re-litigated every audit.

The pass does not write this file. A candidate's record is
`holistic_pass.candidates[]` in the gate record of the plan that produced it,
committed with that plan in its own repository. This file is owner-curated only:
the owner reads gate records across projects and promotes a rule here with the
project detail stripped, so the plugin stays project-agnostic. An installed copy
of this file sits under a version-keyed cache and is replaced on upgrade, which is
one more reason nothing automated writes to it.

The pass itself never gates; a finding here is a claim that the *rubric* has a gap, not
that any particular plan does. Every entry names the angle it came from, so a
reader can see when several candidates are one gap in the rubric seen from several
sides. Sharing an angle is not a reason to merge them: each candidate keeps its own
draft rule as long as it names a distinct checkable condition.

Why this exists: every enforcement mechanism in Phase 5 makes the judge honest
about the criteria it was given. None of them can notice that the criteria are
incomplete. A plan can satisfy every rule and still fail in production for a reason
no rule names. The holistic pass is the only mechanism looking for that class, and
this file is where its output lands.

Format per entry:

```markdown
## {date} — {finding-slug}
**Angle:** {the underlying assumption this cluster rests on}
**Finding:** {what the rubric-free judge said would fail in production}
**Maps to:** none (checked against the registry as of {date})
**Proposed rule:** {draft LINT text, if the finding generalises}
**Status:** proposed | promoted as LINT-NN | rejected ({reason})
```

The heading carries the finding, not the plan that produced it: a plan name is
project detail, and this file is read by every project.

## Candidates

## 2026-09-06 — mitigation detector shares the failure's blind spot
**Angle:** the registry checks that a control is named, not that it works
**Finding:** A plan's mitigation for a silent authorization failure was a check
that could never fire. It compared the rows a caller asked to delete against the
rows actually affected, to catch a row-level-security policy filtering rows out
silently — but the read policy and the delete policy carried byte-identical
predicates, so the counting query and the delete were filtered the same way and
the two numbers always agreed. The detector shared its blind spot with the
failure it was built to detect.
**Maps to:** none (checked against the registry as of 2026-09-06). LINT-02 asks
that a HIGH risk *have* a mitigation, not that the mitigation be capable of
firing, so the plan satisfied it.
**Proposed rule:** LINT-21 — Every mitigation for a silent-failure risk names a
signal not derived from the same filtered source as the failure.
**Status:** promoted as LINT-21 on 2026-09-06.

## 2026-09-06 — deploy ordering enforced by prose
**Angle:** the registry checks that a control is named, not that it works
**Finding:** A plan required a schema migration to reach production before the
application code that calls it, and enforced that ordering with a sentence. The
database workflow needed a manual dispatch while the application host had no
deployment gate, so merging one pull request shipped the caller and nothing
shipped the callee. The plan's own risk section named the hazard without noticing
that its control was prose.
**Maps to:** none (checked against the registry as of 2026-09-06). LINT-03 covers
rollback and LINT-04 dependency owners; neither asks how a stated ordering
between deployable artifacts is enforced.
**Proposed rule:** LINT-22 — Every stated ordering between deployable artifacts
names the mechanism that enforces it.
**Status:** promoted as LINT-22 on 2026-09-06.

## 2026-09-06 — rollback artifact is not re-runnable
**Angle:** the registry checks that a control is named, not that it works
**Finding:** A plan shipped its irreversible-failure insurance as a table copy
created inside the same migration that created the functions it protects. The
statement carried no existence guard, so a re-run after a partial apply failed on
the object that already existed — and that object was the backup the rollback
depended on. Separately, the copy was taken when the migration applied rather
than when the application deployed, so the snapshot was already stale relative to
the deploy it existed to protect.
**Maps to:** none (checked against the registry as of 2026-09-06). LINT-03 asks
that a deployment phase have a rollback plan; it does not ask whether the
rollback's own artifacts survive the migration being re-run, nor whether a
point-in-time copy is taken at the point in time it is meant to cover.
**Proposed rule:** LINT-23 — Every rollback artifact the plan itself creates is
re-runnable and created at the point whose state it preserves.
**Status:** promoted as LINT-23 on 2026-09-06.

## 2026-09-06 — the stated measurement measures something else
**Angle:** the registry checks that a control is named, not that it works
**Finding:** Several non-functional requirements named a command as their
measurement, and the named command did not measure the stated property. One
required that no feature code import the database client and named a task that
runs a dependency-graph check and a stylesheet-rot check; the check that would
actually catch the stated failure lived in a different script. Nothing shipped
broken, because continuous integration ran both — but the spec's stated evidence
for its own requirement was evidence of something else, and a reader auditing
that requirement would run the wrong command and believe it held.
**Maps to:** none (checked against the registry as of 2026-09-06). LINT-15 and
LINT-16 ask whether claimed test and monitoring *infrastructure* exists; neither
asks whether a named command exercises the property the requirement states.
**Proposed rule:** LINT-24 — Every named measurement exercises the property its
requirement states.
**Status:** promoted as LINT-24 on 2026-09-06.
