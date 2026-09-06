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
## {date} — {plan-name}
**Angle:** {the underlying assumption this cluster rests on}
**Finding:** {what the rubric-free judge said would fail in production}
**Maps to:** none (checked against the registry as of {date})
**Proposed rule:** {draft LINT text, if the finding generalises}
**Status:** proposed | promoted as LINT-NN | rejected ({reason})
```

## Candidates

*(none promoted yet — candidates live in each plan's gate record under
`holistic_pass.candidates[]`)*
