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

## Fourth run: what is built and what is not

The critic scoped run 4 to three engineered scenarios (stress-run3-critic.md §6). Built: the PASS-path attempt reuses **s1** under the D9–D11 text, and **s8** above forces a flip on unchanged text. Not built: a scenario where the auditor misses the canary so `inject --exclude` and exit 3 execute, and one where the relaunched subprocess auditor also fails so `auditor-did-not-return` is recorded once.
