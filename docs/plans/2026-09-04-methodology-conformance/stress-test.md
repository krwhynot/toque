# Stress test of the shortcut commands — September 5, 2026

Decision D1 made `quick-plan` and `quick-audit` execute the same design gate as Stage 2, by reference. The suite guard for that decision (PH5-042) checks that one definition exists and that both commands carry the execute-by-reference directive. It cannot check that a live run obeyed it. This file records the test that did: six scenarios run end to end by agents following the shipped instruction text, in scratch repositories, with the resulting files re-inspected by a script and by a second agent that had not seen the first one's reasoning.

The purpose was to move D1's evidence from "the files say the right thing" to "running it produces the right thing", and to find the places where the instructions are ambiguous enough that two competent readers do different things. It found both: the gate's structure held in every run, and fourteen instruction defects survived the file-level audit that preceded this test.

## What was run

Six scenarios, chosen to cover every binding the two commands can produce.

| ID | Scenario | Bindings exercised |
| --- | --- | --- |
| s1 | `quick-plan` on a vague objective, standalone | new spec, gate folder beside it, scaffolder bound as `{generator}` |
| s2 | `quick-plan --plan {name}` with the plan folder present | spec linked to an existing plan; plan's own gate record must not be touched |
| s3 | `quick-audit` on a standalone spec written to the template | existing document, no generator, all five canary shapes present |
| s4 | `quick-audit` on a prose ADR carrying none of the five shapes | the canary-not-applicable branch |
| s5 | `quick-audit` on a plan's own `spec.md` after design completion | Full mode, rerun into `reaudits/{date}/` |
| s6 | `quick-audit` on a plan pasted as text, with no file path | document written to `docs/specs/` first, then audited |

Thirteen agents ran: one executor and one independent verifier per scenario, plus one cross-scenario critic. 2.37M subagent tokens, 328 tool calls, roughly 49 minutes of agent time. The run was interrupted once by a session limit and resumed from its journal; two scenarios re-ran live and the rest replayed from cache.

## How isolation was enforced

Each executor was given a single scratch repository and this constraint in its prompt: never read, write, or run anything in the plugin repository except reading files under `plugins/toque`; write only inside its own scenario directory. The verifiers checked that afterwards — `git status` in each scratch repo, and the absence of any change in the real checkout.

Fixtures were built by `stress-rig/build-fixtures.sh`:

- **s1, s4, s6** use a small invented Node project (an Express reporting API with `reports.js`, `auth.js`, `db.js` and two tests) so the auditor has real code to cite and no prior Toque artifacts to lean on.
- **s2, s3, s5** use a `tar` copy of this repository, because the centerpiece plan those scenarios reference is about this repository. `.git`, `assets/`, `node_modules/` and the 2026-07-20 plan folder are excluded; each copy gets a fresh `git init` and one commit, so "unchanged since the fixture commit" is checkable.
- **s3** additionally gets `stress-rig/fixture-template-spec.md`, a spec written to the shipped template that carries all five shapes the canary attaches to. All five classes were confirmed applicable to it before the run. (Since September 7 the builder binds s3 to the small project instead, which is what the spec describes; runs 1–3 bound it to the repository copy, and §4b row 7 of the run-3 critic records what that cost.)
- Baseline sha256 values (LF-normalised) for every document that must not change are written to `.stress-baseline/` in each repo, git-excluded.

## How each run was checked

Four layers, deliberately not trusting each other.

1. **The executor's own log.** What it says it did. Used only as a claim to check, never as evidence.
2. **`stress-rig/check-invariants.js`.** A deterministic script that reads the repository afterwards: gate folder contents, evidence record count, whether any record cites a `.canary/` path, whether the audited document's hash still matches its baseline, whether `.canary/` survives anywhere, the `gate.json` keys, and the plan folder's `audit.md`/`spec.md`/`evidence` counts against their baselines. It also runs the shipped evidence validator against the produced records and reports its exit code and flags. It never writes.
3. **A verifier agent per scenario.** Given the scenario definition and the repository, not the executor's conclusions. It re-derived each invariant itself and classified every divergence as an instruction defect, an agent error, or a fixture artifact.
4. **One critic across all six.** It read every verifier report and the current plugin files, discarded findings already closed, deduplicated the rest, and ranked them by how badly they mislead a real run and how many scenarios hit them.

Eighty-nine invariants were checked across the six scenarios; six came back not-ok, and all six are explained below.

## Results

| ID | Gate verdict | Canary | Mode | Invariants |
| --- | --- | --- | --- | --- |
| s1 | PASS (16 MET, 0 UNMET, 2 N_A; 0 INFRA-GAPs) | found in both iterations: `owner-strip` → LINT-04, then `assumption-inject` → LINT-08 | Lite | 13 of 13 |
| s2 | NOT PASS (LINT-07, 08, 15, 16 unmet; 9 INFRA-GAPs) | not run — `no-isolation` | Lite | 13 of 13 |
| s3 | NOT PASS (8 unmet; 2 INFRA-GAPs) | `not-applicable` — `inject` exit 2 | Lite | 12 of 13 |
| s4 | NOT PASS (14 unmet; 0 INFRA-GAPs) | `not-applicable` — `inject` exit 2 | Lite | 17 of 18 |
| s5 | NOT PASS (12 unmet; 0 INFRA-GAPs) | `not-applicable` — `inject` exit 2 | Full | 15 of 15 |
| s6 | NOT PASS (13 unmet; 1 INFRA-GAP) | found: `assumption-inject` → LINT-08, stripped and re-checked | Lite | 13 of 17 |

The validator exited 0 on every run's records, with no flags.

The six not-ok invariants: s3's canary did not plant (the anchor fix committed mid-run removed the one class that applied to that fixture); s4's `gate.json` had the wrong top-level shape (the shape was defined by a commit that landed between the executor writing the record and writing the file); and s6's four are all measured against text that landed three minutes after that run finished. None is a case of a run doing something the text it read forbade.

## What the runs establish

Every scenario executed the shared `<design_gate>` block with its own bindings rather than a lighter local review, and the on-disk consequences D1 specifies all held:

- the gate folder sat beside the audited document, or in `reaudits/{date}/` for a post-approval rerun (s5);
- audit mode came from the caller's bindings — Lite for a spec, Full for a plan's own `spec.md` — not from whether a plan folder happened to exist;
- the plan folder's own `audit.md`, `spec.md` and `evidence/` were byte-identical afterwards in s2, s3 and s5, verified against pre-run hashes;
- `manifest.md` and `status.json` rows appeared only where the command names them, and nowhere else;
- evidence records cited the committed document, never the mutated `.canary/` copy, and `.canary/` was gone from every repository;
- the gate expression was derived term by term rather than asserted;
- no run committed anything, and no run touched the real checkout.

Most importantly, **no run produced a wrong PASS.** Five NOT PASS verdicts were correct under both the text those runs read and the text as it stands now. The one PASS (s1) was honest against its own evidence.

Where the six runs diverged from each other, it was always in reading the instruction text, never in the gate's structure and never in a command inventing its own gate. That is the specific property D1 was chosen for, and it is what this test measured.

## What the runs do not establish

- **The intended PASS path has not been run end to end under the current text.** That path is: a freshly spawned auditor finds a planted defect, the records validate, and the gate opens. s1 passed but its auditor ran in the caller's context; s5 achieved isolation but its document had no applicable canary class.
- **The current text was never executed live.** Every executor read the pre-`371b37d` instructions for at least part of its run, because that commit landed while the runs were in flight. The fixes in it are covered by unit tests and by reading, not by a run. This is the rig's worst flaw and the thing to do differently next time: freeze the plugin checkout before launching.
- **Auditor independence was exercised only once.** Five of six executors had no tool to spawn a subagent and concluded isolation was impossible; s5 achieved it by launching `claude -p` from Bash. The canary mechanics ran, but the property the canary exists to measure — that an auditor who knows nothing about the plant still finds it — was tested in one run out of six.
- **Agent-level model was not pinned.** Executors and verifiers inherited the session model; no per-agent override was set. Later runs of this rig should pin the model so results are comparable.
- Six runs is a sample, not a proof. The scenarios were chosen to cover the bindings, not to be statistically representative of real use.

## Defects found

Fourteen instruction defects survived the file-level audit and `371b37d`. Full text, cited line numbers and proposed wording are in the critic output; the ranking and the three that matter are summarised here.

| Rank | Where | Problem | Scenarios |
| --- | --- | --- | --- |
| 1 | `stage-2-design.md` LINT-14 caller record | Tells the caller to cite baseline entries that a later step rewrites, so the citation goes stale and the validator rejects it; also says both `N_A` and "MET otherwise" for a first audit | all six |
| 2 | `stage-2-design.md` no-isolation branch | The branch every spawn-less session lands on; read three different ways, no statement of whether `inject` runs, no precedence against `not-applicable`, and the STOP rule does not name it | s1–s4, s6 |
| 3 | INFRA verification and LINT-15/16 | A test file the spec names as its own deliverable is recorded as a gap, so an honest new-work spec cannot open the gate; the template instructs naming exactly those files | s1–s3, s6 |
| 4 | Evidence reinforcement | Inserts a line into the Evidence header that splits the LINT-20 quote the gate just pinned, then calls the break a demotion | s1, s2 |
| 5 | `quick-audit.md` rerun semantics | Same-day `reaudits/` folders collide; a standalone gate folder that already holds a record has no stated rule | s3–s6 |
| 6–14 | assorted | Vacuous lint rules with no defined result; `--plan` naming collision that overwrites a prior spec; falsified assumptions missing from the gap total; an unconditional "passed the design gate" sentence; the holistic pass's write-target loophole; pasted text overwriting an existing file; two bare registry paths in `plan-auditor.md`; three contradictions with the agent file; `Task` in `allowed-tools` where the tool is now `Agent` | various |

Ranks 1, 2, 4 and 5 are wording fixes. Rank 3 is a product decision about how strict the gate should be on work that has not happened yet.

**All fourteen are closed.** Rank 3 was decided as D7 (a planned deliverable is not
a gap) and the isolation question in rank 2 as D8 (a `claude -p` subprocess is a
fresh instance); both are recorded with their rationale in
[decisions.md](decisions.md). The wording fixes landed with them, and PH5-043 in
`tests/layer1-repo.sh` fails if the block loses the fresh-instance definition,
the STOP rule covering every canary reason, the LINT-14 write order, the
PLANNED/CLAIMED split, the reinforcement exception, or the vacuous-rule rule.
That guard was checked for vacuity by deleting two of those phrases and
confirming it failed.

Not ranked, and recorded here so the numbers are not mistaken for instruction defects: nine executor mistakes (a skipped risk row, two short table rows, a dropped citation, two wrong `N_A` verdicts, a CRLF misreading, a stale gate file left in place, a gap count that disagreed with its own baseline) and seven fixture artifacts (chiefly the mid-run commit described above).

Nine defects the executors reported were already closed by `371b37d` before the critic ran — the template and scaffolder canary shapes, the `assumption-inject` anchor, the existence of a no-isolation rule, the reinforcement re-pin, the `gate.json` shape, the exit-2 skip list, the plugin-relative registry path, the holistic-pass skip rule, and the LINT-08 falsified wording. They are recorded as closed rather than ranked, which is why the run reports name defects this file does not.

## Second run, against a frozen checkout — September 5, 2026

The first run's results were partly void: the plugin changed underneath it mid-flight. That was the one real defect in the method, and this run closed it.

**The freeze.** `tar` streamed into a read-only copy (`rsync` is not installed in Git Bash here, and GNU `tar` reads `C:/...` as a remote host, so the `-f` form is avoided), a writable twin from the same stream as the fixture source, then `chmod a-w` on all 59 instruction files and scripts. The lock was proved rather than assumed: a shell append and a `fs.appendFileSync` were both attempted against the gate stage file and both refused, and the freeze script exits non-zero if either succeeds. Tree digest `51f67865…4d22` over 256 files, LF-normalised, taken before locking and again after the run. **Identical.** One scenario reported a refused write — the holistic pass trying to append to `lint-candidates.md` inside the plugin — and took the read-only fallback rather than routing around it.

**Scale.** 13 agents (6 executors, 6 verifiers, 1 critic), all pinned to Opus 5, 0 errors, 2.5M tokens, 842 tool calls. A usage limit killed 7 of 9 agents partway; two executor results survived and were replayed from the run journal, the four contaminated scenario repositories were rebuilt clean, and the run resumed.

**The intended PASS path was reached, once.** Scenario s2, end to end: fresh instance via `claude -p`, a defect planted (`criteria-strip` → LINT-10) and returned UNMET, confirmed mechanically by `tq-canary.js detected` with the applicable set supplied, validator exit 0 over 18 records, 17 MET + 1 N_A, 0 infrastructure gaps, `gate_passed: true` — every term re-derived from the gate folder by a verifier that did not perform the run. Two runs had failed to reach it.

**All four fixes held.** PLANNED versus CLAIMED was the cleanest: five scenarios, every classification independently re-derived, zero misclassifications. Vacuous rules returned PASS everywhere — exactly one `N_A` per corpus and it is LINT-14 every time — and s4 closed the loop by re-auditing a byte-identical document and finding the same rules recorded `pass` in the prior baseline. Isolation held on what it defines: six scenarios, six fresh-instance routes, no caller-context role pass. The LINT-14 write order held six times out of six, every pin matching its `audit.md` hash.

**Two fixes had a hole immediately adjacent, and the run found both.** Next to the isolation branch: no reason exists for an auditor that is spawned and never returns, the vocabulary was explicitly closed, and 5 of 6 scenarios hit it and each invented a different answer. Next to the vacuous-rule fix: the canary re-anchoring rule drops any citation not locatable in the document, which is what a whole-section citation evidencing an absence becomes after an insertion — so two correctly-passing rules were demoted to UNMET by the harness's own edit.

**The sharpest defect was in none of the four areas.** The gate told the caller to retry a missed canary with the literal seed `retry`, "because the default seed is derived from the file and would pick the same class again". `pickClass` hashes the seed alone — the document is not an input — so `retry` is a constant (`owner-strip`). About one default seed in five lands on it, and the rotation on a sparse document can return to the missed class anyway. The canary's one second chance could silently be the first chance again, and two misses of one trial condemn the audit as untrustworthy and forbid the revision loop.

**Sixteen instruction defects survived the critic's own re-reading**, four of them high severity. Six are one class: two files describing one artifact and disagreeing. The most consequential is that LINT-20 was stated two contradictory ways inside `lint-registry.md`, the file whose own line 6 says it is the only place rule text may be written — and the run's single PASS sits exactly on that contradiction.

### What was built afterwards, and what was not

The run was asked to decide between three candidate controls: embedded runnable spec-test blocks, a term registry with CI enforcement, and a step-I/O declaration with a graph check. **It justified none of them.**

- The step-I/O checker guards an ordering failure that has now not occurred across two full runs; all six scenarios navigated the ordering correctly.
- Spec-test blocks would have caught the retry-seed defect, which is the only executable claim about code in the whole corpus outside its own paragraph. Reading the function caught it in two minutes.
- A term registry is the largest defect class, but every drift confirmed is between files `tests/layer1-repo.sh` already reads.

What was built instead: the four high-severity fixes, ten unit assertions pinning `pickClass` and the exclusion contract, and four greps added to the existing `PH5-043` guard. The `--exclude` mechanism replaced the magic-literal seed in `tq-canary.js`, with exit 3 distinguishing "only one trial was ever possible" from "the auditor missed twice". Both the unit test and the guard were checked for vacuity by breaking the code and the text and watching them fail.

The twelve medium and low defects are recorded and not fixed. Two runs found 14 and then 16 defects, but the second run's are markedly lower in severity, and instruction-dense prose will always yield more ambiguities. A third run was planned only for what this one could not show — run 2's own fixes executing under frozen text, and the isolation route recorded rather than inferred — and it ran the next day against the 11.2.0 release; see the section below.

## Third run, against the 11.2.0 release — September 6–7, 2026

Run 2's confidence section named the two things a third run had to do: execute run 2's own four fixes under a frozen checkout at or after `72935f2`, and record the auditor's isolation route per scenario instead of inferring it. This run did both, and the second one produced the run's most useful artifact.

**The freeze.** Same method as run 2, against `main` at `063e509` — the 11.2.0 release plus two documentation and test commits, well after `72935f2`. Tree digest `453ce1bd…7084` over 265 files, taken before locking and again after the last executor returned: **identical**. 59 instruction files and scripts locked; both write probes refused. No scenario attempted a write under the frozen tree, and none was refused: the one instruction that could have targeted it, the holistic pass's `lint-candidates.md`, is forbidden by the gate text itself and every executor obeyed the prohibition. The fixtures were built from the frozen bytes by `freeze-plugin.sh`; s3 carried an applicable canary class (`rollback-strip`) and s4 none, asserted by the builder before any agent launched.

**Scale.** 13 agents (6 executors, 6 verifiers, 1 critic), all pinned to Opus 5, 3.27M tokens, 1,548 tool calls, 9.3 hours of agent time across 3 hours 36 minutes of wall clock (01:55Z to 05:31Z). No interruption and no replay: every agent ran once, live, to completion. The executor prompts fixed the answers to `quick-plan`'s clarifying questions, forbade the installed `toque:*` subagent types (which would have loaded the 11.1.0 agent files rather than the frozen ones), and required every spawned auditor's raw output to be saved by launch number.

**The isolation route was recorded, not inferred.** Every `gate.json` carries an `isolation_route` field, and each verifier graded it from disk artifacts alone, before reading the executor's log:

| ID | Route | Launches | Grade | What the grade rests on |
| --- | --- | --- | --- | --- |
| s1 | Agent tool | 6 | corroborated | six distinct reports; auditor 3 overturned a rule auditors 1 and 2 passed |
| s2 | Agent tool | 9 | corroborated | verdicts moving against the caller; an auditor self-reporting a deviation from its own contract |
| s3 | `claude -p` | 3 | **established** | a CLI argument-parser error in the saved stdout that the Agent tool cannot produce |
| s4 | `claude -p` | 3 | **established** | the same error, echoing the caller's actual prompt with `{doc}` and `{gate_dir}` bound |
| s5 | Agent tool | 2 | corroborated | two reports from one start time with harness-reported durations |
| s6 | `claude -p` | 3 | established for launches 1–2 | argument rejection, then the CLI's stdin banner |

Three routes are established from a disk artifact, which is the first time an auditor's bindings have been provable after the fact; the other three are corroborated and, by construction, always will be, because an Agent-tool launch leaves no process artifact. Zero scenarios recorded `no-isolation`. The subprocess branch — "tell the auditor to run its specialist reviews in sequence, and say so in the gate record" — was given and recorded in all three `claude -p` scenarios and correctly withheld in the other three.

**Run 2's four fixes: two held, one and a half were never entered.** LINT-20's single wording held cleanly — six scenarios, six records, no auditor split. The re-anchoring carve-out held on what it covers: three canary-found scenarios, validator exit 0 with zero flags in all six corpora, zero demotions. The `--exclude` re-run mechanism is entered only on a canary miss, and no scenario missed a canary (found in s1 ×3, s2 ×3, s3, s6; not-applicable in s4, s5), so it is unexercised, not held. The `auditor-did-not-return` branch was likewise never reached: three scenarios had a first `claude -p` launch fail, but it failed because the CLI parsed the agent file's leading `---` as an option and never started, which the paragraph's heading ("IF THE SPAWN STARTS") excludes and its body ("exited without writing its records") includes. All three executors treated it as the one harness relaunch, a reading the body supports, and both readings gave identical artifacts.

**No scenario reached PASS, and every NOT PASS is correct.** Six verifiers re-derived 84 of 85 invariants as ok (the one exception is s2's `audit.md` carrying four disagreeing count triples, an agent bookkeeping error; the records are authoritative and agree with `gate.json`). All 24 gate terms were independently re-derived from the evidence records and matched; the validator was re-run from the frozen scripts by every verifier at exit 0; `inject` was reproduced four times and `detected` run counterfactually twice, confirming that the pre-re-anchor ordering rule is load-bearing. No run produced a wrong PASS and no executor mis-derived a gate term. s2 finished one criterion from PASS, on a genuine defect in the spec it generated. s3's verdict is partly fixture-influenced (the template spec describes a reporting app but was bound to a copy of this repository, so its cited paths are absent) and over-determined: with the paths present, eight criteria stay UNMET.

**Six new high-severity defects, in text two runs had already swept.** All are in `stage-2-design.md` or the scripts it runs, all are stated with proposed fixes in [stress-run3-critic.md](stress-run3-critic.md), and one is code rather than prose:

- **R3-03, code.** `tq-canary.js:63` scans from the assumption-register header to end of file for a literal `| 1 |` row. Both scaffolder-written specs numbered their registers `A1…`, so the planted row landed in the Testing Strategy table, `inject` exited 0, and `canary.json` recorded a criterion the plant could not violate. Reproduced by two verifiers and the critic; the s1 executor's competing diagnosis (the header regex at `:61`) was checked and is not causal.
- **R3-02, adjacent to run 2's carve-out.** The strip-and-recheck after a found canary is scoped to the canary's one criterion. In s2 the misplaced row also failed LINT-17, which stayed UNMET and was forwarded to the generator as a real defect; in s3 the stripped finding survived in two matrix rows and persisted into the baseline. Run 2 fixed the citation half of the principle at `:696-699` and left the verdict half.
- **R3-01.** Evidence reinforcement writes prior-iteration verdicts into `{doc}`, which `plan-auditor.md:51` forbids the next auditor to read. Four auditors across s1 and s2 found the notes, disclosed them, and re-derived independently — correct behaviour against a mechanism that forces the conflict.
- **R3-04, five scenarios.** Nothing may edit `audit.md` after the LINT-14 pin (`:856-858`), yet two later steps must append to it. Executed as printed, the pin goes stale, the validator exits 1, and the gate closes on a document nobody changed. Five executors caught it and re-pinned; every pin on disk matches its file.
- **R3-05.** The feedback form sends one line per unmet criterion naming one location. A universally-quantified rule cannot be conveyed that way: s1's LINT-07 was closed and re-found on a different mechanism on all three iterations, consuming the whole revision budget.
- **R3-06.** LINT-14's only variance exemption requires a byte-identical `doc_sha256`, which a revision loop can never satisfy, so LINT-14 is unreachable in exactly the case it exists for.

Nineteen medium and sixteen low defects sit below these, ranked and cited in the critic file; the medium ones include the holistic judge being pointed at the folder that holds `canary.json` (it read the answer key outright in s3), the Full/Lite mode rule not admitting the `reaudits/` redirect, the "no two canary reasons can apply at once" claim being falsified in s4, and a missing `criterion_id` silently disabling the validator's executable-criterion check. Agent errors (25, none changing a gate term) and fixture artifacts (11) are listed separately there so the counts are not mistaken for instruction defects.

**What was changed afterwards.** Two rig defects were fixed in `stress-rig/`: the fixture `tar` now excludes `.canary/`, because the builder had copied a git-ignored leftover from the real checkout into three scenario repositories, and on the in-progress branch the gate's own deletion step would have removed the rig's fixture; and the invariant checker's prose scan for `.canary/` was renamed so a `true` is not read as a citation violation (the citation count, which is the invariant, was zero in all six). No plugin text or script was changed during the run; the nine fixes the critic recommends landed the next day (decisions.md, September 7), and the two that needed an owner decision, plus the design half of R3-01, were decided the same day as D9–D11. The remaining rig fixes from the critic's §4b landed on September 7 as well: s3 is bound to the small project its spec describes and the builder asserts every claimed path resolves there (row 7); `launch-auditor.sh` pipes the prompt on stdin and grants the tools the shipped agent declares (rows 2 and 8); `scenario-inputs.md` fixes the s1 clarifying answers and the s6 pasted text (row 6); and the checker's mode regex tolerates the bolded form that returned `null` for s6 (row 4). Row 3 and row 5 were judged not rig defects and are unchanged.

**A fourth run is warranted, and it is three scenarios, not six.** The general invariants have held across three runs and a fourth sweep would mostly re-prove them. What has never been observed under frozen current text is the gate's open path (no PASS in this run; run 2's one PASS was under superseded text), a canary miss (so `--exclude` and exit 3 execute), and a spawn that starts and fails twice (so `auditor-did-not-return` is recorded once). One scenario engineered for each, after the fixes land.

## Fourth run, against decisions D9–D11 — September 7, 2026

Two scenarios, not three: the PASS-path attempt and a scenario engineered to flip an element on unchanged text. The canary-miss and double-spawn-failure scenarios named above are still unbuilt.

**The freeze.** `main` at `d3cb9ea` — the nine run-3 fixes, the rig fixes from the critic's §4b, and D9–D11 — into `C:/scratch/toque-run4`. Tree digest `87efdd75…4559` over 292 files, taken before locking and again after the last executor returned: **identical**. 59 files locked, both write probes refused. Every spawned agent in both scenarios went through `launch-auditor.sh`, so every prompt, raw output and launch record is on disk by launch number.

**Scale.** 4 agents (2 executors, 2 verifiers), all pinned to Opus 5, 1.09M tokens, 406 tool calls, 3 hours 7 minutes of agent time across about 2 hours 40 minutes of wall clock. s1 ran 7 subprocess launches (3 scaffolder, 3 auditor, 1 holistic judge), s8 ran 2; none failed to start, so the stdin form held on all 9.

| ID | Scenario | Result | What the verifier established from disk |
| --- | --- | --- | --- |
| s1 | `quick-plan`, two revision iterations | NOT PASS, **21 of 22 MET**, LINT-14 alone UNMET | Every feedback line re-derived from the scaffolder prompts; every baseline comparison re-derived from the preserved per-iteration documents; the audited document reconstructed byte-exactly from the delivered one by removing the 55 reinforcement lines |
| s8 | `quick-audit` re-run over a prior gate folder with a planted prior miss | NOT PASS, 11 of 22 MET, LINT-14 UNMET on 5 regressions | The previous document recovered from git history by the baseline's sha; all 47 citations mapped against the diff; the verifier's comparison table matched the caller's item for item |

**D9 held on the caller's side and exposed the auditor's.** In s1 every UNMET row of each audit's Verdict Summary became one feedback line, in the printed form, with LINT-19's two witnesses on two lines; a grep of the caller-written regions of both revision prompts finds no count, total, band or rubric text. No criterion was closed on one witness and re-found on another the previous auditor had listed. But LINT-15 and LINT-17 each returned at iteration 2 on a witness that was visible in v1 (`scripts/test-db.sh`, `doc-at-baseline-1.md:212`) and that the iteration-1 auditor had not listed. D9 fixed the channel; the auditor's "one row per witness" instruction was not followed by that auditor, and nothing checks it.

**D10 executed in both scenarios and discriminated correctly.** s8: LINT-13, the planted prior miss, cited lines 30–36, all unchanged, and was reported as auditor variance; LINT-03, LINT-07, LINT-17 and two matrix rows cited lines 100–103, the revised Phase 2 block, and were regressions; the verifier's independent table was identical. s1: audit 2 against baseline 1 produced zero regressions on a document revision 1 had changed; audit 3 produced one, the "API contract" concern citing spec line 496, which revision 2 had rewritten, and five variance flips on untouched text. The one bookkeeping error is in s1: the caller wrote "2 new items, 3 variance flips" where two of the "new" items were renamed rows already covered in baseline 2, so the correct line is 1 regression, 7 improvements, 0 new, 5 variance. The verdict does not change. In s8 the three lint regressions already forced LINT-14 UNMET, so D10 changed the label, not the outcome; in s1 it is the outcome.

**D11 held completely.** Neither preserved baseline document carries an audit note or a `Last reinforced` line; the final spec carries five notes and the header line; a scan of the five notes for criterion ids, verdict tokens, counts and gate results returns nothing. The only difference between the document audit 3 read and the document delivered is the reinforcement.

**The PASS path is still unobserved, and the reason is one sentence.** s1's single UNMET rests on the caller treating a cross-cutting concern row as an "item" whose "new record" cites a changed line. Matrix rows have no evidence record; the rule at `stage-2-design.md:1039-1045` is written for records, while the comparison at `:1020-1035` includes coverage, scenario and concern rows, and the restatement at `:1053-1055` uses only the matrix vocabulary. Both verifiers read the text as requiring the caller's reading, both call it ambiguous, and both note that under the other reading s1 is 22 of 22 MET and PASS (compound with the caller's INFRA-GAP override, which held). Run 4 did not settle whether the gate opens; it settled that the gate's open path now hangs on a referent the text does not supply.

**Isolation.** s8 ESTABLISHED: both prompt hashes match `PROMPT_SHA256`, the frozen agent file sits verbatim at byte 0 of the auditor prompt, and the evidence folder's mtime falls inside the subprocess window. s1 CORROBORATED: seven of seven hashes match and timings are sequential, but a `.meta` carries nothing unforgeable — no PID or session id — so a wrapper run by hand would look the same. No prompt in either scenario contained a prior verdict, audit, score or the planted record.

**Defects, ranked.** All in the frozen `stage-2-design.md` (SD) or `plan-auditor.md` (PA):

- **R4-01, HIGH, outcome-determining.** `SD:1039-1045` keys the regression test on "the line the item's new record cites"; coverage, scenario and concern items have no record, only matrix rows that need not carry a line. Two of s8's five regressions and s1's only one were such items.
- **R4-02, HIGH.** `SD:569`, `:730-733`, `:1197-1234` never say whether the canary re-runs per revision iteration. Both executors ran it once; in s1 the iteration-2 and iteration-3 auditors were never tested, and CANARY_OK for those gate runs rests on a trial they did not take.
- **R4-03, MED.** `PA:479-484` tells the auditor one row per witness; `SD:1202-1234` checks nothing about it. The one-witness-per-iteration failure mode D9 exists to stop recurred from the auditor's side in s1 on two criteria.
- **R4-04, MED, recurring from run 3.** `SD:730-733` (record the canary result, then delete `.canary/`) and `SD:886` (write the gate record last) cannot both hold; both executors captured the values first and deleted, then wrote.
- **R4-05, MED, recurring.** `SD:1096` points the holistic judge at a file inside `.canary/` with `canary.json` one level up and no `<forbidden_inputs>`; the s8 judge read it and disclosed it, as the run-3 s3 judge did.
- **R4-06, LOW.** `SD:1039-1046` has no category for covered→partial or ok→warn; three occurred in s8 and the executor invented one. `SD:1046` improvements are not diff-scoped, the mirror of what D10 discounts. `SD:1027` enumerates `covered|partial|ok-excluded|gap` while the auditor's matrices emit `OK|WARNING|GAP` with no mapping. `SD:1086-1087` never says what element goes into `history`. `SD:1093-1095` "Its entire prompt is:" cannot be a subprocess's entire prompt. `quick-plan.md:113-115` still says one line per criterion where `SD:1202` now says per defect.

**Agent errors, none changing a gate term:** s1's iteration-2 `gate.json` records LINT-14 `n_a` where its `audit.md` says MET; the s1 run-3 auditor labelled absent CI an INFRA-GAP against `SD:829-845` and wrote "Gap-checked: YES" against `SD:925-934`, both caught by the caller; the s8 executor's log cites frozen line numbers that are off by up to 65 lines in both directions while every quoted passage is verbatim. **Fixture artifacts:** `check-invariants.js:135` probes `history[i].run_number`, a field no schema puts there, so `prior_run_in_history` is a false negative; and neither verifier could reproduce `frozen-before.sha` because `run-started.txt` does not name `hash-tree.sh` as the recipe, although `freeze-plugin.sh verify` reproduced it twice.

**What was changed afterwards.** Nothing in the plugin. The rig gained nothing during the run; the two checker and recipe artifacts above are the next rig fixes. The recommendation that survives this run is the one made before it: the caller duties D10 added — keep the previous document, diff it, classify every compared element, write and pin the LINT-14 record — are mechanical and should be one script, which would also settle R4-01 by construction because a script must name what it compares.

## Reproducing it

Freeze first. Run 1 skipped this step and lost part of its result to a plugin that moved mid-flight; `freeze-plugin.sh` is that step, and it builds the fixtures itself so the two cannot be done out of order.

```bash
# from a Git Bash shell, with node, git and tar available
RIG=docs/plans/2026-09-04-methodology-conformance/stress-rig
RUN=/c/scratch/toque-run3

# 1. freeze the plugin, prove the lock, hash the tree, build the six fixtures
RUN=$RUN bash $RIG/freeze-plugin.sh

# 2. run the scenarios, giving every agent the FROZEN plugin and its own repo:
#      plugin root  $RUN/frozen/plugins/toque   (read-only)
#      scenario     $RUN/stress/s1 .. s6
#    each executor prompt quotes its scenario's block from scenario-inputs.md
#    (the s1 answers and the s6 pasted text are fixtures, not the executor's
#    choice), and a subprocess auditor is launched only through the wrapper:
bash $RIG/launch-auditor.sh "$RUN/logs/s3-auditor-1-prompt.md" "$RUN/stress/s3" "$RUN/logs/s3-auditor-1.txt"

# 3. after each scenario, re-derive its invariants from disk
node $RIG/check-invariants.js s1 "$RUN/stress/s1" "$RUN/frozen/plugins/toque"

# 4. after the whole run, prove the plugin never moved
RUN=$RUN bash $RIG/freeze-plugin.sh verify

# 5. read-only files cannot be deleted; unlock before removing the scratch dir
RUN=$RUN bash $RIG/freeze-plugin.sh unlock && rm -rf $RUN
```

`freeze-plugin.sh` takes the tree digest *before* locking, so the opening number describes the bytes the agents read rather than the bytes plus a permission change, then proves the lock instead of assuming it: a shell append and a `fs.appendFileSync` are both attempted against the gate stage file and the script exits non-zero if either succeeds. `verify` re-takes the same digest through the same helper — `hash-tree.sh`, so two numbers cannot differ merely because two implementations disagreed — and exits 1 on any drift. Both directions were checked for vacuity: appending one byte to a file inside the frozen tree turns `verify` red and removing that byte turns it green again, and both lock probes succeed once the probe file is made writable.

`build-fixtures.sh` asserts rather than prints its fixture properties — s3 must have an applicable canary class and every path its spec claims must resolve in s3's own tree, s4 must have no applicable class — and fails the build if any stops holding, then lists each scenario repo's file count and commit. Each assertion was falsified once: removing the timing-log marker from the small project fails the build at the line that names it. `check-invariants.js` prints JSON and never writes.

`launch-auditor.sh` is the only sanctioned way to start a `claude -p` auditor. It pipes the prompt on stdin, because the frozen agent file's leading `---` is parsed as a flag on argv and cost three of three subprocess scenarios their first launch in run 3; it grants exactly the tools `plan-auditor.md` declares, since run 3 withheld `Agent` and `Skill` and so tested a differently-equipped auditor; and it writes a `.meta` beside the output with the argv, cwd, prompt hash, timestamps and exit code, so the route is established from disk on every launch rather than only when the CLI happens to fail. `scenario-inputs.md` fixes the s1 clarifying answers and the s6 pasted text, which were the executor's invention in run 3.

What the rig still does not contain is the agent half: the executor prompts that hand an agent the command text and the sandbox constraint, the verifier prompts, and the critic. Those are composed per run, quoting `scenario-inputs.md`. The reusable parts are the freeze, the fixtures and fixed inputs, the launcher, the invariant checker, and the four-layer separation described above — executor, deterministic script, independent verifier, cross-scenario critic — which is the part worth repeating.

## Confidence

**Design of D1: High (95%).** Every invariant re-derived from disk in six of six runs by a checker and a verifier that did not share the executor's reasoning.

**The fourteen defects are real: High (90%).** Every cited line was read in the current files; the top four were re-read directly rather than taken from the critic.

**Runtime conformance: Med (78%), raised from 55% by the second run and from 75% by the third.** The two steps this section named as "to increase" were both taken. Six scenarios executed post-`371b37d` text under a frozen, read-only checkout whose opening and closing digests are identical; the intended PASS path ran end to end once, with a fresh auditor spawned via `claude -p`, a planted defect returned UNMET and confirmed mechanically, and every term re-derived from the gate folder by a verifier that did not perform the run; and the LINT-14 write order held six times out of six, every pin matching its `audit.md` hash.

The third run closed the second of those two gaps and half of the first. Isolation is now recorded in every gate record and established from a disk artifact in three scenarios of six; the other three are corroborated and cannot be more, because an Agent-tool launch leaves no process artifact. Of run 2's four fixes, two held under execution, and two (`--exclude` on a miss, `auditor-did-not-return` on a double failure) were never entered because no scenario produced the condition that triggers them. The components, rated separately in the critic file: invariant conformance 97%, gate-term derivation 98%, isolation recorded 80%, run 2's fixes at runtime 62%, the PASS path under current text below 30%. The gap that keeps the headline from High is the last one: no scenario in run 3 reached PASS, so the gate's open path has never been executed under the current text with a recorded isolation route, and six correct refusals do not establish one correct acceptance. To increase: the three scoped scenarios named at the end of the third-run section, against a checkout frozen after the recommended fixes land.

**After the fourth run: Med (82%).** Two of the three scoped scenarios ran under a frozen tree carrying D9–D11, and each decision was executed and re-derived from disk by a verifier that did not perform the run: D9's feedback lines matched the preceding audit's UNMET rows one for one in both iterations, D10's classification matched the verifier's independent table in s8 and its verdict in s1, and D11 left the two baseline documents untouched and the final one reinforced once. Isolation was established from a launch record in s8 and corroborated seven times in s1. The components: invariant conformance 98%, gate-term derivation 98%, D9 caller-side 97%, D10 mechanism 96%, D11 99%, isolation recorded 92%. What keeps the headline from High is unchanged in kind and narrower in scope: the open path is still unobserved, and s1 shows it now turns on one referent the text does not supply (R4-01). To increase: name what a matrix row's "record" is, or move the comparison into a script that must name it; then re-run s1's fixture, which reached 21 of 22.

The headline is the floor of those three. This test establishes that the design gate's structure survives being executed by six independent readers, and that its prose does not yet say one thing.
