# Immutable Change Records with Supersession

## What It Is

Immutable Change Records enforce a rule that once a decision is accepted, it cannot be silently edited. Any change to an accepted decision requires creating a NEW record that explicitly supersedes the old one. The original record is preserved with its original rationale, context, and timestamp — it becomes historical evidence. The new record must explain what changed and WHY. This creates an unbreakable audit trail of decision evolution.

The key principle: decisions are append-only, never edit-in-place. Silent edits destroy institutional knowledge; supersession preserves it. When a decision is superseded, the original document gains a status marker pointing to its replacement, but its content remains untouched. Anyone reading the history can follow the chain from the current decision back through every prior version and understand not just what was decided, but how the thinking evolved over time.

## Enterprise Origin

**AWS Prescriptive Guidance ADR Process.** AWS states: "When the team accepts an ADR, it becomes immutable. If new insights require a different decision, the team proposes a new ADR. When the team accepts the new ADR, it supersedes the previous ADR." ADR states follow a lifecycle: Proposed -> Accepted -> (optionally) Superseded by [new ADR]. The original rationale is never lost. The superseding ADR must reference the original and explain why the new decision is needed, creating a traceable chain of reasoning.

**Legal/compliance document management (SOX, HIPAA).** Regulated industries require full history of changes with timestamps, authors, and justifications. A financial record cannot be edited — corrections are made via new entries that reference and supersede the original. The Sarbanes-Oxley Act specifically requires that audit trails be maintained for all financial records, and that no record can be silently altered after the fact. HIPAA requires similar immutability for protected health information amendments.

**IBIS (Issue-Based Information System) argumentation framework.** IBIS preserves the full chain of issues, positions, and arguments. When a position is replaced by a new position, the original position and its supporting arguments remain in the graph. The framework treats the evolution of thinking as valuable data, not noise to be cleaned up. This enables any stakeholder to reconstruct the full reasoning process, including rejected alternatives and the arguments for and against each option.

## How It Works

1. **When a plan decision is accepted** (Stage 1 Plan acceptance, Stage 2 Design approval), the document is timestamped and marked ACCEPTED. From this point forward it is not edited in place: a change travels as a Change Record, and the original receives one SUPERSEDED banner line and nothing else.

2. **The accepted document cannot be edited directly.** Any attempt to modify the content of an accepted document must go through the change record process.

3. **If new information requires a change:**
   a. Create a new Change Record in `docs/plans/{date}-{name}/changes/CR-{number}.md`
   b. The Change Record contains:
      - What changed
      - Why it changed
      - What it supersedes (specific document and section)
      - Impact on other phases
   c. The original document gets a status update: "SUPERSEDED by CR-{number}" (but content is NOT modified)
   d. The new decision/scope is the Change Record itself (or a new version of the document referenced by the CR)

4. **Change Records are numbered sequentially** (CR-001, CR-002, etc.). The numbering is global to the plan, not per-document, so the chronological order of all changes is immediately apparent.

5. **The manifest.md links to all Change Records** in chronological order, creating a single place where the full change history of the plan is visible.

6. **Anyone reviewing the plan can see the full decision evolution** by reading the change records in order. The chain from the current state back to the original decisions is always traceable.

## Why It Prevents Gaps

- **Prevents silent scope creep.** Every scope change is a formal, visible event with a dated record. Scope cannot drift incrementally through small, undocumented edits.
- **Preserves original rationale.** "We originally chose X because of Y" is never lost. When a future engineer asks "why didn't we do X?", the answer is in the historical record, not in someone's memory.
- **Creates accountability.** Every change record carries a dated author, so each decision can be traced to the person who made it.
- **Enables post-mortem analysis.** "What changed during the project and why?" is answerable by reading the CR chain. Without immutable records, post-mortems rely on faulty memory.
- **Prevents contradictions.** Two team members cannot silently edit the same section in conflicting ways. Each change is a discrete, visible event that must be reconciled with the current state.
- **Forces explicit justification for changes.** "I want to change the approach" requires explaining why the original approach is no longer valid. This friction is intentional — it prevents casual, unconsidered changes.
- **Enables change impact analysis.** Each CR explicitly states what other phases/documents are affected. When CR-003 changes the API design, it must list which phases need to be re-evaluated.
- **Satisfies audit/compliance requirements** for regulated industries. The immutable record chain meets SOX, HIPAA, and similar requirements for decision traceability.

## Status Before Implementation

When scope changes during Phase 6 Build, our plan workflow marks dependent phases as STALE and offers to return to Phase 3. But the original approach.md gets overwritten with the new scope. The original decision and its rationale are lost. There's no record of what changed, when, why, or who approved it. If the plan has 3 scope changes over 4 weeks, only the final state is preserved. We lose the decision evolution.

This has concrete consequences: when a build encounters a problem that was actually anticipated in the original approach but removed during a scope change, there is no way to discover this without relying on someone's memory. The rationale for the scope change — which might have been valid at the time but is no longer valid — is gone. The team either re-derives the original reasoning from scratch or proceeds without it.

## Implementation (Completed)

- **Add a `changes/` subdirectory** to the plan folder structure:
  ```
  docs/plans/{date}-{name}/
    intent.md                <- Superseded only via CR after Stage 1 (Plan) acceptance
    spec.md                  <- Superseded only via CR after Stage 2 (Design) approval
    changes/
      CR-001.md              <- First change record
      CR-002.md              <- Second change record
  ```

- **When any accepted stage document changes after its gate:**
  1. Write the change record to `changes/CR-{N}.md` with: what changed and why, which document/section it supersedes, the NEW content (the CR is the authoritative version going forward), and impact on other stages
  2. Add a status line to the TOP of the original document: "SUPERSEDED by CR-{N} on {date}". Do NOT modify the original document's content — the CR holds the new version
  3. Update manifest.md with link to the Change Record
  4. Update status.json with change record metadata

- **Add Change Record template:**
  ```markdown
  # CR-{N}: {Title}
  Date: {date}
  Author: {name}
  Supersedes: {document or section}

  ## What Changed
  ## Why It Changed
  ## Impact on Other Phases
  ```

- **Possible future enhancement: display change count in `/toque:plan-status` output.** The command does not report change records today — neither the overview loop nor the detail list mentions them. If added, the status output would show "Change Records: 3 (latest: CR-003, 2026-03-18)" so that plan health includes visibility into how much the plan has evolved.

- **Add change history section to the Stage 5 (Deploy) `review.md`.** The release review should include a complete list of all change records with their dates, summaries, and impact assessments. This gives the reviewer full context on how the delivered plan differs from the original plan.

## References

- AWS Prescriptive Guidance: ADR Process (docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html)
- Joel Parker Henderson, Architecture Decision Record (github.com/joelparkerhenderson/architecture-decision-record)
- IBIS (Issue-Based Information System) argumentation framework
- SOX/HIPAA compliance document management requirements
