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

The same shape as s8, with the one difference run 7 exists for: the prior gate folder is real and its baseline carries a quote on every matrix row. It is the folder run 6's s9 produced at PASS — 22 lint statuses, 50 matrix rows, `exact_quote` on 50 of 50 — copied into the rig **unedited** as `fixture-run6-gate/`. Nothing in `gate.json`, `audit.md` or `evidence/` is rewritten, including the `doc_copy` field, which holds an absolute path into run 6's scratch directory; the script writes that field and never reads it back (`tq-gate-baseline.js:1923`), so a dangling copy path is an observation to record, not a fixture to repair. The 71-character slug is kept for the same reason. The retained files are pinned `-text -eol` in `.gitattributes`: `doc-at-baseline-2.md` is CRLF as run 6 wrote it, its hash is what `gate.json` records, and the repository-wide `*.md text eol=lf` rule would otherwise normalize it on checkout and break the guard at `tq-gate-baseline.js:1641`.

The repository holds the document at v1 in its first commit together with that gate folder, and at v2 in its second commit. **v1 is `doc-at-baseline-2.md`** — the copy the run-6 baseline was actually taken on, which hashes to the `doc_sha256` its `gate.json` records (`4fd13fb0…`). It is **not** the file run 6 left on disk (`8330b478…`), which carries 29 further lines the reinforcement step appended after the last `snapshot` (stress-test.md, R6-04). Using the on-disk file would fail the script's near-miss guard at `tq-gate-baseline.js:1641` and would misalign every baseline coordinate above line 616. The reinforcement text is therefore absent from the fixture by choice, so it cannot enter run 7's diff.

v2 changes three things in v1 and nothing else. Every coordinate below is a v1 line number, verified against `doc-at-baseline-2.md` (840 lines) before this fixture was built.

| # | Edit | v1 lines | Intended effect |
| --- | --- | --- | --- |
| 1 | One bullet added to Phase 2's Exit Criteria: `tests/pricing.test.js` asserts the fractional multi-row total to the bit. | after 267 | A realistic addition, shifting everything below it down by one; no criterion depends on it |
| 2 | Phase 2's `Rollback:` paragraph deleted entire, with its trailing blank line | 287–292 | LINT-03 loses a deployment phase's rollback plan; the `Rollout/rollback` concern row, quoted at 287–291, loses the text it quotes |
| 3 | The Mitigation cell of Risk 3 emptied, the rest of the row untouched | 348 | LINT-02 loses the mitigation on a HIGH-impact risk; the `Risk 3: re-association` coverage row, quoted at 348, loses the text it quotes |

Edits 2 and 3 each land on a matrix row that quotes exactly the text they change, so each is expected to flip through the quote route, and each also fails a lint criterion that reaches the same text through its evidence record. The net line shift is five lines up for everything below 292, which puts every surviving baseline coordinate off by five and leaves every quote intact — the condition the anchor is for.

The revision relocates nothing. The ordering rule is not exercised by design, and criterion 4 stays a cost measure, as in run 6.

The scenario is NOT PASS by design. **The executor is told none of this**, and is not told that the prior gate folder came from an earlier run of this rig.

## Fourth run: what is built and what is not

The critic scoped run 4 to three engineered scenarios (stress-run3-critic.md §6). Built: the PASS-path attempt reuses **s1** under the D9–D11 text, and **s8** above forces a flip on unchanged text. Not built: a scenario where the auditor misses the canary so `inject --exclude` and exit 3 execute, and one where the relaunched subprocess auditor also fails so `auditor-did-not-return` is recorded once.
