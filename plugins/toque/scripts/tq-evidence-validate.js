#!/usr/bin/env node
/**
 * Evidence record validator — PH5-020, spec §5.3.
 *
 * The Phase 5 gate treats a criterion as MET only when the judge produced evidence
 * that survives mechanical re-checking. This module does the re-checking.
 *
 * The point is narrow and worth stating: it decides byte-equality between a quoted
 * string and the lines it claims to come from. It does not, and cannot, decide
 * whether the quoted text actually satisfies the criterion. That limit is the
 * design — equality is a question text comparison answers soundly, and confining
 * the judge to claims of that shape is what makes the gate a verifier rather than
 * a better-instructed grader.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Hash an artifact's LF-normalized content, never its raw bytes.
 *
 * This repository stores LF blobs and converts to CRLF on Windows checkout, so a
 * raw-byte hash would validate on a developer machine and fail on Ubuntu CI. A
 * validator that only fails in CI is worse than no validator: it produces failures
 * nobody can reproduce locally, and people learn to re-run it until it goes away.
 */
function hashContent(text) {
  return crypto.createHash('sha256')
    .update(String(text).replace(/\r\n/g, '\n'), 'utf8')
    .digest('hex');
}

/**
 * Criteria settled by running something rather than by reading something.
 *
 * Fixed here, deliberately, rather than declared by the record. If a record could
 * state its own check type, a judge could relabel an executable criterion as textual
 * and satisfy it with a quote — which is precisely the opt-out this rule removes.
 * The judge does not get a vote on which rules apply to it.
 *
 * Kept in sync with docs/planning-techniques/lint-registry.md by
 * tests/evidence-validate-test.js; see the registry for what each id means.
 */
const EXECUTABLE_CRITERIA = new Set(['LINT-15', 'LINT-16']);

/**
 * The closed verdict vocabulary, from the schema block in plan-auditor.md.
 *
 * Kept as a set rather than an inequality against 'MET' because the rest of this
 * module treats "not MET" as "nothing to check". That is sound only when every
 * other value is a deliberate non-claim; a typo or a synonym must not inherit the
 * exemption.
 */
const VALID_VERDICTS = new Set(['MET', 'UNMET', 'N_A']);

/**
 * Flags that report something without changing the verdict.
 *
 * Every other flag demotes. This set exists so a note can be surfaced to a reader
 * without silently costing a record its verdict — the failure mode being a comment
 * that says "not a demotion on its own" sitting above code that demotes, which is
 * how a validator starts lying about itself.
 */
const ADVISORY_FLAGS = new Set(['EVIDENCE-EXITCODE-IGNORED']);

function isExecutableCriterion(id) {
  return EXECUTABLE_CRITERIA.has(id) || /^INFRA-/.test(String(id || ''));
}

/**
 * Re-read the cited lines and compare them with the quote the judge supplied.
 * Returns null when they agree, or a flag string naming the disagreement.
 */
function checkQuote(item, rootDir) {
  // A citation with no artifact is not a citation. Before this guard the field was
  // passed straight to path.resolve, which throws ERR_INVALID_ARG_TYPE on undefined
  // and took down the whole run — one malformed item meant zero records validated,
  // so the failure mode of a bad record was "no audit" rather than "one demotion".
  if (typeof item !== 'object' || item === null || typeof item.artifact !== 'string' || !item.artifact) {
    return 'EVIDENCE-ARTIFACT-MISSING';
  }

  const abs = path.resolve(rootDir, item.artifact);

  // The citation must land inside the tree being audited.
  //
  // path.resolve happily accepts an absolute path or a ../ chain and walks
  // straight out of rootDir, so a record could satisfy MET by quoting a file the
  // audit has no claim over — a sibling checkout, or anything else on the disk.
  // The quote would match, the hash would match, and the verdict would be
  // meaningless. Containment is what makes "this repository says so" true.
  // Absolute paths are refused even when they land inside the tree. One that does
  // is contained today and broken tomorrow: records are committed and re-checked
  // on other machines, so C:\Users\...\repo\spec.md validates for its author and
  // fails for everyone else. Repo-relative is the only spelling that survives the
  // trip, so the check is on the SPELLING, not only on where it happens to land.
  if (path.isAbsolute(item.artifact) || /^[A-Za-z]:[\\/]/.test(item.artifact)) {
    return 'EVIDENCE-PATH-ESCAPE';
  }
  const root = path.resolve(rootDir);
  const rel = path.relative(root, abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return 'EVIDENCE-PATH-ESCAPE';
  }

  let raw;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (err) {
    return 'EVIDENCE-ARTIFACT-MISSING';
  }

  // Containment again, this time against the filesystem rather than the string.
  //
  // The check above is lexical: it resolves ".." and compares paths. A symlink or
  // a Windows junction inside the tree passes it and still reads a file outside,
  // because resolve() does not follow links. Re-checking the REAL path after the
  // read is what closes that — and it has to be after, since realpath on a
  // nonexistent file throws and would turn a missing artifact into a confusing
  // path error.
  try {
    const realRoot = fs.realpathSync(path.resolve(rootDir));
    const realAbs = fs.realpathSync(abs);
    const realRel = path.relative(realRoot, realAbs);
    if (realRel === '' || realRel.startsWith('..') || path.isAbsolute(realRel)) {
      return 'EVIDENCE-PATH-ESCAPE';
    }
  } catch (err) {
    // realpath can fail on a path that readFileSync accepted — a permissions
    // quirk, a race. Unresolvable containment is not proven containment.
    return 'EVIDENCE-PATH-ESCAPE';
  }

  // Staleness dominates every other check. If the artifact has moved on since the
  // record was written, the line numbers and the quote are being compared against a
  // document the auditor never saw, and agreement would be coincidence rather than
  // evidence.
  //
  // The pin is REQUIRED, and that is a correction. It used to be checked only when
  // a record happened to supply one, while the schema in plan-auditor.md did not
  // ask for it and stage-2-design.md told the reader the validator "confirms its
  // hash still matches". So a record written exactly to the published schema
  // carried no pin, skipped this check, and the documentation described a guarantee
  // nothing provided. Optional staleness detection is not staleness detection: the
  // records that most need pinning are the ones a hurried judge would omit it from.
  if (!item.sha256) {
    return 'EVIDENCE-UNPINNED';
  }
  if (hashContent(raw) !== String(item.sha256).toLowerCase()) {
    return 'EVIDENCE-STALE';
  }

  const start = Number(item.line_start);
  const end = Number(item.line_end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return 'EVIDENCE-RANGE-INVALID';
  }

  // Split on \n after stripping \r, so a CRLF checkout on Windows and an LF
  // checkout on CI slice identically. Line numbers are 1-based.
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  if (end > lines.length) {
    return 'EVIDENCE-RANGE-INVALID';
  }

  const actual = lines.slice(start - 1, end).join('\n');
  const quoted = String(item.exact_quote == null ? '' : item.exact_quote)
    .replace(/\r\n/g, '\n');

  // An empty quote is not evidence, and this is the hole the previous fix left.
  //
  // Making executable criteria depend on "a citation that survives re-checking"
  // closed the fabricated-exit-code route and opened a narrower one: cite a blank
  // line, supply exact_quote: "", and the comparison below is '' === '' — true.
  // The record passes re-checking having quoted nothing. A fabricated INFRA-*
  // criterion returned MET this way, with a failing exit code attached.
  //
  // Whitespace counts as nothing too, or the same trick works on any indented
  // blank line. Every criterion is covered, not just the executable ones: a quote
  // that says nothing supports nothing, whatever it is cited for.
  if (quoted.trim() === '') {
    return 'EVIDENCE-QUOTE-EMPTY';
  }

  return actual === quoted ? null : 'EVIDENCE-INVALID';
}

/**
 * Validate one criterion record.
 *
 * Returns { criterion_id, verdict, flags }. The verdict returned is the verdict
 * the gate must use: a MET whose evidence does not survive re-checking comes back
 * UNMET. Nothing here can raise a verdict — validation only ever demotes.
 */
function validateRecord(rec, rootDir) {
  const flags = [];
  const claimed = rec && rec.verdict;

  // The vocabulary is closed: plan-auditor.md's schema block states "verdict is one
  // of MET, UNMET, N_A". Enforcing it here is not pedantry about spelling — the
  // check below exempts every non-MET verdict from evidence validation, so any
  // token outside the set is a free pass. Records written as PASS took exactly that
  // route: not equal to MET, therefore never examined, and printed with a tick.
  // An unrecognised verdict is the one case where the validator cannot know what
  // was claimed, so it resolves to the safe direction.
  if (!VALID_VERDICTS.has(claimed)) {
    return { criterion_id: rec && rec.criterion_id, verdict: 'UNMET', flags: ['EVIDENCE-VERDICT-INVALID'] };
  }

  if (claimed !== 'MET') {
    // A negative finding needs no evidence — you cannot cite the absence of a
    // thing — but evidence it DOES carry is still a claim about a file, and a
    // claim about a file can be stale. This return used to send every non-MET
    // record home unexamined. LINT-14 is pinned to audit.md's hash and has been
    // UNMET in every stress iteration run so far; audit.md was appended to, the
    // pin went stale, checkQuote said EVIDENCE-STALE when called directly, and
    // the CLI printed "0 flagged" and exited 0 — so EVIDENCE_OK, a gate term,
    // read true on a pin nothing had refreshed (stress run 5, R5-06). The
    // documented hazard was a false alarm; the real one was silence.
    //
    // The verdict is kept either way. An UNMET cannot be demoted further, and it
    // must not be promoted because its citations happen to hold — the final
    // MET-or-UNMET expression below is for records that CLAIMED MET. Only the
    // flags are collected, and `flagged` is what validateDirectory and the CLI
    // exit on. Absent evidence raises nothing here, as before.
    const supplied = Array.isArray(rec.evidence) ? rec.evidence : [];
    for (const item of supplied) {
      const flag = checkQuote(item, rootDir);
      if (flag && !flags.includes(flag)) flags.push(flag);
    }
    return { criterion_id: rec.criterion_id, verdict: claimed, flags };
  }

  const evidence = Array.isArray(rec.evidence) ? rec.evidence : [];

  // An externally checkable claim with nothing to check is not a weak pass, a
  // warning, or a PARTIAL — it is UNMET. This is the rule that converts a judgement
  // call into an outcome, and it is the one this repository has already lost twice:
  // PHV5-044 sat at PARTIAL with its result asserted in a commit message and no
  // artifact in any commit, and Wave 5 closed nine findings against greps typed at
  // a terminal. Both would fail here without anyone having to notice.
  if (evidence.length === 0) {
    flags.push('EVIDENCE-MISSING');
  }

  for (const item of evidence) {
    const flag = checkQuote(item, rootDir);
    if (flag && !flags.includes(flag)) flags.push(flag);
  }

  // For an executable criterion a quote is not evidence. "The scenario matrix says
  // there is a test" and "the test file exists" are different claims, and only the
  // second settles the rule — the first is the plan restating its own assertion.
  //
  // What counts as settling it is the part this got wrong for a release. The rule
  // used to be "a command field is present and its exit_code is 0" — both written
  // by the judge, neither checked. A record carrying
  // `command: "definitely-not-run", exit_code: 0` came back MET. The judge was
  // grading its own homework on precisely the criteria that exist to stop that.
  //
  // This validator will not execute a command to find out. These records are
  // model-authored, and running a string one wrote is a worse problem than the one
  // it solves. So exit_code is ignored entirely — it is not evidence and cannot be
  // made into evidence by asserting it harder.
  //
  // What IS checkable without running anything: that the artifact exists and says
  // what the record claims. A citation surviving checkQuote proves a real file, at
  // real lines, quoted exactly, unchanged since the audit.
  //
  // It does NOT prove the quote is relevant to the criterion, and this rule should
  // not be read as if it did. Requiring a citation raises the floor from "assert an
  // exit code" to "find a real line and quote it", which is a real improvement and
  // a small one. A citation of a closing brace passes. Two earlier rounds tried to
  // patch that — first by rejecting empty quotes, then by rejecting whitespace —
  // and each patch moved the bar by one character while leaving the class open.
  //
  // Relevance is not decidable by text comparison, so this module does not claim to
  // decide it. See the module header: the guarantee is existence and fidelity, not
  // sufficiency. What closes the remaining gap is a human reading the record, and
  // the gate's documentation now says so rather than implying the machine did it.
  if (isExecutableCriterion(rec.criterion_id)) {
    const verifiedCitations = evidence.filter(
      (e) => e && typeof e.artifact === 'string' && e.artifact && checkQuote(e, rootDir) === null,
    );
    if (verifiedCitations.length === 0) {
      // Named for what it now means. It used to fire when no evidence item
      // carried a command, so EVIDENCE-UNEXECUTED described its trigger exactly.
      // It now fires when no citation survived re-checking, which a genuinely
      // executed command can also hit — a stale hash, a wrong line range — and
      // the old name sent the reader hunting for a missing command instead of a
      // broken citation.
      flags.push('EVIDENCE-UNSUPPORTED');
    }
    if (evidence.some((e) => e && e.exit_code !== undefined)) {
      // Not a demotion on its own — the citations above decide the verdict. This
      // says out loud that the number carried no weight, so nobody reads a green
      // record as confirmation that the command was re-run.
      flags.push('EVIDENCE-EXITCODE-IGNORED');
    }
  }

  const demoting = flags.filter((f) => !ADVISORY_FLAGS.has(f));
  const verdict = demoting.length > 0 ? 'UNMET' : 'MET';
  return { criterion_id: rec.criterion_id, verdict, flags };
}

/**
 * Validate every record in a directory.
 *
 * Returns { records, demoted } where demoted counts verdicts the auditor claimed as
 * MET that did not survive re-checking.
 */
function validateDirectory(dir, rootDir) {
  const entries = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const records = entries.map((f) => {
    const full = path.join(dir, f);
    let rec;
    try {
      rec = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (err) {
      // A record that will not parse is not a record. Treating it as absent would
      // let a malformed file silently remove a criterion from the audit.
      return { file: f, criterion_id: null, claimed: null, verdict: 'UNMET', flags: ['EVIDENCE-UNPARSEABLE'] };
    }
    const out = validateRecord(rec, rootDir);
    return { file: f, criterion_id: out.criterion_id, claimed: rec && rec.verdict, verdict: out.verdict, flags: out.flags };
  });

  const demoted = records.filter((r) => r.claimed === 'MET' && r.verdict !== 'MET').length;

  // Anything the validator had to flag, whatever the record claimed.
  //
  // `demoted` counts only records that claimed MET and lost it, which is the
  // number a reader wants — but it is the wrong number to exit on. A record
  // written `"verdict": "PASS"` never claimed MET, so it demotes nothing, and
  // for one release the CLI printed `✗ EVIDENCE-VERDICT-INVALID` and then
  // exited 0. The caller reads exit 0 as "every record survived". A corpus the
  // validator could not read is not a corpus that survived.
  const flagged = records.filter((r) => r.flags.some((f) => !ADVISORY_FLAGS.has(f))).length;
  return { records, demoted, flagged };
}

if (require.main === module) {
  const dir = process.argv[2];
  const rootDir = process.argv[3] || process.cwd();

  if (!dir) {
    console.error('usage: tq-evidence-validate.js <evidence-dir> [root-dir]');
    process.exit(2);
  }
  if (!fs.existsSync(dir)) {
    // An audit whose evidence directory does not exist has not produced evidence.
    // Exiting 0 here would report "nothing wrong" for the worst possible case.
    console.error(`evidence directory not found: ${dir}`);
    console.error('An audit with no evidence directory has not been completed.');
    process.exit(2);
  }

  const { records, demoted, flagged } = validateDirectory(dir, rootDir);

  for (const r of records) {
    // Three marks, not two. A record whose only flags are advisory keeps its
    // verdict and does not fail the run, so printing it with the same ✗ as a
    // rejected record produced "✗ LINT-15: MET ... 0 flagged" and exit 0 — a
    // screen contradicting itself, above a comment claiming every mark was a
    // record the validator could not support.
    const demoting = r.flags.filter((f) => !ADVISORY_FLAGS.has(f));
    const mark = demoting.length ? '✗' : (r.flags.length ? '!' : '✓');
    const why = r.flags.length ? `  [${r.flags.join(', ')}]` : '';
    console.log(`  ${mark} ${r.criterion_id || r.file}: ${r.verdict}${why}`);
  }
  console.log(`\n${records.length} record(s), ${demoted} demoted, ${flagged} flagged`);

  if (records.length === 0) {
    console.error('No records found — an empty evidence directory is not a pass.');
    process.exit(2);
  }
  // Exit on `flagged`, not `demoted`. Every mark printed above is a record the
  // validator could not stand behind; exiting 0 while one is on screen makes the
  // exit code disagree with the report, and the caller only reads the exit code.
  process.exit(flagged > 0 ? 1 : 0);
}

module.exports = {
  validateRecord, checkQuote, hashContent, isExecutableCriterion, validateDirectory,
  VALID_VERDICTS,
};
