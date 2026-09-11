# Changelog

## 11.3.0 (2026-09-10)

### Added

- **`tq-gate-baseline.js`, the third design-gate tool.** The baseline comparison that decides LINT-14 was prose the caller executed by hand, and its rule keyed a regression on "the line the item's new record cites" — which coverage, scenario and cross-cutting-concern rows do not have. In one stress-run scenario the single criterion standing between a spec and a gate PASS was a concern row, and two independent readers of that paragraph reached opposite verdicts about whether it could be a regression at all. The comparison is now four subcommands: `compare` diffs the document against the previous baseline's copy and classifies every element that changed status, `record` writes the `## Baseline comparison` section and pins the LINT-14 evidence record to it, `repin` recomputes that pin after the appends that follow it, and `snapshot` writes the new baseline and keeps the document copy the next diff needs. Every compared element carries the lines it is about and the file they were read from — a lint criterion filling them from its evidence record, a matrix row naming them itself — and a flip the tool cannot scope is recorded as a regression with the reason, never exempted on a guess. A regression outranks a class the previous baseline never carried: missing information about one class does not erase a regression established in another. The diff marks the lines the revision changed, the seams of any run whose position shifted, and every line a relocated block crossed — so moving a commit phase above a validation phase is a regression against a concern about that ordering, while an ordinary revision that edits a 300-line document at both ends still marks four lines. A moved block is found from distinctive lines — text occurring exactly once in each version — so relocating boilerplate is never read as a move, and pairing line by line rather than whole-block means a revision note written beside a moved block does not hide it. Literal HTML blocks are shielded as CommonMark has them, comments, raw-text elements and block-level tags alike, so a heading inside a comment does not truncate the pinned section and an evidence log inside `<pre>` or a `<table>` does not read as an unterminated fence. Layer 9 of the suite (`tests/gate-baseline-test.js`) and PH5-044 in `tests/layer1-repo.sh` guard it.

### Changed

- **The revision channel sends one line per witness.** The feedback form sent one line per unmet criterion, naming one location, so a rule quantified over the whole document ("every new behavior has a test") was closed one instance per iteration and re-found by the next fresh auditor; one stress-run scenario spent both iterations on LINT-07 that way while all three witnesses were visible in v1. The form now sends one line per defect, the auditor's UNMET table lists one row per witness, and no count of further instances is sent (decision D9).
- **A regression is a flip on text the revision changed.** LINT-14 counted any element that was passing and now fails, with an exemption only when the document was byte-identical — which a revision loop never is — so a fresh auditor noticing a pre-existing defect on iteration 2 booked a regression on text nobody touched. The caller now keeps a copy of the document beside each baseline and diffs it: a flip whose cited lines are unchanged is reported as auditor variance and fails only its own criterion; when no prior copy can be found the caller says so and every flip counts, as before (decision D10).
- **A compared element is settled on its quoted text, not its line number.** A line range is a coordinate, and any edit above a citation invalidates it while leaving the cited content untouched; all four of one stress run's false regressions were that conflation — a re-wrapped line above the citation, a block inserted inside its range, and a paragraph restructured into a table around a requirement that survived verbatim. The comparison now carries an evidence record's `exact_quote` onto its element as an anchor: a quote present in both documents is unchanged, one only in the current document was written by the revision, one only in the previous was removed by it, and one in neither falls back to the line test. A matrix row, which has no evidence record, carries `exact_quote` inline beside `lines`; `compare` and `snapshot` refuse a baseline whose inline quote does not match the document byte for byte, and `snapshot` warns on a row with lines and no quote. The anchor yields to one thing only, a block the revision relocated, so reordering phases is still a regression against a concern about their order. On the next real revision, 20 pass-to-fail flips were classified with no false regression and no missed one, every row decided by its anchor.
- **Evidence reinforcement runs once, after the loop.** Audit notes and the `Last reinforced` line were written into the document between iterations, where the next auditor — forbidden any prior verdict — had to find, disclose and re-derive around them. They are now written once, to the final version, from the final audit and the gaps earlier iterations closed; the baseline snapshot is still taken every iteration (decision D11).

### Fixed

- **The fresh auditor could read the revision out of git history.** In one stress run the auditor's first repository command was `git log --oneline -5`, and the rubric-free judge ran `git show HEAD -- {doc}` and opened its findings with the commit that added the text under test. `plan-auditor.md`'s forbidden-inputs block now names the audited document's own version history — earlier revisions, diffs of it, commit messages describing its changes, and unscoped history that touches it — while history of other files stays available to verify the document's claims. The judge never reads that file, so its prompt carries the same exclusion as a second sentence, which names no criterion and keeps it rubric-free. Relaunched on the same fixture, neither agent ran a history command and both said so. Not closed by this: Claude Code places a git snapshot — recent commit subjects and the git user — in every session's and subagent's starting context, which no plugin text can withhold. Under the new rule one auditor disclosed that snapshot and set it aside.
- **A stale citation on a non-MET record passed validation.** `validateRecord` returned for any valid non-MET verdict before looking at its citations, so an UNMET record pinned before a later append to `audit.md` read "0 flagged" with exit 0 and EVIDENCE_OK true. A non-MET record now has its supplied citations checked and keeps its verdict; absent evidence still raises nothing, and a valid citation does not promote it. Two `tq-gate-baseline.js` defects found in the same review: the CLI's `compare` dropped the anchors it had just filled, scoping every record-anchored element by line number where the in-process path scoped it by text; and an inline quote labelled `"line_source": "evidence/…"` skipped validation on the label alone.
- **The canary planted its assumption row outside the register.** `tq-canary.js` scanned from the register header to the next `| 1 |` row anywhere below it, so on a register numbered A1..A11 the row landed 120 lines down inside a Testing Strategy table, `inject` exited 0, and `canary.json` named a criterion the copy did not violate — a correct audit then read as a miss on both trials, which condemns the audit and forbids revision. The scan now anchors on the register's header row followed by a separator, stops at the first non-table line, appends after the last row with the register's own numbering and column count, and refuses when the register is empty. The scaffolder's register template shows an example row. Ten assertions in `tests/canary-test.js`.
- **The answer key sat beside the exam.** `inject` wrote `canary.json` into the same folder as the mutated copy, and one stress-run judge that listed the folder of the file it was handed read it. The copy now sits alone in `.canary/doc/`; the record stays in `.canary/`, and the auditor's forbidden-inputs block names it.
- **The strip-and-recheck reached one criterion; the mutation's blast radius did not.** A planted row that failed a second criterion sent that verdict to the generator as a defect to fix, and a stripped finding survived as two matrix gaps that entered the baseline. `canary.json` now records the operation and line of the edit, and the gate re-derives every verdict, matrix row and concern status that rests on that line before the baseline is taken.
- **The LINT-14 pin ordering was unsatisfiable as printed.** "Nothing after the pin may edit that file" preceded two mandatory appends to `audit.md` (`## Evidence notes` with no generator, `## Revision History` after the loop), so executing the steps in order flagged EVIDENCE-STALE and closed the gate on a document nobody changed. The gate now re-pins and re-validates after any later edit, and EVIDENCE_OK is the exit code of the last validator run before the gate record is written.
- **Prior-iteration verdicts reached the next fresh auditor through the document.** Evidence reinforcement wrote audit notes naming criterion ids and verdicts into the spec, which the next iteration's auditor is forbidden to read; ten such notes sat in one stress-run spec. Notes now carry prose only, the auditor's file states how it treats a note that names a verdict anyway, and the gate folder is swept of the previous iteration's `audit.md` and `evidence/` while the auditor works.
- **The baseline comparison had no category for three transitions it produced, and three vocabularies with no mapping.** `covered -> partial` and `ok -> warn` fell outside every listed class and one stress-run executor invented a category on the spot; they are now DEGRADATION, reported and not a LINT-14 failure. The baseline schema enumerated `covered|partial|ok-excluded|gap` while the auditor's matrices emit `OK|WARNING|GAP` and its lint tables emit `PASS|FAIL|N_A`, with nothing mapping them — all three map in one place now, and a token outside them is refused rather than guessed. `history` never said what it held; it holds the whole previous baseline. And LINT-14 no longer enters its own comparison, where the auditor's standing N_A against the caller's overwritten verdict reported as a status change every iteration.
- **`quick-plan` still described the pre-D9 revision channel**, one line per unmet criterion where the gate now sends one per defect.
- **Smaller gate defects from the third stress run.** FULL mode admits a `reaudits/{date}/` folder, as its own parenthetical already claimed; the record schema's field-order sentence names `criterion_id`, whose omission silently skipped the unsupported-citation check for the two executable rules; the auditor's Gap Summary carries `Total gaps` and `Total warnings` so the two shipped templates agree; the canary-reason vocabulary reads six with a rule for which wins when two occur, and `quick-audit` presents all six tokens.

### Internal

- **The stress rig's auditor launches no longer carry the operator's environment.** `launch-auditor.sh` passed the operator's output style into the auditor under test, then — once that was overridden — their `~/.claude/CLAUDE.md` and rules, one of which surfaced in an auditor's text unprompted. It now launches with `--restricted --tools … --strict-mcp-config --plugin-dir … --add-dir …` plus `--settings '{"outputStyle":"default"}'`, and a full audit under those flags carried none of the operator's rules. `check-invariants.js` no longer reads a Lite audit's per-criterion PASS cells as a gate verdict, and its `git_status` no longer reports an unstaged change as staged. Stress runs 3 through 7 are recorded in `stress-test.md`.
- **Three stress-rig artifacts the fourth run recorded.** `check-invariants.js` probed `history[i].run_number` against a field no schema then put there and reported a false negative on a scenario that had done it right; it now reports the shapes and run numbers it actually found, and the field is real, since `snapshot` writes whole baselines. `freeze-plugin.sh` writes `run-started.txt` itself, naming `hash-tree.sh` as the digest recipe with its normalisation rules, the source commit and the exclusions — both run-4 verifiers could re-derive every gate term from disk and neither could reproduce `frozen-before.sha`, because nothing said which recipe produced it. `launch-auditor.sh` records a wrapper PID, the child PID, a launch nonce, the host and the output file's size, mtime and hash: not proof against a determined forger, but the difference between a record that describes a launch and one written by one.
- **A third discrimination fixture closes the gap 11.2.0 named.** The repaired fixture's text stated the property each of LINT-21 through LINT-24 restores, so the pair could not show that the rules separate a mechanism that works from one merely claimed to work. `tests/fixtures/lint-discrimination/nightly-export.claimed.md` is the repaired spec with the same four lines rewritten so that each still asserts the property while the mechanism it describes fails. Under one neutral prompt, two blind auditors returned UNMET on all four for the new fixture and MET on all four for the repaired one, 8 of 8 against a prediction sealed before either launched, every citation on its planted line. Layer 3 asserts the new file is 93 lines and differs from the repaired twin at exactly lines 24, 37, 45 and 86. Still open, recorded in `result-claimed.md`: the LINT-22 and LINT-23 verdicts rested partly on the registry's paragraph about where the four rules came from, and each fixture has been judged by one auditor instance.

## 11.2.0 (2026-09-06)

### Added

- **Four lint rules, LINT-21 through LINT-24.** All four came out of the Phase 5 rubric-free holistic pass from a single angle: the registry checked that a control was named, never that it works. LINT-21 requires every mitigation for a silent-failure risk to name a signal not derived from the same filtered source as the failure; the source case compared rows requested against rows affected to catch a row-level-security policy filtering silently, but the read and delete policies carried identical predicates, so the two numbers always agreed. LINT-22 requires every stated ordering between deployable artifacts to name the mechanism that enforces it. LINT-23 requires every rollback artifact the plan itself creates to be re-runnable and created at the point whose state it preserves. LINT-24 requires every named measurement to exercise the property its requirement states. They are kept apart rather than merged: one rule covering all four would have to be stated so generally that no auditor could return a falsifiable verdict on it. Each has a triggering condition, and a plan that meets none of them passes with the absent condition recorded as the reason, not N_A. The Phase 5 set, the registry total and the Lite set each grow by four; the counts themselves live only in the registry. `lint-candidates.md` records the disposition with project detail stripped, and its entry format now reads `{finding-slug}` rather than `{plan-name}`, since a plan name is project detail. Verified against a discrimination pair under two blind auditors, 8 of 8 verdicts matching a prediction sealed before either ran. Not yet shown: that the rules separate a mechanism that works from one merely claimed to work, because the repaired fixture's text states the property it restores.

### Fixed

- **The holistic pass discarded its own output.** A live run filed four candidates into the installed plugin's `lint-candidates.md`, which sits under a version-keyed cache directory replaced on upgrade. The write succeeded, so nothing reported it. The pass now records every candidate in full under `holistic_pass.candidates[]` in the gate record (`status.json` for a plan folder, `gate.json` for a standalone document), committed with the plan that produced it, and never writes the plugin's `lint-candidates.md`. Promotion into a rule is the owner's job, reading gate records across projects with project detail stripped. Unmapped findings are clustered by angle and the angle is named in each entry, but a cluster is never collapsed into one candidate. The schema 2 template lists `baseline`, `history` and `holistic_pass` as fields the gate writes and states that hooks read only `current_phase` and `phases`; `gate.json` gains `holistic_pass`.
- **46 documentation claims the code contradicted.** A sweep read each user-facing document against the source it describes and re-checked every finding adversarially. Among them: `install.md` said the hooks "never create files" seven lines above saying one appends to `subagent-log.txt`; `the-plan-workflow.md` called the canary and validator "the only executable checks" four lines below a table listing the automated tests as one; the plugin README gave Stage 6 a gate the stage file calls "None" and omitted Stage 2's human review; `GUIDE.md` keyed quick-audit's record location on `--plan` when the command keys it on whether the file is the plan's own `spec.md`; `help.md` said quick-plan does no research when the scaffolder deploys three analysts; `METHODOLOGY.md` still flagged two defects fixed in 371b37d. The plugin README's "Commands (6)" heading keeps its number, which `layer1-core.sh` asserts against the file count, and gains two lines explaining the nine rows. Held back: `stage-2-design.md` and `stage-4-test.md` still point an executing agent at a bare `docs/planning-techniques/` path that resolves only inside the plugin; fixing those changes what the agent reads.

### Internal

- **The LINT-21 to LINT-24 discrimination pair is checked in** at `tests/fixtures/lint-discrimination/`: one 93-line spec with a planted instance of each rule, its repaired twin differing at exactly lines 24, 37, 45 and 86, the prediction sealed before the auditors ran, and the recorded result. Layer 3 asserts the pair still differs at exactly those four lines. The rules are judged by an auditor, not by code, so the guard protects the fixture, not the verdict.
- **The stress rig's freeze is checked in.** Run 1 of the conformance stress test was partly void because the plugin changed underneath it, and run 2's freeze lived in a scratch directory described in prose. `stress-rig/freeze-plugin.sh` (`freeze`, `verify`, `unlock`) builds a read-only frozen tree and a writable twin from one tar stream, digests before locking, and proves the lock by attempting two writes and failing if either succeeds. `hash-tree.sh` is the shared digest and reproduces run 2's recorded digest over 256 files. `build-fixtures.sh` no longer aborts on its own s4 sanity check; both canary checks are now assertions with named failures. `stress-test.md` moves its runtime-conformance confidence from 55% to 75% and names the remaining gap: run 2's own fixes have not been run, and auditor isolation is structural in two scenarios of six.

## 11.1.0 (2026-09-06)

### Changed

- **One design gate (D1).** `/toque:quick-plan` claimed "the same gate as Stage 2" while spawning the auditor on its own terms, with no canary and no evidence validation; `/toque:quick-audit` had no gate at all. Stage 2's Part C is now a delimited `<design_gate>` block with three bindings (`{doc}`, `{gate_dir}`, `{generator}`), and both shortcuts execute that block by reference. A standalone document gets a gate folder beside it (`docs/specs/{name}/` for a quick-plan spec) holding `audit.md`, `evidence/` and `gate.json`; the `.canary/` scratch is deleted once used. The auditor no longer has a conversation-only mode. `quick-audit` has no generator, so it reports `NOT PASS` with the unmet criteria and stops. A document written outside the spec template can be audited but cannot PASS: the canary has nothing to attach to, and the gate says so instead of skipping the check. Evidence records are re-anchored to the committed document before validation, so committed evidence never cites the mutated copy. Guarded by PH5-042 in `tests/layer1-repo.sh`.

- **Authorization and release are two events (D4).** Stage 5 marked Deploy `complete` and printed `Released` the moment a human authorized. It now records `authorized_by`/`authorized_at` and leaves the stage `authorized`; a later human confirmation writes `released_by`/`released_at`, marks the stage `complete`, moves `current_phase` to `maintain`, and starts Maintain. `/toque:plan {name}` on resume asks whether an authorized release happened; `/toque:plan-status` reports plan-to-authorization always and plan-to-release only when known, and labels a pre-existing `complete` without `released_at` as recorded at authorization. Existing status files need no migration: the new fields are optional. Guarded by REL-1.

- **The immutable set is enumerated (D5).** "Accepted plan documents are immutable" contradicted every stage that writes `plan.md`, `status.json` and `manifest.md`. Stage 3 now names the set: `changes/CR-*.md` and `snapshots/**` are never edited once written (what CI refuses in this repository); accepted documents are superseded through a Change Record and one SUPERSEDED banner line; everything else is living state updated in the way its stage describes.

- **A separate agent writes the tests (D2).** The TDD entry in the testing-methodology guide let the implementation agent write its own tests first, against LINT-18 and both stage files. It now assigns test generation to a separate agent or a human, keeping the red-green ordering.

- **Baselines stay read-only (D3).** The BRD template's deep scan said to update confidence in the audit baseline, two lines above the rule that baselines are never written back. Verified confidence is now recorded in the BRD's own coverage table.

- **A planned deliverable is not an infrastructure gap (D7).** The design gate checked whether every named test and monitoring file existed at audit time, while the spec template tells the author to name the file each phase will create. An honest pre-build plan therefore failed its own coverage check. Infrastructure verification now classifies each referenced path as PLANNED (this plan delivers it) or CLAIMED (the plan relies on it already existing, or a phase uses it before the phase that creates it) and judges only the claims. LINT-15/16 follow the same scope. Guarded by PH5-043.

- **A fresh auditor is defined (D8).** The canary measures whether an independent auditor finds a planted defect, and the instructions never said what "independent" meant. A fresh instance is now the Agent tool or `claude -p` launched from Bash; a role pass in the caller's own context is not, and never was. Isolation is decided before anything is injected: with neither route available, nothing is planted, the output is labelled findings rather than a gate, and the result is NOT PASS with reason `no-isolation`. `/toque:quick-plan` carries the same fallback for its scaffolder. Guarded by PH5-043.

- **A knowledge-base match is a lead, not a fix (D6).** The troubleshoot skill offered "Apply the same fix?" on a HIGH match before root-cause investigation, against its own Iron Law. A match now names the earlier cause as the first hypothesis for Phase 1; the earlier fix is not re-applied until Phase 1 confirms the cause, and only a confirmed match increments the recurrence count. Guarded by KB-1.

- **The guide names the file behind each entrypoint.** `Commands at a glance` gains a `Handled by` column, so a reader can see which of the nine entrypoints is a command file and which is a skill without listing two directories. The paragraph under `How the pieces connect` said "The other entrypoints call no agent"; that was only ever true of the two agents with a file in `agents/`, and `The 2 agents` now separates those from the subagents a stage or phase file defines inline.

- **The reader-facing pages were rewritten around one voice**, and the documentation audit's first six visuals were applied: tables for what installing writes, for which dependencies are required or conditional, and for what each stage reads, writes, checks and decides; Mermaid flowcharts for the canary, for evidence validation and the PASS decision, and for how the entrypoints connect to the agents, gate tools and output paths. `METHODOLOGY.md` was rewritten against the conformance audit and is about 1,200 lines, down from about 2,000.

### Fixed

- **The canary could not attach to a spec written from the plugin's own template.** `templates/spec.md` wrote rollback and go/no-go as bullets, had no dependency table with an owner, and no assumption register, so every class of `tq-canary.js inject` refused it and Stage 2 would have reported "no canary class could be applied" on its own specs. The template and the scaffolder's template now carry every shape (a `Rollback:` and a `Go/No-Go:` line per phase, an owned dependency row, an assumption register, named test files), Stage 2's Delivery instructions name them, and `tests/canary-test.js` fails if the template drops one. Found by a live stress run of `quick-audit`.
- **`assumption-inject` planted its row in the first numbered table, usually the Risk Assessment.** It now anchors on the assumption register and refuses a document without one.
- **The shared gate block, after live runs of both shortcuts:** a branch for a document the canary cannot mark; a no-isolation rule when no fresh auditor can be spawned; `detected` runs on the auditor's raw UNMET list, then records and `audit.md` line references are re-anchored to the committed document; records are re-pinned after evidence reinforcement; LINT-14 is the caller's verdict from the baseline comparison and is N_A whenever no baseline exists; lint results admit N_A; the gap total names its terms; `gate.json` has a fixed top-level shape; the registry and lint-candidates paths are plugin-relative (`${CLAUDE_PLUGIN_ROOT}/...`); the holistic pass is skipped and recorded when no fresh judge can be spawned; the assumption-verification step names where a standalone run records its counts; a `reaudits/{date}/` folder takes the standalone branch.
- **Auditor and registry text:** LINT-08 covers falsified as well as unverified HIGH-impact assumptions; LINT-18 is UNMET, not N_A, when authorship is unspecified; the lint table admits N_A with a reason; the audit report's Criterion Verdicts section points at `evidence/` instead of inlining records; the specialist reviewers' `docs/audit/*` inputs are marked optional; the confidence tiers follow the self-audit skill (a quote from the plan is Tier B, Tier C is never HIGH); the reviewer count reads five, matching the text below it.
- **The plan skill's parallel rule** said two independent tasks go to subagents while its scaling table said two run inline; the rule now says three or more.
- **The baseline-regression technique note** claimed the gate tolerates pre-existing gaps; it now says that is the technique's origin and that Toque's gate blocks on every unmet criterion.
- **The canary's second chance could silently be its first chance again.** The gate told the caller to retry a missed canary with the literal seed `retry`, on the stated grounds that the default seed "is derived from the file and would pick the same class again". `pickClass` hashes the seed alone — the document is not an input — so `retry` always selects the same class, about one default seed in five collides with it, and the rotation on a sparse document can return to the missed class regardless. Two misses of what was one trial failed the gate as "audit untrustworthy" and blocked the revision loop. `tq-canary.js` now takes `--exclude <class>`, which removes the class already tried from the rotation, records the exclusion in `canary.json`, and exits 3 when no other class applies so that "only one trial was ever possible" cannot be recorded as a second miss. Pinned by ten assertions in `tests/canary-test.js`.
- **LINT-20 was written two contradictory ways inside the registry.** The rules table said the confidence brief must have "all 3 sections"; Gate Behavior said it fails only if the brief "has none of the 3". A brief with two passes under one and fails under the other, and two independent auditors split on exactly that document. No shipped template emits three subsections. LINT-20 now checks that the brief exists and that each entry carries its required fields; the METHODOLOGY restatement follows.
- **A spawned auditor that starts and never returns had no representation.** The canary reason vocabulary was explicitly closed over four values, none of which fitted, and five of six live scenarios hit the case. The gate now relaunches once without consuming the canary re-run, records `auditor-did-not-return` on a second failure, and advises running specialist reviews in sequence when the auditor is a subprocess rather than a subagent.
- **Canary re-anchoring demoted verdicts on the gate's own edit.** A quote split by the injected or removed line is genuine but no longer locatable, so it was dropped as if fabricated, turning correct MET verdicts into UNMET. The carve-out already present for evidence reinforcement now covers the canary step too.
- **The LINT-14 caller record could not pass the validator it had to pass.** The caller was told to cite the baseline entries it compared, and those entries live in the gate record, which a later step rewrites — so the citation went stale, and a MET with no citation is a missing citation. The block now fixes the order: append a `## Baseline comparison` section to `audit.md`, pin `evidence/LINT-14.json` to it, update the auditor's own LINT-14 row as caller-decided, run the validator, write the gate record last. The previous baseline is identified explicitly (committed or not), and an unchanged document records N_A with any differences reported as auditor variance rather than regressions.
- **A rule whose triggering condition is absent is PASS, not N_A.** No compatibility claim, no external dependency, no endpoint. Recording N_A one run and PASS the next made the baseline comparison report a regression on a document nobody changed.
- **Evidence reinforcement demoted the citation its own edit split.** The inserted `Last reinforced` line broke the Evidence-section quote that LINT-20 pins; a quote split only by that line is now re-cited at its new range, and `EVIDENCE_OK` is the exit code of the post-reinforcement validator run.
- **Re-run semantics.** A same-day `reaudits/{date}/` folder is overwritten with its earlier gate record appended to `history[]` and its manifest row replaced, not duplicated; a standalone rerun overwrites in place with the same history append, and any existing `gate.json` is the baseline.
- **`/toque:quick-plan --plan {name}` named the spec after the plan**, so a second spec linked to the same plan silently overwrote the first and its gate record. The spec is now `docs/specs/{slug}.md` from the objective; `--plan` only selects the plan that receives the link rows.
- **`/toque:quick-plan` printed "This spec passed the design gate" unconditionally**, including on NOT PASS. It now prints the matching sentence for each result.
- Smaller: falsified HIGH-impact assumptions count toward the gap total and the baseline's assumption counts; the rubric-free holistic pass writes nothing into the audited repository and does not re-append a candidate already recorded; pasted text is never written over a different existing file; two bare lint-registry paths in `plan-auditor.md` are plugin-relative, so an auditor spawned in a consumer repository can find the registry; `audit.md` holds one verdict row per criterion pointing at `evidence/`, matching the auditor; the baseline's coverage statuses admit `partial` and `ok-excluded`; the four command files list `Agent` alongside `Task` in `allowed-tools`.
- **`tests/run-all.sh`** accepted only layers 1 to 7 as a single-layer argument while running 1 to 8 by default; it accepts 8 and rejects anything else.
- The suite's B4 cross-reference check could not fail when a shortcut command stopped referencing its agent; it now does.

### Internal

- CI refuses edits to immutable plan records. `.github/protected-artifacts.sh` blocks changes to `docs/plans/*/snapshots/**` and `docs/plans/*/changes/CR-*.md` in the working tree and across a pushed range, and the suite runs it as its own job.
- The eight owner decisions and their rationale are recorded in `docs/plans/2026-09-04-methodology-conformance/decisions.md` — D1 to D6 from the conformance audit in `findings.md`, D7 and D8 from the live stress test — alongside `stress-test.md` and the `stress-rig/` fixture builder and invariant checker.
- Mascot explorations that were not adopted are ignored rather than tracked; the shipped art remains the `toque-tall-*` variant.

## 11.0.1 (2026-09-04)

### Fixed

- **A JSON evidence file containing only `null` crashed the validator and took
  the whole corpus with it.** `validateRecord` was null-safe at both of its
  early returns, but `validateDirectory` read `rec.verdict` off the parsed value
  to report what the record claimed. `null` is valid JSON, so the file never
  reached the `EVIDENCE-UNPARSEABLE` path: it parsed, then threw
  `TypeError: Cannot read properties of null (reading 'verdict')`. That fails
  closed only by accident — nothing invalid passes, but nothing valid is checked
  either, and the caller gets a stack trace where a verdict belongs. A
  non-record now demotes itself to `EVIDENCE-VERDICT-INVALID` and the remaining
  files are still read. Regression test covers `null`, a number, a string, an
  array, and a valid record sorted after them.

- **`/toque:plan-export` wrote three generated files into the live plan folder
  instead of the staging copy.** `redaction-log.md`, `codebase-verification.md`
  and `CLAUDE.md` were written to `docs/plans/{name}/`, but the staging copy
  that becomes the zip is taken before those writes. The export polluted the
  working tree and shipped a package missing the three files its own contents
  list promised — including the `CLAUDE.md` the receiving developer's session
  depends on. The package description and the paths inside the generated
  `CLAUDE.md` now read `plans/{name}/`, matching the layout actually archived.

- **`/toque:quick-cleanup` created plan folders in the pre-8.0.0 shape.** It
  wrote `brainstorm.md` and set schema-1 phase keys (`brainstorm -> complete`,
  `research -> in_progress`) in `status.json`. Schema 2 defines only
  plan/design/build/test/deploy/maintain, so a folder created today was born
  looking like a legacy plan and `/toque:plan-status` would report a stage that
  is not a stage. It now writes `intent.md` and sets `phases.plan`.

- **The design gate silently ran in LITE mode.** `plan-auditor` detected FULL
  MODE by the presence of `brainstorm.md` and `approach.md`, names retired in
  8.0.0. Every current plan folder holds `intent.md` and `spec.md`, so detection
  fell through and the gate — which `lint-registry.md` classifies as Full mode —
  ran spec-only and advised the caller to "run `/toque:plan`" for the matrices it
  was already inside. Detection now keys on the current artifacts, with the old
  names kept as an explicit schema-1 fallback.

- **CI could not pass.** The `validate` job asserted a hardcoded count of three
  plugin directories. `9091fb9` split two plugins out to a separate repository
  and left the literal at 3, so the job failed on every push from that point,
  11.0.0 included, while both suite matrix legs were green. The check now
  derives the expected set from `marketplace.json` and compares it against the
  tree in both directions, so it cannot go stale the way a literal did.

### Changed

- **The documentation now describes the software that ships.** Reading all
  13,328 lines of the living documentation found 75 contradictions against the
  tree, where a keyword sweep had found five. `METHODOLOGY.md` section 3 is
  rewritten from a 9-phase workflow to the six stages shipped since 8.0.0. The
  8-dimension 1-5 scoring rubric is gone from every page that still described
  it — `plan-auditor.md` has forbidden a score field since 11.0.0, and the pages
  now state the gate that exists: per-criterion MET/UNMET/N_A resolving to
  `PASS = CANARY_OK AND EVIDENCE_OK AND VERIFIED AND INFRA_OK`. Also corrected:
  a "3 Safety Hooks" badge above a section explaining there are none, a
  SessionStart staleness nudge deleted in 11.0.0, test-layer numbers, three
  handler links to a directory that does not exist, a change-record template
  disagreeing with the one that ships, a `baseline.json` no code writes,
  LINT-20 failing on a `confidence.md` folded into `spec.md` at 8.0.0,
  ADR/BRD/PRD templates writing back to files `interop.md` documents as
  read-only, and a checks total that did not match its own table.

### Internal

- `tests/layer1-core.sh` locates the plugin README's hook table by heading, and
  that heading changed with the docs: the stale "Safety Hooks" vocabulary lived
  in the test too.

## 11.0.0 (2026-09-04)

### BREAKING

- **`/toque:codex-challenge` is removed.** The adversarial review loop against
  the OpenAI Codex CLI is deleted, along with its 447-line parser test and seven
  fixtures. The planning plugin goes from 10 command surfaces to 9 and from 6
  skills to 5. There is no replacement command; anyone wanting a cross-model
  second opinion now runs the Codex CLI directly.

  **Why.** The loop reported success at 36/40, so a plan whose rollback scored
  the worst possible 1 out of 5 could still total exactly 36 on seven perfect
  dimensions and be declared converged — six unrelated strengths outvoting one
  fatal flaw. That is precisely the compensating sum this project's design gate
  forbids: *"There is no weighted sum. A strong showing on seven criteria cannot
  offset a miss on the eighth."* Repairing it meant changing the prompt, the JSON
  response schema, four fixtures and the parser — a contract migration with an
  external tool — to keep a command that could not run without that tool
  installed. Deleting it was cheaper and more honest.

  **What is genuinely lost:** adversarial review by a different model family.
  Nothing replaces it. The design gate's canary and evidence validator check
  whether an audit was performed *honestly*; they do not offer a second opinion
  on whether a plan is *good*.

- **`/toque:quick-audit` no longer prints a score.** It reports PASS or NOT PASS
  with the criteria that failed, and findings by severity citing `file:line`.
  The `X/40` total and the Green/Yellow/Orange/Red band are gone, as is the
  scorecard table.

- **Plan fixture shape.** `tests/fixtures/plan-*/status.json` carry
  `"verdict": "PASS" | "NOT_PASS"` in place of `"score"` and `"rating"`. Anything
  parsing those fixtures must be updated.

- **`METHODOLOGY.md` §7 is retitled** from "The Plan Audit Scoring System" to
  "The Plan Audit". Its "Score Thresholds" subsection and 0-40 traffic-light
  diagram are deleted; "The 8-Dimension Scorecard" becomes "The 8 Review
  Dimensions" with its `/5` columns removed. Six of its nine subsections are
  unchanged — the evidence requirement, the four gap checks, the lint rules, the
  five subagents, the verification pass and the sources all still describe the
  gate accurately. Section 8 shifts from line 1258 to 1236; the only
  cross-reference into this document points at §6 and is unaffected.

- **`docs/planning-techniques/10-llm-rubric-calibration.md` is retired.** 157
  lines arguing that plan scoring should be made consistent via 1-5 rubrics, in a
  product that no longer scores. It had no inbound references.

- **The suite drops from 8 layers to 7.** Layer 5 tested the deleted parser;
  layers 6, 7 and 8 renumber to 5, 6 and 7. `tests/run-all.sh` accepts `1-7`.


- **A third review answered the question the first two raised: stop patching.**
  Rounds one and two each fixed the demonstrated instance and left the class
  open — executable criteria went from "assert an exit code" to "cite anything",
  then from "cite anything" to "cite anything non-empty". The third review's
  probe settled it: a citation quoting a single `}` character returns `MET` on a
  fabricated `INFRA-` criterion with no flags at all.

  **Relevance is not decidable by text comparison, and the validator no longer
  implies it is.** Its module header always said so; the two rounds of patching
  ignored its own documentation. What a `MET` guarantees is now stated wherever
  the gate is described: the cited file exists, is unchanged since the audit, and
  contains the quoted text at the cited lines. Whether that text *supports* the
  criterion is a judgement about meaning, and no byte comparison makes one.

  `documentation/the-design-gate.md` says it in the user's terms, the spec
  carries it as a row in the contract table, and the human-review waiver in
  `stage-2-design.md` now states what waiving actually skips — the only reader
  who checks that the evidence supports the verdicts. Waiving stays defensible on
  small reversible work; it is not defensible *because the gate was green*, since
  green was never a claim about relevance.

- **The canary's blanket-rejection rule was never wired.** It was added to
  `wasFound` in the previous release, and `wasFound` has no caller outside its
  own unit tests: `stage-2-design.md` instructed an agent to check membership by
  hand, in prose. In this plugin the markdown *is* the runtime for agent
  behaviour, so a rule living in JavaScript nothing invokes is decoration.

  `tq-canary.js` gains a `detected` subcommand — record, UNMET set, applicable
  set, exit 0 or 1 — and the workflow now runs it instead of eyeballing. Without
  the applicable set it warns and degrades to plain membership, which is the
  behaviour that let an audit returning *every* criterion as UNMET pass by
  construction. A missing record exits 2; it was never a pass.

  Layer 6 goes from 35 assertions to 42. Its CLI helper switched to `spawnSync`,
  because `execFileSync` returns stdout only and a warning printed to stderr
  alongside exit 0 was invisible to the tests holding it.

- **A second adversarial review found nine more, including one my own fix
  opened.** The reviewer was asked to attack the previous round rather than
  re-run it, and the headline finding is that the executable-criterion fix
  replaced one bypass with a narrower one.

  **An empty quote satisfied any criterion.** Requiring "a citation that
  survives re-checking" closed the fabricated-exit-code route and opened this:
  cite a blank line with `exact_quote: ""` and the byte comparison is
  `'""' === '""'`, which is true. The record passed re-checking having quoted
  nothing. A fabricated `INFRA-FAKE` criterion returned `MET` this way, with a
  failing exit code attached. Empty and whitespace-only quotes are now
  `EVIDENCE-QUOTE-EMPTY`, for every criterion — a quote that says nothing
  supports nothing, whatever it is cited for.

  **Containment was lexical, so a symlink walked through it.** `path.resolve`
  does not follow links, so a symlink or Windows junction inside the tree passed
  the check and read a file outside. The real path is now re-checked after the
  read, and an unresolvable one is refused rather than assumed contained.

  **The canary trusted an auditor that failed everything.** `wasFound` reduced
  the audit to a set of criterion ids, so an auditor returning every criterion
  as `UNMET` hit the canary by construction — it would "detect" a planted defect
  in a document with none. That is the lazy failure mode wearing the opposite
  mask from the one the canary was built for. It now takes the applicable set
  and reports NOT found on a blanket rejection.

  **`EVIDENCE-UNEXECUTED` named the wrong defect** once it started firing on
  "no citation survived" rather than "no command retained": a genuinely executed
  command with a stale hash got a flag telling the reader to look for a missing
  command. Renamed `EVIDENCE-UNSUPPORTED`.

  **An advisory-only record printed as a failure.** Every flagged record got
  `✗`, so the screen could show a record marked failed while still reading `MET`, above a summary of `0 flagged`, and then exit 0.
  Advisory-only records now print `!`.

  **The normative spec still mandated the discarded contract.**
  `docs/specs/phase5-verifier-gate.md` required `command` + `exit_code` and
  promised retained command output as verification, while the validator had
  stopped reading either. Two consumers, incompatible contracts.

  **The release commit staged everything.** `.github/release.sh` ran
  `git add -A` AFTER the suite, so anything a layer left behind went into the
  release commit silently, and the dry-run path never exercised that line.
  Staging is now by pathspec, and any unexpected change aborts the release.

  **A hook forged its own log entries.** `tq-subagent-stop.js` appended
  `payload.reason` verbatim, so a newline in it wrote a second entry with its
  own timestamp. Control characters are collapsed and the value capped.

  **The hashing command shipped broken.** The command `plan-auditor.md` tells
  the auditor to run for its `sha256` was split across four physical lines by an
  escaping error in the commit that added it, so it did not parse. Repaired and
  verified to produce the hash the tests expect.

  **New guard, `PH5-052`:** every flag the validator can emit is documented, and
  no document names a flag the code cannot emit. It caught the two stale flag
  tables that carried `EVIDENCE-COMMAND-FAILED` after its removal, and it caught
  the rename above while this entry was being written. Mutation-proven in both
  directions.

  All five code fixes are mutation-proven. Layer 5 goes from 59 assertions to 66,
  Layer 6 from 32 to 35.

- **Nine defects from an external adversarial review are fixed.** An independent
  reviewer audited the plugin at the 11.0.0 tree and every finding was reproduced
  before being acted on. Four were in the design gate itself, and two of those
  were introduced earlier in this same release.

  **The gate reported success on records it had just rejected.** The CLI exited on
  `demoted`, which counts only records that CLAIMED `MET` and lost it. A record
  written `"verdict": "PASS"` demotes nothing, so it printed
  `EVIDENCE-VERDICT-INVALID` on screen and exited 0 — and the caller reads the exit
  code, not the screen. Exit is now on any non-advisory flag.

  **Executable criteria trusted a self-reported exit code.** `LINT-15`/`LINT-16`
  were satisfied by a `command` field existing and its `exit_code` being 0, both
  written by the judge and neither checked; a record carrying
  `command: "definitely-not-run", exit_code: 0` came back `MET`. The validator will
  not execute a model-authored string to find out, so `exit_code` is now ignored
  entirely and an executable criterion is settled by a citation that survives
  re-checking. A record whose only support is a command string is `UNMET`. Records
  still carrying an exit code get `EVIDENCE-EXITCODE-IGNORED`, an advisory flag
  that reports the number carried no weight without demoting.

  **The artifact pin is now mandatory.** `sha256` was checked only when a record
  happened to supply one, while `plan-auditor.md`'s schema did not ask for it and
  `stage-2-design.md` told the reader the validator "confirms its hash still
  matches". A record written exactly to the published schema skipped the staleness
  check the documentation promised. Missing pins are now `EVIDENCE-UNPINNED`, and
  the schema asks for it with the command to compute it.

  **Citations must stay inside the audited tree.** `path.resolve` accepted an
  absolute path or a `../` chain and walked out of the root, so a record could
  satisfy `MET` by quoting a file the audit has no claim over. Absolute paths are
  refused even when they land inside the tree, because a record is committed and
  re-checked elsewhere: `EVIDENCE-PATH-ESCAPE`.

  **`F07` passed having examined nothing.** Its extractor required "write" and a
  `docs/audit/` path inside one period-delimited span, which no live agent
  satisfies — `plan-auditor` heads a section "Write the Audit Report" and names the
  path seven lines below. It derived ZERO subjects, and `F07_FLOOR=0` disabled the
  collapse check that exists to catch exactly that. Now 2 subjects, floor 1.

  **`INTEROP-2` could not see a glob.** `troubleshoot` reads
  `docs/audit/impact-review-*.md`; the path regex matched only literal names, so a
  real read went undocumented with both interop guards green and a comment above
  them claiming every functional read was derived. The regex now includes `*`,
  self-tests against a glob, and the second hardcoded copy of it is gone.

  **`PH5-051`'s comment claimed more than the regex checks.** It said no scoring
  vocabulary survives; it matches notation — numerals, `scorecard`, `score_history`,
  the colour bands — not the words score, scoring or rating. The comment now says
  notation and records the gap as accepted, because a word-level pattern would fire
  on every legitimate use and get itself suppressed. Three word-only remnants it
  cannot see were fixed by hand.

  Also: the stale repository inventory in `README.md` and `CONTRIBUTING.md` (three
  catalog entries, six skills — actually one and five), and `tq-subagent-stop.js`'s
  header, which said the handler was "wired to NOTHING" while `hooks.json` wires it.

  All six code fixes are mutation-proven: reverting each one reddens the suite.
  Layer 5 goes from 48 assertions to 59.

  **What this does not fix.** The historical evidence corpus under
  `docs/plans/2026-09-03-plan-centerpiece-alignment/evidence/` now reports 10
  demoted rather than 2, because those records were written before the pin was
  required and cannot be retrofitted honestly — computing a hash today would pin
  them to a file the auditor never saw. They stay unpinned and demoted, which is
  the true statement about them.

- **`toque-audit` and `toque-readiness` are removed.** The codebase audit,
  security scan, delta/KPI tracking, characterization tests, CI gate generation
  and the AI-readiness scan are gone from this repository and this marketplace.
  Nothing replaces them here. The catalog goes from three entries to one; the
  version lockstep, which held three manifests together, now has a single
  member.

  **Installed copies keep working** from the plugin cache but receive no
  further updates. `claude plugin uninstall` removes them when you are done
  with them.

  **Why.** `/toque:plan` is the centrepiece, and a marketplace that shipped it
  beside two scanners asked every user to work out which of three plugins they
  wanted before they could use any of them. Scanning a codebase is a different
  job for a different person on a different cadence — a consultant grading
  repositories is not the developer living in `docs/plans/`. Toque is a
  planning tool.

- **Toque no longer suggests audit or readiness commands.** The `valid_commands`
  allowlists in `plan-export.md`, `skills/plan/SKILL.md` and
  `skills/troubleshoot/SKILL.md`, and the command table in
  `skills/documentation/SKILL.md`, list only Toque's own commands. Suggesting a
  command from a marketplace the user may not have installed is a guess about
  their setup, and a command that does not resolve is worse than no suggestion.

- **`interop.md` is now a list of optional inputs.** Toque still reads
  `docs/audit/risk-assessment.md`, `dependency-map.md`, `feature-inventory.md`,
  `integration-scan.md`, the four `baseline/*.json` files and the readiness
  report — it just no longer ships anything that writes them, and does not say
  what should. Every reader degrades to working without the file, so a project
  with no `docs/audit/` loses nothing but context.

  **The guarantee is genuinely weaker, and this is the honest statement of it:**
  a green suite used to mean the contract held end to end, because both ends
  were in this repository. It now means Toque's end holds. If whatever writes
  those files renames one, it arrives here as a feature that quietly stops
  finding its input — no error, just a plan generated without risk data.
  Nothing here can detect that.

- **The stale-audit warning is removed from `tq-session-start.js`.** The
  SessionStart hook used to stat an audit report and add "Audit report is N days
  old" to its message. It reported on a file this plugin does not produce, which
  made a session message depend on another tool having run in the same
  repository. Toque reports on its own plans.

### Changed

- **`PH5-051` is widened from three hand-listed paths to a derived subject set**,
  and its pattern is self-tested before it is trusted. The old list was the hole:
  two commands, an agent, three planning-technique docs, two fixtures and
  METHODOLOGY §7 all kept scoring vocabulary while the guard reported clean,
  because none of them was on it. The guard now sweeps 54 subjects, refuses to
  report on a tree if its own known-positive and known-negative probes fail, and
  fails loudly if the derivation collapses below 20 subjects.

  It matches placeholder numerators (`X/40`, `{total}/40`) and `N/5` dimension
  scores as well as `N/40` totals — three forms a narrower pattern missed during
  this work. `METHODOLOGY.md` is scoped by header-derived bounds, so §8 onward,
  where the readiness scan's letter grades legitimately live, stays out of scope.

  Proven by mutation in four directions: a planted `3/5` and a planted `X/40` in
  the plugin each redden Layer 1; a planted `3/5` inside §7 reddens it; a planted
  `3/5` inside §8 correctly does not.

- Scoring vocabulary replaced with verdicts in `plan-scaffolder.md`,
  `quick-plan.md`, `GUIDE.md`, `02-evaluator-optimizer-loop.md` and
  `09-multi-category-success-criteria.md`. The phantom `score_history` sentence
  in `GUIDE.md` is deleted — that field was documented but never written by
  anything.


- **Guards that policed the three-plugin split are retired or retargeted**, each
  for a stated reason rather than deleted to get the suite green:
  - `SPLIT-1` (self-audit-knowledge mirror byte-identity) is **retired**. The
    mirror left with `toque-audit`. If the copies drift now, nothing here can
    tell; that is recorded in `CONTRIBUTING.md` rather than replaced by a guard
    that cannot see its subject.
  - `SPLIT-2` and `SPLIT-4` count **1** manifest and **1** catalog entry.
  - `SPLIT-3` is **retargeted** to the single `toque:` namespace, floor 20 → 10.
    The cross-plugin half is gone; the failure it caught — a rename landing in
    one file and not the eleven referencing it — is unchanged. Its
    known-negative is now `toque:codebase-audit`, a real command name that moved
    away, which is a sharper negative than an invented string.
  - `INTEROP-1/2` check the **reader** half only, against a table that no
    longer has a producer column. `INTEROP-3` is **retired**: it validated
    `readability-score.json` against its producer's schema, and the producer is
    not here to have one. Its number is not reused — a renumbered guard makes
    old failure reports mean the wrong thing.
  - Layer 4's `B1` asserts `help.md` **states the commands were removed**. An
    upgrading user who runs `/toque:help` looking for them must find out they
    are gone, or they go hunting for a typo; silence reads as "this toolkit
    never had them". No destination is named — where a project gets its
    codebase analysis is not this plugin's business.
  - Ten mutation cases in `tests/mutation/wave5-guards.py` are dropped with
    their subjects. Two guards they proved (F11 argument-hint, F08 PowerShell)
    now have no subject in this repository at all, and inventing one to keep the
    count up would prove the fixture rather than the rule.
  - `release-preflight-test.sh` V2 moves the **manifest** against fixed
    documents instead of one manifest against another. Manifest-vs-manifest
    drift has no second party at a count of one; the surviving half is the one
    that actually shipped broken in 5.0.0.

- **Three stale descriptions of the removed scorecard are corrected.** The
  `/toque:quick-plan` command description, `plan-scaffolder`'s frontmatter and
  `02-evaluator-optimizer-loop.md` all still promised a plan that "scores well
  on the plan auditor's 8 dimensions". The scorecard was removed earlier in this
  release; the PH5-051 guard matches numerals like `3/5`, not prose, so it could
  not see them. The command description is the one a user actually reads before
  running it.

- **`documentation/choosing-a-plugin.md` is deleted** and the scanner sections
  of `documentation/when-to-use.md` with it. A page whose subject was choosing
  among three plugins has no subject at one.

- **`METHODOLOGY.md` carries a scope note.** Sections 1, 2, 4 and 9 describe
  codebase analysis this repository no longer implements; 3, 5, 6, 7, 8, 10 and
  11 describe Toque. The analysis sections are kept because several Toque
  sections build on their reasoning, and their links to departed files are
  reduced to plain text. Sections are **not** renumbered — specs, plan records
  and the PH5-051 guard's derived section-7 bounds all cite the current
  numbers.

### Fixed

- **The evidence validator had never read a real evidence record.**
  `tq-evidence-validate.js` reads `evidence[].artifact` / `line_start` /
  `line_end` / `exact_quote` — the schema documented in `plan-auditor.md`. Every
  record written to disk used `path` / `lines` / `quote`. The two sets do not
  overlap, so `path.resolve(root, undefined)` threw `ERR_INVALID_ARG_TYPE` on the
  first record and validated none of them. `tests/evidence-validate-test.js`
  passed throughout because it built its own records in the validator's shape and
  never opened one the auditor produced.

  All 32 records under `docs/plans/2026-09-03-plan-centerpiece-alignment/evidence`
  are migrated to the documented schema. The migration is mechanical — field
  renames and the verdict mapping below. No quote text, line number or exit code
  was altered, because the point of the repair is to let the validator judge this
  evidence, and adjusting it to pass would have made the corpus a record of what
  satisfies the test.

- **Verdicts outside the documented vocabulary were exempt from checking.**
  `validateRecord` returned early for anything that was not `MET`, on the
  assumption that every other value is a deliberate non-claim. Records were
  written with `PASS` (7) and `FAIL` (10) — outside the `MET` / `UNMET` / `N_A`
  vocabulary — so seven records asserting a pass were never examined and printed
  with a tick. The vocabulary is now closed: an unrecognised verdict resolves to
  `UNMET` with `EVIDENCE-VERDICT-INVALID`. `PASS` maps to `MET` and `FAIL` to
  `UNMET` in the migrated records.

- **A malformed citation aborted the entire run.** A missing or non-string
  `artifact` reached `path.resolve` directly, so one bad item meant zero records
  validated rather than one demotion. It now returns
  `EVIDENCE-ARTIFACT-MISSING` and the remaining records are still evaluated.

- **The suite now validates real evidence.** Layer 5 runs the real validator over
  every `docs/plans/*/evidence` directory, asserting the records parse in the
  documented schema and that validation completes without throwing. It
  deliberately does not require them all to come back `MET`: two records cite
  live files the plan subsequently edited, and demanding a clean run would create
  pressure to rewrite quotes until they matched. Layer 5 goes from 32 assertions
  to 48; all three guards are mutation-proven.

  Re-checked for the first time, the corpus demotes two records. `C-04` and
  `LINT-15` quote five lines that have since changed — including METHODOLOGY §7's
  old title, which this release is what changed. Both were already inside an audit
  whose verdict was NOT PASS, so no conclusion moves. Records citing the frozen
  `.canary/spec.md` copy all still verify.

## 10.0.0 (2026-09-03)

### BREAKING

- **The project is renamed Toque.** Every plugin, command, skill, agent, hook
  script, and environment variable takes the new name. Nothing about behavior
  changes; this release is the rename and nothing else.

  The three plugins are `toque`, `toque-audit`, and `toque-readiness`,
  published from the `toque-marketplace` catalog at
  `https://github.com/krwhynot/toque`. Commands are `/toque:*`. The audit
  plugin's knowledge skill is `toque-knowledge` and its report agent is
  `toque-report-generator`. Hook scripts are `scripts/tq-*.js`. The four
  environment variables are `TQ_STRICT_GIT`, `TQ_DISABLE_GUARDS`,
  `TQ_CHANGE_THRESHOLD`, and `TQ_COUNTS_FILE`.

  **Migration.** Remove the three previously installed plugins and the previous
  marketplace entry, then add the marketplace at the URL above and install the
  three plugins under the names above. Environment variables set in a shell
  profile or CI config must be respelled to the `TQ_` prefix; the former
  spellings are not read and fail silently. Slash commands written into
  scripts, prompts, or `CLAUDE.md` files must be respelled to the `/toque:`
  prefix. Plan folders under `docs/plans/` are untouched and need no
  migration.

### Changed

- The rename is applied to the whole tree, historical documents included, so a
  single spelling is greppable everywhere. Where a document points at an
  artifact by name *at an older tag* — the retired guard handlers in
  METHODOLOGY.md §"one named field, decide" — the pre-rename spelling is given
  alongside, because that is the name the file actually has at `v8.0.0`.
- `tests/fixtures/f30-provenance-ledger.tsv` is rehashed. The ledger addresses
  occurrences by `sha256(line)`, and the rename changed the token in all 39
  ledgered lines. The occurrence set is unchanged — same 39 lines in the same
  files, verified by a per-file count diff against the 9.0.0 ledger — so no new
  provenance claim is registered here.

## 9.0.0 (2026-09-02)

### BREAKING

- **`toque-guard` is retired.** The always-on safety plugin (force-push and
  hard-reset guard, migration guard, DB deploy guard, change and test trackers,
  session summary) is removed from the marketplace and the tree. Claude Code
  permission rules cover every blocking behavior with no runtime dependency and
  no second enforcement layer silently overriding a project's own `ask` rules;
  the recommended `settings.json` baseline is in METHODOLOGY.md §6. Installed
  copies keep working from the plugin cache but receive no further updates.
  With it go `tests/run-hook-corpus.js`, `tests/fixtures/hook-corpus.json`, the
  guard rows of `tests/layer2-ledger-rows.js`, and the `$TMPDIR/tq-*` session
  marker bus. Three plugins remain in lockstep.

### Added

- **Document skeletons in every documentation template.** `adr`, `brd`, `prd`,
  and `readme` templates now carry a fill-in document body; the PRD template
  previously pointed at a "standard template" that did not exist. The PRD
  skeleton has P0/P1/P2 requirements with Given/When/Then acceptance criteria
  and a leading/lagging success-metrics table.
- **`/toque:documentation runbook`.** New `runbook-template.md`: prerequisites,
  exact steps each with expected result and failure action, verification,
  troubleshooting table, rollback trigger and steps, escalation, run history.
  Plan-linked runbooks land in the plan folder and are referenced from
  review.md; Stage 4 already gated on a reviewed runbook without defining one.
- **Spec requirements carry priority and acceptance criteria.** `templates/spec.md`
  requirements are P0/P1/P2, trace to a line of intent.md, and have
  Given/When/Then criteria including a negative case. New `## Success metrics`
  section with numeric targets, windows, and measurement method.
- **Release checklist with numeric rollback triggers.** `templates/review.md` has
  pre-deploy, deploy, post-deploy, and rollback sections; triggers are
  thresholds over a window, and Stage 6 uses them to classify severity.
- **Incident status updates and blameless postmortems.** The troubleshoot
  pre-flow emits a status update on a fixed cadence for SEV1/SEV2; Step 5
  writes a postmortem beside the log whose action items feed the proposed
  intent.

### Changed

- `GUIDE.md` and `README.md` for the planning plugin document the design gate
  (canary classes, evidence-validator flags, the pass expression), the
  six-stage artifact chain, the two gate tools as distinct from the hooks, and
  every output location.

## 8.0.0 (2026-09-02)

### BREAKING

- **`/toque:plan` runs Anthropic's AI-Native SDLC playbook.** Nine phases
  become six stages, Plan, Design, Build, Test, Deploy, Maintain, each
  committing one artifact the next stage reads: `intent.md`, `spec.md` (plus
  `audit.md` from the verifier gate), `plan.md` (the build plan: files, order,
  risks, proof, verification), `test-plan.md`, `review.md`, and a new
  `intent.md` proposed from incidents. All artifacts live in the plan folder;
  `docs/specs/{name}.md`, `brainstorm.md`, `approach.md`, and `confidence.md`
  are no longer written (the confidence brief is spec.md's Evidence section).
  `status.json` moves to schema 2 with the six stage keys and per-stage
  `started`/`completed` timestamps; a schema-1 plan is migrated on resume by a
  fixed name map and its old artifacts are read where they are. Anything that
  parsed the old phase names or artifact names breaks.
- **The audit score is gone.** The design gate keeps the canary, the evidence
  validator, the criterion registry, and the rubric-free pass; the 8-dimension
  1-5 score, `/40` totals, bands, `score_history`, and the score clause in the
  review waiver are removed. plan-auditor returns criterion verdicts only.
- New: `intent {name}` runs Stage 1 only and stops, so a non-engineer can
  capture intent for a product owner to accept. Deploy adds a diff-versus-plan
  check (unplanned and untouched files, intent constraints against the code)
  that must be acknowledged in plan.md before release, and the skill never runs
  a release command: it prepares and asks a named human. Troubleshoot proposes
  a Draft intent for SEV1/SEV2 or recurring incidents linked to a plan.
  plan-status prints intent-to-spec, spec-to-plan, plan-to-release elapsed.

### Changed
- **`/toque:plan` is a skill.** The 1,710-line command is now
  `skills/plan/SKILL.md` (a 319-line router) plus one file per phase under
  `skills/plan/phases/`, read on entry to that phase. Invocation, arguments,
  and `status.json` are unchanged. Closes F12 (deferred since 5.0.0): a
  single long command loses its later phases after context compaction in
  exactly the long sessions a nine-phase workflow produces. Tests that read
  Phase 5 content now point at `phases/phase-5-audit.md`.
- **`/toque:troubleshoot` and `/toque:codex-challenge` are skills**, on
  the same router-plus-phase-files layout as `plan`. troubleshoot (854 lines)
  becomes a 256-line router with the incident pre-flow, four phases,
  multi-agent mode, and knowledge-base write-back in one file each;
  codex-challenge (533 lines) becomes a 213-line router with the output
  schema, prompt template, round loop, and report split out. The parser
  tests now bind to `skills/codex-challenge/phases/output-schema.md`. The
  three remaining long commands (quick-cleanup, readiness-generate,
  plan-export) are under the documented 500-line guidance and stay as
  commands. Closes backlog B07.
- The documentation skill's bundled templates live in `references/`, the
  documented convention, instead of `resources/`. Closes backlog B28.
- The `(toque)` description prefix is stripped from all 23 commands and
  skills. After the monorepo split it mislabelled 11 files owned by
  toque-audit and toque-readiness.
- Marketplace entries carry `category` and `tags`; the non-deliverable
  owner email is removed.

### Fixed
- Backlog triage of the 32 low/info findings recorded against 4.31.0: 13 were
  already closed by the hardening work; 15 fixed here. Scanner "Output"
  sentences un-garbled in all 8 readiness scanners; database-scanner check 9.1
  name matches its contract; plan-auditor steps renumbered 1-7 and its subagent
  count corrected to 5; gate-generator's duplicate Step 4.5 is now 4.6; every
  `<valid_commands>` block regenerated from the real 17-entry surface; help.md
  drops the dead `/tp`, lists the plan skill, and namespaces its documentation
  examples; the phantom `plan-review.js` reference is gone; two agents no longer
  read a `$ARGUMENTS` that is never substituted; the documentation skill no
  longer carries a literal positional placeholder in its body; the two long
  templates have a Contents list; mcp-research drops a baked-in date;
  METHODOLOGY.md stops describing the removed bash PATH preamble as current.
- Stop hooks (guard session-stop, toque subagent-stop) exit silently when
  `stop_hook_active` is set, so a continued turn cannot re-post the summary.
  The session-stop hook also sweeps tracker files from other sessions older
  than a day; before this they accumulated in TMPDIR forever.

### Internal
- CR-7 (owner-ratified): the U7 compatibility-floor requirement is descoped.
  Verification is on the current Claude Code version at each release (hosted
  ubuntu+windows CI); no floor is declared. F24 closed — every
  plugin-hardening-v5 finding is now closed. The auth-free bisection facts
  (`--strict` appears at 2.1.145; git-subdir pinned installs work at ≤2.1.144)
  are preserved in the plan's research record.
- Test scratch directories are swept at process exit — 49 OS-temp entries
  leaked per combined test run before, zero after.

## 7.1.0 (2026-08-03)

### Changed
- **Check-element vocabulary ratified to `points`/`max`.** The 2026-08-03
  dogfood run showed every scanner template demanding `score`/`max_score`
  while all eight live scanners emitted `points`/`max` unanimously; the
  templates were aligned to observed reality, the interop fixture was
  regenerated from a real scan artifact, and the retired vocabulary is now
  banned by the INTEROP sweep.
- Marketplace entries use `git-subdir` sources with explicit https URLs, so
  installs no longer require GitHub SSH keys; SPLIT-4 guards the catalog
  shape. `interop.md` documents the cross-plugin artifact contracts,
  enforced by the INTEROP sweep. Two README drifts fixed (readiness score
  path, guard output table).

### Removed
- **Per-check `confidence` field dropped from scanner templates.** Recon
  proved zero consumers: the report generator never reads it, and the
  methodology's "confidence levels" are a module-level concept the
  orchestrator derives from gate results, not a `checks[]` field.
  Module-level confidence is untouched.

### Internal
- Runtime evidence completed: all nine PHV5-044 Part 2 owner-observed
  checks recorded live on the installed copy — SessionStart, PreCompact and
  both Stop branches surfacing; deny, ask and allow paths; and the
  node-less hook-error notice (CR-1 re-confirmed). Line-ending handling is
  enforced via `.gitattributes` (`* text=auto eol=lf`, snapshots frozen),
  and F30's directory allowlist was replaced by an occurrence-addressed
  provenance ledger.

## 7.0.0 (2026-08-03)

The monolith is now four plugins. Updating `toque` alone does NOT keep the
toolkit you had — read the BREAKING section before updating.

### BREAKING

- **One plugin is now four.** `toque` keeps only the planning core (plan,
  plan-status, plan-export, quick-plan, quick-audit, quick-cleanup,
  troubleshoot, codex-challenge, help). Auditing, readiness scanning, and the
  safety hooks moved to plugins that must be installed separately:
  `/plugin install toque-audit@toque-marketplace`,
  `toque-readiness@toque-marketplace`, and
  `toque-guard@toque-marketplace`.
- **Audit and readiness commands renamespace to their plugin.**
  `/toque:codebase-audit` → `/toque-audit:codebase-audit` (same for
  codebase-characterize, codebase-delta, codebase-gates, codebase-security);
  `/toque:readiness-scan` → `/toque-readiness:readiness-scan` (same for
  readiness-generate). Anything scripted against the old names breaks.
- **Skills renamespace with their plugin.** `toque-knowledge` and
  `governance-knowledge` load as `toque-audit:*`; `readiness-scoring` as
  `toque-readiness:readiness-scoring`. `self-audit-knowledge` resolves under
  BOTH `toque:` (canonical) and `toque-audit:` (byte-identical mirror,
  guarded by the suite).
- **The safety hooks ship only in `toque-guard`.** The git/DB deploy guard,
  migration guard, change/test trackers, and the Stop-time session summary
  (PreToolUse ×2, PostToolUse ×2, Stop) are no longer part of `toque`,
  which retains only SessionStart, SubagentStop, and PreCompact. An update that
  does not add `toque-guard` silently loses force-push and DB-deploy
  blocking.
- **The monolith GUIDE is retired.** Each plugin ships its own README and
  GUIDE; METHODOLOGY.md remains the deep reference for the audit methodology.

### Changed

- Versions are lockstep across the four manifests; the marketplace lists four
  entries sharing one ref+SHA pin, released atomically by `.github/release.sh`.
- The suite gained per-plugin layer-1 profiles plus split invariants: SPLIT-1
  (self-audit-knowledge mirror byte-identity, eol-insensitive), SPLIT-2
  (4-manifest lockstep), SPLIT-3 (cross-namespace reference resolution). CI
  validates the root marketplace and each plugin directory.

## 6.0.0 (2026-08-02)

The Phase 5 audit gate no longer authorizes a plan on the score the audited model
assigned to itself. Full design: `docs/specs/phase5-verifier-gate.md`.

### BREAKING

- **The Phase 5 gate expression changed.** `IF score >= 32 AND gap-checked = YES`
  is gone. A plan now passes only when the seeded canary was found, every evidence
  record survived mechanical re-checking, every applicable criterion is MET or N_A,
  and infra gaps are zero. **Plans that previously passed at 32-40 on prose scores
  will fail under 6.0.0 until their claims carry evidence.** This is intended: a
  score in that band proved the text resembled the rubric, not that the claims were
  true.
- **The YELLOW outcome is gone.** "Usable with known gaps" no longer exists as a
  rung; either every applicable criterion is satisfied and evidenced, or the
  specific unmet ones are named. Anything scripted against the GREEN/YELLOW/ORANGE
  bands must read the gate verdict instead.
- **`/toque:quick-plan` uses the same gate.** It previously accepted a plan at
  `score >= 32/40` on its own; a lighter command with a score gate was a way
  around the main one.
- **The solo-mode review waiver is conditional.** Blocked when infra gaps exist,
  when the score is under 35, or when the canary was missed. Solo workflows that
  relied on an unconditional waiver will now be prompted for a named reviewer in
  those cases.
- **Audits must produce evidence.** The auditor writes one record per criterion to
  `evidence/{criterion_id}.json`; a missing or empty evidence directory fails the
  gate (exit 2 — treated as worse than a demotion, because an audit that produced
  nothing checkable reporting clean is the failure mode this release removes).
- **LINT-17/18 renumbering.** The confidence-brief rules formerly carrying those
  ids in `commands/plan.md` and `agents/plan-auditor.md` are now LINT-19/20; 17/18
  are the testing-methodology rules, as the registry always defined them. Audit
  reports written before 6.0.0 refer to the confidence-brief checks by the old ids
  and are left unrewritten.

### Added

- `scripts/tq-evidence-validate.js` — re-reads every cited artifact, verifies the
  hash, slices the cited line range, and compares byte-for-byte with the quote.
  Validation only ever demotes; the judge's MET is a proposal. Suite layer 6.
- `scripts/tq-canary.js` — injects one known defect (5 classes, seeded rotation)
  into a working copy before the audit; an audit that misses it twice fails as
  untrustworthy and does NOT trigger the revision loop. Suite layer 7.
- A rubric-free holistic judge whose unmapped findings land in
  `docs/planning-techniques/lint-candidates.md` — the only mechanism that can
  notice the rubric itself is incomplete. Advisory, never gates.
- `score_history` in `status.json`: the score no longer gates, but its
  distribution is the cheapest detector of threshold-aiming.
- Judge isolation: the rubric, anchors, and thresholds moved out of
  generator-readable files; `<forbidden_inputs>` in `agents/plan-auditor.md`; a
  fresh auditor instance per revision iteration; verdict schema with no total
  field and evidence serialized before the verdict.
- `docs/planning-techniques/lint-registry.md` is now the enforced single source of
  lint rule text and counts (guards PH5-001/002 in the suite; every rule had
  drifted into at least one alternate wording, and two into a second meaning).

### Known limitations (stated, not closed)

- The auditor holds Read/Grep/Glob over the repository and can reach the criterion
  files and the canary defect table. Isolation is enforced by instruction, not
  capability; the canary reliably detects a lazy audit, only incidentally an
  adversarial one.
- Nothing in this release measures whether the judge is *right* — only whether it
  is evidenced. Judge calibration against known-good/known-bad plans is the
  natural successor.

## 5.0.1 (2026-08-02)

### Added
- The 4.x migration note 5.0.0 should have carried. 5.0.0 changed the hook runtime
  dependency, moved where hooks are declared, and changed the `git reset --hard` decision —
  and shipped with no upgrade sequence, no disable procedure, and no statement of what was
  and was not verified. Those are now recorded under 5.0.0 below, describing the release
  they belong to. This version exists so they reach installed copies: the version in
  `plugin.json` is the cache key, and text attached to an already-published tag propagates
  to nobody.
- The marketplace catalog now pins an explicit source object carrying the release commit's
  full SHA, so an install resolves to a known tree rather than to whatever the default
  branch happens to hold.


## 5.0.0 (2026-07-30)

A hardening pass across the plugin's configuration, hooks, and command surface. No new
user-facing features — this release fixes defects found by a structured audit and verifies
the fixes actually work, including with a runtime check that confirms the safety hooks fire
in a live session rather than just looking correctly configured on disk.

### Breaking

**The safety hooks now require `node` (18 or later) instead of `bash` and `jq`.** On 4.31.0
the hooks were declared inline in `plugin.json` as `bash -c '...'` one-liners that preferred
`jq` and fell back to `grep`/`sed` string parsing. They are now one Node script per handler
under `scripts/`, declared in `hooks/hooks.json`. Where `node` cannot be spawned the guards
do not run at all and Claude Code surfaces its own hook-error notice — visible in an
interactive session, suppressed under `claude -p`.

**`git reset --hard` now asks instead of blocking.** On 4.x it was denied outright. It now
raises a confirmation prompt you can accept. Force pushes and direct database deploys are
still blocked.

**Guard matching is scoped to the command itself.** On 4.x the guard matched its trigger
strings anywhere in the hook payload, so `git commit -m "no git push --force"` was blocked by
its own commit message, and a trigger word inside a quoted argument or a tool description
stopped legitimate work. Matching is now shell-word aware and reads only the command field.
Commands that 4.x wrongly blocked will now run.

**Enforcement is PARTIAL by design.** The guards enforce only where a real parser is
available. On a host without one they allow the event and report themselves rather than
failing closed. This is recorded as formally NOT MET on parser-less hosts rather than
claimed fixed everywhere.

### Upgrading from 4.x

Third-party marketplace auto-update is off by default, and hook commands keep using the
previous version's path mid-session. An upgrade will not reach you without these four
commands:

```
/plugin marketplace update toque-marketplace
/plugin update toque
/reload-plugins
/plugin list
```

`/plugin list` is the verification step — confirm it reports the version you expect.
**The version in `plugin.json` is the cache key; without a bump, nothing propagates.**

**To turn the guards off immediately**, in order of preference:

1. `/plugin uninstall toque` (or disable it) **followed by `/reload-plugins`**. Verify by
   attempting a guarded command and confirming it is not stopped, and restart the session if
   any handler is still live. Uninstalling alone does not relieve a running session — hook
   commands keep using the previous version's path until `/reload-plugins` runs.
2. Set `TQ_DISABLE_GUARDS=1` in the environment **and restart the session**. A process that
   is already running does not observe a newly-set environment variable.

**The `tq-*` temp files are disposable.** The plugin writes them to track state across a
session. A stale-schema file left by a mid-upgrade session is read as zero, and deleting any
`tq-*` temp file is always a safe recovery step.

### Verification scope

Stated plainly so it is not read as more than it is:

- The test suite and the manifest schema are verified **on Windows only**. There is no CI
  matrix yet, so behaviour on Linux and macOS — including runtime hook dispatch — is
  unverified.
- **No minimum Claude Code version is declared.** The plugin relies on hooks-folder-over-
  manifest precedence, exec-form `args`, `${CLAUDE_PLUGIN_ROOT}` substitution and structured
  hook output. All were confirmed on the development host (2.1.216), but the lowest version
  that supports them has not been established by running against it, so no floor is claimed
  rather than implying one that has not been tested.

### Fixed
- `/toque:codebase-gates` told users their generated hooks were written to
  `.claude/hooks/hooks.json` — a location Claude Code never reads from a project. The feature
  silently did nothing. Hooks are now correctly targeted at the `hooks` key of
  `.claude/settings.json`, merged rather than overwritten.
- `/toque:plan-status` with no argument reported "No plans found." on a normal project
  layout, because its existence check and its listing loop referenced different directories.
- `/toque:quick-cleanup`'s Word-document fallback printed a "no pandoc and no python
  interpreter" error on a **successful** conversion, due to a shell operator-precedence bug.
- `/toque:plan-export`'s Windows fallback (no `zip` on stock Windows) is now verified to
  actually create an archive, not merely to mention the right PowerShell cmdlet.
- `/toque:readiness-generate` no longer shells out to `tree`, which is absent from Git
  Bash; several commands' temp-file handling is now portable across Windows and Linux.
- Removed dead `/ai-readiness-*` command references left over from an earlier rename; the
  real commands are `/toque:readiness-*`.
- Several skills carried thin or absent trigger descriptions and could not reliably load;
  descriptions now carry concrete trigger phrasing.
- The `mcp-research` skill was referenced only in prose ("see the mcp-research skill") with
  no resolvable link; now referenced by its namespaced name.
- The former `doc` command (superseded by the `documentation` skill) is fully retired: no
  command file, no live references to it anywhere in the plugin's product surface.
- Hooks are now proven to fire at runtime (not just correctly declared): file-change
  tracking, test-run detection, and subagent-completion logging were each verified by
  actually triggering them in a live session, not by reading configuration.

### Removed
- `docs/troubleshooting-techniques/` — nine files duplicating content from a standalone
  sibling skill bundle, referenced by nothing in this plugin (no command, agent, skill, or
  test loaded it). Removing the orphaned copy eliminates the duplication permanently; the
  content is preserved in git history.

### Known gaps
A small number of internal consistency checks for this release are text-based and were
found to be an unreliable way to verify certain claims — specifically, whether an
*instruction* is followed (e.g., "the agent must emit a PowerShell variant") as opposed to
whether a *string* is present or absent. Where our verification could not distinguish a real
instruction from an example, a decoy, or a negation, we are recording that honestly rather
than shipping a check that looked green without meaning much. This affects a handful of
internal acceptance criteria, not shipped behavior we have reason to believe is broken; each
underlying product change was independently verified by reading the actual file. Tightening
these into genuine runtime tests is ongoing.

### Deferred to 5.1.0
- Converting the 1,528-line `/toque:plan` command into a skill (better survival across
  context compaction in long planning sessions). This is an improvement to a command that
  works today, not a fix, and is being done separately with its own staging and rollback
  proof.

## 4.31.0 (2026-04-03)

### Added
- Optional MCP research tool integration across planning, troubleshooting, documentation, and audit
  workflows. **All integrations degrade gracefully — the plugin works identically with no MCP servers
  connected.**
- New knowledge skill: `skills/mcp-research/SKILL.md` — tool selection heuristics and tier mapping
  (Ref → Exa → Perplexity), token budget rules, and graceful degradation patterns
- `/toque:plan`: tiered Ref → Exa → Perplexity search in Phase 2 Track 3, plus URL verification
  for HIGH-impact confidence entries
- `/toque:troubleshoot`: Step 0.2 external documentation and issue lookup (Ref + Exa)
- The documentation command and skill: external enrichment for specs, ADRs, and READMEs
- `integration-scanner`: API validation against external documentation via Ref
- `dependency-mapper`: deprecation checking via Ref documentation

### Changed
- `METHODOLOGY.md`: Track 3 tools table updated for the tiered search strategy
- `/toque:readiness-generate`: now offers to generate a research MCP server `.mcp.json`

## 4.30.0 (2026-03-31)

### Added
- `confidence.md` brief in the planning process — a stakeholder-readable knowledge brief grounding
  every tool, method, and pattern choice in external industry evidence. Created in Phase 3 (Pre-Plan),
  reinforced in Phase 5 (Audit).
- Source credibility tiers (A/B/C) with impact classification and required rationale per entry
- LINT-17 and LINT-18 validation rules for confidence brief completeness
- Confidence falsification protocol, staleness cascade integration, timeline-pressure protections for
  HIGH-impact entries, and a conflicting-evidence protocol

## 4.29.0 (2026-03-22)

### Added
- New command: `/toque:codex-challenge` — Evaluator-Optimizer loop between Claude and OpenAI Codex CLI
- Score-driven convergence: Codex scores plan (8 dimensions × 5 = max 40), Claude optimizes until 36/40 GREEN achieved
- 8 adversarial review dimensions (problem, architecture, sequencing, risk, rollback, timeline, testing, omissions)
- Model escalation: auto-upgrades to gpt-5.4 when score < 24/40 (RED)
- Structured `codex-review.md` report with per-dimension score trajectory and gap resolution log
- Pre-review backup system with timestamped snapshots in `.codex-backup/`
- Schema-validated JSON output via Codex CLI `--output-schema` (eliminates free-text parsing)
- Read-only sandbox: no `--dangerously-bypass-approvals-and-sandbox` needed (default read-only verified)
- Ephemeral sessions via `--ephemeral` flag (no session file persistence)
- Fail-closed parsing with JSON primary, legacy text fallback
- Security isolation: Codex runs from `os.tmpdir()` in read-only sandbox
- Parser regression tests: 41 test cases covering JSON, text, schema, and edge cases
- Windows-compatible Codex invocation via Node.js temp-file pattern
- 15-minute hard ceiling with per-round budget checkpoints

## 4.27.1 (2026-03-15)

### Added
- LLM Self-Audit Framework: epistemic transparency for audit findings
- New skill: `self-audit-knowledge` — single source of truth for claim verification tiers (A/B/C), failure mode flags, and cascade risk classification
- Evidence Basis column in all 5 Phase 2 scanner agents (feature-scanner, dependency-mapper, doc-auditor, risk-assessor, integration-scanner)
- Structured Phase 3 synthesis with 7 steps: cross-reference matrix, contradiction detection, spot-checking, cascade risk assessment, coverage failure checks
- Self-Audit Summary section in report generator (replaces Confidence Summary)
- Analysis Reliability paragraph in Executive Summary
- Evidence-based finding format with cascade risk line (exception-only for non-CONTAINED)
- Tier A/B/C labels in plan-auditor Confidence Summary
- Evidence basis format in plan-scaffolder Plan Confidence table
- Plan audit failure mode flags: `[PLAN-GAP-INFERRED]`, `[SCOPE-ASSUMED]`, `[CODEBASE-CLAIM-NOT-VERIFIED]`
- Tier-aware confidence decay in governance-knowledge (Tier A: 30/60/90d, Tier B: 20/45/75d, Tier C: 15/30/60d)
- Claim verification tier guidance in codebase-audit confidence_tiers section
- Thinking guidance for CASCADE + Tier C and setter/mutation side-effects

### Changed
- Confidence Summary in report generator replaced by richer Self-Audit Summary
- Phase 3 synthesis expanded from 5 lines to 7 structured steps
- Plan-auditor evidence requirement now maps to Tier A/B/C alongside HIGH/MEDIUM/LOW
- Plan-scaffolder Confidence Summary uses evidence basis format
- quick-plan Step 4 references evidence basis distribution and Tier C threshold

## 4.27.0 (2026-03-06)

### Breaking Changes
- Converted from standalone `.claude/` format to Claude Code plugin
- All commands now namespaced: `/toque:command-name`
- File names changed (see migration guide below)

### Added
- Plugin manifest (`.claude-plugin/plugin.json`)
- `/toque:help` command listing all capabilities
- Stack-agnostic Phase 2 agents (React/TS, C#/.NET, Python, Rust, Go)
- Phase 0 stack detection in Phase 2 orchestrator
- Fan-in/fan-out coupling metrics in risk-assessor (from PViz research)
- Debt classification: CRITICAL/MANAGED/DEFERRED in risk-assessor (from CAST Highlight)
- SCC (circular dependency) detection in dependency-mapper
- "Outcomes that cannot fail" identification in feature-scanner
- Business outcome narrative in report-generator
- Two skills: readiness-scoring, toque-knowledge

### Changed
- report-generator split into readiness-report-generator (Phase 1) and toque-report-generator (Phase 2)
- context-file-scanner renamed to context-scanner
- entry-point-scanner renamed to entry-scanner
- feedback-loop-scanner renamed to feedback-scanner
- context-budget-scanner renamed to budget-scanner
- documentation-auditor renamed to doc-auditor

### Migration from 1.x (standalone)

If upgrading from the standalone `.claude/` version:

1. Remove old files from `.claude/agents/` and `.claude/commands/`
2. Install the plugin: `claude --plugin-dir ./toque`
3. Commands change from `/ai-readiness-scan` to `/toque:readiness-scan`
4. Commands change from `/toque-audit` to `/toque:codebase-audit`

## 4.26.0 (2026-02-xx)

### Added
- Phase 1: 10 AI Readiness scanner agents + 2 commands
- Phase 2: 6 Toque audit agents + 1 command (C#/.NET only)
- Hardened deterministic scoring (7 unstable checks fixed)
