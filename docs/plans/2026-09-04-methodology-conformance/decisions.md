# Owner decisions — September 5, 2026

The six conflicts recorded in [findings.md](findings.md) (D1–D6) were decided by the owner on 2026-09-05; D7 and D8 were decided the same day on the evidence of the live stress test in [stress-test.md](stress-test.md). All eight were applied in the commits on the `methodology/decisions` branch. This file is additive: findings.md keeps the conflicts as they were found; this file records what was chosen, why, and where the change landed. The selection rule was the option that stays honest as the plugin ages, not the cheapest edit.

| ID | Decision | Rationale | Where it landed |
| --- | --- | --- | --- |
| D1 | **One gate.** `quick-plan` and `quick-audit` run the same design gate as Stage 2, by executing the `<design_gate>` block of `stage-2-design.md` with their own bindings (`{doc}`, `{gate_dir}`, `{generator}`). | The command's own rationale was correct: a lighter gate becomes the route around the real one. Two definitions drift; one cannot. | `plugins/toque/skills/plan/stages/stage-2-design.md` (block and bindings), `plugins/toque/commands/quick-plan.md`, `plugins/toque/commands/quick-audit.md`, `plugins/toque/agents/plan-auditor.md` (no conversation-only mode), `.gitignore`, `tests/layer1-repo.sh` (PH5-042), GUIDE, README, quickstart, when-to-use, the-design-gate, help, METHODOLOGY. |
| D2 | **LINT-18 wins.** A separate agent or a human generates the tests from the spec first; the implementation agent makes them pass. | Three stage files already required separation; TDD's red-green ordering survives with only the author changed. | `plugins/toque/docs/planning-techniques/10-testing-methodology-selection.md` (TDD entry), METHODOLOGY Stage 4. |
| D3 | **Baselines stay read-only.** The BRD deep scan records verified confidence in the BRD's Feature Coverage table, never in the baseline file. | Writing into another tool's output destroys the ability to tell what that tool said from what Toque verified. | `plugins/toque/skills/documentation/references/brd-template.md` (Step 2 and the coverage table), METHODOLOGY shortcuts section. |
| D4 | **Two release events.** Stage 5 records `authorized_by`/`authorized_at` (status `authorized`), then `released_by`/`released_at` when a named human confirms the release (status `complete`, Maintain starts at `released_at`). Metrics report plan-to-authorization always and plan-to-release when known. | Neither record lies; backward compatible (new optional fields). | `plugins/toque/skills/plan/stages/stage-5-deploy.md` (Steps D and E), `stage-6-maintain.md`, `plugins/toque/skills/plan/SKILL.md` (bookkeeping and resume), `plugins/toque/commands/plan-status.md`, plan-workspace, the-plan-workflow, GUIDE, both READMEs, METHODOLOGY Stages 5 and 6. |
| D5 | **The immutable set is enumerated.** `changes/CR-*.md` and `snapshots/**` are never edited once written (what CI enforces here); accepted documents are superseded through a Change Record and one banner line; `plan.md`, `status.json` and `manifest.md` are living state that each stage updates in a named way. | Freeze the evidence and the deltas, let working documents move, detect drift by fingerprint. Widening CI to prose documents would fight the SUPERSEDED banner and every legitimate bookkeeping write. | `plugins/toque/skills/plan/stages/stage-3-build.md` (change control), `stage-2-design.md` (scope lock), `stage-6-maintain.md`, plan-workspace, the-plan-workflow, METHODOLOGY Stage 3. |
| D6 | **A knowledge-base match is a lead.** A HIGH match names the earlier cause as the first hypothesis for Phase 1; the earlier fix is not re-applied until Phase 1 shows the same cause is present now; a confirmed match is logged as a recurrence. | The Iron Law stays a hard rule. Blind reuse is how the same incident returns a third time. | `plugins/toque/skills/troubleshoot/SKILL.md` (Step 0.2), METHODOLOGY troubleshooting section. |
| D7 | **A planned deliverable is not an infrastructure gap.** INFRASTRUCTURE VERIFICATION and LINT-15/16 classify every referenced path as PLANNED or CLAIMED, and judge only the claims. A path relied on by a phase that runs before the phase creating it is still CLAIMED, and still fails. | Six live runs showed the gate could not open on an honest new-work spec: the template tells the author to name the test file each phase will create, and the check then failed the plan for not having created it. Scenario s2 took 9 INFRA-GAPs on the same objective s1 passed only by citing a pre-existing test. | `plugins/toque/skills/plan/stages/stage-2-design.md` (INFRASTRUCTURE VERIFICATION), `plugins/toque/docs/planning-techniques/lint-registry.md` (Rule Scope Notes), `08-data-source-validation.md` (step 0), `plugins/toque/skills/plan/templates/spec.md`, `tests/layer1-repo.sh` (PH5-043). |
| D8 | **A fresh instance is the Agent tool or `claude -p` from Bash.** Either satisfies the canary; a role pass in the caller's own context never does. Isolation is decided at STEP 0, before inject runs, and "no-isolation" means nothing is planted and the result is findings, not a gate. | Five of six runs concluded isolation was impossible and read the branch three different ways; the sixth reached it with `claude -p` and got real independence. Naming both routes makes the canary fire in the sessions where it previously never could. | `plugins/toque/skills/plan/stages/stage-2-design.md` (CANARY STEP 0, STOP rule), `plugins/toque/commands/quick-plan.md` (scaffolder fallback), `tests/layer1-repo.sh` (PH5-043). |

## Audit follow-up (September 5, 2026)

A six-dimension review of the seven commits (consistency, executability, guards, documentation, records, regression; 44 agents, one verifier per finding) confirmed 34 findings, most of them stale prose, and four that mattered. All were applied in the follow-up commit:

- The shared block had no branch for a document the canary cannot mark (`tq-canary.js inject` exits 2 when none of the five template shapes exist), which would have made `quick-audit` stop on any plan written outside the spec template. The block now audits such a document and reports NOT PASS with the reason; a template-shaped plan is what the gate can check the auditor against.
- Evidence records cited the mutated `.canary/` copy, a file nobody commits. Records are re-anchored to the committed document before validation. This was a pre-existing Stage 2 defect that D1 put on every caller's path.
- The auditor chose Full mode from the existence of a plan folder, so `quick-plan --plan` would have audited the plan's spec instead of the new one; mode now follows the caller's bindings. `quick-audit` binds the plan folder only for the plan's own `spec.md`, and writes a rerun after design completion to `reaudits/{date}/` instead of overwriting the Stage 2 record.
- Evidence reinforcement inside the block edited the audited document in place for every caller, against D5 for an approved spec and against `quick-audit`'s promise not to change someone else's document; it now runs only with a generator bound and an unapproved document.
- Smaller: a standalone run keeps its baseline and gate result in `gate.json` (the auditor rewrites `audit.md` each iteration); the canary re-run passes a seed; `.canary/` is deleted after use and ignored path-agnostically; Step E sets `current_phase`; the bookkeeping rule excepts Stage 5; the recurrence count increments only when Phase 1 confirmed the cause; the guard was renamed PH5-042 (the id the verifier-gate spec reserved for exactly this) and tightened to require the execute-by-reference directive; REL-1 and KB-1 guard D4 and D6; layer 4's B4 can fail again; stale sentences in METHODOLOGY, interop, GUIDE, help, install, both READMEs, the inventory and technique notes 02 and 06 were swept.
- The CHANGELOG `Unreleased` section was removed: this repository writes the entry at release time, and the mutation harness refuses a tree that carries that heading. The draft lives in [changelog-draft.md](changelog-draft.md).

## Stress-test follow-up (September 5, 2026)

The method, the per-scenario results, the limits of the rig and the full defect ranking are in [stress-test.md](stress-test.md); the fixtures and the invariant checker are in [stress-rig/](stress-rig/). Summary:

Six live runs of the shortcut commands were executed by agents following the shipped text in isolated scratch repositories (a standalone quick-plan, quick-plan linked to a plan, quick-audit on a template-shaped spec, on a prose ADR, on a plan's own approved spec, and on pasted text), each checked by a deterministic on-disk script and a verifier. Every on-disk invariant held: gate folders in the right place, audited documents byte-identical afterwards, evidence records citing the committed document, validator passing against the repository root, the plan's Stage 2 record untouched, the post-approval rerun landing in `reaudits/{date}/`, the pasted plan written to `docs/specs/` first, and the prose ADR taking the canary-not-applicable branch. One limit of the rig: the executing agents had no tool to spawn subagents, so the auditor ran in the same context as the caller; the canary mechanics were exercised, the auditor's independence was not.

The runs surfaced instruction defects the file-level audit had missed, all applied in the follow-up commit:

- The plugin's own `templates/spec.md` carried none of the shapes the canary attaches to, so Stage 2 would have refused its own specs; the `assumption-inject` class also planted into the first numbered table, usually the Risk Assessment. Both fixed, with a test that fails if the template drops a shape.
- The shared block lacked: a no-isolation rule, the order of `detected` versus re-anchoring, re-anchoring of `audit.md` line references, re-pinning after evidence reinforcement, a rule for LINT-14 when the auditor is forbidden the previous audit, N_A in lint results, a defined gap total, a fixed `gate.json` shape, plugin-relative paths for the registry and lint-candidates, and a standalone branch for assumption verification and for `reaudits/{date}/`.
- Auditor and registry text: LINT-08 now covers falsified assumptions; LINT-18 is UNMET when authorship is unspecified; the tier-to-confidence mapping follows the self-audit skill.

The four lower-impact ambiguities findings.md recorded are also closed: the auditor's reviewer count reads five; the plan skill's parallel rule and scaling table agree on three or more; the auditor's tier mapping no longer files a plan quote under Tier A or allows HIGH inference; the baseline-regression note no longer claims the gate tolerates pre-existing gaps.

## Stress-test defects closed (September 5, 2026)

All fourteen instruction defects the stress test ranked are closed, in the same commit as D7 and D8. Beyond those two decisions:

- **LINT-14 has a write order.** The caller appends a `## Baseline comparison` section to `audit.md`, pins `evidence/LINT-14.json` to that section, updates the LINT-14 row in the auditor's own tables as caller-decided, runs the validator, and writes the gate record LAST. Previously the record cited a file a later step rewrote, so it could not pass the validator it had to pass.
- **The previous baseline is identified**, committed or not, and an unchanged document (`doc_sha256` equal) records LINT-14 N_A with any differences reported as auditor variance rather than regressions.
- **A vacuous rule is PASS, not N_A** — no compatibility claim, no external dependency, no endpoint. Alternating N_A and PASS on an unchanged document was being read as a regression.
- **Evidence reinforcement no longer demotes the citation it split.** A quote broken only by the inserted `Last reinforced` line is re-cited at its new range; `EVIDENCE_OK` is the exit code of the post-reinforcement validator run.
- **Re-run semantics are defined** for a same-day `reaudits/{date}/` folder and for a standalone gate folder that already holds a record; one folder gets one manifest row.
- **`--plan {name}` no longer names the spec.** The spec is `docs/specs/{slug}.md` from the objective; `--plan` only selects the plan receiving the link rows. Two quick-plans against one plan no longer overwrite each other.
- Smaller: falsified assumptions count toward the gap total; `quick-plan` prints a NOT PASS sentence on NOT PASS; the holistic pass writes nothing into the audited repository and does not re-append a candidate; pasted text never overwrites a different existing file; the auditor's two bare registry paths are plugin-relative; `audit.md` holds verdicts pointing at `evidence/`, and the baseline's coverage statuses admit `partial` and `ok-excluded`; the four command files list `Agent` alongside `Task`.

Guarded by PH5-043, which fails if the block loses the fresh-instance definition, the STOP rule covering every canary reason, the LINT-14 write order, the PLANNED/CLAIMED split, the reinforcement exception, or the vacuous-rule rule — verified falsifiable by removing two of those phrases and watching it fail.

## Second stress run and the four fixes it justified (September 5, 2026)

The six scenarios were re-run against a frozen, read-only copy of the plugin, closing the one defect in the first run's method. The freeze held — same tree digest before and after — and the intended PASS path was reached end to end for the first time. All four September 5 fixes held; two had a hole immediately adjacent. Full method and results in [stress-test.md](stress-test.md).

The run was asked to decide whether to build any of three standing controls (embedded spec-test blocks, a term registry with CI enforcement, a step-I/O declaration with a graph check). **It justified none of them**, and the evidence for each rejection is recorded in stress-test.md. Four fixes and one test were built instead:

- **The canary re-run excludes a class; it no longer reseeds.** `tq-canary.js` takes `--exclude <class>`, drops that class from the rotation entirely, records the exclusion in `canary.json`, and exits 3 — distinct from exit 2 — when the document carries no other applicable class. The old instruction told the caller to pass the literal seed `retry` "because the default seed is derived from the file"; `pickClass` hashes the seed alone, so `retry` is a constant and about one default seed in five re-planted the class just missed. Two misses of one trial condemned the audit as untrustworthy and forbade revision. New `canary_reason` `single-trial-only` records the exit-3 case as unproven rather than untrustworthy.
- **LINT-20 has one wording.** It was stated two incompatible ways inside `lint-registry.md`, whose own line 6 declares it the only place rule text may be written: "all 3 sections" in the rules table, "none of the 3 sections" in Gate Behavior. Two auditors split on a two-subsection document, and the run's only PASS sat on the difference. No shipped template produces three subsections — `templates/spec.md` emits one, `plan-scaffolder.md` two, and no file names a third — so the count is gone and the entry fields are what LINT-20 checks. The METHODOLOGY restatement follows verbatim.
- **A spawned auditor that never returns has a branch of its own.** STEP 0 branched only on whether a route was available; 5 of 6 scenarios hit a route that was available, was used, and did not return, and each invented a different answer. The gate now relaunches once — a harness retry that does not consume the sanctioned canary re-run — and records `auditor-did-not-return` if the second launch also fails. It also says to tell a subprocess auditor to run its specialist reviews in sequence, which is what separated the one scenario that completed from the one that timed out twice.
- **Re-anchoring no longer demotes a citation the canary's own edit split.** The rule dropped any quote not locatable in the document, which is what a whole-section citation evidencing an absence becomes after an insertion. In one scenario two correctly-passing rules were demoted to UNMET by the harness's own edit. The carve-out the evidence-reinforcement step already had now covers the canary step.

The `--exclude` fix was then reviewed by an external agent (Codex CLI) and three edge-case defects in it were closed: exit 3 fired on a document *no* class could mark, claiming one trial was possible when none was — it now confirms the excluded class would itself have applied, and otherwise exits 2; a repeated `--exclude` left the second flag to be parsed as the seed and could select the very class the caller excluded — repeats and a missing value are now refused; and the "returns a different class" assertion passed against the reverted CLI, which parsed `--exclude` as a seed, so both injections now share an explicit seed and the exclusion is the only difference. The same review showed the guard's bare `--exclude` grep survived replacing the retry command with a reseed, so it now matches the invocation with lines joined, and also requires the sentence warning against reseeding.

Guarded by fourteen assertions in `tests/canary-test.js` (63 passing, up from 49) and five greps added to `PH5-043`. Both were checked for vacuity: removing the exclusion from the script makes the test report the same class twice, and renaming the new reasons or lower-casing the carve-out makes the guard fail.

The twelve medium and low defects the run recorded are not fixed. A third run, against the frozen 11.2.0 release on September 6–7, executed these four fixes: LINT-20 and the re-anchoring carve-out held; `--exclude` and `auditor-did-not-return` were never entered because no scenario missed a canary or lost an auditor twice. It also found six new high-severity defects, one of them in `tq-canary.js`; the ranked list is in [stress-run3-critic.md](stress-run3-critic.md) and the run itself in [stress-test.md](stress-test.md). The nine fixes it recommends landed on September 7; see the next section.

## Third stress run and the nine fixes it justified (September 7, 2026)

The critic's §6 named nine fixes and two owner decisions. The nine are landed, in one commit, in the shape the critic gave each one:

- **The canary's assumption row lands inside the register or nowhere.** `tq-canary.js` anchors on the register's header row (a cell starting "Assumption", followed by a separator row), stops at the first line that is not a table row, appends after the last row with the register's own numbering and column count, and refuses when the register has no rows. On two run-3 documents the old scan walked past a register numbered A1..A11 into the next numbered table, `inject` exited 0, and `canary.json` named a criterion the copy did not violate, so a correct audit read as a miss. The scaffolder's register template now shows an example row, since nothing had told a generator what the canary anchors on.
- **The mutated copy sits alone in `.canary/doc/`; `canary.json` stays one level up.** The critic asked for a sibling directory; a subfolder gives the same property — an auditor that lists the folder of the file it was handed finds only that file — with no change to the `.gitignore` rule, the deletion step or the `detected` path. The auditor's forbidden-inputs block names the canary record as a sixth entry, so declining it is the shipped rule rather than the auditor's initiative.
- **The strip-and-recheck reaches every finding that rests on the mutated line**, not the canary's own criterion alone. `canary.json` records the operation and 1-based line (`edit`), and the block requires every verdict, matrix row and concern status derived from that line to be re-derived on the document before the baseline is taken. In s2 a collateral UNMET reached the generator as a defect to fix; in s3 two matrix gaps from a stripped finding entered the baseline.
- **The LINT-14 pin survives the two appends that follow it.** "Nothing after the pin may edit that file" was unsatisfiable in printed order: `## Evidence notes` (no generator) and `## Revision History` both append to `audit.md` after it, and five of six executors had to work around the EVIDENCE-STALE this produces. The block now says to re-pin and re-validate after any later edit, and EVIDENCE_OK is the exit code of the last validator run before the gate record is written — which also settles which run the definition names on the quick-audit path (R3-09).
- **Audit notes carry no ids or verdicts.** The reinforcement step forbids criterion ids, verdict tokens, rule counts and gate results in `**Audit note**` text and on the `Last reinforced` line; the auditor's file states how it treats a note that names one anyway — as document text, disclosed, never as a verdict; and `{gate_dir}` is swept of the previous iteration's `audit.md` and `evidence/` as well as its `gate.json` while the auditor works there (R3-13).
- **Smaller:** FULL mode admits a `reaudits/{date}/` folder (R3-15); the record schema's field-order sentence names `criterion_id`, whose absence silently disabled the unsupported-citation check (R3-12); the auditor's Gap Summary carries `Total gaps` and `Total warnings` and the stage's failed and N_A counts, so the two templates agree (R3-10); the canary-reason vocabulary reads six, with a later-event-wins rule for inject exit 2 followed by a double spawn failure, and `quick-audit` presents all six tokens (R3-11).

Guarded by ten new assertions in `tests/canary-test.js` and three greps added to PH5-043.

**Two decisions the critic routed to the owner, and a third that was half-open, were decided on September 7 — see the next section. As the critic stated them:**

- **R3-05 — the one-witness feedback line cannot carry a universally quantified rule.** Roughly half the registry reads "every X has Y"; the revision channel sends one location per unmet criterion, the generator closes that instance, and the next fresh auditor finds another. In s1 this consumed both iterations on one rule. Sending the rule text is foreclosed for stated reasons. Options: one line per witness rather than per criterion; or a bounded suffix naming the further instances by line. Needs a decision record like D7/D8.
- **R3-06 — LINT-14's variance exemption cannot fire inside the revision loop.** It applies only when the document's sha256 is unchanged, and a revision loop changes the document every iteration while spawning a fresh auditor that maximises variance, so a newly noticed pre-existing defect is booked as a regression. Whether to widen the exemption — for example to elements whose underlying text did not change between baselines — is a judgement about how much auditor variance the gate absorbs.
- **R3-01, the design half.** Audit notes now carry no verdicts, but they are still written into the document before the loop ends and are read by the next auditor. Whether reinforcement should wait until the loop ends is the remaining question; the mechanical half is landed.

The rig fixes from the critic's §4b are in `stress-rig/` as of September 7: the `.canary` tar exclusion and the checker's prose-scan rename (during the run), then s3 bound to the small project with its claimed paths asserted, `launch-auditor.sh` for the stdin and tool-grant form, `scenario-inputs.md` for the fixed s1 answers and s6 text, and the checker's mode regex. The fourth run — three scoped scenarios, none yet built — is unblocked by the decisions below.

## Fourth decision round: the revision loop (September 7, 2026)

Decided by the owner on September 7 on the evidence of the third stress run, with the option chosen from the alternatives the critic and the session laid out. Same selection rule as D1–D8: the option that stays honest as the plugin ages.

| ID | Decision | Rationale | Where it landed |
| --- | --- | --- | --- |
| D9 | **One feedback line per witness.** The revision channel sends one line per defect, not per criterion: a criterion quantified over the whole document is unmet at every instance the audit found, and each instance is its own line with its own location. No count of further instances is sent — a count is a total. The auditor's UNMET table lists one row per witness so the caller has the rows to forward. | In s1 all three LINT-07 witnesses were visible in v1; the channel named one per iteration, the generator closed it, and the next fresh auditor named another, so both iterations went to one rule. The budget was lost to sequencing, not discovery. The alternatives — a capped "also at" suffix, or leaving it — either invent a number the generator reads as the total or make the two-iteration limit depend on which instance the auditor named first. Sending the rule text stays foreclosed for the reasons the block already gives. | `plugins/toque/skills/plan/stages/stage-2-design.md` (`<revision_feedback>`), `plugins/toque/agents/plan-auditor.md` (Verdict Summary), `tests/layer1-repo.sh` (PH5-043). |
| D10 | **A regression is a flip on text the revision changed.** An element that was passing and now fails counts as a regression only when a line its new record cites lies inside the diff between the previous baseline's document and the current one. A flip whose cited lines are unchanged is AUDITOR VARIANCE: reported, never a LINT-14 failure, and the element still fails its own criterion. The caller keeps a copy of the document beside each baseline; when no copy can be found it says so and treats every flip as a regression, as before. | The gate mandates a fresh auditor every iteration and then penalised the document when that auditor saw more. Byte-identical was the only exemption, and a revision loop changes the document by definition, so LINT-14 was unreachable in the loop it exists for; s1 booked a pre-existing LINT-21 defect first noticed on iteration 3 as a regression because the text left no other option. Making LINT-14 N_A on every loop iteration would also have removed the real signal, a revision breaking a passing element. Revisions are already scoped to the failing sections, so the changed region is known and small. | `stage-2-design.md` (BASELINE SNAPSHOT comparison rules, the exemption paragraph, the loop's compare step), `tests/layer1-repo.sh` (PH5-043). |
| D11 | **Evidence reinforcement runs once, after the loop.** Audit notes and the `Last reinforced` line are written to the final version of the document, using the final audit and the gaps earlier iterations closed, never between iterations. The baseline snapshot is still taken every iteration. Notes still carry no ids or verdicts, because a manual re-audit or a Full-mode reaudit reads the document later. | The mechanical half (no verdicts in notes) landed with the nine fixes; the design half remained: a note written mid-loop is caller text in the document the next fresh auditor is told to read without prior verdicts, and four run-3 auditors had to find, disclose and re-derive around such notes. Writing once on the final version removes the conflict instead of managing it. | `stage-2-design.md` (EVIDENCE REINFORCEMENT header and timing paragraph, the post-loop step, the Part C outline), `tests/layer1-repo.sh` (PH5-043). |

All three were executed under a frozen tree the same day (stress-test.md, fourth run). D9 held on the caller's side in both revision iterations of s1 and exposed that nothing checks the auditor's half (R4-03). D10 executed in both scenarios and classified every flip the way an independent verifier did, but its rule names "the item's new record" for element classes that have no record (R4-01), and that referent decided s1's only UNMET. D11 held completely. The two run-4 defects that follow from these decisions, R4-01 and R4-03, are recorded there and are not yet fixed.

## Fourth-run fixes: the baseline comparison is a script (September 7, 2026)

The recommendation the fourth run left standing was the one made before it: the
caller duties D10 added — keep the previous document, diff it, classify every
compared element, write and pin the LINT-14 record — are mechanical and should
be one script, which would settle R4-01 by construction because a script must
name what it compares. That script is
`plugins/toque/scripts/tq-gate-baseline.js`, and it replaces the prose that
occupied `stage-2-design.md:1017-1087`.

**R4-01 is closed at the input, not by a clarifying sentence.** The old rule
keyed a regression on "the line the item's new record cites"; coverage,
scenario and concern rows have no record. Every element the script compares now
carries `lines` and `line_source`. A LINT element may omit both — `compare
--evidence` fills them from `evidence/{criterion_id}.json`, using only
citations that point at the audited document, since a change to a cited test
file is not a change to the document being diffed. A matrix row has no record
and names them itself, read from the auditor's own matrices. A flip the script
cannot scope — no previous document, or a row that named no lines — is booked
as a REGRESSION and marked unscoped with the reason, because the gate's
standing rule is that the exemption is never applied on a guess.

The four subcommands map one to one onto the four caller duties: `compare`
(diff and classify, exit 1 on any regression), `record` (write `## Baseline
comparison` into `audit.md` and pin `evidence/LINT-14.json` to it — steps 1 and
2 of the LINT-14 write order, in one pass so the section and the pin cannot
disagree), `repin` (recompute the hash and relocate the range after any later
append, the failure five of six run-3 executors worked around by hand), and
`snapshot` (write the baseline, move the previous one whole into `history`,
compute `doc_sha256` from the document rather than trusting a transcribed one,
and keep the document copy the next diff needs).

Four R4-06 items are closed as a side effect, because a script cannot leave
them open: the three status vocabularies in use (`covered|partial|ok-excluded|gap`,
`OK|WARNING|GAP`, `PASS|FAIL|N_A`) map in one place and an unmapped token is
refused rather than guessed; `covered -> partial` and `ok -> warn` have a
category (DEGRADATION, reported, not a LINT-14 failure, which D10 defines over
an element that was passing and now fails); `history` holds the whole previous
baseline object, which is what a trend line over it needs; and every
classification records whether it was diff-scoped, so improvements are marked
the same way regressions are. Two things the runs hit are new: a DROPPED class
beside NEW, so the two renamed rows one run booked as new items would show as a
rename; and LINT-14 excluded from its own comparison, since the auditor writes
it N_A every time and the caller overwrites it, which would report as
NOT-COMPARABLE noise on every iteration.

Guarded by PH5-044 in `tests/layer1-repo.sh` — the block must RUN each of the
four subcommands rather than describe them, the script must dispatch all four
and read all four element groups, and the schema sentence requiring a matrix
row to name its lines must survive — and by 58 assertions in
`tests/gate-baseline-test.js`, registered as layer 9. Both were checked for
vacuity: making `scopeOf` always report "changed" fails nine assertions,
emptying the self-referential set fails the LINT-14 exclusion, dropping the
deletion marker fails the deletion test, and pointing the block's `repin`
command at another filename, removing the matrix-row sentence, or moving the
script away each turns PH5-044 red.

**The two rig artifacts the run recorded are fixed.**
`check-invariants.js` reports what `history` actually holds rather than a bare
boolean against a field no schema then put there — and the field is now real,
since `snapshot` writes whole baselines. `freeze-plugin.sh` writes
`run-started.txt` itself, naming `hash-tree.sh` as the recipe with its
normalisation rules, the source commit and the exclusions, so a verifier can
recompute `frozen-before.sha` instead of taking it on trust; run 4's two
verifiers could re-derive every gate term from disk and neither could reproduce
that number. `launch-auditor.sh` records a wrapper PID, the child PID, a launch
nonce, the host and the output file's size, mtime and hash alongside what it
already recorded — not proof against a determined forger, since nothing the
wrapper writes about itself can be, but the difference between a file that
describes a launch and one written by one. That is the gap between s8's
ESTABLISHED and s1's CORROBORATED.

**Also closed:** `quick-plan.md` said one line per unmet criterion where D9 says
one per defect.

**Still open from run 4, and not decided here.** R4-02 (whether the canary
re-runs per revision iteration) is an owner decision, not a fix: both executors
ran it once, and CANARY_OK for s1's second and third gate runs rests on a trial
those auditors never took. R4-03 (nothing checks the auditor's own "one row per
witness" instruction), R4-04 (the canary-delete step and the gate-record-last
step still cannot both hold as printed) and R4-05 (the holistic judge is
pointed inside `.canary/` with no forbidden-inputs block) are unchanged. The
open path is still unobserved: s1's fixture has not been re-run against the
script.

## Third review of the baseline script: what its own fixes broke (September 7, 2026)

The script was reviewed twice and sixteen fixes landed. A third adversarial
re-test, asked specifically to break the fixes rather than re-find the defects,
returned six closed cleanly and ten partial. Two of the partials were leniency
introduced BY the fixes, which is the failure mode the script exists to prevent,
and one defect none of the three reviews had named was the most destructive
thing in the file. All were reproduced here before being fixed.

**A regression outranks an uncompared class.** The rule that made LINT-14 `N_A`
when a whole element class had no history was ordered above the regression test,
so adding the first concern row to a plan whose baseline carried none turned a
proven pass-to-fail regression into `N_A` and exit 0 — and `N_A` does not block
the gate. A regression is established information; missing information about a
different class cannot erase it. The uncompared demotion now applies only to an
otherwise-`MET` verdict, and the justification names the uncompared classes
alongside the regressions that stand regardless. Reproduced at 1 regression,
`N_A`, exit 0 before; 1 regression, `UNMET`, exit 1 after.

**Displacement marks seams, not every displaced line.** Marking every LCS-matched
line whose offset shifted was justified as safe over-reporting, on the reasoning
that it can only turn a variance into a regression. Measured, it marks 302 of 303
lines on a 300-line document with one insertion at the top and one edit at the
bottom, because trimming the common prefix and suffix only protects a document
edited at ONE end. That is D10's exemption switched off for the whole document by
an ordinary two-place revision — the same outcome as the bug the rule was written
to fix, reached from the other side. Only the boundaries of a run whose offset
differs from the run before it are marked now: the same case marks 4 lines, and a
block swap is still caught at both its seams.

The interior of a moved block was then left reading as unchanged, and that was
written up as a permanent limit on the argument that inside one diff alignment
`cj - pi` is identically (insertions above − deletions above), so "displaced"
carries no information beyond "text changed above". **That argument was wrong and
the fifth section below retracts it.** The identity holds; the conclusion drawn
from it does not, because the offset is not the only thing the alignment carries.

**A refusal must not edit the file it refuses to pin.** Two checks fired after
`writeSection` had already written: the realpath containment check, and the
discovery that the section could not be found afterwards. Both produced exit 2,
no evidence record, and a modified `audit.md`. On an audit holding an
unterminated code fence, three identical `record` runs left three contradictory
sections on disk behind an exit code that said nothing was written (963 → 1,898
bytes over two). Containment is now checked before the write, and `writeSection`
verifies the section is locatable in the computed text and throws without
writing when it is not. Verified: the file is byte-identical after two refused
runs.

**The section terminator deleted to end of file, and nobody had named it.** The
terminator tested the raw line against `/^##\s/` while the section START tested
the trimmed line. An indented `  ## Verdicts` was therefore accepted as a
heading that opens the section and rejected as one that closes it, and a
`# Appendix` never closed it at all — so the section ran to end of file and
every rewrite deleted that content, at exit 0, with a success message. Both
tests now allow up to three spaces of indentation, and the terminator stops at
any level-1 or level-2 heading. A level-3 heading belongs to the section.

**The fence scanner kept the character and discarded the length.** Four of eight
fence shapes mis-located the section: a four-backtick block closed on the first
three-backtick line inside it, an info-string line closed a block, and a fence
indented four spaces inside a list was not recognised as a fence at all. In each
case a `## Baseline comparison` written as an EXAMPLE became the section the
script rewrote. The scanner now tracks the fence character and its length,
requires a closing fence to be at least as long and to carry nothing but
whitespace, and refuses a backtick opener whose info string contains a backtick.
Eight of eight shapes locate correctly.

**A reused run number destroyed the copy the next comparison needs.** The kept
document copy is named by run number alone and written unconditionally, so
snapshotting a CHANGED document under a run number already used overwrote the
copy the earlier history entry points at. That entry keeps its old `doc_sha256`
while the file holds different bytes, and `compare` — which authenticates the
previous document against exactly that hash — then refuses to diff it, leaving
`-` and unscoped regressions as the only route. The two fixes fought each other:
one step destroyed the artifact the other demanded, and the error told the
caller to recover a file that step had deleted. A collision on differing content
is now refused before anything is written. The duplicate guard does not cover
this: it keys on the document hash, and here the document is what changed.

**Also closed:** the caller instructions still said "regressions indicate the
revision broke something that was previously working". The earlier fix corrected
the public guide and not the instruction the caller executes. A regression means
the cited lines overlap the diff; the script establishes overlap, not causation,
in either direction.

**The tests were weaker than the commit claimed.** The re-test mutated the script
and re-ran the suite: four assertions stayed green against a mutant that removed
the protection they name, including the realpath check and the out-of-range
citation bound. `PH5-044`'s behavioural probe — added specifically because the
grep-only version survived a gutted `readElements` — used concern rows alone, and
survived `if (kind !== 'concern') return;`, which deletes every lint, coverage
and scenario row. The probe now runs all four classes and the regression-ordering
case; the suite is 148 assertions; and each of fourteen protections is verified
against a mutant that removes it, 14 killed and 0 surviving.

**Not fixed, and recorded rather than closed.** A citation of the form `./doc.md`
is rejected where the validator accepts it, because path identity is literal
string equality. Omitting `doc_sha256` from the previous baseline and supplying
the current document twice still passes with a warning. `normalizeStatus` mangles
a balanced nested parenthetical while accepting a malformed one. `record` accepts
a comparison computed for a different document, so hashing the report establishes
its bytes and not that its statuses belong to this audit. The deepest of them is
not a defect: the script computes citation-coordinate overlap, and a line whose
own text is unchanged can fail because the lines around it changed — so the
variance exemption is no better founded than the causal claim already withdrawn
from the regression side. That bounds what D10 can honestly promise, and no
wording repairs it.

## Fourth review: the third leniency, and a claim retracted (September 8, 2026)

Two repairs in a row had introduced their own leniency, so the fourth review was
aimed only at the seven changes in `63991f3` and told to assume a third instance
existed. It found one, and it disproved the reasoning used to justify the second.

**Seam marking exempted a reordering.** Move the "Commit payment" block above the
"Validate request" block. A cross-cutting concern reading "authorization happens
before commit" flips ok → gap and cites a validation line. That line's own text is
untouched — it sits in the interior of the run the commit block passed over — so
the comparison returned VARIANCE, LINT-14 MET, exit 0, on a revision whose whole
content was the reordering the concern is about. Reproduced against the committed
script before anything was changed.

**The claim that this could not be fixed is retracted.** The previous section
argued that a moved block's interior is unrecoverable because `cj - pi` is
identically (insertions above − deletions above). The identity is true. The
inference from it was wrong: the offset is not the only thing the alignment
carries. A maximal unmatched run on the previous side whose CONTENT equals a
maximal unmatched run on the current side is a block deleted from one place and
inserted in another — a move named by content rather than inferred from position
— and the matched lines it crossed follow from its two positions. The cost is a
hash map over unmatched runs; the LCS table is not enlarged.

Measured, marking crossed lines does what marking displaced lines could not:

| Revision | Seams only | With the move detector |
|---|---|---|
| Reorder two phases (the defect above) | line 8 exempt, MET | line 8 marked, UNMET |
| Block swap, interior cited | variance | regression |
| 300-line, insert at one end | 1 of 302 | 1 of 302 |
| 300-line, insert and edit at both ends | 4 of 303 | 4 of 303 |
| 300-line, three scattered edits | 6 of 302 | 6 of 302 |

Ordinary revisions are untouched because their unmatched runs do not pair. The
limit that survives is narrower and is now stated as such in both the gate
instructions and the public guide: the diff cannot show a retained requirement was
UNAFFECTED when only the prose around it was rewritten. Variance means "no cited
line is in the diff", not "the revision did not disturb this obligation".

**A test was bent around the defect, and the review said so.** Section 8 of
`tests/gate-baseline-test.js` had been changed to assert that a moved block's
interior IS variance — turning the defect into behaviour the suite insisted on
preserving, under a comment calling it a permanent limit. It now asserts the
interior is a regression, and the reordering case is a test of its own.

**Literal HTML blocks are not markdown.** Two defects, one class. An `# H1`
written inside an HTML COMMENT terminated the comparison section, so the pin
quoted three lines and excluded the verdict and regression row the record rests
on — and the evidence validator passed that record, because quote fidelity says
nothing about whether the quoted span is the right one. Backticks inside a `<pre>`
evidence log opened a fence nothing closed, so `record` refused a well-formed
audit with "close the fence" against a fence that did not exist, and no re-run
could repair it. Comments and raw-text elements (`pre`, `script`, `style`,
`textarea`) are now shielded, as CommonMark has them.

**The previous pass's test evidence was weaker than its commit message.** It
claimed "fourteen protections each verified against a mutant that removes it".
The fourteen were broad reversions — easy to kill, and therefore weak evidence.
Asked to write the subtlest mutation of each guard instead, the review found
eleven that passed all 148 assertions, including `regressions > 0` weakened to
`=== 1` (two regressions returned MET, because every regression fixture in the
file had exactly one) and the pre-write containment check reading `process.cwd()`
rather than the `--root` it was given (every CLI test ran with the two equal).
Three assertions were also literally `check(name, true)` when the host could not
create a junction, so a machine that never ran the containment tests reported the
same green total as one that did.

The suite is 182 assertions. Skips are counted and printed separately from
passes. The harness now requires a green control run before applying any mutant,
fails on a stale needle instead of skipping it, and reports a crashed run as
inconclusive rather than as a kill. Fourteen subtle mutants: 14 killed, 0
surviving. Two more were shown to be EQUIVALENT rather than chased — merging
same-offset runs is unobservable because two such runs can only be non-adjacent
when the gap holds a balanced delete-plus-insert, which already marks the first
run's end line; and `pi >= mv.prev.end` equals `pi > mv.prev.end` because
`mv.prev` spans unmatched indices that no matched pair can hold.

**Not fixed, and recorded.** An UNCOMPARED class never has to acquire history:
fix the named regressions and the next run returns N_A and exit 0 with the class
still uncompared. The workflow instructs the caller to record it; the script does
not enforce it. Sharing one `--keep` directory between two documents at the same
run number is refused, because the copy is named by run number alone; separate
keep directories are the remedy. Both predate this round.

## Fifth review: the move detector's own blowup (September 8, 2026)

The fifth review was aimed at exactly two functions — `crossedByMovedBlocks` and
the HTML handling inside `fencedLines`, both new in `8165b37` — and told to
assume the repair had introduced a defect, as the three before it had.

**Pairing on byte equality re-created the blowup it replaced.** A markdown
document is mostly repeated single lines: blanks, `---`, `|---|---|`. One of them
pairing with an identical copy at the far end marks everything between. Measured
on spec-shaped documents: deleting one blank line below the title and adding one
before the appendix marked **145 of 150 lines**; relocating a single `---` among
forty marked **334 of 361**. Both are formatting edits that touch no requirement.
This is the third distinct route to the same failure — the variance exemption
switched off wholesale — after the blanket displacement rule's 302 of 303.

The fix is DISTINCTIVENESS, counted over the whole documents rather than the diff
region: a line occurring more than once anywhere has ambiguous provenance and
supports no claim about what moved. Uniqueness among unmatched runs is not enough
and the review said so — the blank-line case has exactly one unmatched blank on
each side and still fails under the weaker rule.

**Whole-run equality was brittle in the other direction.** Move a block and write
one revision note beside it: the new unmatched run carries the note, so the runs
are different lengths, they do not pair, no move is found, and the reordering the
note is about goes back to being auditor variance — `MET`, exit 0. Pairing is now
line by line, and lines that were consecutive before and stayed consecutive after
regroup into a block. Text added next to a moved block no longer hides it. The
`used` set is gone with it: a distinctive line has at most one home on each side,
so there is no greedy choice left to get wrong.

**Four HTML deviations from CommonMark 4.6, one of them the same defect twice.**
A bare `<pre` at end of line is a valid start condition and was rejected, so
backticks inside such a block opened a fence and made the audit unwritable —
which is the exact failure the shield was added to fix, reached by a different
spelling of the tag. A raw-text block is closed by ANY of the four closing tags,
not only the one that opened it. `<!-->` and `<!--->` are complete comments and
were opening blocks that swallowed the file. And `<table><tr><td>` followed by a
nested `<pre>` made an ordinary evidence excerpt unwritable, because type-6
blocks were not recognised at all; they are now, ending at a blank line, which
keeps the nested tag from starting a block of its own. Tag boundaries follow the
spec — space, tab, `>`, end of line — rather than `\s`, which also accepted a
non-breaking space.

**A previous equivalence proof was wrong.** The fourth round excluded the mutant
`lastPi === pi - 1` → `<= pi - 1` as equivalent, arguing that merging same-offset
runs is unobservable because the first run's end line is already marked by the
deletion rule. That much is true. It missed that merging also invents a NEW last
boundary at the second run's end, which the real rule leaves exempt. The review
supplied the counterexample, it is now a pinned test, and the mutant is back in
the harness. The companion proof — that `pi >= b.pEnd` equals `pi > b.pEnd`
because a block's span holds only unmatched indices — was independently confirmed
and stands.

**The tests were thin where it mattered most.** Against the two functions under
review, thirty subtle mutants passed all 182 assertions. The suite is now 234
assertions and the harness runs 29 mutants, one per decision either function
makes: 29 killed, 0 surviving. Five of those took a randomised search to
separate, because hand-built fixtures were small enough that ordinary
deletion-adjacency marking covered every line and real and mutant agreed by
accident. Those five fixtures are kept verbatim rather than tidied.

Cost, on the adjacent-swap worst case: 8 ms at 500 lines, 33 ms at 1,000, 120 ms
at 2,000 — below the 354 ms the review measured for the previous implementation
on the same shape. The coarse fallback returns before the detector runs, which is
correct: it already marks the whole changed middle.

**Not fixed, and recorded.** Greedy pairing can attribute a move to the wrong one
of two identical blocks, but the review established that no purely geometric
alternative removes a necessary crossing — the two documents cannot supply the
provenance, and sorted pairing marks exactly the crossings that must occur. A
block deleted here and coincidentally identical text inserted there is still read
as a move; for the gate's purpose those are the same event.

## What this does not claim

- D1 changes what the shortcut commands instruct; it does not add a runtime check that an agent obeyed the instruction. The suite's PH5-042 guard checks that the gate has one definition and that both shortcuts carry the execute-by-reference directive, not that a live run executed it. The evidence re-anchoring step is an instruction to the agent; a script that does it mechanically would be the durable form.
- A plan written outside the spec template cannot PASS the gate. That is a consequence of one gate, stated in the commands rather than hidden.
- D4's `released_at` is a human statement recorded by the agent, not an observation of production.
- D5's immutability is enforced at the diff only in Toque's own repository (`.github/protected-artifacts.sh`). In a consumer repository it remains a workflow instruction.

## Lower-impact ambiguities left as recorded

The ambiguities findings.md lists below the decision table (auditor count wording, overlapping parallel thresholds, self-audit example mixing, the old baseline reference) were not part of this decision round and are unchanged.
