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
- **s3** additionally gets `stress-rig/fixture-template-spec.md`, a spec written to the shipped template that carries all five shapes the canary attaches to. All five classes were confirmed applicable to it before the run.
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

The twelve medium and low defects are recorded and not fixed. Two runs found 14 and then 16 defects, but the second run's are markedly lower in severity, and instruction-dense prose will always yield more ambiguities. A third run is not planned.

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

# 3. after each scenario, re-derive its invariants from disk
node $RIG/check-invariants.js s1 "$RUN/stress/s1" "$RUN/frozen/plugins/toque"

# 4. after the whole run, prove the plugin never moved
RUN=$RUN bash $RIG/freeze-plugin.sh verify

# 5. read-only files cannot be deleted; unlock before removing the scratch dir
RUN=$RUN bash $RIG/freeze-plugin.sh unlock && rm -rf $RUN
```

`freeze-plugin.sh` takes the tree digest *before* locking, so the opening number describes the bytes the agents read rather than the bytes plus a permission change, then proves the lock instead of assuming it: a shell append and a `fs.appendFileSync` are both attempted against the gate stage file and the script exits non-zero if either succeeds. `verify` re-takes the same digest through the same helper — `hash-tree.sh`, so two numbers cannot differ merely because two implementations disagreed — and exits 1 on any drift. Both directions were checked for vacuity: appending one byte to a file inside the frozen tree turns `verify` red and removing that byte turns it green again, and both lock probes succeed once the probe file is made writable.

`build-fixtures.sh` asserts rather than prints its two fixture properties — s3 must have an applicable canary class, s4 must have none — and fails the build if either stops holding, then lists each scenario repo's file count and commit. `check-invariants.js` prints JSON and never writes.

What the rig does not contain is the agent half: six executor prompts that hand an agent the command text and the sandbox constraint, six verifier prompts, and the critic. Those were composed for this run. The reusable parts are the freeze, the fixtures, the invariant checker, and the four-layer separation described above — executor, deterministic script, independent verifier, cross-scenario critic — which is the part worth repeating.

## Confidence

**Design of D1: High (95%).** Every invariant re-derived from disk in six of six runs by a checker and a verifier that did not share the executor's reasoning.

**The fourteen defects are real: High (90%).** Every cited line was read in the current files; the top four were re-read directly rather than taken from the critic.

**Runtime conformance: Med (75%), raised from 55% by the second run.** The two steps this section named as "to increase" were both taken. Six scenarios executed post-`371b37d` text under a frozen, read-only checkout whose opening and closing digests are identical; the intended PASS path ran end to end once, with a fresh auditor spawned via `claude -p`, a planted defect returned UNMET and confirmed mechanically, and every term re-derived from the gate folder by a verifier that did not perform the run; and the LINT-14 write order held six times out of six, every pin matching its `audit.md` hash.

Two gaps remain, and they are why this is not High. Run 2's own four high-severity fixes are in the text and have not themselves been run — the same gap as before, one generation down, and a third run is not planned. Auditor isolation is proved structurally in two scenarios and only circumstantially in the other four. To increase: one run of the six scenarios against a checkout frozen at or after `72935f2`, with the isolation route recorded per scenario rather than inferred.

The headline is the floor of those three. This test establishes that the design gate's structure survives being executed by six independent readers, and that its prose does not yet say one thing.
