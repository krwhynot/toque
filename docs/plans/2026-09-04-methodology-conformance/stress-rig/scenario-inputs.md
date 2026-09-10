# Scenario inputs — the part of each executor prompt that must not vary between runs

`build-fixtures.sh` fixes what is on disk in each scenario repository. This file fixes what the executor is *told*, so that two runs of one scenario differ only in what the plugin text and the agents do, not in what the harness invented on the day. Run 3's critic listed the inputs that were still invented per run (stress-run3-critic.md §4b, rows 2, 6 and 8); each has a row here. An executor prompt for a scenario quotes the matching block verbatim.

## Every scenario

- **Plugin root.** The frozen tree, `$RUN/frozen/plugins/toque`, read-only. Never the installed plugin: the installed `toque:*` subagent types load the installed agent files, not the frozen ones, so they are forbidden even when the Agent tool is the isolation route. Spawn a general-purpose agent and hand it the frozen agent file's text instead.
- **Write scope.** Only the scenario's own repository. Nothing under `$RUN/frozen`, nothing in the real checkout.
- **Raw output.** Every spawned auditor's, scaffolder's and holistic judge's complete output is saved to `$RUN/logs/{scenario}-{role}-{launch}.txt`, numbered by launch, before it is read.
- **No release preflight.** Do not run `.github/release.sh check` in a scenario repository. It dispatches to `preflight`, whose first test fails on any dirty tree, and a scenario is required to leave its tree dirty (§4b row 3).
- **Subprocess route.** When the isolation route is `claude -p`, launch through `launch-auditor.sh` (below). Never pass the prompt on argv, and never add `--dangerously-skip-permissions`.
- **Every prompt on disk.** The prompt handed to every spawned agent — auditor, generator, holistic judge — is written to `$RUN/logs/{scenario}-{role}-{launch}-prompt.md` before the launch, so a verifier can re-derive from disk what the generator was told (the D9 feedback lines) and what the auditor was bound to. From run 4 on, every spawn goes through the wrapper, which makes this automatic.
- **Long launches.** A subprocess can run longer than one Bash call allows. Start the wrapper with the Bash tool's `run_in_background`, and read `{out}.meta` when the completion notification arrives; the meta file is written only after the subprocess exits.

## s1 — `quick-plan` on a vague objective

Command, verbatim:

```
/toque:quick-plan "make report delivery faster and let customers schedule reports"
```

The command judges the objective vague and asks three clarifying questions (`commands/quick-plan.md`, Step 1). There is no live user. The executor answers them with exactly these, and records in its log that they are fixture answers, not user answers:

| Question | Fixed answer |
| --- | --- |
| Desired end state | Reports are sent asynchronously, and a customer can schedule a report to be sent on a recurring basis. |
| Constraints | Two engineers, two weeks, no new infrastructure beyond the existing Postgres database. |
| Biggest risk | A report's sharing permissions change between the moment it is scheduled and the moment it is sent. |

These are the answers run 3's executor chose. Fixing them keeps the resulting spec's constraints, and every finding that derives from them (the engineer-day squeeze, the permission-drift risk), comparable across runs.

## s9 — `quick-plan` on an objective the repository can close (run 6)

Command, verbatim:

```
/toque:quick-plan "move the pricing arithmetic out of render into its own module, with tests"
```

Same fixture bytes as s1. The difference is the objective: s1's plan needs HIGH-impact assumptions verified against a production database the fixture does not have, so s1 cannot PASS however many iterations it runs (stress-test.md, fifth run). s9's objective touches only `src/reports.js` and `tests/`, both of which the fixture contains, so every assumption a plan for it would rate HIGH is one the scaffolder can verify by reading the repository — the shape of `report.rows`, the `node --test` runner, the render timing log. This fixture is PASS-capable; it is not a fixture that must PASS, and a NOT PASS on it is a result to record, not a failure of the run.

If the command asks its clarifying questions, the executor answers with exactly these, and records that they are fixture answers:

| Question | Fixed answer |
| --- | --- |
| Desired end state | Pricing is computed in `src/pricing.js`; `render()` calls it; the total in the rendered HTML is unchanged for every existing report; the render timing log line stays exactly as it is. |
| Constraints | One engineer, three days, no new dependencies, no database change. |
| Biggest risk | A rounding or missing-field difference (a row without `seats` or `unit_price`) changes a customer's total between the old inline arithmetic and the new module. |

## s3 — `quick-audit` on a standalone template-shaped spec

```
/toque:quick-audit docs/specs/pricing-engine.md
```

The document is `fixture-template-spec.md`, copied in by the builder. It describes the small project it sits in: the inline pricing arithmetic in `src/reports.js`, the `node --test` conventions, the render timing log. The builder asserts those claims resolve.

## s4 — `quick-audit` on a prose ADR

```
/toque:quick-audit docs/adr/ADR-reporting-pipeline.md
```

The builder asserts no canary class applies to it.

## s6 — `quick-audit` with pasted text

The executor pastes the complete contents of `fixture-pasted-plan.md` as the command's argument, with no file path. The text is the plan run 3's s6 executor wrote; it carries all five canary shapes and names files (`src/worker.js`, `tests/jobs.test.js`) that do not exist in the repository, which is what a pasted plan for new work looks like. The command must write it to `docs/specs/` before auditing.

## Launching a subprocess auditor

```bash
RIG=docs/plans/2026-09-04-methodology-conformance/stress-rig
# prompt.md = frozen agents/plan-auditor.md text + bindings + the sequential-specialist line
bash $RIG/launch-auditor.sh "$RUN/logs/s3-auditor-1-prompt.md" "$RUN/stress/s3" "$RUN/logs/s3-auditor-1.txt"
```

The wrapper pipes the prompt on stdin, grants exactly the tools `plan-auditor.md`'s frontmatter declares, pins the model to Opus, and writes `{out}.meta` with the argv, cwd, prompt hash, start, end and exit code. That file is the disk artifact a verifier grades the isolation route from. `DRY_RUN=1` prints the argv and launches nothing.

## s8 — `quick-audit` re-run over a prior gate folder (run 4)

```
/toque:quick-audit docs/specs/pricing-engine.md
```

The repository holds the s3 spec at v1 in its first commit together with the gate folder run 3's s3 produced for it (`fixture-prior-gate/`, a real run-3 artifact with one planted prior-auditor miss: LINT-13 is recorded as pass although the Design section evaluates no alternative), and at v2 in its second commit, where Phase 2 is revised and its `Rollback:` line dropped. The previous document is in git history under the baseline's `doc_sha256`, which is the D10 reconstruction path.

Expected under D10: LINT-13 fails on unchanged text and is reported as AUDITOR VARIANCE; LINT-03 fails on changed text and is a regression; LINT-14 is UNMET for that one regression; LINT-15 and LINT-16 improve because the binding now resolves. The scenario is NOT PASS by design. The executor is told none of this.

## s10 — `quick-audit` over a quoted prior gate, on a document revised to fail (run 7)

```
/toque:quick-audit docs/specs/move-the-pricing-arithmetic-out-of-render-into-its-own-module-with-tests.md
```

The same shape as s8, with the one difference run 7 exists for: the prior gate folder is real and its baseline carries a quote on every matrix row. It is the folder run 6's s9 produced at PASS — 22 lint statuses, 50 matrix rows, `exact_quote` on 50 of 50 — copied into the rig **unedited** as `fixture-run6-gate/`. Nothing in `gate.json`, `audit.md` or `evidence/` is rewritten, including the `doc_copy` field, which holds an absolute path into run 6's scratch directory; the script writes that field and never reads it back (`tq-gate-baseline.js:1923`), so a dangling copy path is an observation to record, not a fixture to repair. The 71-character slug is kept for the same reason. Line endings cannot move the hash: `tq-gate-baseline.js:49-53` normalizes `\r\n` to `\n` before hashing. `doc-at-baseline-2.md` is LF throughout (0 CR bytes, measured), which `make-s10-v2.js` requires, because its coordinates were measured on that file.

The repository holds the document at v1 in its first commit together with that gate folder, and at v2 in its second commit. **v1 is `doc-at-baseline-2.md`** — the copy the run-6 baseline was actually taken on, which hashes to the `doc_sha256` its `gate.json` records (`4fd13fb0…`). It is **not** the file run 6 left on disk (`8330b478…`), which carries 29 further lines the reinforcement step appended after the last `snapshot` (stress-test.md, R6-04). Using the on-disk file would fail the script's near-miss guard at `tq-gate-baseline.js:1641` and would misalign every baseline coordinate above line 616. The reinforcement text is therefore absent from the fixture by choice, so it cannot enter run 7's diff.

v2 adds two things to v1 and changes nothing else. Every coordinate below is a v1 line number, verified against `doc-at-baseline-2.md` (840 lines) before the fixture was built. v2 is 846 lines, and its diff from v1 must equal the committed `s10-v1-v2.diff` byte for byte (hunks `253a254,258` and `356a362`).

| # | Addition | After v1 line | Criterion it breaks, and why nothing in v1 can satisfy it |
| --- | --- | --- | --- |
| 1 | A paragraph in Phase 2: `src/pricing.js` also exports `lineTotal(row)`, returning `row.seats * row.unit_price`, for an invoice export planned next quarter; `render()` does not call it | 253 | LINT-07, every new behaviour has a test or test delta. No test anywhere names `lineTotal`; cases 6–10 pin the lenient arithmetic `computeTotal` keeps, not this function |
| 2 | Risk 12: `lineTotal` and `computeTotal` disagree on a row with a missing or non-numeric field; MEDIUM likelihood, HIGH impact, Mitigation `TBD` | 356 | LINT-02, every HIGH risk has a mitigation. The risk is about a function v1 never contained, so no unchanged passage can mitigate it |

Both plants **add** text. The first design removed it — Phase 2's `Rollback:` paragraph and Risk 3's Mitigation cell — and the review of September 10 showed that could not work on this document. The Kill Switch at v1 391–396 is still a Phase 2 rollback plan, and Design Decision 2 at v1 75–79 is still Risk 3's mitigation, so a competent auditor keeps both criteria MET. The comparison also scopes a flip by the *current* baseline's citation (`tq-gate-baseline.js:976`), and a failure resting on deleted text is booked VARIANCE whenever its quote names text that survives verbatim in both documents, including a quote of either surviving neighbour or the line beside the gap; only an unquoted citation of the join (coordinate route) or a multi-line quote spanning the join reaches `changed` (reproduced in `tests/gate-baseline-test.js`, section 19). LINT-02's violation is the added Risk 12 row itself; LINT-07's is partly an absence, so an auditor may cite only unchanged text such as the Tests Required list, which the classifier books VARIANCE — the run-7 charter's criterion 2 counts that as a missed regression.

Neither LINT-02 nor LINT-07 is a criterion a canary class targets — the classes in `tq-canary.js` cover LINT-03, 04, 08, 10 and 15 — so the canary's strip-and-recheck cannot land on a plant. Other flips the additions cause, such as LINT-05 on the new export or LINT-17 on an undeclared deliverable, are possible, are caused by changed text, and are adjudicated like any other.

The revision relocates nothing. The ordering rule is not exercised by design, and its criterion stays a cost measure, as in run 6.

**What the executor is given:** the command line at the top of this block and the logging rules — nothing else from this file. Everything after the command is the answer key. The executor is not told what v2 changed, what is expected to fail, or that the prior gate folder came from an earlier run of this rig. The scenario is NOT PASS by design.

## Fourth run: what is built and what is not

The critic scoped run 4 to three engineered scenarios (stress-run3-critic.md §6). Built: the PASS-path attempt reuses **s1** under the D9–D11 text, and **s8** above forces a flip on unchanged text. Not built: a scenario where the auditor misses the canary so `inject --exclude` and exit 3 execute, and one where the relaunched subprocess auditor also fails so `auditor-did-not-return` is recorded once.
