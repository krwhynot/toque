
Generate a BRD for "$1".

**Step 0: Disambiguate**

Read `docs/audit/baseline/feature-inventory.json` and identify domains
matching "$1".

If no baseline exists: "No audit baseline found in docs/audit/. Continuing without it."

If "$1" matches a domain name exactly (e.g., "Ordering", "Payments"):
proceed with that domain.

If "$1" is vague or matches multiple domains, present options:
```
"$1" relates to features in multiple domains:
  [1] Ordering (12 features, avg confidence: 0.88)
  [2] Payments (8 features, avg confidence: 0.91)
  [3] Reporting (15 features, avg confidence: 0.72)
Which domain should the BRD cover?
```

Wait for the developer's choice.

If "$1" matches no existing domain:
```
"$1" doesn't match any existing domain in the baseline.
  [1] Create a BRD for a new business area named "$1"
  [2] Search the codebase for related features
```

**Step 1: Show Domain Scope**

Present the features that will be covered by this BRD:
```
BRD for [Domain] will cover [N] features:

  | Feature | Confidence | PRD? | Test Coverage |
  |---------|-----------|------|---------------|
  | [name]  | [score]   | [Y/N]| [status]      |

  Average confidence: [score]
  Features below 0.90: [count]

  [1] Proceed with BRD generation
  [2] Run deep scan on low-confidence features first
  [3] Cancel
```

**Step 2: Deep Scan (if chosen)**

For each feature below 0.90 confidence in this domain, read the source files
and verify entry points and database tables. Record what was verified, and the
confidence you now hold, in the BRD's Feature Coverage table (Notes column):
`verified {date}: {what was checked}`. Never edit the baseline file; it belongs
to the tool that produced it, and a later reader must be able to tell what that
tool reported from what this BRD verified.

**Step 3: Generate BRD**

Generate the BRD directly, using:
- The selected domain name
- The list of feature IDs in this domain
- Links to any existing PRDs and ADRs for cross-referencing

Steps:
1. Write the BRD to `docs/brd/{domain}.md` using the skeleton below

The audit baselines are inputs only. Read them for evidence; never write back
to them.

**Document skeleton**

A BRD answers *why the business needs this domain to exist*; PRDs answer
*what each feature does*. Keep requirements at the business-capability level
(BR-NNN), and point each one at the PRDs that implement it.

```markdown
# BRD: {Domain}

**Status:** Draft | Approved · **Date:** {YYYY-MM-DD} · **Owner:** {business owner}
**Covers:** {N} features · **Linked PRDs:** {list} · **Linked ADRs:** {list}

## Business Context

{Why this domain exists: the business process it serves, who depends on it,
and what it costs when it fails. 3-5 sentences, grounded in baseline data.}

## Objectives

{3-5 business outcomes, each measurable. "Cut order-entry time 30%", not
"improve ordering".}

## Stakeholders

| Role | Interest | Decision authority |
|------|----------|--------------------|
| {role} | {what they need from this domain} | Approves / Consulted / Informed |

## Scope

**In:** {business capabilities covered}
**Out:** {adjacent capabilities explicitly excluded, with a reason each}

## Business Requirements

| ID | Requirement | Priority | Implemented by |
|----|-------------|----------|----------------|
| BR-001 | {business capability, outcome-phrased} | Must / Should / Could | PRD-{name}, PRD-{name} |

## Feature Coverage

| Feature | Confidence | PRD | Test coverage | Notes |
|---------|-----------|-----|---------------|-------|
| {name} | {baseline score} | {link or "missing"} | {status} | {[ASSUMPTION] if below 0.90 and not verified; otherwise "verified {date}: {what was checked}"} |

## Success Metrics

| Metric | Baseline | Target | Measured by | Review date |
|--------|----------|--------|-------------|-------------|
| {metric} | {today} | {target} | {tool or query} | {date} |

## Assumptions and Constraints

- Assumption: {what is taken as true; tag [ASSUMPTION] if unverified}
- Constraint: {regulatory, contractual, technical, or budget limit}

## Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|--------|------------|-------|
| {risk} | Low / Med / High | Low / Med / High | {mitigation} | {role} |

## Open Questions

| Question | Owner | Blocking? |
|----------|-------|-----------|
| {question} | {role} | Yes / No |
```

**Step 4: Post-Generation**

After the BRD is created, check for PRD gaps:
```
BRD created: docs/brd/{domain}.md
Covers [N] features in the [Domain] domain.

Document chain status:
  [N] features have PRDs (complete chain: BRD -> PRD)
  [N] features need PRDs (run /toque:documentation prd [feature] for each)

  [1] Generate PRDs for all features missing them
  [2] Done for now
```
