# Testing Methodology Selection Framework

## What It Is

A decision framework that maps each plan deliverable to the most appropriate
testing methodology based on the situation (new code, refactoring, API
integration, UI change, database migration, etc.) rather than defaulting to
"unit tests" for everything.

## Why It Exists

AI-assisted development in 2026 creates a testing asymmetry: code is generated
at 10x speed, but testing has not kept pace.

Evidence:
- 2025 DORA Report: Embedding AI in software engineering creates a "productivity
  paradox" -- boosting speed and quality but increasing delivery instability.
- Cortex 2026 Engineering Benchmark: Pull requests per engineer climbed 20%
  year-over-year while incidents per PR rose 23.5%.
- Harness 2025 Survey: 72% of organizations reported at least one production
  incident caused by AI-generated code.
- ThoughtWorks Technology Radar Vol. 33 (Nov 2025): Flagged "complacency with
  AI-generated code" as a technique to hold/assess.

The default "write unit tests" approach fails because:
- Legacy code being refactored needs characterization tests, not unit tests
- API boundaries need contract tests, not integration tests
- AI-generated code needs separate test authorship, not self-testing
- User-facing features need BDD, not just assertion-based tests
- High-stakes migrations need shadow testing, not just staging validation
- Database schema changes need expand/contract, not big-bang migrations

## Evidence Tiers

Each methodology carries an evidence tier:

- **ENTERPRISE-VALIDATED**: Documented adoption at named companies or backed
  by established standards (ISO, IEEE, DORA, ThoughtWorks Radar, Fowler).
- **INDUSTRY-RECOMMENDED**: Recommended by credible practitioners/frameworks
  with broad adoption, but limited case studies specific to AI coding.
- **EMERGING PRACTICE**: Reasonable extrapolation from validated principles,
  recommended by multiple credible sources, but no named enterprise adoption
  data specific to AI-generated code.

## Enterprise Sources

- **ThoughtWorks Technology Radar (Vol. 32, Apr 2025)**: Placed "AI-aided
  test-first development" in Assess ring. Experiments found structured guidance
  with TDD produced production-grade code while "vibe coding" produced
  functional but unmaintainable software.
- **ThoughtWorks Technology Radar (Vol. 33, Nov 2025)**: Flagged "complacency
  with AI-generated code." AI-powered UI testing in Assess ring with caveat
  that LLM non-determinism introduces flakiness.
- **Anthropic 2026 Agentic Coding Trends Report**: Case studies from Rakuten,
  TELUS, CRED, Zapier. Identifies multi-agent coordination and separate
  review/testing agents as enterprise patterns.
- **Anthropic Code Review (Mar 2026)**: Multi-agent review for enterprise
  customers (Uber, Salesforce, Accenture). Validates separate-agent testing.
- **2025 DORA Report**: AI productivity paradox at enterprise scale.
- **ISO/IEC/IEEE 29119**: Software Testing standard. Formal basis for
  automated/manual categorization.
- **Martin Fowler**: Defined contract testing, parallel change (expand/contract),
  and evolutionary database design patterns.
- **Michael Feathers, "Working Effectively with Legacy Code" (2004)**: Origin
  of characterization testing. Standard enterprise reference.
- **Kent Beck, "Test-Driven Development: By Example" (2002)**: TDD origin.
- **SPARC Methodology (Agentics, open source)**: TDD + AI agent integration.
- **BMAD Method (open source)**: Brownfield modernization testing patterns.
- **Claude Code plugin-dev**: Test-generator agent pattern.
- **BAML (Boundary ML)**: Two-tier verification in production.
- **pgroll (Xata)**: Expand/contract pattern automation for PostgreSQL.
- **Flagger (CNCF)**: Enterprise canary/shadow deployment.
- **GitHub**: Shadow testing for merge algorithm rewrite.

## The 11 Methodologies

### 1. TDD (Test-Driven Development) [ENTERPRISE-VALIDATED]
**Cycle:** Red (write failing test) -> Green (minimal code to pass) -> Refactor
**Trigger:** New feature with clear spec, algorithms, core business logic,
stored procedures with defined inputs/outputs
**Protects against:** Logic errors, refactoring regressions, missing edge cases
**Does NOT protect against:** Integration failures, UI mismatches, external deps
**Who writes tests:** A separate agent, or a human, generates the tests from the
spec FIRST; the implementation agent then writes code to make them pass. One
agent never authors both sides of an AI-generated deliverable (LINT-18). The
red-green ordering is kept; only the author changes.
**AI adaptation:** Spec-Generate-Implement-Verify-Refactor cycle replaces
traditional Red-Green-Refactor. A test-writer agent generates the FULL test
suite from the spec before any implementation, rather than incrementally; the
implementer receives the suite, not the spec's answers.
**Enterprise evidence:** ThoughtWorks Radar Vol. 32 (Assess ring). ThoughtWorks
experiments validated TDD + AI produces production-grade code. SPARC methodology.

### 2. BDD (Behavior-Driven Development) [INDUSTRY-RECOMMENDED]
**Format:** Given [context] / When [action] / Then [outcome]
**Trigger:** User-facing features, cross-functional teams, requirements ambiguity
**Protects against:** Misinterpreted requirements, behavior drift, misalignment
**Does NOT protect against:** Performance issues, algorithmic bugs, non-functional
**Who writes tests:** Humans write Gherkin specs (product/QA). AI wires step defs.
**Enterprise evidence:** Mature methodology (Cucumber, SpecFlow). Widely adopted
in enterprise. No specific evidence of AI-adapted BDD at named companies.

### 3. Characterization / Golden Master Testing [ENTERPRISE-VALIDATED]
**Approach:** Capture current behavior as baseline, assert preservation
**Trigger:** Refactoring legacy code, extracting from monolith, behavior unknown,
data migration validation (capture row counts, checksums, referential integrity)
**Protects against:** Behavioral regressions, undocumented business rules
**Does NOT protect against:** New feature correctness, non-deterministic outputs
**Who writes tests:** AI captures snapshots. Humans approve golden baseline.
Separate agent validates post-refactor.
**Key principle:** Characterization tests document what code DOES, not what it
SHOULD do. They are change detectors, not correctness validators.
**Database application:** Before data migration, capture golden master of row
counts, checksums, and referential integrity. After migration, compare.
Normalize volatile data (auto-increment IDs, timestamps) before comparison.
**Enterprise evidence:** Michael Feathers (2004). ThoughtWorks "test-first
modernization." BMAD method. Mechanical Orchard's Imogen platform (banking,
insurance, retail).

### 4. Contract Testing [INDUSTRY-RECOMMENDED]
**Approach:** Consumer defines expected API contract, provider verifies
**Trigger:** Microservices, API integrations, independent deployment, database
backward compatibility (old code + new schema must both work)
**Protects against:** Schema mismatches, provider breaking changes
**Does NOT protect against:** Internal logic errors, performance under load
**Who writes tests:** AI generates contracts from OpenAPI specs. Humans define
business-critical contract terms.
**Database application:** When schema changes affect API consumers, contract
tests verify both old code + new schema AND new code + old schema work.
Combined with expand/contract, this validates the transition phase.
**Enterprise evidence:** Martin Fowler defined the pattern. Pact used at
Discover Financial, Atlassian, and others.

### 5. Property-Based Testing [INDUSTRY-RECOMMENDED]
**Approach:** Define invariants, generate random inputs, verify properties hold
**Trigger:** Algorithms with infinite input space, financial calculations, data
transforms, query performance testing (generate realistic load volumes)
**Protects against:** Edge cases, off-nominal paths, invariant violations
**Does NOT protect against:** Specific business rules, UI flows, integration
**Who writes tests:** AI excels here (generating input generators and property
definitions). Human review of property correctness.
**Database application:** Generate realistic query volumes to detect N+1
patterns, slow queries, and missing indexes under load. Define invariants
like "query must return in <100ms for tables with <1M rows."
**Enterprise evidence:** Used at Jane Street, Ericsson (QuickCheck origin).

### 6. Snapshot / Approval Testing [INDUSTRY-RECOMMENDED]
**Approach:** Capture output, compare future runs against approved snapshot
**Trigger:** UI components, serialized output, reports, config generation
**Protects against:** Unintended output changes, visual regressions
**Does NOT protect against:** Semantic correctness, dynamic content
**Who writes tests:** AI generates snapshots, humans approve changes.
**Enterprise evidence:** Wide adoption (Jest, Approval Tests library).

### 7. Shadow / Parallel Testing [ENTERPRISE-VALIDATED]
**Approach:** Run old and new systems simultaneously, compare outputs
**Trigger:** Production migration, database cutover, replacing live systems,
data migration validation under real traffic
**Protects against:** Functional divergence under real load
**Does NOT protect against:** Latency differences, rare race conditions
**Who writes tests:** Humans design infrastructure. AI monitors diff output.
**Database application:** Dual-write to old and new databases during migration.
Compare query results from both systems. Essential for the "migrate" phase of
expand/contract on large datasets.
**Enterprise evidence:** GitHub (merge algorithm rewrite). Flagger (CNCF).
Dan Milstein: "Always insert that dual-write layer. Always."

### 8. ATDD (Acceptance Test-Driven Development) [INDUSTRY-RECOMMENDED]
**Approach:** Define acceptance criteria before implementation
**Trigger:** Sprint planning, user story definition, stakeholder alignment,
database migration sign-off (stakeholders confirm data integrity)
**Protects against:** Features not meeting acceptance, scope creep
**Does NOT protect against:** Unit-level bugs, scalability
**Who writes tests:** Three Amigos (product/QA/dev) define criteria. AI automates.
**Enterprise evidence:** Standard agile practice. BrowserStack, Katalon support.

### 9. Mutation Testing [EMERGING PRACTICE for AI context]
**Approach:** Inject faults into code, verify tests catch them
**Trigger:** Pre-release quality gate, measuring test suite effectiveness
**Protects against:** Weak/dead tests, false confidence in coverage
**Does NOT protect against:** Missing tests entirely, real-world failure modes
**Who writes tests:** Automated tooling (Stryker, PIT). Human reviews survivors.
**Enterprise evidence:** Google uses mutation testing internally. Using it
specifically as an AI code quality gate is our recommendation.

### 10. Exploratory Testing [ENTERPRISE-VALIDATED]
**Approach:** Session-based human testing guided by risk charters
**Trigger:** Complex UI, late-stage discovery, automation gaps
**Protects against:** Usability issues, unforeseen interactions
**Does NOT protect against:** Repeatable regressions (must automate follow-ups)
**Who writes tests:** Humans ONLY. AI generates test charters from risk data.
**Enterprise evidence:** Standard QA practice. ThoughtWorks Radar tracks
AI-powered UI testing separately but notes non-determinism concern.

### 11. Expand/Contract (Parallel Change) [ENTERPRISE-VALIDATED]
**Approach:** Three-phase schema evolution: expand (add new alongside old),
migrate (dual-write, backfill, test), contract (remove old after cutover)
**Trigger:** Database schema migration, renaming columns/tables, changing data
types, splitting/merging tables, any breaking schema change on a live system
**Protects against:** Downtime during schema changes, data loss, backward
incompatibility, rollback failures, environment drift between dev and production
**Does NOT protect against:** Application logic bugs, query performance
regressions, business rule violations in transformed data
**Who writes tests:** Humans design the expand/migrate/contract phases. AI
generates migration scripts and dual-write triggers. Each phase gets its own
test suite:
  - Expand phase: structural assertions (new columns/tables exist, old untouched)
  - Migrate phase: data integrity (row counts, checksums, referential integrity),
    dual-write verification, shadow comparison of old vs new query results
  - Contract phase: old structures removed, no orphan references, all code uses
    new schema
**Database-specific test checklist:**
  - [ ] Forward migration script runs cleanly on empty DB
  - [ ] Forward migration script runs cleanly on production-like data
  - [ ] Backward (rollback) migration script restores original state
  - [ ] Old code works against expanded schema (backward compatible)
  - [ ] New code works against expanded schema
  - [ ] New code works against contracted schema
  - [ ] Data integrity preserved (row counts, checksums match pre/post)
  - [ ] Referential integrity intact (no orphan foreign keys)
  - [ ] Indexes exist on new columns (no missing index regressions)
  - [ ] Query performance within acceptable bounds on new schema
**Enterprise evidence:** Martin Fowler, "Parallel Change" and "Evolutionary
Database Design." Prisma Data Guide. pgroll (Xata) automates this for
PostgreSQL with versioned schemas and database-level dual writes via triggers.
Flyway and Liquibase support versioned forward/backward migration scripts.
The plugin's Migration Guard enforced "never edit existing migrations" — the
foundation of this pattern — until it was retired with `toque-guard` in 9.0.0
(METHODOLOGY.md, "Why the plugin was retired"). The permission deny rules
documented there carry that enforcement now.
**Combines with:** Characterization (golden master of data before migration),
Shadow/Parallel (dual-write during migrate phase), Contract Testing (old code
+ new schema compatibility), Property-Based (query performance under load).

## AI-Specific Testing Principles

### Separate Test Authorship [ENTERPRISE-VALIDATED]
The agent that writes implementation code MUST NOT write the tests.
**Evidence:** Anthropic Code Review uses multiple specialized agents. Their
implementation guide assigns separate agents for implementation, testing,
docs, security.

### Higher Scrutiny for AI Code [ENTERPRISE-VALIDATED]
AI-generated code should receive more testing scrutiny than human code.
Set team-calibrated coverage targets above your human-code baseline.
**Evidence:** 2025 DORA Report (productivity paradox). ThoughtWorks Radar
(complacency with AI-generated code). Cortex 2026 benchmark.
**Note:** Specific numeric thresholds (e.g., "80-90%") are emerging practice.
Calibrate per team.

### AI Failure Mode Checklist [EMERGING PRACTICE]
Every AI-generated deliverable should be checked for:
- Logic drift (matches training patterns, not business rules)
- Stale dependencies (versions from training data, not current)
- Hidden business rule violations (rules in comments/Slack/tribal knowledge)
- Tautological tests (assertions that restate implementation)
- Happy-path-only coverage (missing negative/error cases)
**Note:** Failure modes documented by Testkube, Bright Security, Anthropic.
Checklist format is our synthesis.

### TDD Cycle Adaptation for AI [ENTERPRISE-VALIDATED]
Traditional: Red -> Green -> Refactor (human iterates incrementally)
AI-adapted: Spec -> Generate Tests -> Generate Implementation -> Verify -> Refactor
**Evidence:** ThoughtWorks AI-aided test-first development (Radar Vol. 32).
SPARC methodology.

## Common Methodology Combinations

| Scenario | Primary | + Secondary | + Tertiary |
|----------|---------|-------------|------------|
| Refactor legacy + add feature | Characterization | TDD (new code) | Snapshot |
| New microservice endpoint | TDD | Contract Testing | Property-Based |
| UI component update | Snapshot | BDD (user flows) | Exploratory |
| Database schema migration | Expand/Contract | Characterization (data) | Contract (compat) |
| Database cutover (new DB) | Shadow/Parallel | Characterization | Expand/Contract |
| Stored procedure change | TDD (pgTAP/tSQLt) | Characterization | Property-Based |
| Data migration (rows moving) | Characterization | Shadow/Parallel | ATDD (sign-off) |
| API version upgrade | Contract Testing | Characterization | Property-Based |
| Sprint feature delivery | ATDD | TDD (unit) | BDD (integration) |
| Pre-release quality gate | Mutation Testing | Exploratory | All existing |
| Payment/financial logic | TDD | Property-Based | Characterization |
| Query performance validation | Property-Based | Characterization | Shadow |

## Database Testing Quick Reference

| Database Concern | Primary Method | Secondary | What to Assert |
|-----------------|----------------|-----------|---------------|
| Schema migration | Expand/Contract | Characterization | Forward/backward scripts work, old+new code compatible |
| Stored proc / DB logic | TDD (pgTAP/tSQLt/DbUp) | Characterization | Inputs produce expected outputs, edge cases handled |
| Data migration | Characterization | Shadow/Parallel | Row counts, checksums, referential integrity preserved |
| Rollback safety | Expand/Contract | Structural assertions | Apply -> verify -> rollback -> verify original state |
| Query performance | Property-Based | Profiling in CI | N+1 detected, queries under threshold, indexes present |
| Backward compat | Contract Testing | Expand/Contract | Old code + new schema works, new code + old schema works |

## Integration with Plugin Phases

- **Phase 4 (Plan):** Select methodology per deliverable using decision framework
- **Phase 5 (Audit):** Dimension 7 is the lens through which methodology selection is examined; the result is a per-criterion verdict (LINT-17, LINT-18 MET / UNMET / N_A), never a rating
- **Phase 7 (Impact Review):** Verify methodology coverage for all changed code
- **Phase 8 (Test):** Execute methodology-specific test procedures
- **Phase 9 (Handoff):** Document which methodologies were used and results

## LINT Rules

LINT-17: Every deliverable in Phase 4 spec must have a testing methodology assigned.
  Fails if any deliverable has no methodology or uses "unit tests" without justification.

LINT-18: AI-generated code deliverables must specify a separate test writer.
  Fails if the same agent is both implementation author and test author.

## References

### Enterprise-Validated Sources
- ThoughtWorks Technology Radar Vol. 32 (Apr 2025): AI-aided test-first development
- ThoughtWorks Technology Radar Vol. 33 (Nov 2025): AI-generated code complacency
- Anthropic 2026 Agentic Coding Trends Report: Rakuten, TELUS, CRED, Zapier
- Anthropic Code Review (Mar 2026): Multi-agent review (Uber, Salesforce, Accenture)
- 2025 DORA Report: AI productivity paradox
- Cortex 2026 Engineering Benchmark: Incident rate data
- Harness 2025 Survey: 72% AI incident rate
- ISO/IEC/IEEE 29119: Software Testing standard
- Michael Feathers, "Working Effectively with Legacy Code" (2004)
- Kent Beck, "Test-Driven Development: By Example" (2002)
- Martin Fowler: Contract Test, Parallel Change, Evolutionary Database Design
- GitHub: Shadow testing for merge algorithm rewrite
- Flagger (CNCF): Enterprise canary/shadow deployment
- pgroll (Xata): Expand/contract automation for PostgreSQL
- Prisma Data Guide: Expand/contract pattern documentation
- Flyway, Liquibase: Versioned forward/backward migration scripts

### Industry-Recommended Sources
- BAML (Boundary ML): Two-tier verification
- SPARC Methodology: TDD + AI agents
- BMAD Method: Brownfield modernization testing
- Claude Code plugin-dev: Test-generator agent pattern
- Agent.ai Best Practices: 3-phase testing approach
- Dan North: BDD
- Pact: Consumer-driven contract testing
- pgTAP, tSQLt, DbUp: Database unit testing frameworks

### Emerging Practice Sources
- Testkube: AI failure modes (logic drift, stale deps)
- Bright Security: Treat AI code as untrusted
- NxCode Agentic Engineering Guide: Multi-agent testing pipeline
- QA Wolf 2026: Deterministic vs agentic testing
