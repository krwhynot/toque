#!/usr/bin/env node
/**
 * Tests for scripts/tq-evidence-validate.js  (PH5-020, spec §5.3)
 *
 * Unlike a test that mirrors logic living in markdown,
 * this file requires the real module. There is no second copy of the rules to drift.
 *
 * Run with: node tests/evidence-validate-test.js
 */

const path = require('path');
const { validateRecord, validateDirectory, VALID_VERDICTS } = require('../plugins/toque/scripts/tq-evidence-validate.js');

const ROOT = __dirname;
const ARTIFACT = 'fixtures/evidence/spec-sample.md';

// Line 9 of the fixture, byte for byte.
const TRUE_QUOTE = 'Rollback: revert migration 0043 via `npm run db:down 0043`.';

// sha256 of the fixture's LF-normalized content. If this file is legitimately
// edited, recompute with:
//   node -e "const f=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(f.readFileSync('tests/fixtures/evidence/spec-sample.md','utf8').replace(/\r\n/g,'\n'),'utf8').digest('hex'))"
const FIXTURE_SHA = 'd86dda77cbba04fe400a4e88e801d6e9bc95c9cdd769200c8eb64dd6691cacc2';

let pass = 0;
let fail = 0;

function check(name, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    fail++;
  }
}

function record(overrides = {}) {
  return Object.assign({
    criterion_id: 'LINT-03',
    evidence: [{
      artifact: ARTIFACT,
      line_start: 9,
      line_end: 9,
      exact_quote: TRUE_QUOTE,
      // Required since 11.0.0. Every helper carries it so that a test which
      // omits it is testing the omission on purpose.
      sha256: FIXTURE_SHA,
    }],
    reasoning: 'Phase 2 names a reversal command.',
    verdict: 'MET',
  }, overrides);
}

console.log('\n1. Quote fidelity');

// A paraphrase is the cheapest possible fabrication: it reads as a citation, points
// at a real file and a real line range, and is wrong. If the validator accepts it,
// every downstream guarantee about evidence is decorative.
{
  const r = record({
    evidence: [{
      artifact: ARTIFACT,
      line_start: 9,
      line_end: 9,
      exact_quote: 'Rollback: revert migration 43 using npm run db:down.',
      sha256: FIXTURE_SHA,
    }],
  });
  const out = validateRecord(r, ROOT);
  check('paraphrased quote forces UNMET', out.verdict === 'UNMET', `got ${out.verdict}`);
  check('paraphrased quote is flagged EVIDENCE-INVALID',
    (out.flags || []).includes('EVIDENCE-INVALID'),
    `flags=${JSON.stringify(out.flags)}`);
}

// The control. Without it the suite cannot tell "rejects paraphrase" from "rejects
// everything", and a validator that fails every record would score 2/2 above.
{
  const out = validateRecord(record(), ROOT);
  check('byte-equal quote is accepted', out.verdict === 'MET', `got ${out.verdict}`);
  check('byte-equal quote raises no flags',
    (out.flags || []).length === 0,
    `flags=${JSON.stringify(out.flags)}`);
}

console.log('\n2. Unverifiable claims');

// The PHV5-044 shape, mechanised. A judge that asserts a criterion is satisfied and
// produces nothing to check has not verified it, and "PARTIAL, no artifact" is a
// judgement call only while something is willing to make the call. Here it is an
// outcome: no evidence, no MET.
{
  const out = validateRecord(record({ evidence: [] }), ROOT);
  check('MET with an empty evidence array forces UNMET', out.verdict === 'UNMET', `got ${out.verdict}`);
  check('bare MET is flagged EVIDENCE-MISSING',
    (out.flags || []).includes('EVIDENCE-MISSING'),
    `flags=${JSON.stringify(out.flags)}`);
}

{
  const r = record();
  delete r.evidence;
  const out = validateRecord(r, ROOT);
  check('MET with no evidence key at all forces UNMET', out.verdict === 'UNMET', `got ${out.verdict}`);
}

// UNMET needs no evidence — you cannot cite the absence of a thing. Demoting it
// would make the validator reject every honest negative finding, which is the
// direction that quietly destroys a gate: the judge learns UNMET is expensive.
{
  const out = validateRecord(record({ verdict: 'UNMET', evidence: [] }), ROOT);
  check('UNMET with no evidence is left alone', out.verdict === 'UNMET', `got ${out.verdict}`);
  check('UNMET with no evidence raises no flags',
    (out.flags || []).length === 0,
    `flags=${JSON.stringify(out.flags)}`);
}

// Stress run 5, R5-06. The exemption above used to be total: any non-MET
// record returned before its citations were looked at. LINT-14 is pinned to
// audit.md's hash and has been UNMET in every iteration run so far, so when
// audit.md was appended to after the pin, checkQuote said EVIDENCE-STALE when
// called directly and the CLI said "0 flagged", exit 0. A negative finding
// keeps its verdict and needs no evidence; evidence it carries is still checked.
{
  const stale = validateRecord(record({
    verdict: 'UNMET',
    evidence: [{ artifact: ARTIFACT, line_start: 9, line_end: 9, exact_quote: TRUE_QUOTE, sha256: 'deadbeef'.repeat(8) }],
  }), ROOT);
  check('UNMET with a stale citation keeps its verdict', stale.verdict === 'UNMET', `got ${stale.verdict}`);
  check('and is flagged EVIDENCE-STALE',
    (stale.flags || []).includes('EVIDENCE-STALE'), `flags=${JSON.stringify(stale.flags)}`);

  const fine = validateRecord(record({ verdict: 'UNMET' }), ROOT);
  check('UNMET with a valid citation is not promoted to MET',
    fine.verdict === 'UNMET' && (fine.flags || []).length === 0,
    `got ${fine.verdict} flags=${JSON.stringify(fine.flags)}`);

  const na = validateRecord(record({
    verdict: 'N_A',
    evidence: [{ artifact: ARTIFACT, line_start: 9, line_end: 9, exact_quote: 'a paraphrase', sha256: FIXTURE_SHA }],
  }), ROOT);
  check('N_A with a bad quote keeps its verdict and carries the flag',
    na.verdict === 'N_A' && (na.flags || []).length === 1, `got ${na.verdict} flags=${JSON.stringify(na.flags)}`);

  // The directory counts are what the CLI prints and exits on: a stale UNMET
  // is flagged, not demoted, and one flag is exit 1.
  const os = require('os');
  const fs = require('fs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-evidence-r506-'));
  fs.writeFileSync(path.join(dir, 'LINT-14.json'), JSON.stringify(record({
    criterion_id: 'LINT-14', verdict: 'UNMET',
    evidence: [{ artifact: ARTIFACT, line_start: 9, line_end: 9, exact_quote: TRUE_QUOTE, sha256: 'deadbeef'.repeat(8) }],
  })), 'utf8');
  const out = validateDirectory(dir, ROOT);
  check('a directory holding a stale UNMET reports 0 demoted, 1 flagged',
    out.demoted === 0 && out.flagged === 1, `demoted=${out.demoted} flagged=${out.flagged}`);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\n3. Staleness');

// The quote can still match its lines while the surrounding document has moved on.
// Pinning the artifact hash binds the record to the version that was audited, so a
// spec edited after the audit cannot keep carrying that audit's verdicts.
{
  const out = validateRecord(record({
    evidence: [{
      artifact: ARTIFACT, line_start: 9, line_end: 9,
      exact_quote: TRUE_QUOTE, sha256: 'deadbeef'.repeat(8),
    }],
  }), ROOT);
  check('stale artifact hash forces UNMET', out.verdict === 'UNMET', `got ${out.verdict}`);
  check('stale hash is flagged EVIDENCE-STALE',
    (out.flags || []).includes('EVIDENCE-STALE'),
    `flags=${JSON.stringify(out.flags)}`);
}

{
  const out = validateRecord(record({
    evidence: [{
      artifact: ARTIFACT, line_start: 9, line_end: 9,
      exact_quote: TRUE_QUOTE, sha256: FIXTURE_SHA,
    }],
  }), ROOT);
  check('matching artifact hash is accepted', out.verdict === 'MET', `got ${out.verdict}`);
}

// Platform portability, and the reason the hash is not over raw bytes. This repo
// converts LF to CRLF on Windows checkout while storing LF blobs, so a raw-byte
// hash would validate on a dev machine and fail on Ubuntu CI — a validator that
// only fails in CI is worse than none, because it trains people to ignore it.
{
  const os = require('os');
  const fs = require('fs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-evidence-'));
  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 }); } catch { /* leave it */ } });
  const crlfDir = path.join(tmp, 'fixtures', 'evidence');
  fs.mkdirSync(crlfDir, { recursive: true });
  const lf = fs.readFileSync(path.join(ROOT, ARTIFACT), 'utf8').replace(/\r\n/g, '\n');
  fs.writeFileSync(path.join(crlfDir, 'spec-sample.md'), lf.replace(/\n/g, '\r\n'), 'utf8');

  const out = validateRecord(record({
    evidence: [{
      artifact: ARTIFACT, line_start: 9, line_end: 9,
      exact_quote: TRUE_QUOTE, sha256: FIXTURE_SHA,
    }],
  }), tmp);
  check('same content with CRLF endings hashes and quotes identically',
    out.verdict === 'MET', `got ${out.verdict} flags=${JSON.stringify(out.flags)}`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\n4. Executable criteria');

// Some criteria are settled by running something, not by reading something: does
// the test file exist, is the gate wired. The executable set is fixed inside the
// validator on purpose — if a record declared its own check type, a judge could
// call an executable criterion textual and satisfy it with a quote, which is the
// opt-out this rule exists to remove.
//
// What SETTLES one changed in 11.0.0 and this section changed with it. The rule
// used to be "a command field is present and its exit_code is 0", both written by
// the judge and neither checked; a record claiming
// `command: "definitely-not-run", exit_code: 0` came back MET. The validator does
// not execute commands — these records are model-authored and running a string one
// wrote is a worse problem than the one it solves — so exit_code is ignored
// entirely and a verified citation carries the verdict.

// The defect, verbatim. This is the exact shape that used to pass.
{
  const out = validateRecord({
    criterion_id: 'LINT-15',
    evidence: [{ command: 'definitely-not-run', exit_code: 0 }],
    reasoning: 'Claims to have run something.',
    verdict: 'MET',
  }, ROOT);
  check('a fabricated command with exit_code 0 does not satisfy an executable criterion',
    out.verdict === 'UNMET', `got ${out.verdict} flags=${JSON.stringify(out.flags)}`);
  check('command-only evidence is flagged EVIDENCE-UNSUPPORTED',
    (out.flags || []).includes('EVIDENCE-UNSUPPORTED'),
    `flags=${JSON.stringify(out.flags)}`);
}

// A verified citation settles it. The exit_code here is deliberately nonsense: if
// it carried any weight in either direction this would not come back MET, so this
// case is what proves the number is genuinely ignored rather than merely tolerated.
{
  const out = validateRecord({
    criterion_id: 'LINT-15',
    evidence: [{
      artifact: ARTIFACT, line_start: 9, line_end: 9,
      exact_quote: TRUE_QUOTE, sha256: FIXTURE_SHA,
      command: 'test -f tests/evidence-validate-test.js', exit_code: 99,
    }],
    reasoning: 'The artifact the command is about exists and says this.',
    verdict: 'MET',
  }, ROOT);
  check('a verified citation settles an executable criterion', out.verdict === 'MET',
    `got ${out.verdict} flags=${JSON.stringify(out.flags)}`);
  check('a nonsense exit_code does not change the verdict', out.verdict === 'MET');
  check('the ignored exit_code is reported, not silently dropped',
    (out.flags || []).includes('EVIDENCE-EXITCODE-IGNORED'),
    `flags=${JSON.stringify(out.flags)}`);
}

// EVIDENCE-EXITCODE-IGNORED is advisory: it tells a reader the number carried no
// weight, and it must not cost the record its verdict. A note that silently
// demotes is how a validator starts disagreeing with its own comments.
{
  const out = validateRecord({
    criterion_id: 'LINT-15',
    evidence: [{
      artifact: ARTIFACT, line_start: 9, line_end: 9,
      exact_quote: TRUE_QUOTE, sha256: FIXTURE_SHA, exit_code: 0,
    }],
    reasoning: 'Cited and pinned.',
    verdict: 'MET',
  }, ROOT);
  check('an advisory flag alone does not demote',
    out.verdict === 'MET' && out.flags.length === 1 && out.flags[0] === 'EVIDENCE-EXITCODE-IGNORED',
    `got ${out.verdict} flags=${JSON.stringify(out.flags)}`);
}

// An executable criterion whose citation does not survive re-checking has no
// support at all — the quote being wrong removes the only thing that settles it.
{
  const out = validateRecord({
    criterion_id: 'LINT-15',
    evidence: [{
      artifact: ARTIFACT, line_start: 9, line_end: 9,
      exact_quote: 'not what line 9 says', sha256: FIXTURE_SHA,
    }],
    reasoning: 'Misquoted.',
    verdict: 'MET',
  }, ROOT);
  check('an executable criterion with a failing citation forces UNMET',
    out.verdict === 'UNMET' && (out.flags || []).includes('EVIDENCE-UNSUPPORTED'),
    `got ${out.verdict} flags=${JSON.stringify(out.flags)}`);
}

// The control that keeps the rule scoped. A textual criterion settled by reading
// the document must NOT be made to produce a command — there is nothing to run.
// Without this the validator would demand shell commands as proof that a plan
// contains a paragraph, and every honest textual verdict would fail.
{
  const out = validateRecord(record(), ROOT);
  check('textual criterion needs no command', out.verdict === 'MET',
    `got ${out.verdict} flags=${JSON.stringify(out.flags)}`);
}

console.log('\n4b. The artifact pin is mandatory');

// The pin was checked only when a record happened to supply one, while the schema
// in plan-auditor.md did not ask for it and stage-2-design.md told the reader the
// validator "confirms its hash still matches". A record written exactly to the
// published schema therefore skipped the staleness check the documentation
// promised. Optional staleness detection is not staleness detection.
{
  const unpinned = record({
    evidence: [{ artifact: ARTIFACT, line_start: 9, line_end: 9, exact_quote: TRUE_QUOTE }],
  });
  const out = validateRecord(unpinned, ROOT);
  check('a MET citation with no sha256 forces UNMET', out.verdict === 'UNMET', `got ${out.verdict}`);
  check('the missing pin is flagged EVIDENCE-UNPINNED',
    (out.flags || []).includes('EVIDENCE-UNPINNED'),
    `flags=${JSON.stringify(out.flags)}`);
}

console.log('\n4c. Citations stay inside the audited tree');

// path.resolve accepts an absolute path or a ../ chain and walks straight out of
// rootDir. Without containment a record could satisfy MET by quoting a file the
// audit has no claim over — a sibling checkout, or anything else on the disk. The
// quote would match, the hash would match, and the verdict would mean nothing.
{
  const path2 = require('path');
  const abs = path2.resolve(ROOT, ARTIFACT);
  for (const [name, artifact] of [
    ['an absolute path inside the tree (non-portable)', abs],
    ['a parent-directory escape', '../' + ARTIFACT],
    ['a deeper escape', '../../etc/passwd'],
  ]) {
    const out = validateRecord(record({
      evidence: [{ artifact, line_start: 9, line_end: 9, exact_quote: TRUE_QUOTE, sha256: FIXTURE_SHA }],
    }), ROOT);
    check(`${name} is refused`,
      out.verdict === 'UNMET' && (out.flags || []).includes('EVIDENCE-PATH-ESCAPE'),
      `got ${out.verdict} flags=${JSON.stringify(out.flags)}`);
  }
}

console.log('\n4d. An empty quote evidences nothing');

// The hole the previous round's fix left open, and the reason this section is
// separate from the quote-fidelity tests above.
//
// Making executable criteria depend on "a citation that survives re-checking"
// closed the fabricated-exit-code route and opened a narrower one: cite a blank
// line with exact_quote: "" and the byte comparison is '' === '', which is true.
// The record passes re-checking having quoted nothing. A fabricated INFRA-*
// criterion returned MET this way with a failing exit code attached.
{
  const fs = require('fs');
  const raw = fs.readFileSync(path.join(ROOT, ARTIFACT), 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');
  let blank = -1;
  for (let i = 0; i < lines.length; i++) { if (lines[i] === '') { blank = i + 1; break; } }
  check('the fixture has a blank line to attack with', blank > 0, `blank=${blank}`);

  for (const [name, quote] of [['empty string', ''], ['whitespace only', '   '], ['a newline', '\n']]) {
    const out = validateRecord(record({
      evidence: [{ artifact: ARTIFACT, line_start: blank, line_end: blank, exact_quote: quote, sha256: FIXTURE_SHA }],
    }), ROOT);
    check(`a quote that is ${name} is refused`,
      out.verdict === 'UNMET' && (out.flags || []).includes('EVIDENCE-QUOTE-EMPTY'),
      `got ${out.verdict} flags=${JSON.stringify(out.flags)}`);
  }

  // The shape verbatim, on both executable criterion kinds. A fabricated
  // INFRA- id is included because that branch is matched by prefix, so anyone
  // can mint one.
  for (const id of ['LINT-15', 'INFRA-FAKE']) {
    const out = validateRecord({
      criterion_id: id,
      evidence: [{ artifact: ARTIFACT, line_start: blank, line_end: blank, exact_quote: '', sha256: FIXTURE_SHA, exit_code: 137 }],
      reasoning: 'Cites a blank line.',
      verdict: 'MET',
    }, ROOT);
    check(`${id} cannot be satisfied by a pinned blank line`, out.verdict === 'UNMET',
      `got ${out.verdict} flags=${JSON.stringify(out.flags)}`);
  }
}

console.log('\n4e. Containment follows the filesystem, not just the string');

// The lexical check resolves ".." and compares paths; it does not follow links.
// A symlink or Windows junction inside the tree passes it and reads a file
// outside. Skipped rather than faked where the platform will not create one —
// on Windows a symlink needs elevation or developer mode, and a test that
// silently passes because it could not run is worse than one that says so.
{
  const fs = require('fs');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-link-'));
  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 }); } catch { /* leave it */ } });

  const outside = path.join(tmp, 'outside.md');
  fs.writeFileSync(outside, 'secret\n');
  const inside = path.join(tmp, 'repo');
  fs.mkdirSync(path.join(inside, 'fixtures', 'evidence'), { recursive: true });

  let linked = false;
  try {
    fs.symlinkSync(outside, path.join(inside, 'link.md'), 'file');
    linked = true;
  } catch { /* no privilege on this host */ }

  if (!linked) {
    console.log('  - symlink escape not exercised (this host cannot create one)');
  } else {
    const out = validateRecord(record({
      evidence: [{ artifact: 'link.md', line_start: 1, line_end: 1, exact_quote: 'secret', sha256: 'x'.repeat(64) }],
    }), inside);
    check('a symlink pointing out of the tree is refused',
      (out.flags || []).includes('EVIDENCE-PATH-ESCAPE'),
      `flags=${JSON.stringify(out.flags)}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\n5. CLI contract');

// The Phase 5 flow calls this as a command and branches on its exit code, so the
// exit code is the interface. Each case below is one the gate must distinguish.
{
  const os = require('os');
  const fs = require('fs');
  const { execFileSync } = require('child_process');
  const CLI = path.join(__dirname, '..', 'plugins', 'toque', 'scripts', 'tq-evidence-validate.js');

  const run = (args) => {
    try {
      const stdout = execFileSync('node', [CLI].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { code: 0, stdout };
    } catch (err) {
      return { code: err.status, stdout: String(err.stdout || '') + String(err.stderr || '') };
    }
  };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-cli-'));
  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 }); } catch { /* leave it */ } });
  const evd = path.join(tmp, 'evidence');
  fs.mkdirSync(evd, { recursive: true });

  const good = {
    criterion_id: 'LINT-03',
    evidence: [{ artifact: ARTIFACT, line_start: 9, line_end: 9, exact_quote: TRUE_QUOTE, sha256: FIXTURE_SHA }],
    reasoning: 'Phase 2 names a reversal command.',
    verdict: 'MET',
  };
  fs.writeFileSync(path.join(evd, 'LINT-03.json'), JSON.stringify(good));

  let r = run([evd, ROOT]);
  check('all-valid evidence exits 0', r.code === 0, `code=${r.code}\n${r.stdout}`);

  // One fabricated citation must fail the whole directory. A gate that passed the
  // set because most of it was fine would let a single invented quote through.
  const bad = JSON.parse(JSON.stringify(good));
  bad.criterion_id = 'LINT-07';
  bad.evidence[0].exact_quote = 'Rollback: something approximately like this.';
  fs.writeFileSync(path.join(evd, 'LINT-07.json'), JSON.stringify(bad));

  r = run([evd, ROOT]);
  check('one invalid record exits 1', r.code === 1, `code=${r.code}\n${r.stdout}`);
  check('output names the failing criterion', /LINT-07/.test(r.stdout), r.stdout);
  check('output names the reason', /EVIDENCE-INVALID/.test(r.stdout), r.stdout);

  // THE EXIT CODE MUST AGREE WITH THE REPORT.
  //
  // A record the validator cannot read demotes NOTHING, because it never claimed
  // MET in the first place. For one release the CLI counted only demotions, so a
  // record written "verdict": "PASS" printed its own rejection on screen and then
  // exited 0 — and the caller reads the exit code, not the screen. The gate opened
  // on a corpus the validator had refused.
  //
  // Both shapes below demote zero and must still exit 1.
  fs.rmSync(path.join(evd, 'LINT-07.json'));
  const typo = JSON.parse(JSON.stringify(good));
  typo.criterion_id = 'LINT-09';
  typo.verdict = 'PASS';
  fs.writeFileSync(path.join(evd, 'LINT-09.json'), JSON.stringify(typo));
  r = run([evd, ROOT]);
  check('a verdict outside the vocabulary exits 1 despite demoting nothing',
    r.code === 1, `code=${r.code}
${r.stdout}`);
  check('the report says 0 demoted while the exit code still refuses',
    /0 demoted/.test(r.stdout) && r.code === 1, r.stdout);
  fs.rmSync(path.join(evd, 'LINT-09.json'));

  fs.writeFileSync(path.join(evd, 'LINT-10.json'), '{not json');
  r = run([evd, ROOT]);
  check('an unparseable record exits 1 despite demoting nothing',
    r.code === 1, `code=${r.code}
${r.stdout}`);
  fs.rmSync(path.join(evd, 'LINT-10.json'));

  // The control: an advisory-only flag must NOT fail the run, or every record
  // carrying a retained command would redden the gate for saying so.
  const advisory = JSON.parse(JSON.stringify(good));
  advisory.criterion_id = 'LINT-11';
  advisory.evidence[0].exit_code = 0;
  fs.writeFileSync(path.join(evd, 'LINT-11.json'), JSON.stringify(advisory));
  r = run([evd, ROOT]);
  check('an advisory-only flag still exits 0', r.code === 0, `code=${r.code}
${r.stdout}`);
  fs.rmSync(path.join(evd, 'LINT-11.json'));

  // A missing directory is the worst case, not the quiet case. Exiting 0 would
  // report "nothing wrong" for an audit that produced no evidence at all — the
  // precise shape of the PARTIAL-with-no-artifact failure this replaces.
  r = run([path.join(tmp, 'nope'), ROOT]);
  check('missing evidence directory exits 2, not 0', r.code === 2, `code=${r.code}`);

  const empty = path.join(tmp, 'empty');
  fs.mkdirSync(empty, { recursive: true });
  r = run([empty, ROOT]);
  check('empty evidence directory exits 2, not 0', r.code === 2, `code=${r.code}`);

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// The verdict vocabulary is closed.
//
// Every test above this point builds its own record, in the shape the validator
// expects, with a verdict the validator recognises. That is why the suite was
// green while the validator had never successfully read a record the auditor
// actually wrote. These tests cover the gap in both directions: unrecognised
// verdicts, and records shaped like the ones on disk.
// ---------------------------------------------------------------------------
{
  console.log('\nVerdict vocabulary:');

  for (const bogus of ['PASS', 'FAIL', 'PARTIAL', 'met', '', undefined, null, 0]) {
    const out = validateRecord(record({ verdict: bogus }), ROOT);
    check(
      `${JSON.stringify(bogus)} is refused, not exempted`,
      out.verdict === 'UNMET' && out.flags.includes('EVIDENCE-VERDICT-INVALID'),
      `got ${out.verdict} [${out.flags}]`,
    );
  }

  // The direction that matters: PASS must not inherit the "not MET, nothing to
  // check" exemption. A record claiming PASS with evidence that does not survive
  // re-checking used to print a tick.
  const lying = record({ verdict: 'PASS', evidence: [{ artifact: ARTIFACT, line_start: 9, line_end: 9, exact_quote: 'not what line 9 says' }] });
  check('PASS with false evidence does not pass', validateRecord(lying, ROOT).verdict === 'UNMET');

  for (const good of ['MET', 'UNMET', 'N_A']) {
    const out = validateRecord(record({ verdict: good, evidence: good === 'MET' ? undefined : [] }), ROOT);
    check(`${good} is accepted`, !out.flags.includes('EVIDENCE-VERDICT-INVALID'), `flags=${out.flags}`);
  }
}

// ---------------------------------------------------------------------------
// A malformed citation demotes one record; it does not abort the run.
// ---------------------------------------------------------------------------
{
  console.log('\nMalformed citations:');

  for (const [name, item] of [
    ['artifact undefined', { line_start: 1, line_end: 1, exact_quote: 'x' }],
    ['artifact null', { artifact: null, line_start: 1, line_end: 1 }],
    ['artifact empty string', { artifact: '', line_start: 1, line_end: 1 }],
    ['artifact not a string', { artifact: 42, line_start: 1, line_end: 1 }],
    ['item is null', null],
    ['item is a string', 'docs/x.md'],
  ]) {
    let out;
    try {
      out = validateRecord(record({ evidence: [item] }), ROOT);
    } catch (err) {
      check(`${name} does not throw`, false, `threw ${err.code || err.message}`);
      continue;
    }
    check(
      `${name} demotes rather than throwing`,
      out.verdict === 'UNMET' && out.flags.includes('EVIDENCE-ARTIFACT-MISSING'),
      `got ${out.verdict} [${out.flags}]`,
    );
  }

  // One bad item among good ones must not cost the good ones their evaluation.
  const mixed = record({
    evidence: [
      { artifact: ARTIFACT, line_start: 9, line_end: 9, exact_quote: TRUE_QUOTE, sha256: FIXTURE_SHA },
      { line_start: 1, line_end: 1, exact_quote: 'x' },
    ],
  });
  const out = validateRecord(mixed, ROOT);
  check('a bad item flags only itself', out.flags.length === 1 && out.flags[0] === 'EVIDENCE-ARTIFACT-MISSING', `flags=${out.flags}`);
}

// ---------------------------------------------------------------------------
// A file that parses but is not an object.
//
// `validateRecord` was already null-safe; `validateDirectory` was not. It read
// `rec.verdict` off the parsed value to report what the record claimed, so a
// file containing exactly `null` — valid JSON, no record — threw a TypeError
// and killed the whole run. That fails closed only by accident: the corpus is
// not validated at all, and the caller sees a crash instead of a verdict.
// A non-record must demote itself and let every other record still be read.
// ---------------------------------------------------------------------------
{
  console.log('\nNon-object record files:');

  const fs = require('fs');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-nonobj-'));

  // `null` first alphabetically, so a throw here also proves the later files
  // never got read.
  fs.writeFileSync(path.join(tmp, 'a-null.json'), 'null');
  fs.writeFileSync(path.join(tmp, 'b-number.json'), '3');
  fs.writeFileSync(path.join(tmp, 'c-string.json'), '"MET"');
  fs.writeFileSync(path.join(tmp, 'd-array.json'), '[{"verdict":"MET"}]');
  fs.writeFileSync(path.join(tmp, 'e-good.json'), JSON.stringify(record({ verdict: 'N_A' })));

  let result;
  try {
    result = validateDirectory(tmp, ROOT);
  } catch (err) {
    check('a record file containing `null` does not throw', false, `threw ${err.code || err.message}`);
    result = null;
  }

  if (result) {
    check('a record file containing `null` does not throw', true);
    check('every file still produced a record', result.records.length === 5, `got ${result.records.length}`);

    for (const f of ['a-null.json', 'b-number.json', 'c-string.json', 'd-array.json']) {
      const r = result.records.find((x) => x.file === f);
      check(`${f} is UNMET with EVIDENCE-VERDICT-INVALID`,
        r && r.verdict === 'UNMET' && r.flags.includes('EVIDENCE-VERDICT-INVALID'),
        r ? `verdict=${r.verdict} flags=${r.flags}` : 'no record');
    }

    // The run continues past the bad files rather than stopping at the first.
    const good = result.records.find((x) => x.file === 'e-good.json');
    check('a valid record after the bad ones is still read', good && good.verdict === 'N_A',
      good ? `verdict=${good.verdict}` : 'no record');
    check('the non-records are counted as flagged', result.flagged === 4, `flagged=${result.flagged}`);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// The regression this file existed to catch and did not.
//
// The validator read `item.artifact`; the records on disk were written with
// `path`. Nothing pointed the validator at a real record, so the mismatch
// survived every run of this suite and surfaced only when the script was invoked
// by hand — where it did not report a demotion, it threw ERR_INVALID_ARG_TYPE and
// validated nothing at all.
//
// This test asserts the property that was actually violated: real records are
// readable by the real validator. It deliberately does NOT assert that they all
// come back MET. Several cite live files the plan then edited, and demanding a
// clean run would create pressure to rewrite quotes until they matched — turning
// the evidence corpus into a record of what makes the test pass.
// ---------------------------------------------------------------------------
{
  console.log('\nReal evidence corpus:');

  const fs = require('fs');
  const REPO = path.join(__dirname, '..');
  const corpora = fs.existsSync(path.join(REPO, 'docs/plans'))
    ? fs.readdirSync(path.join(REPO, 'docs/plans'))
        .map((d) => path.join(REPO, 'docs/plans', d, 'evidence'))
        .filter((d) => fs.existsSync(d))
    : [];

  check('at least one real evidence corpus exists to test against', corpora.length > 0);

  for (const dir of corpora) {
    const rel = path.relative(REPO, dir).replace(/\\/g, '/');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

    // Field names, checked directly. The crash was a schema mismatch, so the
    // schema is what gets asserted — reaching it through the validator's output
    // would only tell us a record failed, not that it was shaped wrongly.
    const wrong = [];
    for (const f of files) {
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!VALID_VERDICTS.has(rec.verdict)) wrong.push(`${f}: verdict ${JSON.stringify(rec.verdict)}`);
      for (const e of rec.evidence || []) {
        for (const legacy of ['path', 'lines', 'quote']) {
          if (legacy in e) wrong.push(`${f}: evidence uses legacy field "${legacy}"`);
        }
        if (typeof e.artifact !== 'string') wrong.push(`${f}: evidence.artifact is not a string`);
      }
    }
    check(`${rel}: every record uses the documented schema`, wrong.length === 0, wrong.slice(0, 5).join('; '));

    let result;
    try {
      result = validateDirectory(dir, REPO);
    } catch (err) {
      check(`${rel}: validates without throwing`, false, `threw ${err.code || err.message}`);
      continue;
    }
    check(`${rel}: validates without throwing`, true);
    check(`${rel}: every record produced a verdict`, result.records.every((r) => VALID_VERDICTS.has(r.verdict)),
      result.records.filter((r) => !VALID_VERDICTS.has(r.verdict)).map((r) => r.file).join(', '));
    console.log(`    ${result.records.length} record(s) read, ${result.demoted} demoted on re-check`);
  }
}

console.log(`\n${'═'.repeat(40)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(40)}\n`);
process.exit(fail > 0 ? 1 : 0);
