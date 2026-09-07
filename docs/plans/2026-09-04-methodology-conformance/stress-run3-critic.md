# Cross-scenario critic — stress-test run 3

Read: all six verifier reports (3,552 lines), all six `s?-invariants.json`, the frozen plugin, and
the runs 1–2 record (`frozen/docs/plans/2026-09-04-methodology-conformance/stress-test.md`,
`decisions.md`). Executor logs and raw agent outputs were consulted only where a verifier left a
question open; each such consultation is named where it is used.

Every frozen-tree citation below was re-read in `C:/scratch/toque-run3/frozen/plugins/toque` by me
before the finding was ranked. Where I re-ran a script or re-derived a claim mechanically, I say so
and give the output. Where I differ from a verifier, I say which one and why.

**The freeze held.** `logs/freeze-verify-after-executors.txt`: digest
`453ce1bdbd20865c77a300ce6d18e3e2f7fa07dcaca22c47e3cb8cdc730d7084`, 265 files, identical before and
after. Run window 2026-09-07T01:55:39Z → 04:50:20Z. Twelve scenario agents, all pinned to Opus,
2.96M tokens, 1,515 tool calls.

---

## 1. Did run 2's four fixes hold?

Summary: **one held cleanly, one held on the half that was reachable, one held and has the run's
worst adjacent hole, and one was never entered.**

### Fix 1 — the `--exclude` re-run mechanism replacing the `retry` seed

**Text present and internally consistent.** `stage-2-design.md:657-664` gives the `--exclude`
invocation; `:666-670` gives the reason ("`pickClass` hashes the SEED ALONE, not the document, so a
fixed seed is a fixed class"); `:672-675` gives the exit-3 `single-trial-only` branch. The script
agrees: `tq-canary.js:250-256` carries the same rationale as a comment, `:390`
(`if (name === excluded) continue;`) drops the class from the rotation, `:420` exits 3, and `:439`
records `excluded` in `canary.json`. I read all of these.

**Which scenarios exercised it: none.** The branch is entered only at `:657`, "If the check reports
a miss". Canary outcomes across the six: s1 found (3 gate runs), s2 found (3 gate runs), s3 found,
s4 `not-applicable`, s5 `not-applicable`, s6 found. `detected` returned exit 0 on every run in which
it ran. **No scenario missed a canary.**

**Verdict: UNEXERCISED, not held.** Nothing in run 3 executed `inject --exclude`, and no
`canary_reason` of `"missed"` or `"single-trial-only"` was recorded anywhere.

Two things run 3 *did* establish about the surrounding machinery, worth separating from the fix
itself. The `detected` ordering rule at `:640-641` ("exactly as the auditor returned it, before
anything is re-anchored") is load-bearing and was obeyed: s3's verifier ran `detected` both ways
(original 11-id list → exit 0 "FOUND"; post-strip 10-id list → exit 1 "MISSED", s3-verifier §2), and
s6's verifier ran the same counterfactual (s6-verifier §4). And `excluded` is present as a field in
the run's `canary.json` (s6-verifier §4, byte-compared against its own re-injection), so the record
shape the fix added exists even though the branch that populates it did not fire.

**Adjacent hole: yes — R3-03.** The fix's unstated precondition is that a reported miss means the
*auditor* missed. `tq-canary.js:63`'s unbounded row scan can plant `assumption-inject`'s row outside
the assumption register entirely (reproduced by me on two documents, §3), so an auditor that scores
the malformed row under a different criterion produces a *manufactured* miss. That miss would spend
the one sanctioned re-run, and a second manufactured miss would condemn a correct audit as
"audit untrustworthy" and forbid the revision loop (`:677-681`). The fix is sound; the injector it
depends on is not.

### Fix 2 — LINT-20 stated one way in the registry

**Text present.** `lint-registry.md:99-106` is the Rule Scope Note recording the old two-way
statement and its removal. I grepped every `LINT-20` mention in the frozen tree: `lint-registry.md`
`:43` (rules table — "Confidence brief exists and each entry has its required fields"), `:49`,
`:74`, `:94` (Gate Behavior — entry fields, no subsection count), `:99`, plus
`plan-scaffolder.md:259`. **No "3 sections" wording survives anywhere in the tree.**

**Which scenarios exercised it: all six.** LINT-20 is in the registry's 22-rule Phase 5 set
(`lint-registry.md:74`, `:140`), and a `LINT-20.json` record exists in all six evidence corpora.

**Verdict: HELD.** Six scenarios, six LINT-20 records, one wording, zero reported disagreements. No
verifier flagged a LINT-20 conflict. Run 2's failure mode — two auditors splitting on a
two-subsection document — did not recur. s4's verifier additionally defended the LINT-19/LINT-20
UNMET verdicts on the correct ground ("the rule requires the brief to exist; it does not",
s4-verifier §5), which is the post-fix reading. This is the cleanest of the four.

**Adjacent hole: none on LINT-20 itself.** But the *pattern* the fix closed is alive one rule away
in the same file: `lint-registry.md:31` fails LINT-08 on any falsified HIGH-impact assumption, while
`:87` says "a falsified assumption is not waivable, the plan changes" — so registering, testing and
disproving an assumption (the behaviour `:87` asks for) is what makes LINT-08 UNMET, and concealing
it would have scored MET. That is R3-19 below, and it is the same defect class run 2 swept for and
did not find.

### Fix 3 — the `auditor-did-not-return` branch, and "specialist reviews in sequence"

The two halves came apart. One is the best-evidenced result in run 3; the other was never entered.

**3a. "Specialist reviews in sequence" — HELD, 6/6, provable from disk.**
`stage-2-design.md:636-638`: "If the spawn route is a subprocess rather than the Agent tool, tell the
auditor to run its specialist reviews in sequence in its own context, and say so in the gate record."

| Scenario | Route | Instruction given? | Recorded? |
|---|---|---|---|
| s3 | `claude -p` | **yes, provable** — visible verbatim in the prompt echoed by the failed launch (`s3-auditor-1.txt` tail) | `gate.json.specialist_reviews_in_sequence: true`, `audit.md:371` |
| s4 | `claude -p` | **yes, provable** — `s4-auditor-1.txt:616-618` | `specialist_reviews_sequential: true` + reason string |
| s6 | `claude -p` | **yes, provable** — `s6-auditor-1.txt` tail | `gate.json.spawns[2].specialist_reviews` |
| s1 | agent-tool | correctly **not** given | `auditor_sequential_specialist_instruction_given: false`, with the reason |
| s2 | agent-tool | correctly **not** given | executor log `:112-114`; auditor 1 reports five specialists ran *in parallel* |
| s5 | agent-tool | correctly **not** given | nothing owed — `:638` requires the record only on the subprocess branch |

Three fires, three correct non-fires, and in each subprocess case the instruction is on disk in the
auditor's own echoed prompt rather than in the executor's testimony. **This is the clause run 2
added on the strength of one scenario, and run 3 exercised it three times and confirmed it three
times.**

**3b. `auditor-did-not-return` — UNEXERCISED, and the text does not cover what actually happened.**

No scenario recorded `canary_reason: "auditor-did-not-return"`. But three scenarios (s3, s4, s6 —
every `claude -p` route) had a **first launch that never started**: the CLI parsed the agent file's
leading `---` frontmatter fence as an option and rejected it. All three verifiers established this
from the same artifact, `error: unknown option '---` followed by the whole echoed prompt.

**Does the text cover a launch that never starts? No.** I re-read `:625-634`. Its heading condition
is *"IF THE SPAWN STARTS AND DOES NOT RETURN"* — false here, because the launcher rejected argv
before any agent ran. Its body's second disjunct, *"exited without writing its records"*, is
literally true of the process. **The heading excludes the case and the body includes it.** Nor does
`:614-619`'s reason vocabulary have a slot for "the launcher refused the arguments".

**Was the executors' treatment — counting it as the one sanctioned harness relaunch — a reading the
text supports? Yes, and it is the conservative one.** Supporting it: the body's disjunct describes
what happened; `:628-630` calls the relaunch "a harness retry" that does not consume the sanctioned
canary re-run, and an argv rejection is a harness failure rather than an audit failure by any
reading; and no other branch fits — not a miss (no auditor returned a report), not `not-applicable`
(inject exited 0 in s3 and s6), not `no-isolation` (a route was available and worked on the second
launch). Against it: under "a spawn that never started is not a spawn", launch 1 was not a launch
and the relaunch budget is untouched. **Both readings produce identical artifacts in all three
scenarios**; the difference bites only if the *second* launch also fails, where the conservative
reading records `auditor-did-not-return` (CANARY_OK false, NOT PASS) and the other grants a further
relaunch. So: supported, safe, and undecided by the text. Ranked as R3-16 (LOW) — LOW only because
every second launch returned.

**Adjacent hole: yes, and s4 is the scenario that proves it.** `:614-619` claims "Exactly one
canary_reason is ever recorded, and the five are decided at different moments, so no two can apply
at once". On s4 **both moments fired**: `inject` exited 2 (`not-applicable`, reproduced by s4's
verifier) *and* launch 1 failed to return. The premise held only because launch 2 succeeded. The
same passage also miscounts itself — it says "the five" while enumerating six, and the `gate.json`
shape at `:1187` lists six. The `not-applicable` branch still spawns an auditor (`:603-604`), so it
remains exposed to the spawn-failure branch afterwards; the mutual-exclusivity claim is simply
false. That is R3-11.

### Fix 4 — the re-anchoring carve-out so the canary's own edit cannot demote a citation

**Text present.** `stage-2-design.md:693-699`: "ONE EXCEPTION … a quote SPLIT by the line the canary
inserted or removed is genuine … Only a quote that cannot be relocated at all is dropped. The gate
must not demote a verdict on an edit the gate itself made; a whole-section citation evidencing an
ABSENCE is the usual casualty, and demoting it turns a correct MET into UNMET on a document nobody
changed."

**Which scenarios exercised it: s1, s2, s6** — the three where a canary was planted and the records
had to be re-anchored across an insertion or deletion.

**Verdict: HELD, on the citation side.** The evidence validator returned **exit 0 with zero flags in
all six corpora**, re-run independently by all six verifiers and by me on s1's records. Zero
demotions anywhere. s6's verifier resolved all 62 `spec:N` references in `audit.md` against the
original and found 61 correct (the one exception is a stale `Spec:72`, an agent error, §4). Run 2's
failure — "two correctly-passing rules were demoted to UNMET by the harness's own edit" — did not
recur.

**Adjacent hole: yes, and it is the most consequential finding in run 3 — R3-02.** The carve-out
protects a *citation* the gate's edit broke. It does not protect a *verdict* the gate's edit caused,
and it does not reach the CHECK-4 matrix outputs produced against the same mutated copy:

- **s2**: the injected row made **LINT-17** fail as well as LINT-08. `:682-688` scopes the strip and
  recheck to *"that one criterion"*, singular, so LINT-17 stayed UNMET on the gate's own row and was
  forwarded to the scaffolder as a revision instruction. Scaffolder 7 then reported the defect did
  not reproduce in `{doc}`. `:692` compounds it by asserting of a dropped quote that "its criterion
  was re-checked in step 2" — **false for a collateral criterion**.
- **s3**: the stripped `rollback-strip` finding survived as a live gap in two CHECK-4 matrix rows
  (`audit.md:256`, `:274`), which fed `gap_count` and persisted into
  `gate.json.baseline.scenario_statuses` and `concern_statuses` as `"gap"` — two false baseline
  entries that a later run's LINT-14 comparison will read as **improvements on an unchanged
  document**.

`:696-699` states the governing principle without scope. The procedure that implements it is scoped
to one criterion and one citation. **Run 2 fixed the citation half of exactly this principle and
left the verdict half.**

One further note on fix 4's neighbourhood: `:689-693`'s "A quote that cannot be found in {doc} came
from the mutation: drop it" is the literal condition a *codebase* citation meets when searched for in
`{doc}`. s1's executor wrote a run-2 harness script that did exactly that and dropped two codebase
citations. The step's opening words ("Re-anchor every record **to {doc}**") scope it, so this is not
an instruction defect — but it is a wording weakness a careless implementer walks into, and one did.
Recorded at LOW; the incident itself is a fixture artifact (§4).

---

## 2. Was the isolation route recorded rather than inferred, per scenario?

| # | Route | Launches | Grade | What the grade rests on |
|---|---|---|---|---|
| s1 | `agent-tool` | 6 (3 auditor + 3 scaffolder) | **CORROBORATED** | No CLI artifact exists by construction. Six distinct saved reports; auditor 3 returns LINT-21 UNMET where runs 1–2 scored it PASS (an evaluator grading its own prior verdict tends to ratify it, `:1138-1144` — this is the opposite); three independent forbidden-input disclosures citing *different* line numbers; `s1-auditor-1.txt:41` self-reports a five-specialist parallel fan-out and `:43` an adjudication overruling its own Gap Verifier from 6 FAILs to 4. |
| s2 | `agent-tool` | 9 | **CORROBORATED (weakest)** | **No timestamp or process-metadata file exists for s2 at all** — unlike s3's `launch-times.txt` and s4's `.meta`. Three auditors cite the injected row at three different locations; verdicts move against the caller's interest (16/5/1 → 18/3/1 → 19/2/1); `s2-auditor-5.txt` self-reports a *deviation from its own agent contract* ("I reviewed all eight dimensions directly rather than fanning out to five specialist subagents") — a caller synthesising a report has no reason to invent that. |
| s3 | `claude -p` | 3 | **ESTABLISHED** | `s3-auditor-1.txt` opens `error: unknown option '---` echoing the whole agent file — a commander-style argv-parser error the Agent tool cannot produce (no argv, no option parser, no stdout). The same file's tail carries the subprocess-branch prompt verbatim. `s3-launch-times.txt` gives three start timestamps. |
| s4 | `claude -p` | 3 | **ESTABLISHED (strongest)** | Same argv rejection — and because the CLI echoed the rejected argument, `s4-auditor-1.txt` **contains the caller's actual prompt**, with `{doc}` and `{gate_dir}` bound at `:606-607`. That is direct disk proof of *what the auditor was pointed at*, not testimony about it. Plus `s4-auditor-1.meta`, and a stdout contract in `-2.txt`'s tail that only makes sense for a subprocess. |
| s5 | `agent-tool` | 2 (auditor + judge, concurrent) | **CORROBORATED** | Two reports, two voices (`-1` organised around the 22 registry ids; `-2` twelve numbered prose findings naming no LINT id); both record `Start 02:02:23` with end times 7 minutes apart and harness-reported ms durations (1,159,582 and 1,623,712) — values a caller does not hold unless a tool result returned them; single-writer write pattern (21 records in one sub-second burst). |
| s6 | `claude -p` | 3 | **ESTABLISHED for launches 1–2; CLAIMED for launch 3** | Launch 1 the argv rejection echoing the 638-line prompt; launch 2 a CLI stdin banner (`Warning: no stdin data received in 3s…`) that an Agent-tool launch cannot emit. Launch 3 carries no banner and rests on `gate.json.spawns[2]`, continuity with launch 1, and the fact its output was captured to a file. |

**Route recorded in the gate record: 6 of 6.** Every scenario carries `isolation_route` as an added
top-level key in `gate.json`, permitted by `:1177` ("add fields, never nest these"). The
`:1180-1193` shape does not require the field; recording it unconditionally is a superset of what
`:638` demands (which is the record only on the subprocess branch).

### What this run establishes that runs 1 and 2 did not

- **Run 1**: five of six executors had no subagent tool and audited in the caller's own context;
  isolation was reached once, and stress-test.md:79 records the limitation plainly — "the property
  the canary exists to measure … was tested in one run out of six."
- **Run 2**: "six scenarios, six fresh-instance routes, no caller-context role pass" — but the route
  was *inferred*. Run 2's own confidence line named the remedy verbatim (stress-test.md:182): *"one
  run of the six scenarios against a checkout frozen at or after `72935f2`, with the isolation route
  recorded per scenario rather than inferred."*
- **Run 3 delivers that, and goes past it in three scenarios.** For the first time in three runs,
  the isolation claim in s3, s4 and s6 rests on an artifact only a subprocess launch can produce
  rather than on the executor's word. s4 additionally gives the first disk-level proof of the
  auditor's *bindings*. The subprocess branch was exercised end to end — instruction given, complied
  with, recorded — three times, and correctly withheld three times. Zero `no-isolation` reasons
  across six scenarios (run 1 had one).

### What it still does not establish

- **Three of six routes remain CORROBORATED and always will.** An Agent-tool launch leaves no CLI
  stdout, no PID, no transcript id. Nothing on disk can distinguish it from a role pass performed
  carefully in the caller's own context. s1, s2 and s5 rest on report-shape and behavioural
  arguments — good ones, but arguments. s2 is the weakest of the three, with no process artifact of
  any kind.
- **"A fresh auditor who knows nothing of the plant still finds it" is established in two scenarios,
  not four.** The canary was FOUND in s1, s2, s3, s6. In s3 and s6 the plan-auditor demonstrably
  never opened `canary.json` and said so (s3 `audit.md:30`; s6 `audit.md:13`). But **s3's holistic
  judge read `canary.json` outright** — I confirmed this from `s3-auditor-2.txt:35` directly: *"I
  then read `docs/specs/pricing-engine/.canary/canary.json`, which confirms the fixture's seeded
  defect is `rollback-strip` against criterion `LINT-03`."* And in **s2's gate run 1** the recheck
  returned `stillFails = true` with none of the record's nine citations being the injected row —
  i.e. `detected` reported FOUND without the auditor having seen the plant at all. That run measured
  nothing about the auditor.
- **Prompt bytes are not on disk** for any Agent-tool launch, for any scaffolder, or for the
  holistic judge in s3, s4 and s5. Only the three *failed* `claude -p` launches echoed their
  prompts, which is an accident of the argv bug rather than a property of the rig.
- **s6 launch 3's route is claimed**, not banner-proven.
- **No PASS was reached**, so no isolation route has been exercised on a run whose verdict depended
  on it.

---

## 3. Instruction defects, deduplicated and ranked

Severity: **HIGH** = changes a gate verdict or a record's validity · **MEDIUM** = changes what is
written but not the verdict · **LOW** = wording.

**On "run 2's twelve".** The frozen record states that run 2 found sixteen instruction defects, four
HIGH (fixed) and twelve medium/low (`stress-test.md:128`, `:140`; `decisions.md:70`), and that "six
are one class: two files describing one artifact and disagreeing". **It does not enumerate the
twelve.** No run-2 critic output is frozen. I therefore cannot assert an exact per-defect mapping,
and I do not. Where a run-3 defect falls inside the named "two files disagreeing" class I label it
`run-2 class (unitemised)`; where it sits beside one of the four fixes I label it `adjacent to fix
N`; otherwise `NEW`.

### Ranked

| ID | Sev | File:line | Scenarios | Status |
|---|---|---|---|---|
| **R3-01** | **HIGH** | `stage-2-design.md:907-953` (esp. `:925-940`) vs `agents/plan-auditor.md:51`, `:45-47`, and `stage-2-design.md:1134-1136` | s1, s2 | NEW · adjacent to fix 4 |
| **R3-02** | **HIGH** | `stage-2-design.md:682-688` and `:692` vs `:696-699` | s2, s3 | NEW · **adjacent to fix 4** |
| **R3-03** | **HIGH** | `scripts/tq-canary.js:63` (and `:61`); `agents/plan-scaffolder.md:160-162` | s1, s2 | NEW · adjacent to fix 1 |
| **R3-04** | **HIGH** | `stage-2-design.md:856-858` vs `:1165-1173` and `:907-914` | s1, s2, s4, s5, s6 | NEW |
| **R3-05** | **HIGH** | `stage-2-design.md:1116-1118` vs `:1125-1131`, against `lint-registry.md:30` | s1 | NEW |
| **R3-06** | **HIGH** | `stage-2-design.md:997-1001` vs `:1134-1136`, with `:988-990`, `lint-registry.md:90` | s1 | NEW |
| **R3-07** | MEDIUM (HIGH latent) | `stage-2-design.md:591-593` + `tq-canary.js:429-444` + `:621-623` + `:443-446`; `plan-auditor.md:49-53`; `:712-715` | s3, s6 (+s2, s5 latent) | NEW |
| **R3-08** | MEDIUM | `stage-2-design.md:1011-1015` vs `:621` vs `:704-707` vs `:1008` | s2, s3, s4, s5, s6 | NEW |
| **R3-09** | MEDIUM | `stage-2-design.md:952-953` vs `:907-914`; `quick-audit.md:92` | s3, s4, s5, s6 | run-2 class (unitemised) |
| **R3-10** | MEDIUM | `stage-2-design.md:876-888` vs `agents/plan-auditor.md:565-571` | s4, s5 | run-2 class (unitemised) |
| **R3-11** | MEDIUM | `stage-2-design.md:614-619` vs `:603-604`, `:1187`, `quick-audit.md:107-109` | s4 (+s3, s6 latent) | NEW · adjacent to fix 3 |
| **R3-12** | MEDIUM | `agents/plan-auditor.md:407-408` vs `:387`; `tq-evidence-validate.js:45`, `:67-69`, `:262-274` | s1 (+s4) | NEW |
| **R3-13** | MEDIUM | `stage-2-design.md:993-995` vs `plan-auditor.md:51` | s1, s2 | NEW |
| **R3-14** | MEDIUM | `stage-2-design.md:605-608` vs `lint-registry.md:111-116` | s4 | NEW |
| **R3-15** | MEDIUM (HIGH latent) | `agents/plan-auditor.md:292` vs `:293`, `quick-audit.md:13-17` | s5 | run-2 class (unitemised) |
| **R3-16** | LOW | `stage-2-design.md:625-634` heading vs body | s3, s4, s6 | NEW · **adjacent to fix 3** |
| **R3-17** | MEDIUM | `plan-auditor.md:279` vs `:560-563` and `lint-registry.md:111-116` | s4, s5 | run-2 class (unitemised) |
| **R3-18** | MEDIUM | `stage-2-design.md:682-688`, `:650-655` — `stillFails = true` is unexamined | s2 | NEW |
| **R3-19** | MEDIUM | `lint-registry.md:31` vs `:87` | s1 | NEW · adjacent to fix 2 |
| **R3-20** | MEDIUM | `stage-2-design.md:759` vs `commands/quick-audit.md:115-116` (`:98-99` resolves toward committing) | s4, s6 | NEW |
| **R3-21** | MEDIUM | `stage-2-design.md:1105-1113` — canary per iteration unstated; `gate.json` holds one top-level `canary_class` | s1, s2 | NEW |
| **R3-22** | MEDIUM | `stage-2-design.md:860` vs `:958-960`, `:992-995` | s1 | NEW |
| **R3-23** | MEDIUM | `commands/quick-audit.md:16` — `{date}` used twice with two meanings | s5 | NEW |
| **R3-24** | MEDIUM | `commands/quick-audit.md:13` vs `:15-16` — `{gate_dir}` not restated on the reaudits branch | s5 | NEW |
| **R3-25** | MEDIUM | `stage-2-design.md:1017` — "the criterion set" undefined for holistic mapping | s4 | NEW |
| **R3-26** | MEDIUM | `agents/plan-auditor.md:534-548` — the Output-D table ships with no Status legend | s4 | NEW |
| **R3-27** | LOW | `stage-2-design.md:700-703` — remedy for line numbers, silence on the `.canary/` *path* string | s1, s2 | NEW |
| **R3-28** | LOW | `quick-plan.md:8-9`; `quick-audit.md:44` — slug derivation | s1, s2, s6 | run-2 class (unitemised) |
| **R3-29** | LOW | `stage-2-design.md:784-823` — INFRA verification has no owner and no destination | s1, s4, s5 | NEW |
| **R3-30** | LOW | `stage-2-design.md:849-851` vs `:989-990` (largely closed by `:854`) | s1, s3, s4, s5 | NEW |
| **R3-31** | LOW | `stage-2-design.md:704-707` vs `:860` — record-then-delete vs gate record LAST | s1, s2, s6 | NEW |
| **R3-32** | LOW | `stage-2-design.md:1116` vs `:1125` — LINT-14 in the feedback channel | s1 | NEW |
| **R3-33** | LOW | `stage-2-design.md:803-814` — external-system monitoring reference has no loop | s3 | NEW |
| **R3-34** | LOW | `stage-2-design.md:884` — `gap_count` double-counts one artifact under two terms | s6 | NEW |
| **R3-35** | LOW | `quick-plan.md:24-25` — `status.json` `documents` key shape unstated; object ends mixed-keyed | s2 | NEW |
| **R3-36** | LOW | `quick-plan.md:23-24` — which `manifest.md` table (three exist) | s2 | NEW |
| **R3-37** | LOW | `quick-audit.md:8-9` — `.canary/` promised unconditionally; `:610-612` writes none | s5 | NEW |
| **R3-38** | LOW | `stage-2-design.md:1105-1107` "report NOT PASS and stop" vs `quick-audit.md:103-117` | s6 | NEW |
| **R3-39** | LOW | `stage-2-design.md:622-623` vs `plan-auditor.md`'s output-folder derivation | s6 | NEW |
| **R3-40** | LOW | `stage-2-design.md:1014` — the judge's plugin access unspecified | s6 | NEW |
| **R3-41** | LOW | `plan-auditor.md:5`, `:32` — "the criterion registry" never named | s5 | NEW |

### The HIGH findings, stated

**R3-01 — Evidence reinforcement plants prior-iteration verdicts inside the document the next
auditor is pointed at.** `stage-2-design.md:907-953` requires the caller to write audit findings
into `{doc}` as `**Audit note ({date}):**` blocks and to set a `Last reinforced:` header. It is
positioned *before* the baseline snapshot and *before* the revision loop, so it runs every
iteration, and its output is in `{doc}` when the next iteration's auditor reads it.
`plan-auditor.md:51` says "NEVER read: scores, verdicts or audit.md files from a previous iteration
of this plan". **Once a document has been through one revision loop, the two shipped requirements
cannot both be satisfied — by the gate's own design, not by any caller's choice.** The block itself
argues at `:1138-1144` that both halves of the separation are required "because either alone is a
single point of failure"; the gate then breaks one half itself. I confirmed the contamination on
disk: s1's spec carries ten Audit notes, several naming verdicts verbatim (`:1103` "The design gate
returned LINT-07 UNMET", `:1183`, `:1333`) plus a `Last reinforced` line at `:1049-1052` naming five
prior rule verdicts; s2's spec carries `Last reinforced` at `:844` and notes at `:859`, `:878`,
`:887`, `:888` naming "(LINT-21 MET)", "(LINT-23 UNMET)", "LINT-24 UNMET". All four affected auditor
launches disclosed and disregarded it exactly as `:45-47` prescribes, and two demonstrably
contradicted the embedded claims — but that is agent quality, not a property of the mechanism, and
`:45-47`'s remedy cannot un-read a verdict.
*Severity: s1 graded MEDIUM (because `:45-47` prescribes a working fallback and both auditors
executed it); s2 graded HIGH. I take HIGH.* The fallback is real but it is a mitigation applied
after the contamination has landed, and the verdicts it protects are the same verdicts LINT-14 then
compares across iterations (R3-06). Nothing in the gate's output tells a reader the number is soft.
*Only exercised where a `{generator}` is bound — `:907-908` diverts the notes into `audit.md` with
no generator — so quick-audit (s3–s6) is unaffected.*

**R3-02 — The strip-and-recheck reaches one criterion; the mutation's blast radius does not.**
`:682-688` scopes the strip and recheck to *"that one criterion"*. `:696-699` states the governing
principle without any scope: *"The gate must not demote a verdict on an edit the gate itself made."*
The procedure is narrower than its own principle, and `:692` asserts something false of the gap —
"its criterion was re-checked in step 2" — which is untrue for any collateral criterion.
Two manifestations, both verified: in **s2** the injected row made LINT-17 fail as well as LINT-08;
LINT-17 stayed UNMET, entered the recorded v2 unmet list and `gate.json.history[]`, and was
forwarded to the scaffolder as one of the two revision lines for the final iteration — half the
feedback channel of the last iteration spent on an artifact of the harness. In **s3** the stripped
finding survived as live gaps in two CHECK-4 matrix rows and persisted into
`gate.json.baseline.scenario_statuses` and `concern_statuses` as `"gap"`, which a later run's
LINT-14 will read as improvements on a document nobody changed. **This is the hole immediately
adjacent to run 2's fix 4**, which closed the citation half of the same principle.

**R3-03 — `tq-canary.js:63`'s unbounded row scan plants `assumption-inject`'s row outside the
assumption register, silently.** I re-derived this myself rather than accepting either verifier's
account, because s1's executor and s1's verifier disagree about the cause. Running the two regexes
over the committed specs:

```
s1 spec (1,492 lines)
  header regex /^\|.*\bAssumption\b/i  → 8 matches: 58, 197, 667, 677, 715, 1037, 1041, 1442
  first match (line 58) is an SC1 success-criteria row, NOT a Risk Assessment row
  lines matching /^\|\s*1\s*\|/        → exactly one, line 835
  every one of the 5 headers that finds a row lands on 835 → insert at 836
s2 spec (973 lines)
  header regex → 1 match, line 498 — the correct register header
  lines matching /^\|\s*1\s*\|/ → 453 (Risk table, correctly skipped), 640, 641
  header@498 → row@640 → insert inside the Testing Strategy table
```

**The operative cause is `:63`, not `:61`.** Holding the s1 header at the correct register line 715
still lands the row at 836, because the register's rows are numbered `A1…A11` so none matches
`/^\|\s*1\s*\|/`, and `findIndex` has no notion of where the register ends. **The s1 executor's
diagnosis — that the header regex matched a Risk Assessment row and that is why the row landed
wrong — is wrong on both counts**, and it is written into `gate.json.caller_notes[1]` (also §4). The
`:61` looseness is a real separate latent bug (8 matches, first one wrong on s1) that is not causal
on either document. `inject` exits 0 and says nothing. The convention it depends on is never stated
to the generator: `plan-scaffolder.md:160-162` gives the register a `| # |` header and *no example
row*, while `skills/plan/templates/spec.md:70` — the `/toque:plan` template, not the scaffolder's —
does show `| 1 |`. s6 is the control: its register uses integer rows and the injection landed
correctly at line 71.
*Severity: s1 graded MEDIUM, s2 HIGH. I take HIGH*, because the wrong criterion is written into
`canary.json`, which is the sole input to the CANARY_OK derivation, and a manufactured miss on both
trials condemns a correct audit as untrustworthy and forbids revision (`:677-681`).

**R3-04 — The LINT-14 pin ordering is unsatisfiable as printed.** `:856-858`: "Do this before step
2's hash is taken … **nothing after the pin may edit that file**." Two later, mandatory steps must
edit that file: `:1165-1173` ("After the loop ends, append the revision history to audit.md") and
`:911` (with no generator, the evidence notes go "under `## Evidence notes` in {gate_dir}/audit.md
instead") — and the reinforcement section is *printed after* the LINT-14 sequence. Executing in
printed order pins `audit.md`, then edits it; the validator then flags `EVIDENCE-STALE` on LINT-14
(`:735`), returns exit 1, `EVIDENCE_OK` is false, and **the gate closes on a document nobody
changed**. Every executor that hit it had to notice and work around it: s1 appended then re-pinned
and disclosed it (`audit.md:753-757`); s4 pinned, edited, re-pinned; s5 reordered the whole
sequence. Every on-disk pin holds — s1's `64ca823f…`, s3's `ccd2ec33…`, s5's `88c55ebe…`, s6's
`1a2da065…`, each recomputed by its verifier and matching — but that is five executors independently
catching the same trap.
*Severity: s1 graded MEDIUM, s5 graded HIGH. I take HIGH*, on s5's reasoning, which I verified: the
literal printed order deterministically produces a false NOT PASS. Highest scenario count of the
HIGHs.

**R3-05 — The single-witness feedback form cannot convey a universally quantified rule.**
`:1116-1118` fixes the revision channel as `{criterion_id} UNMET: {what is missing}. Location:
{file}:{line}.` — one witness, one location. `lint-registry.md:30` states LINT-07 as "Every new
behavior has a test or test delta", universally quantified, and roughly half the registry reads the
same way. One line naming one instance closes that instance and cannot carry the quantifier. In s1
the generator closed the named witness and the next fresh auditor found a different one, three times
running, on three genuinely different mechanisms (boot preflight → `SCHEDULES_ENABLED` kill switch →
R4's `mailer_response_id` mitigation, confirmed from the three raw outputs). Both revision iterations
were consumed and LINT-07 was never cleared; s1's own `audit.md:747-751` names the pattern. **The
text forecloses the obvious fix**: `:1125-1131` forbids sending the rubric, for stated and good
reasons. This determined s1's outcome — LINT-07 alone keeps VERIFIED false regardless of the other
three unmet criteria.
*Manifested in 1 of the 2 revision-loop scenarios; in s2 LINT-07 moved UNMET→MET at v1→v2, so it did
not recur there. The mechanism is structural; its firing is not automatic.*

**R3-06 — LINT-14's only variance exemption cannot fire inside the loop that needs it.** `:997-1001`
records LINT-14 N_A and reports differences as AUDITOR VARIANCE only "when {doc}'s sha256 equals the
previous baseline's doc_sha256". A revision loop exists to change the document, so the exemption is
shut on every iteration 2+. Meanwhile `:1134-1136` mandates a FRESH auditor every iteration, which
*maximises* auditor-to-auditor variance. `:988-989` counts as a regression any element "covered/
passing in the previous baseline and now gap/failing" — which is exactly what a newly-noticed
pre-existing defect becomes. In s1, LINT-21 was `pass` in run 2 and `fail` in run 3; s1's own
`audit.md:704-708` says so honestly — "a pre-existing defect newly detected rather than one the
second revision introduced" — and books it as a regression because the text leaves no other option.
LINT-14 went UNMET on that basis.
*Honest bound on the generalisation*: s1's verifier writes that LINT-14 is "close to guaranteed
UNMET" on any second iteration. I do not carry that. s2 ran the same loop with two prior baselines
and LINT-14 came back MET. What run 3 establishes is that the mechanism is **structurally available
on every iteration 2+ and has no escape**, and that it fired once. LINT-14 was one of four UNMET
criteria in s1, so it did not solo-cause that NOT PASS — but on a spec whose only remaining defect is
a newly-noticed pre-existing one, it decides the verdict alone.

### The MEDIUM findings worth stating

**R3-07 — the answer key is filed next to the exam.** `:591-593` binds `inject`'s `outDir` to
`{gate_dir}/.canary/`; `tq-canary.js:429-444` writes *both* the mutated copy and `canary.json` into
that one directory; `:621-623` points the auditor at the mutated copy "knowing nothing of any of
this"; and `:443-446` makes `{gate_dir}` the folder the auditor writes into. Any agent that lists
its own working directory finds `canary.json`. `plan-auditor.md:49-53` does **not** name the canary
record among its five forbidden inputs, and the honest known-limitation note at `:712-715` concedes
only that the auditor can read `scripts/tq-canary.js` — not that the record sits beside the target.
On disk: **s3's holistic judge read it** (`s3-auditor-2.txt:35`, confirmed by me), and s6's and s3's
plan-auditors both declined it *on their own initiative, beyond the shipped list*, and said so. So
CANARY_OK rested on a blind auditor by the auditors' discipline rather than by anything the gate
arranged. MEDIUM on the observed evidence (the pass never gates, `:1063`, and none of s3's ten
candidates is the canary); **HIGH latent** — an auditor that opened it invalidates a gate term.

**R3-08 — the rubric-free judge's input manifest is undecidable, and two scenarios resolved it in
opposite directions.** `:1013` says "same input manifest as the auditor" (the mutated copy, `:621`);
`:1011-1012` fixes the judge's *entire prompt* to one sentence, which names no document and cannot
carry a guard; and `:704-707` deletes `.canary/` at a point the block prints *before* the holistic
section at `:1008`, making "same input manifest" literally unsatisfiable in printed order — while
`:1008`'s "runs alongside the gate" invites the concurrent reading that makes it satisfiable. **s3
pointed the judge at `.canary/` and it read the answer key; s6 pointed it at `{doc}` and violated the
manifest instruction.** Same sentence, opposite behaviour, both defensible. This is the clearest
demonstration of underdetermination in the run.

**R3-09 — EVIDENCE_OK is defined as the exit code of a run that does not happen.** `:952-953`:
"EVIDENCE_OK is the exit code of this post-reinforcement validator run, never the earlier one." With
`{generator} = none` — which `quick-audit.md:92` always binds — `:907-914` says `{doc}` is not
edited, so there is no post-reinforcement state of `{doc}`. All four quick-audit scenarios hit it and
all four took the same sane reading (the caller's own validator run at `:859` step 4).
*Verifier disagreement, surfaced rather than averaged*: s3, s4 and s6 graded LOW; **s5 graded HIGH**,
on the ground that the alternative reading ("undefined, therefore false") would make every
`/toque:quick-audit` NOT PASS by construction. **I take MEDIUM.** s5's HIGH rests on a reading no
executor took and that `:859` step 4 makes unnatural, since the caller's own sequence supplies
exactly one validator run to point at; three verifiers reached the sane reading with no difficulty.
But a gate *term* whose definition names a run that does not exist on the command's only path is
more than wording. What would resolve the disagreement: none of the four runs exercised the failing
reading, so s5's claim is a hypothesis about a reader, not an observation.

**R3-10 — two shipped Gap Summary templates disagree.** `stage-2-design.md:876-888` requires
`Total gaps:` and `Total warnings:` by name; `agents/plan-auditor.md:565-571` gives the same block as
six bullets with **neither**. I read both. The auditors followed the one in their own agent file —
reasonably, since the stage file elsewhere establishes that file as the owner of these tables
(`:543-544`, `:557-558`) and nothing marks the Gap Summary as the exception. Consequence in s4:
`Total warnings` is computed nowhere in any artifact, and it is the exact cross-check that would have
caught that scenario's `gap_count` error — a written `Total warnings: 3` cannot coexist with twelve
concerns all marked GAP.

**R3-12 — an ambiguity that silently disables a check.** `plan-auditor.md:387` opens the record
schema with `criterion_id`; `:407-408` says "Write `evidence` first, then `reasoning`, then
`verdict`", which reads as the whole field list. s1's auditor 3 took it that way and omitted
`criterion_id`. I traced the consequence in the validator: `tq-evidence-validate.js:262` gates the
stricter check on `rec.criterion_id`; with the field absent, `isExecutableCriterion(undefined)`
returns false (`:45`, `:67-69` — neither `EXECUTABLE_CRITERIA.has(undefined)` nor `/^INFRA-/` on the
empty string matches), so the `EVIDENCE-UNSUPPORTED` check at `:273` is **silently skipped for
LINT-15 and LINT-16 — no flag, no exit 1.** s1's caller restored the field on all 22 records, so it
did not bite on disk; the defect is latent and was caught by an alert caller. A shipped ambiguity
that silently disables a check is worse than one that errors. Related: s4's A7 confirms the
executable-criterion rule is stated in neither prose file, so a reader who records a vacuous MET with
no citation gets demoted and cannot find out why.

**R3-15 — the mode test does not admit the reaudits redirect.** `quick-audit.md:13-14` puts the
plan's own `spec.md` in **Full** mode; `:14-17` redirects a post-design rerun to
`reaudits/{date}/`; `plan-auditor.md:292` makes FULL conditional on "the gate folder the caller
bound **is** a plan folder", which a `reaudits/{date}/` folder is not — so `:297` returns LITE, while
`:293`'s own parenthetical names this exact case ("Stage 2, **or quick-audit on the plan's own
spec**") as FULL. The two conjuncts of one sentence disagree. Verdict-neutral in s5 and the rule set
is mode-invariant (`lint-registry.md:139-140` gives Full and Lite Phase 5 the identical 22 ids), but
mode decides which artifacts the auditor may read — under LITE the Coverage Matrix's first six rows,
which are headed from `intent.md`, and `evidence/LINT-04.json`'s citation of `intent.md`, both go
away. s5's executor recorded the stretch openly (`audit.md:7` says the folder is "**inside**" a plan
folder, not "is"). **HIGH latent** on a reaudit of a plan that would otherwise pass. Fix location is
exact: `plan-auditor.md:292`.

**R3-17, R3-14 — the vacuous-rule rule is contradicted twice.** `plan-auditor.md:279` says "LINT-15
and LINT-16 apply only if the spec references test files or monitoring", which reads naturally as
N_A-when-absent; `:560-563` in the same file says "A rule whose triggering condition is absent is
PASS, not N_A — … no 'Tested'/'Monitored' claim", naming that exact case. The wrong reading writes
N_A, which `lint-registry.md:114-116` says then reads as a LINT-14 regression on the next run of an
unchanged document — a defect that surfaces one run later (R3-17). Separately, `:605-608` says a
document lacking the five shapes "is missing what the rollback, dependency-owner, assumption and
coverage criteria require" and its unmet list "will usually name which", so the *same* absence is a
PASS under the registry and an UNMET under the stage file (R3-14). s4's auditor drew the line case by
case and disclosed each; it is the auditor's line, not the text's, and it moved several ids in a
15-UNMET result.

**R3-20 — one obligation, two moods.** `stage-2-design.md:759` is imperative: "**COMMIT** the
evidence directory together with audit.md. An audit whose evidence is not committed did not happen."
`quick-audit.md:115-116` gives the same obligation as a noun phrase — "The gate record: … **to be
committed** with the audited document" — which reads as advice to the user. `quick-audit.md:98-99`
("If the block and this description ever disagree, the block wins") resolves it *toward* committing,
which is not what happened in any scenario. Narrower than s6 states: `quick-plan.md:132-134` is
imperative and matches the block, so only `quick-audit.md` drifts. In this rig the outcome is
over-determined — the harness forbade committing — so this is text-level, not a run failure.

**R3-13, R3-22 — what may sit in `{gate_dir}` while the auditor works there.** `:993-995` bars a
prior `gate.json` from `{gate_dir}` and says nothing about the previous iteration's `audit.md` or
`evidence/` — which is 22 prior-iteration verdict records in the working directory of an auditor
forbidden by `plan-auditor.md:51` to read exactly that (R3-13; s1 and s2 both moved them out, which
was the necessary call). And `:860` puts the gate record LAST while `:992-995` says to read the
previous baseline "BEFORE the auditor is spawned", so mid-loop the baseline is not re-derivable from
the repository alone (R3-22); s1 mitigated it by preserving `s1-run1/` and `s1-run2/` outside the
repo. Both sit next to R3-01 as instances of one problem: the gate has no statement of what the fresh
auditor's environment must be swept of.

### Candidates I re-read and dropped

- **"The registry states the Full-mode Phase 5 count two ways" (s6 D17).** `lint-registry.md:80`
  reads in full: "All 24 rules apply. **Phase 7 rules run during Impact Review.**" The second
  sentence is the disambiguation, and `:139-143`'s Lint Count by Context table closes it cleanly
  (Phase 5 Full = 22; Total Full = 24). **The frozen text already closes this at `:80` and
  `:139-143`.** s6's own verifier partly disagreed with its executor here; I agree with the verifier.
- **"LINT-14's unconditional five steps vs 'skipped on the first audit'" as a standalone defect.**
  `:854` explicitly names the outcome "N_A (as the auditor recorded it) **when no baseline
  existed**", so the sequence plainly anticipates a first audit and what `:989` skips is the
  *comparison*, not the recording. Folded into R3-30 at LOW with `:854` cited as the closing line;
  s4's verifier reached the same conclusion.
- **"Rewrite vs preserve the LINT-14 record" (s5 D11).** s5's own verifier concluded it is not a
  defect, and verified why from the code: `tq-evidence-validate.js:200-212` returns the claimed
  verdict unchanged for every non-MET verdict, so an N_A record's evidence is never re-checked and
  both readings give the same result. I confirmed `:211-213`. **Dropped.**
- **"Slug shortening" as half of R3-28.** The worked example at `quick-plan.md:9` ("nightly report
  delivery -> nightly-report-delivery") *is* a full kebab-casing, so it closes the shorten-or-not
  half. Only punctuation handling (`release.sh` → `release-sh`) and `quick-audit.md:44`'s complete
  silence remain. R3-28 kept, narrowed.

---

## 4. Agent errors and fixture artifacts

Kept separate so the numbers are not read as instruction defects.

### 4a. AGENT ERRORS confirmed by the verifiers

| # | Scenario | Error | Sev |
|---|---|---|---|
| 1 | s1 | The canary-anchor causal diagnosis is wrong (blames `tq-canary.js:61`; the cause is `:63`) and is now written into `gate.json.caller_notes[1]` | MED |
| 2 | s1 | `holistic_pass.runs: 1` while the executor's own reading re-runs the whole block per iteration (3 canaries, 3 audits) | LOW |
| 3 | s1 | `audit.md:745` says "**Two** criteria moved from UNMET to MET" then lists three; `gate.json` and Present Results say 3 | LOW |
| 4 | s2 | Only one of the two LINT-14 tables updated — `audit.md:114` reads `N_A (caller-decided)`, `:518` reads `MET (caller-decided)`. I confirmed both lines. `:855-858` exists precisely to stop this | MED |
| 5 | s2 | Four different criterion-count triples on disk (20/1/1 at `:35-36`, 20/1/1 at `:103-124`, 19/2/1 at `:130-132`, 21/1/0 from the records). I confirmed the first and third | MED |
| 6 | s2 | The Verdict Summary still counts the stripped LINT-03 UNMET with a location and gap description | MED |
| 7 | s2 | Reinforcement notes name criterion ids and verdicts verbatim; the shipped example at `:932-936` names none | MED |
| 8 | s2 | `baseline.coverage_items` yields 11 on a mechanical re-derivation where `gap_count` says 10 | LOW |
| 9 | s2 | `history[1]` records LINT-14 as `n_a` and its own `baseline_comparison` as "(LINT-14 MET, caller-decided)" | LOW |
| 10 | s3 | Three prose restatements of the stripped finding survive in the Executive Summary, Top-5 Risks and GO-If list, asserting a document lacks a rollback it has at line 97; `audit.md:24` contradicts `:66` on disk | MED |
| 11 | s3 | Every `stage-2-design.md` line citation in the executor log is offset, growing with depth (10 spot-checks); substance correct in all of them | LOW |
| 12 | s3 | Executor log `:19` states the route was `agent-tool`; `:27-30` of the same file states `claude -p`. The on-disk record is correct | LOW |
| 13 | s4 | Cross-cutting PARTIALs counted as GAPs against `:566-567`; `gap_count` recorded 47, formula gives 44. The executor's own first draft had it right | MED |
| 14 | s4 | Pinned LINT-14, then edited `audit.md`, then re-pinned. Final state correct; the literal rule was broken during execution | LOW |
| 15 | s5 | `audit.md`'s Gap Summary says "37 items, 18 gaps"; the table has 38 rows and 19 GAPs, and `gate.json` agrees with the table | MED |
| 16 | s5 | Gap Summary omits the failed/N_A split and both total lines (agent half of R3-10) | MED |
| 17 | s5 | "caused **solely** by the untracked `reaudits/`" is wrong — `.github/release.sh:44` trips on any porcelain output and there were three entries. I verified `:44`, `:169` and the `check`→`preflight` dispatch at `:199-200` | LOW |
| 18 | s5 | Citation off-by-ones in the executor log (5 instances, one misattributed across files) | LOW |
| 19 | s5 | Stale present-tense narration at `audit.md:88-89` describing the pre-replacement LINT-14 state | LOW |
| 20 | s6 | One un-re-anchored reference of 62: `audit.md:87` reads `Spec:72`; the correct anchor is 71 | LOW |
| 21 | s6 | `audit.md:128` cites the withdrawn canary row at `spec:71`; mitigated by strike-through and a "Withdrawn — harness artefact" label | LOW |
| 22 | s6 | `audit.md:51` says "All 59 citations"; there are 61 after the caller rewrote two records | LOW |
| 23 | s6 | "12 concerns, 8 gaps" left standing in two places against the corrected 7 | LOW |
| 24 | s6 | Executor log says "5 named angles"; `gate.json` has 8 | LOW |
| 25 | s6 | Executor log says the written spec is 109 lines; it is 99. Closed by the coordinator's addendum: the paste and the file are byte-identical | LOW |

**Did any change a gate term? No — confirmed, not accepted.** Three independent grounds:
(a) every verifier re-derived all four terms from the evidence records and matched `gate.json` —
**24 of 24 term derivations**; (b) `tq-evidence-validate.js` returned **exit 0 with zero flags in all
six corpora**, re-run by each verifier and by me on s1, so no agent error reached an evidence record;
(c) the two errors that do reach a recorded field — s4's `gap_count` and s2's count triples — are not
terms of `<gate_expression>` (`:1073-1082` reads only `canary_found`, the validator exit, the
post-validation verdicts, and `infra_gaps`).

One qualification I will not smooth over: errors 4, 6 and 10 changed what a *human reader* of
`audit.md` would conclude. s3's report tells its reader in three places that a document needs a
rollback it demonstrably has, and s2's two LINT-14 rows disagree on disk — the precise failure
`:855-858` legislates against. No gate term moved; the human-readable record is wrong in both.

### 4b. FIXTURE ARTIFACTS

| # | Artifact | Rig defect? | Fix |
|---|---|---|---|
| 1 | **The git-ignored `.canary/` in the plan folder**, copied into s2, s3, s5 by the tar fixture. Untouched (mtimes at freeze time in all three), never cited, named only as a *declined* forbidden input | **Yes** | Add `--exclude='.canary'` to the tar exclusion list in `stress-rig/build-fixtures.sh`, beside `.git`, `assets/`, `node_modules/`. Worth fixing rather than tolerating because of s5's second-order finding: it survived only because the reaudits redirect moved `{gate_dir}` down a level. On the `design.status == in_progress` branch `{gate_dir}` *is* the plan folder, and `:704-707` would have **deleted a git-ignored file the fixture builder placed there** — the rig destroying its own fixture, with no invariant checking for it |
| 2 | **`--dangerously-skip-permissions` refused in s6**; substituted with `--permission-mode acceptEdits --allowedTools "Bash,Read,Write,Grep,Glob"`, withholding `Agent` and `Skill` which `plan-auditor.md`'s frontmatter declares | **Yes, narrowly** | Add `Agent,Skill` to `--allowedTools` in the s6 launch wrapper so the subprocess's grant matches the shipped agent frontmatter; do not reintroduce `--dangerously-skip-permissions`. `Agent` was irrelevant by design (the subprocess branch forbids fanning out) and `toque:self-audit-knowledge`'s content appears correctly applied anyway because the full agent file reached the subprocess verbatim — but the run silently tested a differently-equipped auditor from the one the plugin ships |
| 3 | **s5's `.github/release.sh check` failure** | **No** | Not a plugin defect and not a rig bug: `check` dispatches to `preflight` (`:199-200`), whose first test at `:44` is `[ -n "$(git status --porcelain)" ]`, and the run's own three entries trip it. Correct behaviour of the audited repo's own script against a tree the scenario is *required* to leave dirty. If anything, the executor prompt should not ask a scenario to run a release preflight in a tree it must not commit |
| 4 | **`audit_cites_canary_path: true`** in the checker for s1, s2, s5, s6 — a prose substring match whose hits are the auditor *declining* to read the file (s5 `audit.md:10`), the caller's re-anchoring note (s1 `audit.md:4`), a quoted `inject` command line (s5 `:874`), and the sentence "No `.canary/` directory was written" (s5 `:885`) | **Yes** | In `stress-rig/check-invariants.js`, either drop the prose scan or rename it `audit_prose_mentions_canary_path` and stop printing it beside the citation counts, so a `true` is not read as a violation — the invariant that matters, `citations.canary: 0`, is satisfied in all six. Same file: `audit_mentions.mode` returned `null` for s6 because the regex does not tolerate the bolded form `Audit mode: **LITE (spec-only)**` |
| 5 | **s1's executor-side re-anchoring script bug** (gate run 2): assumed every citation pointed at the mutated copy and dropped two codebase citations. Self-disclosed in `gate.json.caller_notes[2]`, fixed for run 3, no verdict changed — no run-2 record was left evidence-less (min 1 citation), so `EVIDENCE-MISSING` could not fire | **No — it is executor-authored, not `stress-rig/` code** | Nothing to change in the rig. What is worth changing is upstream: the rig lets each executor write its own re-anchoring harness, so the same bug can recur differently per scenario and is invisible to the invariant checker. `decisions.md:74` already names the durable form — "a script that does it mechanically would be the durable form" — i.e. ship re-anchoring as a plugin script instead of prose. That is a plugin recommendation, not a rig one |
| 6 | **s1's three clarifying questions asked and answered by the executor** (no live user in the rig). The invented constraints — two engineers, two weeks, no new infra — shape the entire spec, including the 19.5-of-20 engineer-day squeeze and risk R13 | **Yes** | Supply a fixed answer set for `quick-plan.md:55-58`'s three questions in the s1 executor prompt, so the spec's constraints are part of the fixture and comparable across runs rather than invented per run |
| 7 | **s3/s4 INFRA-GAPs and LINT-15/16 from the bound repository** — the fixture spec describes a reporting application while the bound repo is a copy of the Toque plugin, so every CLAIMED path is absent for a reason unrelated to the document | **Yes** | Bind `stress-rig/fixture-template-spec.md` to the small invented Node project s1/s4/s6 already use, or add the handful of files it cites. Bounded on this run: with the paths present, LINT-15/16 flip to MET and `INFRA_OK` becomes true, leaving 8 UNMET — VERIFIED still false, verdict unchanged |
| 8 | **The `claude -p` argv rejection** in s3, s4, s6 — the agent file's leading `---` parsed as an option, costing a launch in three of three subprocess scenarios | **Yes** | Pass the prompt on stdin (what the successful relaunch did) or prefix with `--` in the wrapper. It produced the single strongest isolation evidence in the run, but that must not be relied on as a method |
| 9 | **s4's `.stress-baseline/doc.sha` read by the auditor** and disclosed at `audit.md:17-20`. It sits inside the tree under audit; it contains only a hash, so `<forbidden_inputs>` is not violated | **Yes, cheaply** | Write `.stress-baseline/` outside the scenario repo (e.g. `$RUN/baselines/s4/`) so nothing the rig creates is visible to an auditor pointed at the tree |
| 10 | **s2's log-file naming** — the first auditor is "Launch 2" in the log and `s2-auditor-1.txt` on disk | Marginal | One line in the executor prompt: name saved reports by launch number consistently |
| 11 | **s4's `.meta` timing skew** (START/END both 02:01:53 vs the log's 02:01:50–02:01:54) | No | Not worth fixing |

---

## 5. What the run establishes, and what it does not

### What the runs establish

- **All six scenarios executed the shared `<design_gate>` block with their own bindings**, and every
  on-disk consequence D1 specifies held: the gate folder beside the audited document (s1, s2, s3,
  s4, s6) or in `reaudits/{date}/` for a post-approval rerun (s5); the registry's 22-rule Phase 5
  set exactly, LINT-11/12 absent, in all six corpora; **zero evidence records citing a `.canary/`
  path in all six**; `.canary/` gone from every repository; the `gate.json` top-level shape complete
  and unnested in all six with only permitted additions; no `docs/audit/plan-audit.md`; the plan
  folder's own `audit.md`/`spec.md`/`evidence/` byte-identical afterwards in s2, s3 and s5 against
  pre-run hashes; `manifest.md` and `status.json` rows only where the commands name them; **nothing
  committed anywhere**; and the plugin checkout unmoved (digest identical, 265 files).
- **Every gate term was re-derived rather than asserted, 24 of 24.** Six independent verifiers
  counted verdicts from the evidence records rather than from `audit.md`, re-ran the validator from
  the frozen script, and matched `gate.json` on CANARY_OK, EVIDENCE_OK, VERIFIED and INFRA_OK in all
  six scenarios. Four verifiers independently re-ran `tq-canary.js inject` and reproduced the
  recorded class or the exit-2 branch; two ran `detected` counterfactually and confirmed the
  `:640-641` ordering rule is load-bearing.
- **The validator returned exit 0 with zero flags in all six corpora**, re-run by six verifiers and
  by me on s1. No record was demoted, and the re-anchoring carve-out held wherever it was exercised.
- **The isolation route is recorded per scenario in all six and established from disk in three** —
  the thing run 2 named as its "to increase" (§2).
- **The subprocess branch was exercised three times and held three times**, with the "specialist
  reviews in sequence" instruction provable in the auditor's own echoed prompt.
- **Vacuous rules were handled correctly in every scenario checked**: exactly one N_A per corpus and
  it is LINT-14 every time, with each absent-trigger rule recorded PASS and the reason in the record
  (s3 4/4, s4 7/7, s5 4/4, s6 4/4). Run 2's fix held here too.
- **The LINT-14 pin holds on disk in every scenario**, each hash recomputed by its verifier.

### On the PASS path, exactly

**No scenario reached PASS.** Each NOT PASS is correct under the text:

| # | Terms | Why NOT PASS is correct | Artifact of fixture or text? |
|---|---|---|---|
| s1 | CANARY_OK ✓ · EVIDENCE_OK ✓ · **VERIFIED ✗** (4 UNMET) · INFRA_OK ✓ | `:1078` — LINT-07, 08, 14, 21 UNMET after validation, counted from the records | **No.** LINT-08 rests on register row A11, HIGH-impact and "FALSIFIED as the code stands", and LINT-21 on a genuine detector defect — both document-grounded and both survive R3-05/R3-06 being fixed |
| s2 | CANARY_OK ✓ · EVIDENCE_OK ✓ · **VERIFIED ✗** (1 UNMET) · INFRA_OK ✓ | LINT-24 alone — a genuine defect: the golden-master capture freezes an error line, not the summary | **No.** Run 3's closest approach to the open path: **one criterion from PASS** |
| s3 | CANARY_OK ✓ · EVIDENCE_OK ✓ · **VERIFIED ✗** (10 UNMET) · **INFRA_OK ✗** (3) | `:1078` and `:1079` | **Partly fixture-influenced, not fixture-caused.** The 3 INFRA-GAPs and LINT-15/16 are absent because the bound repo has no application source. With the intended repo bound: LINT-15/16 → MET, INFRA_OK → true, **8 UNMET remain, VERIFIED still false, verdict unchanged.** Over-determined |
| s4 | **CANARY_OK ✗** (not-applicable) · EVIDENCE_OK ✓ · **VERIFIED ✗** (15) · INFRA_OK ✓ | `:1074-1076` makes CANARY_OK false for not-applicable, which is independently sufficient (`:1081`, `:1100-1104`) | **No.** The prose ADR genuinely carries none of the five shapes — `inject` exit 2 reproduced by the verifier, and `build-fixtures.sh` asserts this property of the fixture by design |
| s5 | **CANARY_OK ✗** (not-applicable) · EVIDENCE_OK ✓ · **VERIFIED ✗** (15) · **INFRA_OK ✗** (9) | Three independent grounds | **No.** All 9 INFRA-GAPs reproduced path by path by the verifier; one (C1) turns on a reading rather than a file test. The *record set* rests on the contested FULL/LITE reading (R3-15), the *verdict* does not — the Phase 5 set is mode-invariant |
| s6 | CANARY_OK ✓ · EVIDENCE_OK ✓ · **VERIFIED ✗** (9) · **INFRA_OK ✗** (1) | `:1078`, `:1079` | **No.** The one INFRA-GAP — a "server timing log" asserted as the p95 instrument with no logging code or dependency anywhere — was verified by the verifier |

**Did any run produce a wrong PASS? No.** Zero PASS verdicts were reported and zero were warranted.
**Was any gate term mis-derived by an executor? No** — 24 of 24 derivations independently reproduced.
What *was* mis-derived is non-term bookkeeping: s4's `gap_count` (47 recorded, 44 by `:884`) and
s2's four disagreeing count triples, where the records are authoritative per `:729-730` and give
21/1/0.

One connection worth naming, without overclaiming it: **s2 finished one criterion from PASS, and half
of its final iteration's two-line feedback channel was spent on a phantom LINT-17 that R3-02 and
R3-03 jointly created.** Whether LINT-24 would have closed with the full channel is unknowable; that
the harness consumed half of it is not.

### What the runs do not establish

- **The PASS path has not been run under this text.** Run 2 reached it once (s2, `criteria-strip` →
  LINT-10, `gate_passed: true`). Run 3 reached it zero times in six. Every NOT PASS is correct, so
  this is not a regression in the plugin — but it means the gate's *open* path has never been
  executed under the current frozen text with a recorded isolation route, and everything run 3
  proves, it proves about a gate that refused.
- **Two of run 2's four fixes are still unexercised** — `--exclude`/exit-3, and
  `auditor-did-not-return` (§1).
- **Three of six isolation routes remain CORROBORATED** and by construction cannot be ESTABLISHED.
- **Auditor blindness to the plant is established in two of the four canary-found scenarios.** s3's
  holistic judge read `canary.json`; s2's gate run 1 reported FOUND with `stillFails = true` and no
  citation on the injected row.
- **Six new HIGH instruction defects were found in text that two prior full runs had already
  swept.** Coverage is not correctness: three runs inspecting the same files does not show the defect
  set is enumerated. The raw counts (run 1: 14; run 2: 16; run 3: 41 merged IDs) are **not
  comparable** — this run merged across six verifier reports at a finer grain than either predecessor
  — so they are not evidence of a trend in either direction. What *is* comparable is that six HIGH
  findings survived a third sweep of the same files, and none of the six was named by run 1 or run 2.
- **Prompt bytes** are unavailable for every Agent-tool launch, every scaffolder, and three of four
  holistic judges.
- **Six scenarios remain a sample chosen to cover the bindings**, not a representative sample of use.

---

## 6. Recommendation

### Fix now

| # | Defect | File to change | Shape of the change |
|---|---|---|---|
| 1 | **R3-03** | `scripts/tq-canary.js` (+ `agents/plan-scaffolder.md:160-162`) | Bound the `assumption-inject` row scan to the anchored table (stop at the first non-`\|` line after the header), tighten `:61` to match a table *header* rather than any row containing the word, and make `inject` refuse — or record a `mis_anchored` flag in `canary.json` — when the chosen row falls outside it; and show an example integer row in the scaffolder's register template, which currently shows `\| # \|` and no row at all |
| 2 | **R3-02** | `skills/plan/stages/stage-2-design.md:682-692` | Extend strip-and-recheck to every criterion *and* every CHECK-4 matrix row whose finding rests on the injected or removed line, not only the canary's own criterion, and delete `:692`'s false claim that a dropped quote's "criterion was re-checked in step 2" |
| 3 | **R3-04** | `stage-2-design.md:845-864` | Move the LINT-14 five-step sequence after everything that appends to `audit.md` — `:911`'s `## Evidence notes` and `:1165-1173`'s Revision History — or replace "nothing after the pin may edit that file" with an explicit re-pin-and-revalidate step; what cannot stand is a printed order in which the pin precedes two mandatory edits |
| 4 | **R3-07** | `scripts/tq-canary.js:429-444` (+ `stage-2-design.md:591-593`) | Write `canary.json` to a directory the auditor is not pointed at (a sibling of `outDir`), so the answer key is not filed in the exam room; two lines, and it closes both the s3 judge-read and the s6 auditor-declined exposures |
| 5 | **R3-01** | `stage-2-design.md:925-940` (+ `agents/plan-auditor.md`) | Forbid criterion ids and verdicts in the audit-note text (the shipped example at `:932-936` already carries none), and state what must be swept from the fresh auditor's environment between iterations — or, if contamination is accepted as unavoidable, say so in `plan-auditor.md` and make the disclose-and-disregard path at `:45-47` the *stated* handling rather than an accident |
| 6 | **R3-15** | `agents/plan-auditor.md:292` | One line: admit the reaudits redirect in the first conjunct — "is that plan folder **or a `reaudits/{date}/` folder beneath it**" |
| 7 | **R3-12** | `agents/plan-auditor.md:407-408` | Name `criterion_id` in the field-order sentence. One word, and it closes a path where a missing field silently disables `EVIDENCE-UNSUPPORTED` for LINT-15/16 with no flag and no exit 1 |
| 8 | **R3-10** | `agents/plan-auditor.md:565-571` | Add the `Total gaps:` and `Total warnings:` lines the stage file requires at `:876-888`, so the two shipped templates agree — this is also the cross-check that would have caught s4's `gap_count` error |
| 9 | **R3-11** | `stage-2-design.md:614-619` | Correct "the five" to six, add a precedence rule for the case s4 exhibited (inject exit 2 *and* a spawn that fails to return), and align `quick-audit.md:107-109`'s four presentation tokens with the six-value vocabulary |

Items 1, 2, 3, 4, 6, 7, 8, 9 are mechanical. **Item 5 is a design decision, not an edit** — the
contamination cannot be removed by wording alone, because the reinforcement step's whole purpose is
to write into `{doc}`.

Two further defects are **decisions, not fixes**, and should go to the owner as such:

- **R3-05** (`:1116-1118`): allowing one line per *witness* rather than one per criterion would let a
  universally quantified rule be closed instead of re-found each iteration. `:1125` forecloses the
  obvious alternative (sending the rule text) for stated and good reasons, so this needs a decision
  record like D7/D8, not a wording change.
- **R3-06** (`:997-1001`): widening the LINT-14 variance exemption beyond byte-identical
  `doc_sha256` — for instance, to a flip whose *underlying text* did not change — is a judgement
  about how much auditor variance the gate should absorb. As written, the exemption cannot fire in
  the loop that most needs it.

### Record and leave

R3-13, R3-14, R3-16 through R3-41 minus the items promoted above (R3-08, R3-09, R3-17 through R3-41)
— the remaining MEDIUM/LOW set. Two notes on this pile rather than a list. First, **R3-09 carries a live verifier
disagreement** (three LOW, one HIGH) that nothing in run 3 resolves, because no run exercised the
failing reading; record the disagreement with it rather than a single number. Second, the largest
single group is again the class run 2 named and did not itemise — **two files describing one artifact
and disagreeing** (R3-10, R3-15, R3-17, R3-20, R3-28, and the second half of R3-11). Run 2 declined
to build a term registry with CI enforcement on the ground that "every drift confirmed is between
files `tests/layer1-repo.sh` already reads". Run 3 found five more drifts in the same files. That
rejection is now worth revisiting on evidence rather than re-asserting.

### Is a fourth run warranted?

**Yes — but scoped to three targeted scenarios, not another full six.** The general invariants have
now held across three runs with independent re-derivation each time; a fourth full sweep would mostly
re-prove them. What is genuinely unmeasured is narrow and nameable:

1. **One scenario engineered to reach PASS** under the current text, with a recorded isolation route.
   This is the run's largest gap: run 3 went 0-for-6 on the open path, so the gate's accept
   behaviour has never been observed under this text. s2 finished one criterion away, so it is
   reachable.
2. **One scenario engineered to make the auditor MISS the canary**, so `inject --exclude` and the
   exit-3 `single-trial-only` branch actually execute. This is the fix with the least evidence behind
   it — zero — and it is trivially arrangeable (bind an auditor whose applicable set omits the
   canary's criterion, or plant a class the document's shape makes invisible).
3. **One scenario where the relaunched auditor also fails**, so `auditor-did-not-return` is recorded
   once and the R3-16 heading/body ambiguity is forced to matter.

Run it after the nine fixes above land, and freeze again. Add the six rig fixes from §4b to
`stress-rig/` first — particularly the `.canary` tar exclusion, which is one command away from having
the gate delete a fixture the rig itself planted.

### Confidence

**Runtime conformance of the shortcut commands to D1: Med (78%)**, raised from run 2's 75%.

Components, each rated separately and shown rather than rolled up:

| Component | Rating | Basis |
|---|---|---|
| Invariant conformance across the six bindings | High **97%** | 6/6 scenarios, every invariant re-derived from disk by an independent verifier and cross-checked by the deterministic checker. The one NOT OK (s2's `audit.md` internal consistency) is agent bookkeeping, not a conformance failure |
| Gate-term derivation | High **98%** | 24/24 terms independently re-derived from the evidence records; validator re-run 6/6 at exit 0 with zero flags; `inject` reproduced 4×; `detected` run counterfactually 2× |
| Isolation route recorded rather than inferred | Med **80%** | 6/6 recorded in the gate record; 3/6 ESTABLISHED from CLI-only artifacts; 3/6 CORROBORATED with no artifact possible by construction |
| Run 2's four fixes behave as written at runtime | Med **62%** | 2.5 of 4 exercised and held (LINT-20 6/6; the re-anchoring carve-out 3/3 with 0 demotions; the specialist-reviews half of fix 3 at 6/6). 1.5 unexercised: `--exclude`/exit-3 entirely, and `auditor-did-not-return` entirely |
| The PASS path under current text | Spec **<30%** | Zero observations in run 3; one observation in run 2 under superseded text |

**De-risking factors, each verified present and effective**: the freeze proved by identical digests
over 265 files before and after; all twelve scenario agents pinned to Opus, so run-over-run
comparison is sound for the first time; four independent layers per scenario that do not trust each
other (executor log, deterministic checker, verifier, critic); every verifier re-derived from
primary artifacts before opening the executor log; both shipped scripts re-run from the frozen tree
by six verifiers and by me.

**Assumption, labelled and verified**: that the verifiers' frozen-tree line citations resolve. They
largely do — but s3 found the *s3 executor's* citations systematically offset, so I re-read every
line I ranked on. Two of my rankings differ from a verifier's on the strength of that re-reading
(R3-03's causal line, and R3-09's severity).

**The specific evidence gap that keeps this from being higher**: **no scenario in run 3 reached PASS,
so the gate's open path — CANARY_OK, EVIDENCE_OK, VERIFIED and INFRA_OK all true, and the gate
authorising passage — has not been executed under the current frozen text with a recorded isolation
route.** Six correct refusals do not establish one correct acceptance. Secondarily, two of run 2's
four fixes were never entered, and six new HIGH defects surfaced in text two prior runs had already
swept, which is evidence that the defect surface is not yet enumerated.

**To increase**: run the three scoped scenarios in §6 above against a checkout frozen after the nine
fixes land — one engineered to PASS, one engineered to miss the canary, one where both auditor
launches fail. Those three observations would close the PASS-path gap and both unexercised fixes,
and would move the weakest component (62%) and the headline together.
