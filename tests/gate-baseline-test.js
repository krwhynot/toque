#!/usr/bin/env node
/**
 * Tests for scripts/tq-gate-baseline.js  (decision D10, stress run 4 R4-01)
 *
 * The question this script exists to answer mechanically: when an element that
 * was passing now fails, is that a REGRESSION the revision caused or AUDITOR
 * VARIANCE a fresh reader introduced? D10 says it turns on whether a line the
 * element cites lies inside the diff. R4-01 says the prose could not answer it
 * for coverage, scenario and concern rows, because those have no evidence
 * record — and that unanswered referent decided the one criterion standing
 * between a spec and the gate's first observed PASS.
 *
 * Every test below is falsifiable against that: several assert that the SAME
 * flip classifies differently depending only on which line it cites.
 *
 * Run with: node tests/gate-baseline-test.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const gb = require('../plugins/toque/scripts/tq-gate-baseline.js');
const validator = require('../plugins/toque/scripts/tq-evidence-validate.js');

let pass = 0;
let fail = 0;
let skipped = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); fail++; }
}

// A check the host cannot run is NOT a passing check. Three link-containment
// assertions used to be written `check(name, true)` when symlink creation was
// unavailable, so a host with no link support reported the same green total as
// one that had actually exercised the guard — coverage counted without being
// obtained. Skips are counted and printed separately, and the final line says
// how many there were so a suite that silently stopped testing something is
// visible rather than reassuring.
function skip(name, why) {
  console.log(`  ~ ${name} — SKIPPED: ${why}`);
  skipped++;
}

const tmpRoots = [];
function tmpdir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-gb-'));
  tmpRoots.push(d);
  return d;
}

const DOC_V1 = [
  'line1',
  'line2 unchanged',
  'line3',
  'Phase 2: old body',
  'old detail',
  'line6',
  'line7',
].join('\n') + '\n';

const DOC_V2 = [
  'line1',
  'line2 unchanged',
  'line3',
  'Phase 2: NEW body',
  'new detail',
  'line6',
  'line7',
].join('\n') + '\n';

function baseline(over) {
  return Object.assign({
    run_number: 1,
    date: '2026-09-07',
    lint_results: {},
    coverage_items: [],
    scenario_statuses: [],
    concern_statuses: [],
  }, over || {});
}

// ---------------------------------------------------------------------------
console.log('\n1. The diff — which current lines the revision changed');
// ---------------------------------------------------------------------------

{
  const d = gb.changedLines(DOC_V1, DOC_V2);
  check('a rewritten line is inside the diff', d.touched.has(4) && d.touched.has(5),
    [...d.touched].join(','));
  check('lines the revision did not touch are outside it',
    !d.touched.has(2) && !d.touched.has(7), [...d.touched].join(','));
  check('the coarse fallback did not fire on a seven-line document', d.coarse === false);
}

{
  const d = gb.changedLines(DOC_V1, DOC_V1);
  check('two identical documents produce an empty diff', d.touched.size === 0, `${d.touched.size}`);
}

{
  // A pure deletion changes no current line by itself. Marking only insertions
  // would let a revision that deletes the rollback line out of a phase read as
  // "nothing changed here", and every flip it caused would be exempted as
  // variance — the exemption swallowing the regression it was carved around.
  const before = 'a\nb\nDELETED\nc\n';
  const after = 'a\nb\nc\n';
  const d = gb.changedLines(before, after);
  check('a deletion marks the current lines on both sides of the join',
    d.touched.has(2) && d.touched.has(3), [...d.touched].join(','));
}

{
  const before = 'a\nb\n';
  const after = 'a\nINSERTED\nb\n';
  const d = gb.changedLines(before, after);
  check('an insertion marks the inserted line and not its neighbours',
    d.touched.has(2) && !d.touched.has(1) && !d.touched.has(3), [...d.touched].join(','));
}

// ---------------------------------------------------------------------------
console.log('\n2. The status vocabulary — three spellings, one ladder');
// ---------------------------------------------------------------------------

{
  check('the baseline schema vocabulary maps',
    gb.normalizeStatus('covered') === 'pass' && gb.normalizeStatus('gap') === 'fail'
    && gb.normalizeStatus('partial') === 'partial');
  check('the auditor matrix vocabulary maps',
    gb.normalizeStatus('OK') === 'pass' && gb.normalizeStatus('WARNING') === 'partial'
    && gb.normalizeStatus('GAP') === 'fail');
  check('the lint table vocabulary maps',
    gb.normalizeStatus('PASS') === 'pass' && gb.normalizeStatus('UNMET') === 'fail'
    && gb.normalizeStatus('N_A') === 'n_a');
  // R4-06: the two vocabularies were unmapped and the caller mapped them by hand.
  // A token outside all three must be refused, not guessed — guessing "pass" turns
  // a real regression into an unchanged row and nothing on the page says so.
  let threw = false;
  try { gb.normalizeStatus('mostly-ok'); } catch (err) { threw = true; }
  check('an unmapped status is refused rather than guessed', threw);
  check('ok-excluded ranks with pass, so an accepted exclusion is not a degradation',
    gb.normalizeStatus('ok-excluded') === 'pass');
  check('n_a has no rank on the ladder', gb.RANK.n_a === undefined);
}

{
  check('a bare pair of integers is one range', JSON.stringify(gb.normalizeLines([100, 103])) === '[[100,103]]');
  check('a list of pairs stays a list', JSON.stringify(gb.normalizeLines([[1, 2], [9, 9]])) === '[[1,2],[9,9]]');
  check('a single number is a one-line range', JSON.stringify(gb.normalizeLines(496)) === '[[496,496]]');
  check('a "a-b" string parses', JSON.stringify(gb.normalizeLines('12-18')) === '[[12,18]]');
  check('nothing means no lines', gb.normalizeLines(undefined).length === 0);
  let threw = false;
  try { gb.normalizeLines('not-a-range'); } catch (err) { threw = true; }
  check('a malformed range throws rather than becoming "no lines"', threw);
}

// ---------------------------------------------------------------------------
console.log('\n3. R4-01 — a matrix row has a line source, and it decides the class');
// ---------------------------------------------------------------------------

// This is the test that would have settled stress run 4's s1. A cross-cutting
// concern row flipped ok -> gap. It has no evidence record. Under one reading of
// the prose it was a regression and the gate stayed shut at 21 of 22; under the
// other it was variance and the gate opened at 22 of 22. Here the row names its
// lines and the answer follows from them.
{
  const prev = baseline({ concern_statuses: [{ name: 'API contract', status: 'ok' }] });
  const diff = gb.changedLines(DOC_V1, DOC_V2);

  const onChanged = baseline({
    concern_statuses: [{
      name: 'API contract', status: 'gap', lines: [[4, 5]],
      line_source: 'audit.md Cross-Cutting Concerns',
    }],
  });
  const a = gb.compare(prev, onChanged, diff, {});
  check('a concern row citing a line the revision changed is a REGRESSION',
    a.rows[0].klass === 'REGRESSION', a.rows[0].klass);
  check('and LINT-14 is UNMET', a.verdict === 'UNMET', a.verdict);

  const onUnchanged = baseline({
    concern_statuses: [{
      name: 'API contract', status: 'gap', lines: [[2, 2]],
      line_source: 'audit.md Cross-Cutting Concerns',
    }],
  });
  const b = gb.compare(prev, onUnchanged, diff, {});
  check('THE SAME flip citing an unchanged line is AUDITOR VARIANCE',
    b.rows[0].klass === 'VARIANCE', b.rows[0].klass);
  check('and LINT-14 is MET — the element still fails its own criterion',
    b.verdict === 'MET', b.verdict);
  check('the variance row still records the failing status',
    b.rows[0].to === 'fail', b.rows[0].to);
}

{
  // The same discrimination for the other two record-less element classes.
  const diff = gb.changedLines(DOC_V1, DOC_V2);
  const prev = baseline({
    coverage_items: [{ name: 'Auth flow', status: 'covered' }],
    scenario_statuses: [{ id: 1, name: 'Happy path', status: 'covered' }],
  });
  const cur = baseline({
    coverage_items: [{ name: 'Auth flow', status: 'gap', lines: [[4, 4]], line_source: 'audit.md Coverage Matrix' }],
    scenario_statuses: [{ id: 1, name: 'Happy path', status: 'GAP', lines: [[7, 7]], line_source: 'audit.md Scenario Matrix' }],
  });
  const c = gb.compare(prev, cur, diff, {});
  const cov = c.rows.find((r) => r.kind === 'coverage');
  const scn = c.rows.find((r) => r.kind === 'scenario');
  check('a coverage row citing changed text is a REGRESSION', cov.klass === 'REGRESSION', cov.klass);
  check('a scenario row citing unchanged text is VARIANCE', scn.klass === 'VARIANCE', scn.klass);
  check('every compared row names where its lines came from',
    c.rows.every((r) => r.klass === 'UNCHANGED' || r.line_source));
}

{
  // The honest failure. An element that flips and names no lines cannot be
  // scoped, and the gate's own standing rule is that the exemption is never
  // applied on a guess — so it books as a regression AND says why on the row.
  const diff = gb.changedLines(DOC_V1, DOC_V2);
  const prev = baseline({ concern_statuses: [{ name: 'API contract', status: 'ok' }] });
  const cur = baseline({ concern_statuses: [{ name: 'API contract', status: 'gap' }] });
  const c = gb.compare(prev, cur, diff, {});
  check('a flip with no line source is a REGRESSION, not a silent exemption',
    c.rows[0].klass === 'REGRESSION', c.rows[0].klass);
  check('and it is marked unscoped so the reader knows which route it took',
    c.rows[0].unscoped === true && c.counts.unscoped === 1);
  check('the row states the reason it could not be scoped',
    /no line source/.test(c.rows[0].scope_reason), c.rows[0].scope_reason);
}

// ---------------------------------------------------------------------------
console.log('\n4. The three cases where no diff is available');
// ---------------------------------------------------------------------------

{
  const prev = baseline({ lint_results: { 'LINT-03': 'pass' } });
  const cur = baseline({ lint_results: { 'LINT-03': { status: 'fail', lines: [[2, 2]], line_source: 'evidence/LINT-03.json' } } });
  const c = gb.compare(prev, cur, null, {});
  check('with no previous document, every flip is a regression',
    c.rows[0].klass === 'REGRESSION' && c.verdict === 'UNMET', c.rows[0].klass);
  check('and it is marked unscoped', c.counts.unscoped === 1);
}

{
  // The byte-identical exemption, which predates D10 and is unchanged: an empty
  // diff means no line can be inside it, so every flip is variance and LINT-14
  // is N_A rather than MET — nothing about the document was tested.
  const prev = baseline({ lint_results: { 'LINT-03': 'pass' } });
  const cur = baseline({ lint_results: { 'LINT-03': { status: 'fail', lines: [[2, 2]], line_source: 'evidence/LINT-03.json' } } });
  const emptyDiff = { touched: new Set(), coarse: false, changed: 0, total: 7 };
  const c = gb.compare(prev, cur, emptyDiff, { docUnchanged: true });
  check('an unchanged document makes every flip VARIANCE', c.rows[0].klass === 'VARIANCE', c.rows[0].klass);
  check('and LINT-14 N_A, not MET', c.verdict === 'N_A', c.verdict);
}

{
  const prev = baseline({ lint_results: { 'LINT-03': 'pass' } });
  const cur = baseline({ lint_results: { 'LINT-03': 'pass' } });
  const c = gb.compare(prev, cur, gb.changedLines(DOC_V1, DOC_V2), {});
  check('no flips at all is LINT-14 MET', c.verdict === 'MET' && c.counts.regressions === 0);
}

// ---------------------------------------------------------------------------
console.log('\n5. Transitions that are not regressions');
// ---------------------------------------------------------------------------

{
  const diff = gb.changedLines(DOC_V1, DOC_V2);

  // R4-06: covered -> partial and ok -> warn had no category and one executor
  // invented one. D10 speaks about an element that WAS passing and NOW fails;
  // partial is neither, so a degradation is reported and does not fail LINT-14.
  const degraded = gb.compare(
    baseline({ coverage_items: [{ name: 'Auth flow', status: 'covered' }] }),
    baseline({ coverage_items: [{ name: 'Auth flow', status: 'partial', lines: [[4, 4]], line_source: 'audit.md Coverage Matrix' }] }),
    diff, {},
  );
  check('covered -> partial on changed text is a DEGRADATION',
    degraded.rows[0].klass === 'DEGRADATION', degraded.rows[0].klass);
  check('a degradation does not fail LINT-14', degraded.verdict === 'MET', degraded.verdict);

  const improved = gb.compare(
    baseline({ lint_results: { 'LINT-03': 'fail' } }),
    baseline({ lint_results: { 'LINT-03': 'pass' } }),
    diff, {},
  );
  check('gap -> covered is an IMPROVEMENT', improved.rows[0].klass === 'IMPROVEMENT', improved.rows[0].klass);

  // The trap the registry already records: a vacuous rule written N_A on one run
  // and PASS on the next was read as a regression on a document nobody changed.
  // N_A is off the ladder entirely, in both directions.
  const naToFail = gb.compare(
    baseline({ lint_results: { 'LINT-11': 'n_a' } }),
    baseline({ lint_results: { 'LINT-11': { status: 'fail', lines: [[4, 4]], line_source: 'evidence/LINT-11.json' } } }),
    diff, {},
  );
  check('n_a -> fail is NOT-COMPARABLE, never a regression',
    naToFail.rows[0].klass === 'NOT-COMPARABLE' && naToFail.verdict === 'MET', naToFail.rows[0].klass);

  const passToNa = gb.compare(
    baseline({ lint_results: { 'LINT-11': 'pass' } }),
    baseline({ lint_results: { 'LINT-11': 'n_a' } }),
    diff, {},
  );
  check('pass -> n_a is NOT-COMPARABLE too', passToNa.rows[0].klass === 'NOT-COMPARABLE', passToNa.rows[0].klass);
}

{
  // Stress run 4's one bookkeeping error: two RENAMED rows were booked as new
  // items and the rename went unseen because nothing reported the old names
  // disappearing. A NEW beside a DROPPED is a rename a reader can spot.
  const diff = gb.changedLines(DOC_V1, DOC_V2);
  const c = gb.compare(
    baseline({ concern_statuses: [{ name: 'API contract', status: 'ok' }] }),
    baseline({ concern_statuses: [{ name: 'API contract (v2)', status: 'ok', lines: [[2, 2]], line_source: 'audit.md Cross-Cutting Concerns' }] }),
    diff, {},
  );
  check('a renamed row reports as one NEW and one DROPPED',
    c.counts.new_items === 1 && c.counts.dropped === 1,
    `new=${c.counts.new_items} dropped=${c.counts.dropped}`);
  check('neither half is a regression', c.counts.regressions === 0);
}

{
  // LINT-14 is the caller's verdict ABOUT this comparison. Comparing it compares
  // the gate's opinion of the last iteration with its opinion of this one — the
  // auditor writes N_A every time and the caller overwrites it, so it would
  // report NOT-COMPARABLE noise on every single iteration.
  const c = gb.compare(
    baseline({ lint_results: { 'LINT-14': 'n_a', 'LINT-03': 'pass' } }),
    baseline({ lint_results: { 'LINT-14': 'fail', 'LINT-03': 'pass' } }),
    gb.changedLines(DOC_V1, DOC_V2), {},
  );
  check('LINT-14 is excluded from its own comparison',
    c.rows.every((r) => r.id !== 'LINT-14'), c.rows.map((r) => r.id).join(','));
}

// ---------------------------------------------------------------------------
console.log('\n6. Lines filled from evidence records');
// ---------------------------------------------------------------------------

{
  const root = tmpdir();
  fs.mkdirSync(path.join(root, 'evidence'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'spec.md'), DOC_V2, 'utf8');

  fs.writeFileSync(path.join(root, 'evidence', 'LINT-03.json'), JSON.stringify({
    criterion_id: 'LINT-03',
    evidence: [
      { artifact: 'docs/spec.md', line_start: 4, line_end: 5, exact_quote: 'x', sha256: 'y' },
      { artifact: 'scripts/test-db.sh', line_start: 900, line_end: 901, exact_quote: 'x', sha256: 'y' },
    ],
    reasoning: 'r',
    verdict: 'UNMET',
  }), 'utf8');

  const els = gb.readElements(baseline({ lint_results: { 'LINT-03': 'fail' } }), 'cur');
  const filled = gb.fillFromEvidence(els, path.join(root, 'evidence'), 'docs/spec.md');
  const el = els.get('lint:LINT-03');
  check('a lint element fills its lines from its evidence record', filled.includes('LINT-03'));
  check('and names the record as the line source',
    el.line_source === 'evidence/LINT-03.json', el.line_source);
  // A record may cite a test file to support its verdict. A change to THAT file
  // is not a change to the document the baseline diffs, so scoping a flip to it
  // would let a regression hide behind an edit the diff never covered.
  check('citations pointing at other files are not used as document lines',
    JSON.stringify(el.lines) === '[[4,5]]', JSON.stringify(el.lines));
}

// ---------------------------------------------------------------------------
console.log('\n7. The section, the pin, and the two appends that follow it');
// ---------------------------------------------------------------------------

{
  const root = tmpdir();
  const gate = path.join(root, 'gate');
  fs.mkdirSync(path.join(gate, 'evidence'), { recursive: true });
  const auditPath = path.join(gate, 'audit.md');
  fs.writeFileSync(auditPath, '# Audit\n\n## Executive Summary\n\nStuff.\n', 'utf8');

  const cmp = gb.compare(
    baseline({ concern_statuses: [{ name: 'API contract', status: 'ok' }] }),
    baseline({ concern_statuses: [{ name: 'API contract', status: 'gap', lines: [[2, 2]], line_source: 'audit.md Cross-Cutting Concerns' }] }),
    gb.changedLines(DOC_V1, DOC_V2), {},
  );
  const section = gb.renderSection(cmp, { doc_file: 'docs/spec.md', doc_sha256: 'abc' });

  check('the section carries the heading the LINT-14 record cites',
    section.startsWith(gb.SECTION_HEADING));
  check('the section carries the report line in the published wording',
    /Baseline comparison: 0 regressions, 0 improvements, 0 new items, 1 auditor-variance flips/.test(section),
    section.split('\n').find((l) => l.startsWith('Baseline comparison:')));
  check('the section names the line source of every compared element',
    /audit\.md Cross-Cutting Concerns/.test(section));

  const at = gb.writeSection(auditPath, section);
  check('the section lands in audit.md', at !== null && at.start > 1);

  // Re-running the sequence must not leave two sections with one heading — the
  // pin would then cite whichever locateSection found first.
  gb.writeSection(auditPath, section);
  const headings = fs.readFileSync(auditPath, 'utf8').split('\n')
    .filter((l) => l.trim() === gb.SECTION_HEADING).length;
  check('writing it twice replaces rather than duplicates', headings === 1, `${headings}`);

  const pinned = gb.pin(auditPath, path.join(gate, 'evidence'), root, cmp.verdict, cmp.justification);
  check('the pin cites a repo-relative path with forward slashes',
    pinned.artifact === 'gate/audit.md', pinned.artifact);

  const rec = JSON.parse(fs.readFileSync(path.join(gate, 'evidence', 'LINT-14.json'), 'utf8'));
  check('the record opens with criterion_id, as the schema requires',
    Object.keys(rec)[0] === 'criterion_id', Object.keys(rec).join(','));
  check('the record carries the caller-decided verdict', rec.verdict === 'MET', rec.verdict);

  // The pin has to survive the validator, or it is a record that fails the check
  // it exists to pass.
  let out = validator.validateRecord(rec, root);
  check('the freshly written pin passes the evidence validator',
    out.verdict === 'MET' && out.flags.length === 0, JSON.stringify(out));

  // Two later steps append to audit.md by design. Five of six stress-run
  // executors hit the EVIDENCE-STALE this produces and worked around it by hand.
  fs.appendFileSync(auditPath, '\n## Revision History\n| v1 | none |\n', 'utf8');
  out = validator.validateRecord(
    JSON.parse(fs.readFileSync(path.join(gate, 'evidence', 'LINT-14.json'), 'utf8')), root,
  );
  check('an append to audit.md makes the pin stale — the failure repin exists for',
    out.flags.includes('EVIDENCE-STALE'), JSON.stringify(out.flags));

  gb.pin(auditPath, path.join(gate, 'evidence'), root, cmp.verdict, cmp.justification);
  out = validator.validateRecord(
    JSON.parse(fs.readFileSync(path.join(gate, 'evidence', 'LINT-14.json'), 'utf8')), root,
  );
  check('re-pinning restores it without re-auditing anything',
    out.verdict === 'MET' && out.flags.length === 0, JSON.stringify(out));

  // The cited range must still be the section after the append, not the whole
  // tail of the file.
  const after = gb.locateSection(fs.readFileSync(auditPath, 'utf8'));
  const lines = fs.readFileSync(auditPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
  check('the cited range stops before the appended section',
    !lines.slice(after.start - 1, after.end).some((l) => /^## Revision History/.test(l)));
}

{
  // Pinning to a file outside the root is refused. The validator would reject the
  // record anyway with EVIDENCE-PATH-ESCAPE; refusing here means the caller finds
  // out at the step that made the mistake.
  const root = tmpdir();
  const other = tmpdir();
  const auditPath = path.join(other, 'audit.md');
  fs.writeFileSync(auditPath, `x\n\n${gb.SECTION_HEADING}\n\nbody\n`, 'utf8');
  let threw = false;
  try { gb.pin(auditPath, path.join(root, 'evidence'), root, 'MET', 'r'); }
  catch (err) { threw = /outside the root/.test(err.message); }
  check('pinning an audit.md outside --root is refused', threw);
}


// ===========================================================================
// Section 8 onward: the defects an external review (Codex CLI) and a self-pass
// found after the first commit. Every one of these was REPRODUCED before it was
// fixed, and each test below is the reproduction.
//
// Eight of them shared a direction: they turned a real regression into an
// exempted "auditor variance", or skipped the comparison and exited 0. That is
// the failure this whole script exists to prevent, so the leniency cases come
// first.
// ===========================================================================

console.log('\n8. Leniency — the class that lets a regression through');

{
  // Reproduced: `lines: [[900,905]]` against a four-line document matched no
  // touched line, fell through to "every line cited is unchanged", and earned
  // the exemption. A stale line number copied from the PREVIOUS version of the
  // document is the likeliest way to make one, which puts this failure exactly
  // where the document changed most.
  const diff = gb.changedLines(DOC_V1, DOC_V2);
  const c = gb.compare(
    baseline({ lint_results: { 'LINT-05': 'pass' } }),
    baseline({ lint_results: { 'LINT-05': { status: 'fail', lines: [[900, 905]], line_source: 'e' } } }),
    diff, {},
  );
  check('a citation past the end of the document does NOT earn the exemption',
    c.rows[0].klass === 'REGRESSION', c.rows[0].klass);
  // 8, not 7: splitting a newline-terminated file yields a trailing empty
  // element, and `total` deliberately equals that split length because
  // tq-evidence-validate.js bounds its own ranges the same way. A stricter
  // count here would reject citations the validator accepts, and the pin this
  // script writes has to survive that validator.
  check('and the row says the range does not exist',
    /cites line 905 of a 8-line document/.test(c.rows[0].scope_reason), c.rows[0].scope_reason);
  check('LINT-14 is UNMET, not MET', c.verdict === 'UNMET', c.verdict);
}

{
  // Reproduced: auditing docs/spec.md, a record citing only vendor/spec.md had
  // its line 1 imported as a coordinate in docs/spec.md. Two files sharing a
  // name are two files.
  const root = tmpdir();
  fs.mkdirSync(path.join(root, 'evidence'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'spec.md'), DOC_V2, 'utf8');
  fs.writeFileSync(path.join(root, 'evidence', 'LINT-05.json'), JSON.stringify({
    criterion_id: 'LINT-05',
    evidence: [{ artifact: 'vendor/spec.md', line_start: 1, line_end: 1, exact_quote: 'x', sha256: 'y' }],
    reasoning: 'r',
    verdict: 'UNMET',
  }), 'utf8');

  const els = gb.readElements(baseline({ lint_results: { 'LINT-05': 'fail' } }), 'cur');
  const filled = gb.fillFromEvidence(els, path.join(root, 'evidence'), 'docs/spec.md');
  check('a same-basename citation in another directory is NOT used',
    filled.length === 0 && els.get('lint:LINT-05').lines.length === 0,
    JSON.stringify(filled));
}

{
  // Reproduced: swapping two adjacent blocks left the relocated lines outside
  // the touched set, so a concern citing a moved line was exempted on text the
  // revision plainly moved. LCS is free to represent a swap as "the smaller
  // block moved" and leave the larger one matched.
  //
  // Seams alone are not enough, and this file previously asserted that they were
  // — that a moved block's INTERIOR is variance, on the argument that `cj - pi`
  // is identically (insertions above - deletions above) and so no rule could
  // recover it without marking the whole document. The identity is true; the
  // conclusion was wrong, and the assertion built on it was a test bent around a
  // defect. The offset is not the only thing the alignment holds: a maximal
  // unmatched run on one side whose CONTENT equals a maximal unmatched run on
  // the other is a relocated block, and the lines it crossed follow from its two
  // positions. Every line of the moved block is now inside the diff.
  const before = 'header\nA\nB\nC\nD\nx\ny\nfooter\n';
  const after = 'header\nx\ny\nA\nB\nC\nD\nfooter\n';
  const d = gb.changedLines(before, after);
  check('every line of a moved block is inside the diff, interior included',
    [4, 5, 6, 7].every((l) => d.touched.has(l)), [...d.touched].sort((a, b) => a - b).join(','));

  const cite = (l) => gb.compare(
    baseline({ concern_statuses: [{ name: 'ordering', status: 'ok' }] }),
    baseline({ concern_statuses: [{ name: 'ordering', status: 'gap', lines: [[l, l]], line_source: 'audit.md' }] }),
    d, {},
  ).rows[0].klass;

  check('a concern citing a moved block\'s seam is a REGRESSION, not variance',
    cite(4) === 'REGRESSION', cite(4));
  check('a concern citing a moved block\'s INTERIOR is also a REGRESSION',
    cite(5) === 'REGRESSION', cite(5));
  check('and a line the move did not cross is still variance',
    cite(1) === 'VARIANCE', cite(1));
}

{
  // The regression seam-only marking let through, reproduced by the fourth
  // review. Moving the commit phase above the validation phase is exactly what a
  // concern reading "authorization happens before commit" is about, and the
  // cited validation line's own text is untouched — it sits in the interior of
  // the run the commit block passed over. Seam marking returned VARIANCE, MET,
  // exit 0 on it.
  const prev = [
    '# Payment capture', '## Ordered steps', '## Validate request',
    'Check the idempotency key.', 'Reject invalid signatures.', 'Verify available balance.',
    '## Commit payment', 'Write the ledger entry.', 'Send the receipt.', '## End',
  ].join('\n') + '\n';
  const cur = [
    '# Payment capture', '## Ordered steps', '## Commit payment',
    'Write the ledger entry.', 'Send the receipt.', '## Validate request',
    'Check the idempotency key.', 'Reject invalid signatures.', 'Verify available balance.',
    '## End',
  ].join('\n') + '\n';
  const d = gb.changedLines(prev, cur);
  check('a reordered phase puts the phase it crossed inside the diff',
    d.touched.has(8), [...d.touched].sort((a, b) => a - b).join(','));

  const c = gb.compare(
    baseline({ concern_statuses: [{ name: 'Authorization before commit', status: 'ok' }] }),
    baseline({
      concern_statuses: [{
        name: 'Authorization before commit', status: 'gap',
        lines: [[8, 8]], line_source: 'audit.md concern table',
      }],
    }),
    d, {},
  );
  check('and the concern about that ordering is a REGRESSION, not variance',
    c.rows[0].klass === 'REGRESSION', c.rows[0].klass);
  check('so LINT-14 is UNMET', c.verdict === 'UNMET', c.verdict);
}

{
  // The move detector must not fire on an ordinary revision. Its unmatched runs
  // do not pair by content, so nothing is crossed and the seam rule stands alone.
  const req = [];
  for (let i = 1; i <= 60; i++) req.push(`REQ-${i}: requirement text ${i}`);
  const join = (a) => `${a.join('\n')}\n`;
  const bothEnds = gb.changedLines(join(req), join(['NEW TOP', ...req, 'NEW BOTTOM']));
  check('an ordinary two-ended revision detects no move and stays at the seams',
    bothEnds.touched.size <= 8, `${bothEnds.touched.size}/${bothEnds.total}`);

  // Content equality is the pairing rule. The same shape — a three-line block
  // leaving position 2 and arriving at position 16 — is a MOVE when the block
  // arrives unchanged and an ordinary delete-plus-insert when it arrives
  // rewritten. The document is long enough that the twelve lines between the two
  // positions are marked only by the move detector, so the two cases separate.
  const body = [];
  for (let i = 1; i <= 12; i++) body.push(`MIDDLE-${i}`);
  const block = ['BLOCK a', 'BLOCK b', 'BLOCK c'];
  const before = ['top', ...block, ...body, 'tail'].join('\n') + '\n';

  const movedAway = ['top', ...body, ...block, 'tail'].join('\n') + '\n';
  const moved = gb.changedLines(before, movedAway);
  check('a block that arrives unchanged is a move and marks what it crossed',
    body.every((_, k) => moved.touched.has(2 + k)),
    [...moved.touched].sort((x, y) => x - y).join(','));

  const rewritten = ['top', ...body, 'BLOCK a X', 'BLOCK b Y', 'BLOCK c Z', 'tail'].join('\n') + '\n';
  const rw = gb.changedLines(before, rewritten);
  check('the same shape with the block REWRITTEN is not a move',
    !rw.touched.has(5) && !rw.touched.has(9),
    [...rw.touched].sort((x, y) => x - y).join(','));
}

{
  // Reproduced, and the reason the rule above marks seams rather than every
  // displaced line. Marking all of them was justified as "over-reporting can
  // only turn a variance into a regression" — but it does not stop at one
  // section. Trimming the common prefix and suffix protects a document edited at
  // ONE end; a revision note near the front plus a review note near the back
  // defeats both trims, and every line between them is displaced by one.
  //
  // Measured on the blanket rule: 302 of 303. That is D10's exemption switched
  // off for the whole document by an ordinary two-place edit — the same outcome
  // as the bug the displacement rule was written to fix, reached from the other
  // side.
  const req = [];
  for (let i = 1; i <= 300; i++) req.push(`REQ-${i}: requirement text ${i}`);
  const join = (a) => `${a.join('\n')}\n`;

  const oneEnd = gb.changedLines(join(req), join(['NEW TOP', ...req]));
  check('an insertion at one end marks one line',
    oneEnd.touched.size === 1, `${oneEnd.touched.size}/${oneEnd.total}`);

  const bothEnds = gb.changedLines(join(req), join(['NEW TOP', ...req, 'NEW BOTTOM']));
  check('an edit at BOTH ends still marks only the seams, not the document',
    bothEnds.touched.size <= 8, `${bothEnds.touched.size}/${bothEnds.total}`);

  const spread = req.slice();
  spread[49] = 'REQ-50: EDITED';
  spread.splice(59, 0, 'INSERTED');
  spread[250] = 'REQ-250: EDITED';
  const three = gb.changedLines(join(req), join(spread));
  check('three scattered edits mark a handful of lines, not two thirds of the file',
    three.touched.size <= 12, `${three.touched.size}/${three.total}`);
}

{
  // Reproduced: on identical evidence citing an UNCHANGED line, omitting the
  // field gave MET and spelling out `lines: []` gave UNMET. `[]` is truthy, so
  // the filled evidence was thrown away — the natural spelling for "I have no
  // lines" was the one that behaved worst.
  const els = gb.readElements(
    baseline({ lint_results: { 'LINT-05': { status: 'fail', lines: [] } } }), 'cur',
  );
  check('an explicit empty lines array reads as no lines, not as a value',
    els.get('lint:LINT-05').lines.length === 0);
  // The write-back path is exercised through the CLI in section 11.
}

{
  // Reproduced: passing the CURRENT document as both arguments produced an
  // empty diff, so every flip became variance and LINT-14 came back MET. The
  // baseline records doc_sha256 and it was read only for the byte-identical
  // exemption, never to authenticate the file the caller supplied.
  //
  // The guard lives in cmdCompare, so this asserts the ingredient: the hash of
  // a wrong document differs from the baseline's recorded one.
  check('a wrong previous document is detectable from the recorded hash',
    gb.hashContent(DOC_V2) !== gb.hashContent(DOC_V1));
}

{
  // Reproduced: a failing coverage or concern row whose CLASS has no history
  // classified as NEW before its status was examined, and NEW does not fail
  // LINT-14. So the baseline that records least produces the most reassuring
  // verdict. This is R4-01 one level up — not rows without line sources, rows
  // without any prior record at all.
  const diff = gb.changedLines(DOC_V1, DOC_V2);
  const c = gb.compare(
    baseline({ lint_results: { 'LINT-01': 'pass' } }),
    baseline({
      lint_results: { 'LINT-01': 'pass' },
      concern_statuses: [{ name: 'API contract', status: 'gap', lines: [[4, 4]], line_source: 'audit.md' }],
    }),
    diff, {},
  );
  const row = c.rows.find((r) => r.kind === 'concern');
  check('a failing row whose whole class has no history is UNCOMPARED, not NEW',
    row.klass === 'UNCOMPARED', row.klass);
  check('and LINT-14 is N_A — a comparison missing a class cannot report "no regressions"',
    c.verdict === 'N_A', c.verdict);
  check('the uncompared class is named for the reader',
    c.uncompared.length === 1 && c.uncompared[0].kind === 'concern',
    JSON.stringify(c.uncompared));
  check('the section says the class was not compared',
    /concern elements were NOT COMPARED/.test(gb.renderSection(c, {})));
}

{
  // A class present on BOTH sides still compares normally — the guard must not
  // fire on an ordinary run, or every comparison becomes N_A.
  const diff = gb.changedLines(DOC_V1, DOC_V2);
  const c = gb.compare(
    baseline({ concern_statuses: [{ name: 'API contract', status: 'ok' }] }),
    baseline({ concern_statuses: [{ name: 'API contract', status: 'gap', lines: [[4, 4]], line_source: 'audit.md' }] }),
    diff, {},
  );
  check('a class present on both sides compares as before',
    c.rows[0].klass === 'REGRESSION' && c.verdict === 'UNMET', c.rows[0].klass);
}

// ---------------------------------------------------------------------------
console.log('\n9. Sections, fences and headings');
// ---------------------------------------------------------------------------

{
  // Reproduced: the gate's own instructions quote `## Baseline comparison` in a
  // fenced block, so an auditor reproducing them plants a decoy. locateSection
  // selected the decoy and writeSection wrote the real section INSIDE the
  // fence, orphaning its closing backticks and deleting the prose after it.
  const audit = [
    '# Audit', '',
    '## Method', '',
    'The caller appends:', '',
    '```markdown',
    '## Baseline comparison',
    '(the section goes here)',
    '```', '',
    '## Verdicts', '',
    '| id | v |',
  ].join('\n') + '\n';
  check('a heading inside a fence is not the section', gb.locateSection(audit) === null);

  const fenced = gb.fencedLines(audit.split('\n'));
  check('fencedLines marks the fenced region', fenced[6] && fenced[7] && fenced[9]);
  check('and leaves real headings alone', !fenced[2] && !fenced[11]);
}

{
  // Reproduced against a real plan: `## Baseline comparison (caller, run 9 →
  // run 10)` did not match, so `record` appended a SECOND section and left the
  // first asserting the previous verdict — two contradictory comparisons under
  // one heading name, with the pin on the newer.
  const audit = '# A\n\n## Baseline comparison (caller, run 9 → run 10)\n\nold body\n\n## Next\n\nx\n';
  const at = gb.locateSection(audit);
  check('a suffixed heading is the same section', at !== null && at.start === 3, JSON.stringify(at));
  check('and its range stops at the next heading', at && at.end === 5, JSON.stringify(at));
}

{
  // Reproduced: writing the same section twice grew the file by one byte each
  // time and changed its hash, so an idempotent `record` looked like a real
  // edit and shifted every section below it.
  const root = tmpdir();
  const auditPath = path.join(root, 'audit.md');
  fs.writeFileSync(auditPath, '# A\n\n## S\n\nx\n', 'utf8');
  const sec = '## Baseline comparison\n\nBODY\n';
  gb.writeSection(auditPath, sec);
  const h1 = gb.hashContent(fs.readFileSync(auditPath, 'utf8'));
  gb.writeSection(auditPath, sec);
  const h2 = gb.hashContent(fs.readFileSync(auditPath, 'utf8'));
  gb.writeSection(auditPath, sec);
  const h3 = gb.hashContent(fs.readFileSync(auditPath, 'utf8'));
  check('rewriting the same section is byte-stable', h1 === h2 && h2 === h3);

  // And a following section survives the rewrite intact.
  fs.appendFileSync(auditPath, '\n## Revision History\n| v1 |\n', 'utf8');
  const beforeText = fs.readFileSync(auditPath, 'utf8');
  gb.writeSection(auditPath, sec);
  const afterText = fs.readFileSync(auditPath, 'utf8');
  check('a following section is preserved when the comparison is rewritten',
    /## Revision History/.test(afterText) && beforeText === afterText);
}

// ---------------------------------------------------------------------------
console.log('\n10. Statuses, records and self-consistency');
// ---------------------------------------------------------------------------

{
  // Reproduced: a plain lookup on an object literal reaches Object.prototype,
  // so `constructor` returned a function — truthy, accepted as a status, not a
  // status. stage-2-design.md promises unmapped tokens are refused.
  for (const evil of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
    let threw = false;
    try { gb.normalizeStatus(evil); } catch (err) { threw = true; }
    check(`normalizeStatus refuses the prototype member "${evil}"`, threw);
  }
}

{
  // A real audit's matrices emit annotated statuses. Refusing them sends the
  // caller back to hand-mapping every row, which is the transcription step this
  // script removes.
  check('an annotated status maps on its token',
    gb.normalizeStatus('COVERED (see gap 2)') === 'pass');
  check('and so does an annotated warning',
    gb.normalizeStatus('OK (partial — see M13)') === 'pass');
  check('ADDRESSED maps to pass', gb.normalizeStatus('ADDRESSED') === 'pass');
  let threw = false;
  try { gb.normalizeStatus('WOBBLY (see note)'); } catch (err) { threw = true; }
  check('an unknown token with an annotation is still refused', threw);
}

{
  // Reproduced: docUnchanged was applied to the VERDICT after classification,
  // so an element with no line source scoped `unknown`, classified REGRESSION,
  // and the section printed one regression and "Regressions are HIGH priority"
  // above LINT-14 N_A. A record must not cite a section that contradicts it.
  const emptyDiff = { touched: new Set(), coarse: false, changed: 0, total: 7 };
  const c = gb.compare(
    baseline({ concern_statuses: [{ name: 'API contract', status: 'ok' }] }),
    baseline({ concern_statuses: [{ name: 'API contract', status: 'gap' }] }),
    emptyDiff, { docUnchanged: true },
  );
  check('on an unchanged document a flip with no lines is VARIANCE, not a regression',
    c.rows[0].klass === 'VARIANCE', c.rows[0].klass);
  check('so the counts agree with the N_A verdict',
    c.counts.regressions === 0 && c.verdict === 'N_A',
    `${c.counts.regressions} / ${c.verdict}`);
  check('and the section does not claim a HIGH-priority regression',
    !/Regressions are HIGH priority/.test(gb.renderSection(c, {})));
}

{
  // Reproduced: the first-audit branch fell through to the no-previous-document
  // text, so the record cited a section reading "no copy of the previous
  // baseline's document could be found ... every flip below is booked as a
  // regression" above a verdict correctly reading "first audit".
  const cmp = {
    rows: [], counts: { regressions: 0, variance: 0, improvements: 0, degradations: 0,
      new_items: 0, dropped: 0, not_comparable: 0, uncompared: 0, unchanged: 0, unscoped: 0 },
    verdict: 'N_A', justification: 'first audit', diff: null, options: { firstAudit: true },
  };
  const s = gb.renderSection(cmp, {});
  check('a first audit says it is a first audit', /Diff: NOT TAKEN/.test(s));
  check('and does not claim a missing document copy',
    !/no copy of the previous baseline's document could be found/.test(s));
}

{
  // decisions.md says every class records its diff scope, and the rendered
  // table is the only artifact that survives — the comparison JSON is
  // explicitly disposable.
  check('improvements report their diff scope', gb.SCOPED_CLASSES.has('IMPROVEMENT'));
  const diff = gb.changedLines(DOC_V1, DOC_V2);
  const c = gb.compare(
    baseline({ lint_results: { 'LINT-05': 'fail' } }),
    baseline({ lint_results: { 'LINT-05': { status: 'pass', lines: [[2, 2]], line_source: 'e' } } }),
    diff, {},
  );
  const s = gb.renderSection(c, {});
  const row = s.split('\n').find((l) => /LINT-05/.test(l));
  check('and the improvement row shows unchanged rather than a dash',
    /unchanged/.test(row), row);
}

// ---------------------------------------------------------------------------
console.log('\n11. The CLI guards — the failures that exited 0');
// ---------------------------------------------------------------------------

const { execFileSync } = require('child_process');
const CLI = path.join(__dirname, '..', 'plugins', 'toque', 'scripts', 'tq-gate-baseline.js');

function runCli(args, cwd) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

{
  const root = tmpdir();
  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V2, 'utf8');
  fs.writeFileSync(path.join(root, 'prev-doc.md'), DOC_V1, 'utf8');
  fs.writeFileSync(path.join(root, 'prev.json'), JSON.stringify({
    run_number: 1, doc_sha256: gb.hashContent(DOC_V1),
    lint_results: { 'LINT-05': 'pass' },
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'cur.json'), JSON.stringify({
    run_number: 2, lint_results: { 'LINT-05': { status: 'fail', lines: [[4, 4]], line_source: 'e' } },
  }), 'utf8');

  // The worst finding of the set: a typo in the baseline filename made the
  // script announce "first audit", record N_A and exit 0 — the regression check
  // silently absent, wearing a green exit code.
  const typo = runCli(['compare', 'prev-TYPO.json', 'cur.json', 'prev-doc.md', 'doc.md'], root);
  check('a named previous baseline that does not exist is an input error',
    typo.code === 2, `exit ${typo.code}`);
  check('and the message says to use "-" for a real first audit',
    /Pass "-" to declare this a first audit/.test(typo.out));

  // The sentinel still works.
  const first = runCli(['compare', '-', 'cur.json', '-', 'doc.md'], root);
  check('the "-" sentinel still gives first-audit behaviour and exit 0',
    first.code === 0 && /LINT-14: N_A/.test(first.out), `exit ${first.code}`);

  // Reproduced: passing the current document as both arguments produced an
  // empty diff, so the flip became variance and LINT-14 came back MET.
  const wrongDoc = runCli(['compare', 'prev.json', 'cur.json', 'doc.md', 'doc.md'], root);
  check('a previous document that does not match the baseline hash is refused',
    wrongDoc.code === 2, `exit ${wrongDoc.code}`);
  check('and the message shows both hashes',
    /does not match the previous baseline's doc_sha256/.test(wrongDoc.out));

  // The correct previous document still works, and still finds the regression.
  const good = runCli(['compare', 'prev.json', 'cur.json', 'prev-doc.md', 'doc.md'], root);
  check('the right previous document is accepted and the regression is found',
    good.code === 1 && /LINT-14: UNMET/.test(good.out), `exit ${good.code}`);
}

{
  // Reproduced: `lines: []` and an omitted `lines` disagreed on identical
  // evidence — omitting gave MET, spelling it out gave UNMET.
  const root = tmpdir();
  fs.mkdirSync(path.join(root, 'ev'));
  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V2, 'utf8');
  fs.writeFileSync(path.join(root, 'prev-doc.md'), DOC_V1, 'utf8');
  fs.writeFileSync(path.join(root, 'prev.json'), JSON.stringify({
    run_number: 1, doc_sha256: gb.hashContent(DOC_V1), lint_results: { 'LINT-05': 'pass' },
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'ev', 'LINT-05.json'), JSON.stringify({
    criterion_id: 'LINT-05',
    evidence: [{ artifact: 'doc.md', line_start: 2, line_end: 2, exact_quote: 'line2 unchanged', sha256: gb.hashContent(DOC_V2) }],
    reasoning: 'r', verdict: 'UNMET',
  }), 'utf8');

  fs.writeFileSync(path.join(root, 'omitted.json'), JSON.stringify({
    run_number: 2, lint_results: { 'LINT-05': 'fail' },
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'empty.json'), JSON.stringify({
    run_number: 2, lint_results: { 'LINT-05': { status: 'fail', lines: [] } },
  }), 'utf8');

  const a = runCli(['compare', 'prev.json', 'omitted.json', 'prev-doc.md', 'doc.md', '--evidence', 'ev', '--root', root], root);
  const b = runCli(['compare', 'prev.json', 'empty.json', 'prev-doc.md', 'doc.md', '--evidence', 'ev', '--root', root], root);
  check('an omitted lines field fills from evidence and reads as variance',
    a.code === 0 && /LINT-14: MET/.test(a.out), `exit ${a.code}`);
  check('an explicit empty lines array behaves identically',
    b.code === a.code && /LINT-14: MET/.test(b.out), `exit ${b.code}`);
}

{
  // Reproduced: three snapshots of an unchanged document produced run_number 3
  // and two history entries — a trend line invented out of one audit.
  const root = tmpdir();
  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V2, 'utf8');
  fs.writeFileSync(path.join(root, 'cur.json'), JSON.stringify({
    lint_results: { 'LINT-05': 'pass' },
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'state.json'), '{}', 'utf8');

  const one = runCli(['snapshot', 'cur.json', 'doc.md', 'state.json'], root);
  const two = runCli(['snapshot', 'cur.json', 'doc.md', 'state.json'], root);
  const st = JSON.parse(fs.readFileSync(path.join(root, 'state.json'), 'utf8'));
  check('the first snapshot writes run 1', one.code === 0 && st.baseline.run_number === 1,
    `exit ${one.code} run ${st.baseline.run_number}`);
  check('a second snapshot of the same run on the same document is refused',
    two.code === 2, `exit ${two.code}`);
  check('and history is not inflated', st.history.length === 0, `${st.history.length}`);
  check('the refusal explains what it would have invented',
    /would push a duplicate into history and invent a run/.test(two.out));
}

{
  // A carried-over audit_sha256 is a pin to a file the baseline does not
  // describe, indistinguishable on disk from a correct one.
  const root = tmpdir();
  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V2, 'utf8');
  fs.writeFileSync(path.join(root, 'audit.md'), '# Audit\n\nbody\n', 'utf8');
  fs.writeFileSync(path.join(root, 'cur.json'), JSON.stringify({
    lint_results: { 'LINT-05': 'pass' }, audit_sha256: 'deadbeef'.repeat(8),
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'state.json'), '{}', 'utf8');
  runCli(['snapshot', 'cur.json', 'doc.md', 'state.json'], root);
  const st = JSON.parse(fs.readFileSync(path.join(root, 'state.json'), 'utf8'));
  check('audit_sha256 is recomputed from the audit beside the state file',
    st.baseline.audit_sha256 === gb.hashContent('# Audit\n\nbody\n'),
    st.baseline.audit_sha256);
}
// ---------------------------------------------------------------------------
// 12. The third review: what the sixteen fixes broke, and the assertions that
//     could not tell a working implementation from a broken one.
//
// An external re-test mutated the script and re-ran this file. Four assertions
// stayed green against a mutant that removed the protection they name. An
// assertion that cannot fail is worse than no assertion, so each one below
// names the mutant it now kills.
// ---------------------------------------------------------------------------

{
  // Mutant that survived: test the range START against diff.total instead of its
  // END. A citation whose start is inside the document and whose end runs past
  // it then scopes normally, which is the stale-line-number case the check
  // exists for — the previous version's numbers are usually still in range at
  // the start and out of range at the end.
  const d = gb.changedLines('a\nb\nc\n', 'a\nB\nc\n');
  const flip = (lines) => gb.compare(
    baseline({ lint_results: { 'LINT-05': 'pass' } }),
    baseline({ lint_results: { 'LINT-05': { status: 'fail', lines, line_source: 'evidence' } } }),
    d, {},
  ).rows[0];

  const straddle = flip([[3, 900]]);
  check('a citation that STARTS in range and ends past the document is refused',
    straddle.klass === 'REGRESSION' && straddle.unscoped, `${straddle.klass} unscoped=${straddle.unscoped}`);
  const inside = flip([[2, 2]]);
  check('and a wholly in-range citation on a changed line still scopes normally',
    inside.klass === 'REGRESSION' && !inside.unscoped, `${inside.klass} unscoped=${inside.unscoped}`);
}

{
  // Mutant that survived: detect a missing class only when kind === 'concern'.
  // Every other class then slips back to NEW, which does not fail LINT-14 — so
  // the baseline that records least still buys the most reassuring verdict.
  const d = gb.changedLines(DOC_V1, DOC_V2);
  const prevLintOnly = { lint_results: { 'LINT-05': 'pass' } };

  const cases = {
    coverage: { coverage_items: [{ name: 'auth', status: 'gap', lines: [[4, 4]], line_source: 'audit.md' }] },
    scenario: { scenario_statuses: [{ id: 'S-1', status: 'FAIL', lines: [[4, 4]], line_source: 'audit.md' }] },
    concern: { concern_statuses: [{ name: 'perf', status: 'gap', lines: [[4, 4]], line_source: 'audit.md' }] },
  };
  for (const [kind, group] of Object.entries(cases)) {
    const c = gb.compare(prevLintOnly, Object.assign({ lint_results: { 'LINT-05': 'pass' } }, group), d, {});
    check(`a missing ${kind} class is UNCOMPARED, not NEW`,
      c.counts.uncompared === 1 && c.counts.new_items === 0 && c.verdict === 'N_A',
      `uncompared=${c.counts.uncompared} new=${c.counts.new_items} ${c.verdict}`);
  }
}

{
  // The regression this fix pass exists to close, and the worst of the sixteen.
  //
  // The uncompared branch sat ABOVE the regression branch, so adding the first
  // element of a class the previous baseline never carried turned a proven
  // pass-to-fail regression into N_A and exit 0 — and N_A does not block the
  // gate. Missing information about one class cannot erase a regression already
  // established in another.
  const d = gb.changedLines(DOC_V1, DOC_V2);
  const prev = { lint_results: { 'LINT-05': { status: 'pass', lines: [[4, 4]], line_source: 'evidence' } } };
  const failing = { 'LINT-05': { status: 'fail', lines: [[4, 4]], line_source: 'evidence' } };

  const alone = gb.compare(prev, { lint_results: failing }, d, {});
  check('a regression with no missing class is UNMET',
    alone.counts.regressions === 1 && alone.verdict === 'UNMET', alone.verdict);

  const withNewClass = gb.compare(prev, {
    lint_results: failing,
    concern_statuses: [{ name: 'perf', status: 'OK', lines: [[2, 2]], line_source: 'audit.md' }],
  }, d, {});
  check('a regression PLUS a missing class is still UNMET, not N_A',
    withNewClass.counts.regressions === 1 && withNewClass.verdict === 'UNMET',
    `regressions=${withNewClass.counts.regressions} ${withNewClass.verdict}`);
  check('and the justification still reports the uncompared class',
    /had no prior record and were not compared/.test(withNewClass.justification),
    withNewClass.justification);

  const cleanWithNewClass = gb.compare(prev, {
    lint_results: { 'LINT-05': { status: 'pass', lines: [[4, 4]], line_source: 'evidence' } },
    concern_statuses: [{ name: 'perf', status: 'OK', lines: [[2, 2]], line_source: 'audit.md' }],
  }, d, {});
  check('with no regression, a missing class still demotes to N_A',
    cleanWithNewClass.verdict === 'N_A', cleanWithNewClass.verdict);
}

{
  // The fence scanner kept the fence CHARACTER and discarded its length, and
  // never required a closing fence to be bare. Four shapes therefore closed the
  // block early or never opened it, and `## Baseline comparison` written as an
  // EXAMPLE became the section this script rewrites.
  const B = '```';
  const REAL = '## Baseline comparison';
  const shapes = {
    'an ordinary fence': [['# A', B, REAL, 'decoy', B, '', REAL, 'real', ''], 7],
    'a tilde fence holding backticks': [['# A', '~~~', B, REAL, 'decoy', B, '~~~', '', REAL, 'real', ''], 9],
    'a fence indented three spaces': [['# A', `   ${B}`, REAL, 'decoy', `   ${B}`, '', REAL, 'real', ''], 7],
    'a fence marker in a table cell': [['# A', '| a |', '|---|', `| ${B} |`, '', REAL, 'real', ''], 6],
    'a four-backtick fence holding a three-backtick example':
      [['# A', '````', B, REAL, 'decoy', B, '````', '', REAL, 'real', ''], 9],
    'a closing marker carrying an info string':
      [['# A', B, 'ex:', `${B}js`, REAL, 'decoy', B, '', REAL, 'real', ''], 9],
    'a fence inside a list, indented four spaces':
      [['# A', '- step:', '', `    ${B}`, `    ${REAL}`, '    decoy', `    ${B}`, '', REAL, 'real', ''], 9],
    'a plain four-space indented example':
      [['# A', '', `    ${REAL}`, '    decoy', '', REAL, 'real', ''], 6],
  };
  for (const [name, [lines, want]] of Object.entries(shapes)) {
    const at = gb.locateSection(`${lines.join('\n')}\n`);
    check(`the real section is found past ${name}`,
      at && at.start === want, at ? `line ${at.start}, wanted ${want}` : 'not found');
  }
}

{
  // The section terminator read the RAW line against /^##\s/, so an indented
  // `  ## Verdicts` and any `# Appendix` failed to stop it: the section ran to
  // end of file and every rewrite deleted that content, at exit 0, with a
  // success message. This is the most destructive defect the three reviews
  // found, and none of them named it.
  const survives = (tail) => {
    const root = tmpdir();
    const f = path.join(root, 'audit.md');
    fs.writeFileSync(f, `# Audit\n\n## Baseline comparison\n\nold body\n\n${tail.join('\n')}\n`, 'utf8');
    gb.writeSection(f, '## Baseline comparison\n\nNEW\n');
    return fs.readFileSync(f, 'utf8');
  };
  const afterH1 = survives(['# Appendix', 'appendix content']);
  check('a level-1 heading ends the section and its content survives',
    afterH1.includes('# Appendix') && afterH1.includes('appendix content'), JSON.stringify(afterH1));

  const afterIndented = survives(['  ## Verdicts', 'verdict rows']);
  check('an indented level-2 heading ends the section and its content survives',
    afterIndented.includes('## Verdicts') && afterIndented.includes('verdict rows'), JSON.stringify(afterIndented));

  const afterH3 = survives(['### Detail', 'belongs to the section']);
  check('a level-3 heading belongs to the section and is replaced',
    !afterH3.includes('belongs to the section'), JSON.stringify(afterH3));
}

{
  // An audit holding an unterminated fence swallows every line after it, so the
  // appended section landed inside that fence and could not be found. `record`
  // failed at the pin and exited 2 HAVING ALREADY APPENDED; three runs left
  // three contradictory sections behind an exit code that said nothing was
  // written. The check has to run on the computed text, before the write.
  const root = tmpdir();
  const f = path.join(root, 'audit.md');
  const original = '# Audit\n\n```\nunterminated\n';
  fs.writeFileSync(f, original, 'utf8');

  let threw = null;
  try { gb.writeSection(f, '## Baseline comparison\n\nBODY\n'); } catch (err) { threw = err; }
  check('writeSection refuses a section that would not be locatable',
    threw !== null && /would not be locatable/.test(threw.message), threw && threw.message);
  check('and the file is byte-identical after the refusal',
    fs.readFileSync(f, 'utf8') === original, JSON.stringify(fs.readFileSync(f, 'utf8')));
  check('the message names the unterminated fence as the cause',
    threw !== null && /unterminated code fence/.test(threw.message));

  fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(root, 'cmp.json'), JSON.stringify({
    verdict: 'MET', justification: 'caller-decided: t', section: '## Baseline comparison\n\nBODY\n', counts: {},
  }), 'utf8');
  const before = fs.readFileSync(f, 'utf8');
  const r1 = runCli(['record', 'cmp.json', 'audit.md', 'evidence'], root);
  const r2 = runCli(['record', 'cmp.json', 'audit.md', 'evidence'], root);
  check('record exits 2 on that audit', r1.code === 2 && r2.code === 2, `${r1.code}/${r2.code}`);
  check('and two refused runs leave the file unchanged, not two sections longer',
    fs.readFileSync(f, 'utf8') === before,
    `${before.length} -> ${fs.readFileSync(f, 'utf8').length} bytes`);
}

{
  // Mutant that survived: remove the realpath containment check entirely. The
  // standing test only exercised LEXICAL containment, which a junction or a
  // symlink inside the root passes while pointing outside it.
  const root = tmpdir();
  const outside = tmpdir();
  fs.writeFileSync(path.join(outside, 'audit.md'), '# Audit\n\n## Baseline comparison\n\nbody\n', 'utf8');
  let linked = true;
  try {
    fs.symlinkSync(outside, path.join(root, 'linked'), 'junction');
  } catch (err) {
    linked = false;
  }
  if (linked) {
    const viaLink = path.join(root, 'linked', 'audit.md');
    let threw = null;
    try { gb.assertContained(viaLink, root); } catch (err) { threw = err; }
    check('a path that escapes --root through a link is refused',
      threw !== null && /resolves outside/.test(threw.message), threw && threw.message);

    const before = fs.readFileSync(viaLink, 'utf8');
    fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(root, 'cmp.json'), JSON.stringify({
      verdict: 'MET', justification: 'caller-decided: t', section: '## Baseline comparison\n\nNEW\n', counts: {},
    }), 'utf8');
    const r = runCli(['record', 'cmp.json', path.join('linked', 'audit.md'), 'evidence'], root);
    check('record refuses it', r.code === 2, `exit ${r.code}`);
    check('and refuses BEFORE editing the file it cannot pin',
      fs.readFileSync(viaLink, 'utf8') === before, 'the audit was rewritten by a run that then failed');
  } else {
    skip('a path that escapes --root through a link is refused', 'this host cannot create a junction');
    skip('record refuses it', 'this host cannot create a junction');
    skip('and refuses BEFORE editing the file it cannot pin', 'this host cannot create a junction');
  }
  check('a path inside the root is accepted',
    typeof gb.assertContained(path.join(root, 'cmp.json'), root) === 'string');
}

{
  // Mutant that survived: delete both printed hashes. The assertion checked only
  // the introductory phrase, so a message that named neither number passed.
  const root = tmpdir();
  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V2, 'utf8');
  fs.writeFileSync(path.join(root, 'prev-doc.md'), DOC_V2, 'utf8');
  fs.writeFileSync(path.join(root, 'prev.json'), JSON.stringify({
    run_number: 1, doc_sha256: gb.hashContent(DOC_V1), lint_results: { 'LINT-05': 'pass' },
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'cur.json'), JSON.stringify({
    lint_results: { 'LINT-05': 'fail' },
  }), 'utf8');
  const r = runCli(['compare', 'prev.json', 'cur.json', 'prev-doc.md', 'doc.md'], root);
  check('the mismatch message prints the hash actually supplied',
    r.out.includes(gb.hashContent(DOC_V2)), r.out);
  check('and the hash the baseline recorded',
    r.out.includes(gb.hashContent(DOC_V1)), r.out);
}

{
  // The copy is named by run number alone, so re-using a run number on a
  // DIFFERENT document overwrote the copy the earlier run's history entry points
  // at. `compare` authenticates the previous document against exactly that hash
  // and then refuses to diff it — so this write destroyed the artifact the rest
  // of the script depends on, and the error it eventually produced told the
  // caller to recover a file this step had deleted. The duplicate guard does not
  // catch it: that guard keys on the document hash, and here the document is
  // what changed.
  const root = tmpdir();
  const keep = path.join(root, 'keep');
  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V1, 'utf8');
  fs.writeFileSync(path.join(root, 'state.json'), '{"history":[],"baseline":{}}', 'utf8');
  fs.writeFileSync(path.join(root, 'b.json'), JSON.stringify({
    run_number: 1, lint_results: { 'LINT-05': 'pass' },
  }), 'utf8');

  const first = runCli(['snapshot', 'b.json', 'doc.md', 'state.json', '--keep', 'keep'], root);
  check('the first snapshot keeps a copy', first.code === 0, first.out);
  const copy = path.join(keep, 'doc-at-baseline-1.md');
  check('and the copy is the document it was taken on',
    fs.readFileSync(copy, 'utf8') === DOC_V1);

  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V2, 'utf8');
  const second = runCli(['snapshot', 'b.json', 'doc.md', 'state.json', '--keep', 'keep'], root);
  check('re-using a run number on a DIFFERENT document is refused',
    second.code === 2, `exit ${second.code}: ${second.out}`);
  check('and the earlier run\'s copy is untouched',
    fs.readFileSync(copy, 'utf8') === DOC_V1, 'the copy was overwritten');
  check('the refusal says the run becomes permanently unscoped',
    /permanently unscoped/.test(second.out), second.out);

  // The same run number on the SAME document is the duplicate case, refused for
  // its own reason — the two guards must not be confused for one another.
  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V1, 'utf8');
  const third = runCli(['snapshot', 'b.json', 'doc.md', 'state.json', '--keep', 'keep'], root);
  check('and an identical re-run is still refused as a duplicate',
    third.code === 2 && /invent a run/.test(third.out), third.out);
}

// ---------------------------------------------------------------------------
// 13. The fourth review: eleven mutants the 148-assertion suite could not kill.
//
// The previous pass claimed "fourteen protections each verified against a mutant
// that removes it". That was true and insufficient — the fourteen were broad
// reversions, and a review that wrote the SUBTLEST mutation of each guard found
// eleven that passed every assertion. Each block below is the input that
// separates the real guard from its weakened twin.
// ---------------------------------------------------------------------------

{
  // `counts.regressions > 0` mutated to `=== 1`: two regressions returned MET.
  // Every regression fixture in this file had exactly one.
  const d = gb.changedLines(DOC_V1, DOC_V2);
  const prev = {
    lint_results: {
      'LINT-05': { status: 'pass', lines: [[4, 4]], line_source: 'evidence' },
      'LINT-06': { status: 'pass', lines: [[5, 5]], line_source: 'evidence' },
      'LINT-07': { status: 'pass', lines: [[4, 5]], line_source: 'evidence' },
    },
  };
  const failing = (n) => {
    const out = {};
    const ids = ['LINT-05', 'LINT-06', 'LINT-07'];
    const lines = [[[4, 4]], [[5, 5]], [[4, 5]]];
    ids.forEach((id, k) => {
      out[id] = { status: k < n ? 'fail' : 'pass', lines: lines[k], line_source: 'evidence' };
    });
    return { lint_results: out };
  };
  for (const n of [1, 2, 3]) {
    const c = gb.compare(prev, failing(n), d, {});
    check(`${n} regression(s) still fails LINT-14`,
      c.counts.regressions === n && c.verdict === 'UNMET',
      `regressions=${c.counts.regressions} ${c.verdict}`);
  }
}

{
  // Run grouping and the previous-offset comparison, mutated three ways:
  //   `i > 0 ? runs[i-1].off : 0`  ->  `i > 1 ? ... : 0`   (first seam lost)
  //   `last.lastPi === pi - 1`     ->  `<= pi - 1`         (runs over-merged)
  // Both need a diff with more than one run and a non-zero first offset.
  // The fixture needs TWO surviving runs, so the edits must defeat both the
  // common-prefix and common-suffix trims — an earlier version of this test put
  // one edit near the end, the suffix trim absorbed the second run, and the
  // mutant was indistinguishable.
  //
  // Here: an insertion at the top, a same-size replacement in the middle, and an
  // edit at the last line. Both matched runs carry offset +1; the second is
  // therefore NOT displaced relative to the first and contributes no seam. The
  // mutant reads the first run's offset as 0, decides the second run is
  // displaced after all, and marks line 8.
  const before = ['a1', 'a2', 'a3', 'a4', 'a5', 'XX', 'b1', 'b2', 'b3', 'b4', 'b5', 'TAIL'].join('\n') + '\n';
  const after = ['INS', 'a1', 'a2', 'a3', 'a4', 'a5', 'YY', 'b1', 'b2', 'b3', 'b4', 'b5', 'TAILX'].join('\n') + '\n';
  const d = gb.changedLines(before, after);
  const marked = [...d.touched].sort((a, b) => a - b).join(',');
  check('two runs at the same offset mark one seam pair, not two',
    marked === '1,2,6,7,12,13', marked);
  check('the second run is not displaced relative to the first and stays exempt',
    !d.touched.has(8), marked);
}

{
  // Containment mutated to use `process.cwd()` rather than the `--root` passed
  // in. Every existing CLI test ran with cwd equal to the root, so the two were
  // never distinguishable. Here the process runs from a sibling directory.
  const root = tmpdir();
  const elsewhere = tmpdir();
  fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(root, 'audit.md'),
    '# Audit\n\n## Baseline comparison\n\nold\n', 'utf8');
  fs.writeFileSync(path.join(root, 'cmp.json'), JSON.stringify({
    verdict: 'MET', justification: 'caller-decided: t',
    section: '## Baseline comparison\n\nNEW\n', counts: {},
  }), 'utf8');

  const r = runCli([
    'record', path.join(root, 'cmp.json'), path.join(root, 'audit.md'),
    path.join(root, 'evidence'), '--root', root,
  ], elsewhere);
  check('--root is honoured when the process runs from elsewhere',
    r.code === 0, `exit ${r.code}: ${r.out}`);
  check('and the record is written',
    fs.existsSync(path.join(root, 'evidence', 'LINT-14.json')));
}

{
  // Fence close length mutated from `>=` to `===`: a fence opened with three
  // backticks and closed with four is valid CommonMark and stopped closing, so
  // everything after it read as fenced and the section vanished.
  const doc = ['# A', '```', 'body', '````', '', '## Baseline comparison', 'real', ''].join('\n') + '\n';
  const at = gb.locateSection(doc);
  check('a fence closed by a LONGER run still closes',
    at && at.start === 6, at ? `line ${at.start}` : 'not found');

  // And the opposite must not close: a four-backtick fence is not closed by three.
  const shorter = ['# A', '````', '```', '## Baseline comparison', 'decoy', '````', '',
    '## Baseline comparison', 'real', ''].join('\n') + '\n';
  const at2 = gb.locateSection(shorter);
  check('a fence is not closed by a SHORTER run',
    at2 && at2.start === 8, at2 ? `line ${at2.start}` : 'not found');
}

{
  // The backtick info-string rule mutated from `.includes` to `.startsWith`.
  // Prose carrying an inline example mid-line then opened a fence that nothing
  // closed, swallowing the section below it.
  const doc = ['# A', '``` see `code` in the log', '', '## Baseline comparison', 'real', ''].join('\n') + '\n';
  const at = gb.locateSection(doc);
  check('a backtick anywhere in the info string means no fence is opened',
    at && at.start === 4, at ? `line ${at.start}` : 'not found');
}

{
  // Heading and terminator indentation mutated from {0,3} to {0,2}. Three spaces
  // is the maximum an ATX heading may carry and still be a heading.
  const heading = ['# A', '', '   ## Baseline comparison', 'body', '', '## Next', 'x'].join('\n') + '\n';
  const at = gb.locateSection(heading);
  check('a heading indented exactly three spaces is still the section',
    at && at.start === 3, at ? `line ${at.start}` : 'not found');

  const term = ['# A', '', '## Baseline comparison', 'body', '', '   ## Verdicts', 'rows'].join('\n') + '\n';
  const at2 = gb.locateSection(term);
  check('a terminator indented exactly three spaces still ends the section',
    at2 && at2.end === 4, at2 ? `ends ${at2.end}` : 'not found');

  const four = ['# A', '', '## Baseline comparison', 'body', '', '    ## Example', 'in a code block'].join('\n') + '\n';
  const at3 = gb.locateSection(four);
  check('and a FOUR-space heading is an indented code block, not a terminator',
    at3 && at3.end === 7, at3 ? `ends ${at3.end}` : 'not found');
}

{
  // The kept-copy collision guard mutated to require a standing baseline
  // (`standing && fs.existsSync(kept) && ...`). With a fresh state file and an
  // orphan copy already in the keep directory, the guard was skipped and the
  // copy overwritten — the same corruption, reached from an empty history.
  const root = tmpdir();
  const keep = path.join(root, 'keep');
  fs.mkdirSync(keep, { recursive: true });
  fs.writeFileSync(path.join(keep, 'doc-at-baseline-1.md'), DOC_V1, 'utf8');
  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V2, 'utf8');
  // No `baseline` key at all, so `standing` is undefined rather than `{}`. An
  // earlier version of this fixture wrote `"baseline":{}`, which is truthy, so a
  // mutant gating the guard on `standing &&` still fired and survived the test.
  fs.writeFileSync(path.join(root, 'state.json'), '{"history":[]}', 'utf8');
  fs.writeFileSync(path.join(root, 'b.json'), JSON.stringify({
    run_number: 1, lint_results: { 'LINT-05': 'pass' },
  }), 'utf8');

  const r = runCli(['snapshot', 'b.json', 'doc.md', 'state.json', '--keep', 'keep'], root);
  check('an existing copy is protected even with no standing baseline',
    r.code === 2, `exit ${r.code}: ${r.out}`);
  check('and its bytes are intact',
    fs.readFileSync(path.join(keep, 'doc-at-baseline-1.md'), 'utf8') === DOC_V1);
}

{
  // The document-hash comparison mutated to compare only the first eight
  // characters. A near-miss that agrees on a prefix is exactly the shape a
  // hand-copied or truncated hash takes.
  const root = tmpdir();
  const realPrev = gb.hashContent(DOC_V1);
  const nearMiss = realPrev.slice(0, 8) + 'f'.repeat(56);
  check('the doctored hash shares the first eight characters',
    nearMiss.slice(0, 8) === realPrev.slice(0, 8) && nearMiss !== realPrev);

  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V2, 'utf8');
  fs.writeFileSync(path.join(root, 'prev-doc.md'), DOC_V1, 'utf8');
  fs.writeFileSync(path.join(root, 'prev.json'), JSON.stringify({
    run_number: 1, doc_sha256: nearMiss, lint_results: { 'LINT-05': 'pass' },
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'cur.json'), JSON.stringify({
    lint_results: { 'LINT-05': 'fail' },
  }), 'utf8');
  const r = runCli(['compare', 'prev.json', 'cur.json', 'prev-doc.md', 'doc.md'], root);
  check('a hash matching only on its first eight characters is refused',
    r.code === 2, `exit ${r.code}`);
  check('and the message prints the full 64-character values',
    r.out.includes(realPrev) && r.out.includes(nearMiss), r.out);
}

{
  // The locatability guard mutated to `if (!at2 && !at)` — skipped entirely
  // whenever a section already exists. The replacement path must be guarded too:
  // an audit whose section is findable can still be followed by content that
  // makes the rewritten section unfindable.
  const root = tmpdir();
  const f = path.join(root, 'audit.md');
  const original = ['# Audit', '', '## Baseline comparison', '', 'old body', '',
    '<pre>', 'log excerpt', ''].join('\n') + '\n';
  fs.writeFileSync(f, original, 'utf8');
  const at = gb.locateSection(original);
  check('the section is findable before the write', at !== null && at.start === 3,
    at ? `line ${at.start}` : 'not found');

  // An unterminated <pre> swallows the tail, but the heading precedes it, so the
  // write succeeds and stays findable. This is the control for the case below.
  gb.writeSection(f, '## Baseline comparison\n\nNEW\n');
  check('replacing it keeps it findable', gb.locateSection(fs.readFileSync(f, 'utf8')) !== null);

  // The section TEXT is caller-supplied — `record` takes `cmp.section` verbatim
  // when the comparison JSON carries one. A section whose own first line opens a
  // block shields the heading that follows it, so the replacement is unfindable
  // even though the file had a findable section before the write. That is the
  // input the `!at2 && !at` mutant needs, and without it the guard is only ever
  // exercised on files with no existing section.
  let threwReplace = null;
  try {
    gb.writeSection(f, '<pre>\n## Baseline comparison\n\nNEW\n');
  } catch (err) { threwReplace = err; }
  check('replacing a section with text that shields its own heading is refused',
    threwReplace !== null && /would not be locatable/.test(threwReplace.message),
    threwReplace && threwReplace.message);
  check('and the existing section survives that refusal',
    gb.locateSection(fs.readFileSync(f, 'utf8')) !== null
    && fs.readFileSync(f, 'utf8').includes('NEW'));

  // The same guard on a file with no section at all: the heading only exists
  // inside the tail the unterminated block swallows.
  const g = path.join(root, 'audit2.md');
  fs.writeFileSync(g, '# Audit\n\n<pre>\nlog excerpt\n', 'utf8');
  let threw = null;
  try { gb.writeSection(g, '## Baseline comparison\n\nNEW\n'); } catch (err) { threw = err; }
  check('an unterminated HTML block refuses the write like an unterminated fence',
    threw !== null && /would not be locatable/.test(threw.message), threw && threw.message);
  check('and that file is byte-identical too',
    fs.readFileSync(g, 'utf8') === '# Audit\n\n<pre>\nlog excerpt\n');
}

{
  // Literal HTML blocks are not markdown. An `# H1` inside a COMMENT terminated
  // the comparison section, so the pin quoted three lines and excluded the very
  // verdict and regression row the record rests on — and the evidence validator
  // passed it, because quote fidelity says nothing about whether the span is the
  // right one. Backticks inside a `<pre>` opened a fence that nothing closed, so
  // `record` refused a well-formed audit with "close the fence" against a fence
  // that did not exist, and no re-run could repair it.
  const commented = ['# Audit', '## Baseline comparison', 'Summary pending.',
    '<!--', '# Reproduction notes', 'Do not edit generated rows by hand.', '-->',
    '**LINT-14: UNMET**', '| concern | REGRESSION |', '## Evidence notes', 'tail'].join('\n') + '\n';
  const at = gb.locateSection(commented);
  check('an H1 inside an HTML comment does not end the section',
    at && at.start === 2 && at.end === 9, at ? `${at.start}-${at.end}` : 'not found');

  const B = '```';
  const pre = ['# Audit', '<pre>', '````', 'Log records delimiter lengths.', B, '</pre>',
    '', '## Baseline comparison', 'real body', ''].join('\n') + '\n';
  const at2 = gb.locateSection(pre);
  check('backticks inside <pre> do not open a fence',
    at2 && at2.start === 8, at2 ? `line ${at2.start}` : 'not found');

  const script = ['# Audit', '<script>', 'const s = "## Baseline comparison";', '</script>',
    '', '## Baseline comparison', 'real body', ''].join('\n') + '\n';
  const at3 = gb.locateSection(script);
  check('a heading inside <script> is not the section',
    at3 && at3.start === 6, at3 ? `line ${at3.start}` : 'not found');

  const genuine = ['# Audit', '## Baseline comparison', 'body', '# Appendix', 'content'].join('\n') + '\n';
  const at4 = gb.locateSection(genuine);
  check('a genuine H1 outside any block still ends the section',
    at4 && at4.end === 3, at4 ? `ends ${at4.end}` : 'not found');
}

// ---------------------------------------------------------------------------
// 14. The fifth review: the move detector and the HTML scanner, which between
//     them had thirty surviving mutants and two blowups.
//
// The move detector closed a reordering that seam marking exempted, and then
// reintroduced the failure it replaced by a third route: pairing unmatched runs
// on byte equality made an ordinary blank-line cleanup mark 145 of 150 lines.
// Requiring whole-run equality was also brittle in the opposite direction — a
// revision note written beside a moved block made the runs different lengths, so
// no move was found and the reordering went back to being variance.
// ---------------------------------------------------------------------------

{
  // Blowup 1: repeated boilerplate. One blank line removed below the title and
  // one added before the appendix — every requirement untouched.
  const spec = [];
  for (let s = 1; s <= 48; s++) spec.push(`### REQ-${s}`, `Body line for requirement ${s}`, '');
  const prev = ['# Spec', '', '', ...spec, '## Appendix', 'end'].join('\n') + '\n';
  const cur = ['# Spec', '', ...spec, '', '## Appendix', 'end'].join('\n') + '\n';
  const d = gb.changedLines(prev, cur);
  check('a blank-line cleanup does not mark the document',
    d.touched.size <= 8, `${d.touched.size}/${d.total}`);
  check('and a requirement in the middle keeps the exemption',
    !d.touched.has(75), [...d.touched].sort((a, b) => a - b).join(','));
}

{
  // Blowup 2: a single `---` separator relocated in a document holding forty.
  const doc = [];
  for (let s = 1; s <= 40; s++) {
    doc.push(`## Phase ${s}`, '', '| item | status |', '|---|---|',
      `| step ${s}a | ok |`, `| step ${s}b | ok |`, '', '---', '');
  }
  const moved = doc.slice();
  moved.splice(7, 1);
  moved.splice(340, 0, '---');
  const d = gb.changedLines(`${doc.join('\n')}\n`, `${moved.join('\n')}\n`);
  check('relocating one separator among forty does not mark the document',
    d.touched.size <= 8, `${d.touched.size}/${d.total}`);
}

{
  // The brittleness: the same reordering, with one revision note written beside
  // the block that moved. Whole-run equality failed here — the new unmatched run
  // carried the note and so did not equal the old one — and the concern about the
  // ordering came back VARIANCE / MET / exit 0.
  const prev = ['# Payment', '## Validate request', 'Check idempotency.',
    'Reject invalid signatures.', 'Verify balance.', '## Commit payment',
    'Write ledger.', 'Send receipt.', '## End'].join('\n') + '\n';
  const cur = ['# Payment', '## Commit payment', 'Write ledger.', 'Send receipt.',
    'Revision note: commit now precedes validation.', '## Validate request',
    'Check idempotency.', 'Reject invalid signatures.', 'Verify balance.',
    '## End'].join('\n') + '\n';
  const d = gb.changedLines(prev, cur);
  check('a moved block is still detected when a note is added beside it',
    d.touched.has(8), [...d.touched].sort((a, b) => a - b).join(','));

  const c = gb.compare(
    baseline({ concern_statuses: [{ name: 'Authorization before commit', status: 'ok' }] }),
    baseline({
      concern_statuses: [{
        name: 'Authorization before commit', status: 'gap',
        lines: [[8, 8]], line_source: 'audit.md',
      }],
    }),
    d, {},
  );
  check('so the ordering concern is a REGRESSION, not variance',
    c.rows[0].klass === 'REGRESSION' && c.verdict === 'UNMET',
    `${c.rows[0].klass} / ${c.verdict}`);
}

{
  // Distinctiveness is counted over the WHOLE document, not among unmatched runs
  // — the blank-line blowup has exactly one unmatched blank on each side and
  // still fails under the weaker rule. A line that appears twice anywhere cannot
  // identify a block.
  const prevLines = ['head', 'DUP', 'a1', 'a2', 'a3', 'DUP', 'tail'];
  const curLines = ['head', 'a1', 'a2', 'a3', 'DUP', 'DUP', 'tail'];
  const d = gb.changedLines(`${prevLines.join('\n')}\n`, `${curLines.join('\n')}\n`);
  // Line 2 is marked by the ordinary deletion-adjacency rule; line 3 is the one
  // only a move could reach, so it is the discriminating assertion.
  check('a line repeated in the document never establishes a move',
    !d.touched.has(3),
    [...d.touched].sort((a, b) => a - b).join(','));

  // The same shape with a unique marker DOES establish one.
  const uniqPrev = ['head', 'UNIQUE MARKER', 'a1', 'a2', 'a3', 'tail'];
  const uniqCur = ['head', 'a1', 'a2', 'a3', 'UNIQUE MARKER', 'tail'];
  const d2 = gb.changedLines(`${uniqPrev.join('\n')}\n`, `${uniqCur.join('\n')}\n`);
  check('a unique line does establish one, and marks what it crossed',
    d2.touched.has(2) && d2.touched.has(3) && d2.touched.has(4),
    [...d2.touched].sort((a, b) => a - b).join(','));
}

{
  // Both crossing directions, separately, so a mutant that drops one is caught.
  const up = gb.changedLines(
    ['top', 'M1', 'M2', 'k1', 'k2', 'k3', 'bot'].join('\n') + '\n',
    ['top', 'k1', 'k2', 'k3', 'M1', 'M2', 'bot'].join('\n') + '\n',
  );
  check('a block moving DOWN marks what it passed',
    up.touched.has(2) && up.touched.has(3) && up.touched.has(4),
    [...up.touched].sort((a, b) => a - b).join(','));

  const down = gb.changedLines(
    ['top', 'k1', 'k2', 'k3', 'M1', 'M2', 'bot'].join('\n') + '\n',
    ['top', 'M1', 'M2', 'k1', 'k2', 'k3', 'bot'].join('\n') + '\n',
  );
  check('a block moving UP marks what it passed',
    down.touched.has(4) && down.touched.has(5) && down.touched.has(6),
    [...down.touched].sort((a, b) => a - b).join(','));

  // A block that moved past nothing marks nothing extra.
  const still = gb.changedLines(
    ['top', 'k1', 'M1', 'k2', 'bot'].join('\n') + '\n',
    ['top', 'k1', 'M1x', 'k2', 'bot'].join('\n') + '\n',
  );
  check('an in-place edit crosses nothing',
    !still.touched.has(4) && !still.touched.has(5),
    [...still.touched].sort((a, b) => a - b).join(','));
}

{
  // The equivalence proof written into the last harness was WRONG, and the fifth
  // review supplied the counterexample. Merging same-offset runs does leave the
  // first run's end line already marked by the deletion rule — but it also
  // creates a NEW last boundary at the second run's end, which the real rule
  // leaves exempt. The exact set is pinned so the mutant cannot come back.
  const d = gb.changedLines(
    ['A', 'B', 'C', 'D', 'E', 'F', 'tail'].join('\n') + '\n',
    ['new', 'A', 'B', 'X', 'D', 'E', 'F', 'newbottom', 'tail'].join('\n') + '\n',
  );
  const marked = [...d.touched].sort((a, b) => a - b).join(',');
  check('merging same-offset runs would invent a boundary at line 7',
    marked === '1,2,3,4,8', marked);
}

{
  // The HTML scanner, against CommonMark section 4.6. Each row is a shape the
  // fifth review either found wrong or asked to be held: a raw-text block may
  // start with the tag at end of line, is closed by ANY of the four closing
  // tags, and a comment may be the complete `<!-->` or `<!--->`. A type-6 block
  // (a block-level tag) ends at a blank line, which is what keeps a `<pre>`
  // nested inside a `<table>` from opening a block that never closes.
  const S = '## Baseline comparison';
  const F = '```';
  const at = (lines) => {
    const r = gb.locateSection(`${lines.join('\n')}\n`);
    return r ? r.start : null;
  };
  const cases = [
    ['a bare <pre at end of line shields what follows',
      ['# A', '<pre', F, 'x', '</pre>', '', S, 'real'], 7],
    ['a raw block is closed by a DIFFERENT raw closing tag',
      ['# A', '<pre>', 'x', '</script>', '', S, 'real'], 6],
    ['a closing tag inside a quoted string still closes',
      ['# A', '<pre>', 'Captured: "</textarea>"', '', S, 'real'], 5],
    ['<!--> is a complete comment', ['# A', '<!-->', '', S, 'real'], 4],
    ['<!---> is a complete comment', ['# A', '<!--->', '', S, 'real'], 4],
    ['a <pre> nested in a <table> does not swallow the file',
      ['# A', '', '## Evidence', '<table><tr><td>', '<pre>', 'Response body: 202', '', S, 'real'], 8],
    ['a non-breaking space is not a tag boundary',
      ['# A', '<pre x>', '', S, 'real'], 4],
    ['a tab IS a tag boundary',
      ['# A', '<pre\tclass="log">', 'x', '</pre>', '', S, 'real'], 6],
    ['<pretend> is not a raw-text tag', ['# A', '<pretend>', 'x', '', S, 'real'], 5],
    ['uppercase <PRE> is closed by uppercase </PRE>',
      ['# A', '<PRE>', 'x', '</PRE>', '', S, 'real'], 6],
    ['a heading inside <script> is not the section',
      ['# A', '<script>', S, '</script>', '', S, 'real'], 6],
    ['a heading inside <style> is not the section',
      ['# A', '<style>', S, '</style>', '', S, 'real'], 6],
    ['a heading inside <textarea> is not the section',
      ['# A', '<textarea>', S, '</textarea>', '', S, 'real'], 6],
    ['a three-space indented comment still shields',
      ['# A', '   <!--', S, '   -->', '', S, 'real'], 6],
    ['a three-space indented <pre> still shields',
      ['# A', '   <pre>', S, '   </pre>', '', S, 'real'], 6],
    ['prose mentioning <style> mid-sentence is not a block',
      ['# A', 'The <style> tag is banned.', '', S, 'body'], 4],
    ['an unmatched --> in prose opens nothing',
      ['# A', 'Arrow --> implies.', '', S, 'body'], 4],
    ['a comment closed on its own line shields only itself',
      ['# A', '<!-- note -->', '', S, 'body'], 4],
    ['a comment opener not at the start of a line opens nothing',
      ['# A', 'See <!-- marker', '', S, 'body'], 4],
    ['an unterminated comment shields to end of file',
      ['# A', '<!--', S, 'body'], null],
    ['an unterminated raw block shields to end of file',
      ['# A', '<pre>', S, 'body'], null],
    ['a fence inside <pre> does not leak',
      ['# A', '<pre>', F, S, F, '</pre>', '', S, 'real'], 8],
    ['<pre> inside a fence opens no HTML block',
      ['# A', F, '<pre>', F, '', S, 'real'], 6],
    ['a comment opened inside a fence opens no HTML block',
      ['# A', F, '<!--', F, S, 'real', '-->'], 5],
  ];
  for (const [label, lines, want] of cases) {
    const got = at(lines);
    check(label, got === want, got === null ? 'not found' : `line ${got}, wanted ${want}`);
  }
}

{
  // The shield must not shorten the pinned section. A comparison body carrying a
  // comment and a <pre> keeps its real end, and the quote the pin slices still
  // matches what the validator recomputes.
  const root = tmpdir();
  fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
  const audit = ['# Audit', '', '## Baseline comparison', '', '- Diff: 3 of 10 lines changed',
    '<!--', '# generated, do not edit', '-->', '<pre>', 'raw excerpt', '</pre>',
    '**LINT-14: UNMET**', '', '## Evidence notes', 'tail'].join('\n') + '\n';
  const f = path.join(root, 'audit.md');
  fs.writeFileSync(f, audit, 'utf8');
  const at = gb.locateSection(audit);
  check('a section whose body holds a comment and a <pre> keeps its real end',
    at && at.start === 3 && at.end === 12, at ? `${at.start}-${at.end}` : 'not found');

  const pinned = gb.pin(f, path.join(root, 'evidence'), root, 'UNMET', 'caller-decided: t');
  const rec = JSON.parse(fs.readFileSync(pinned.file, 'utf8'));
  const lines = audit.split('\n');
  const quoted = lines.slice(pinned.line_start - 1, pinned.line_end).join('\n');
  check('and the pinned quote covers the verdict line',
    quoted.includes('**LINT-14: UNMET**'), quoted);
  check('and the quote matches the file it was sliced from',
    rec.evidence[0].exact_quote === quoted,
    JSON.stringify(rec.evidence[0].exact_quote));
}

// ---------------------------------------------------------------------------
// 15. Nine mutants that survived section 14. Each fixture below is the input
//     that separates the real guard from its weakened twin, and nothing else in
//     the suite distinguishes them.
// ---------------------------------------------------------------------------

{
  // M02: distinctiveness tested on the previous side only. A line unique in the
  // previous document but repeated in the current one has ambiguous provenance
  // in exactly the direction that matters — which of the two copies is "the"
  // move is unknowable, so it must establish nothing.
  const prev = ['top', 'MARK', 'k1', 'k2', 'k3', 'bot'].join('\n') + '\n';
  const cur = ['top', 'k1', 'k2', 'k3', 'MARK', 'bot', 'MARK'].join('\n') + '\n';
  const d = gb.changedLines(prev, cur);
  check('a line repeated on the CURRENT side establishes no move',
    !d.touched.has(3), [...d.touched].sort((a, b) => a - b).join(','));

  // M05: the pairing key must be the line itself. Trimming it makes two lines
  // that differ only in leading space pair as the same text, and indentation is
  // meaningful in a spec — a nested list item is not the top-level one.
  const prev2 = ['top', '    MARK', 'k1', 'k2', 'k3', 'bot'].join('\n') + '\n';
  const cur2 = ['top', 'k1', 'k2', 'k3', 'MARK', 'bot'].join('\n') + '\n';
  const d2 = gb.changedLines(prev2, cur2);
  check('lines differing only in indentation do not pair as a move',
    !d2.touched.has(3), [...d2.touched].sort((a, b) => a - b).join(','));
}

{
  // M06 and M07: a block is a run of moved lines that were consecutive BEFORE
  // and stayed consecutive AFTER. Checking only one side merges two independent
  // moves into one span, and the invented span crosses lines neither block did.
  //
  // Here P1 and P2 are adjacent in the previous document and separated in the
  // current one, so the previous-side test alone would merge them.
  const prev = ['top', 'P1', 'P2', 'k1', 'k2', 'k3', 'bot'].join('\n') + '\n';
  const cur = ['top', 'k1', 'P1', 'k2', 'P2', 'k3', 'bot'].join('\n') + '\n';
  const d = gb.changedLines(prev, cur);
  const marked = [...d.touched].sort((a, b) => a - b).join(',');
  check('two moves that separated are not merged into one span',
    !d.touched.has(6), marked);

  // And the mirror: separated before, adjacent after.
  const prev2 = ['top', 'k1', 'Q1', 'k2', 'Q2', 'k3', 'bot'].join('\n') + '\n';
  const cur2 = ['top', 'Q1', 'Q2', 'k1', 'k2', 'k3', 'bot'].join('\n') + '\n';
  const d2 = gb.changedLines(prev2, cur2);
  check('two moves that joined are not merged into one span either',
    d2.touched.has(4) && d2.touched.has(5),
    [...d2.touched].sort((a, b) => a - b).join(','));
}

{
  // M10 and M11: a crossing needs BOTH halves. `pi > b.pEnd` alone marks every
  // matched line below the block's old position whether or not the block passed
  // it, which is most of the document.
  // The lines being tested sit two clear of the deletion the move leaves behind,
  // because the deletion-adjacency rule marks its own neighbours and would
  // otherwise mask the difference.
  const prev = ['top', 'k1', 'k2', 'MOVER', 'k3', 'k4', 'k5', 'bot'].join('\n') + '\n';
  const cur = ['top', 'MOVER', 'k1', 'k2', 'k3', 'k4', 'k5', 'bot'].join('\n') + '\n';
  const d = gb.changedLines(prev, cur);
  const marked = [...d.touched].sort((a, b) => a - b).join(',');
  // The block moved above k1 and k2, so those are crossed. k4 and k5 were below
  // it before and are still below it now, so they are not.
  check('a line the block did NOT pass is left exempt (downward half)',
    d.touched.has(3) && d.touched.has(4) && !d.touched.has(6) && !d.touched.has(7), marked);

  const prev2 = ['top', 'MOVER', 'k1', 'k2', 'k3', 'k4', 'bot'].join('\n') + '\n';
  const cur2 = ['top', 'k1', 'k2', 'MOVER', 'k3', 'k4', 'bot'].join('\n') + '\n';
  const d2 = gb.changedLines(prev2, cur2);
  const marked2 = [...d2.touched].sort((a, b) => a - b).join(',');
  check('a line the block did NOT pass is left exempt (upward half)',
    d2.touched.has(2) && d2.touched.has(3) && !d2.touched.has(5) && !d2.touched.has(6), marked2);
}

{
  const S = '## Baseline comparison';
  const at = (lines) => {
    const r = gb.locateSection(`${lines.join('\n')}\n`);
    return r ? r.start : null;
  };

  // H04: a comment ends on the line carrying `-->` wherever it sits on that
  // line. Requiring it to stand alone leaves the comment open and swallows the
  // rest of the file.
  check('a comment closed by a line with text before --> really closes',
    at(['# A', '<!--', 'note text -->', '', S, 'real']) === 5,
    String(at(['# A', '<!--', 'note text -->', '', S, 'real'])));

  // H10: the raw opener is case-insensitive, and it has to shield to matter —
  // an uppercase block with no heading inside proves nothing.
  check('an uppercase <PRE> shields a heading written inside it',
    at(['# A', '<PRE>', S, '</PRE>', '', S, 'real']) === 6,
    String(at(['# A', '<PRE>', S, '</PRE>', '', S, 'real'])));

  // H15: a type-6 block may open with a CLOSING tag. A stray `</div>` left by a
  // hand-edited audit starts a block that runs to the next blank line, and a
  // heading inside it is not a heading.
  check('a lone closing block tag opens a type-6 block',
    at(['# A', '</div>', S, '', S, 'real']) === 5,
    String(at(['# A', '</div>', S, '', S, 'real'])));
}

{
  // The last five mutants of section 15, each with the input that separates it.
  // The first two were found by randomised search rather than by construction:
  // hand-built fixtures kept being small enough that the ordinary
  // deletion-adjacency marking covered every line, so real and mutant agreed by
  // accident. They are kept verbatim, with their exact touched sets pinned,
  // because their value is that they discriminate — not that they read well.
  const J = (a) => `${a.join('\n')}\n`;
  const set = (d) => [...d.touched].sort((a, b) => a - b).join(',');

  // M05: the pairing key is the line itself, never a trimmed copy. Indentation
  // is meaningful in a spec — a nested list item is not the top-level one — and
  // trimming makes two different lines pair as a move that did not happen.
  const trimPrev = ['u3', 'u5', 'u6', 'u8', '  u3', 'u12', 'u4', 'u7', '  u2', '  u1', 'u9', 'u11', 'u2', 'u1'];
  const trimCur = ['  u1', 'u3', 'u8', 'NEWLINE', 'u6', 'u5', '  u3', 'u12', 'u4', 'u7', '  u2', 'u9', 'u11', 'u2', 'u1'];
  check('the pairing key is the raw line, not a trimmed one',
    set(gb.changedLines(J(trimPrev), J(trimCur))) === '1,2,3,4,5,6,7,8,9,10,11,12',
    set(gb.changedLines(J(trimPrev), J(trimCur))));

  // M06: a block is a run of moved lines consecutive on BOTH sides. Checking
  // only the previous side merges two independent moves into one span, and the
  // invented span crosses lines neither block did — and misses one that a real
  // block crossed.
  const grpPrev = ['u9', '  u2', '  u1', 'u1', '  u3', 'u12', 'u6', 'u8', 'u11', 'u10', 'u3'];
  const grpCur = ['  u2', 'u9', '  u1', 'u12', 'u1', 'u6', 'u8', 'NEWLINE', 'u10', '  u3', 'u3'];
  check('block grouping requires consecutiveness on both sides',
    set(gb.changedLines(J(grpPrev), J(grpCur))) === '1,2,3,4,5,6,7,8,9,10',
    set(gb.changedLines(J(grpPrev), J(grpCur))));

  // M07: the mirror of M06 — checking only the current side.
  const a = (n, p) => Array.from({ length: n }, (_, i) => `${p}${i + 1}`);
  const joinPrev = ['HEAD', ...a(3, 'a'), 'Q1', ...a(3, 'b'), 'Q2', 'TAIL'];
  const joinCur = ['HEADX', 'Q1', 'Q2', ...a(3, 'a'), ...a(3, 'b'), 'TAIL'];
  check('block grouping is not satisfied by the current side alone',
    set(gb.changedLines(J(joinPrev), J(joinCur))) === '1,2,3,4,5,6,7,8,9,10',
    set(gb.changedLines(J(joinPrev), J(joinCur))));

  // M10 and M11: a crossing needs BOTH halves of its condition. With `||`, every
  // matched line below the block's old position counts as crossed — which is
  // most of the document, and the blowup all over again.
  const downPrev = ['HEAD', ...a(3, 'a'), 'MOVER', ...a(8, 't'), 'TAIL'];
  const downCur = ['HEADX', 'MOVER', ...a(3, 'a'), ...a(8, 't'), 'TAILX'];
  const dd = gb.changedLines(J(downPrev), J(downCur));
  check('lines below a block that moved UP past them are left exempt',
    !dd.touched.has(7) && !dd.touched.has(10) && dd.touched.has(3), set(dd));

  const upPrev = ['HEAD', ...a(8, 'h'), 'MOVER', ...a(3, 'a'), 'TAIL'];
  const upCur = ['HEADX', ...a(8, 'h'), ...a(3, 'a'), 'MOVER', 'TAIL'];
  const uu = gb.changedLines(J(upPrev), J(upCur));
  check('lines above a block that moved DOWN past them are left exempt',
    !uu.touched.has(3) && !uu.touched.has(6) && uu.touched.has(10), set(uu));
}

// ---------------------------------------------------------------------------
console.log('\n15. R5-01 — the anchor is the text, not the line number');
// ---------------------------------------------------------------------------

// Run 5 scoped ten flips. The four filled from evidence records were all correct
// and all six hand-sourced matrix rows were wrong: four false positives, two
// unscopable. Every false positive is one conflation — a line RANGE cannot tell
// text that MOVED from text that CHANGED, because any edit above a citation
// invalidates its coordinate while leaving its content untouched.
//
// These tests are falsifiable against that claim: each asserts the same flip
// classifies differently depending only on whether the cited TEXT survived.

{
  // Displacement is not modification. The requirement is byte-identical; an
  // insertion above it moved it down two lines. This is run 5's route 3 in
  // miniature — there the gate's own LINT-18 remediation restructured a
  // paragraph into a table and manufactured the false positive.
  const before = ['intro', 'REQUIREMENT: rollback must be reversible', 'tail'].join('\n') + '\n';
  const after = ['intro', 'added one', 'added two',
    'REQUIREMENT: rollback must be reversible', 'tail'].join('\n') + '\n';
  const diff = gb.changedLines(before, after);
  const quote = 'REQUIREMENT: rollback must be reversible';

  const coordinate = gb.scopeOf({ lines: [[2, 3]], anchors: [] }, diff);
  check('a coordinate citation over displaced text scopes as changed',
    coordinate.scope === 'changed', coordinate.reason);

  const anchored = gb.scopeOf({ lines: [[2, 3]], anchors: [{ lines: [2, 3], quote }] }, diff);
  check('the same citation anchored on the surviving text scopes as unchanged',
    anchored.scope === 'unchanged', anchored.reason);
}

{
  // The two genuine directions must survive the change, or the fix has traded
  // false positives for false negatives — the worse trade, since a missed
  // regression is silent and a false one is at least argued with.
  const before = ['keep', 'REMOVED BY THE REVISION', 'keep2'].join('\n') + '\n';
  const after = ['keep', 'keep2', 'WRITTEN BY THE REVISION'].join('\n') + '\n';
  const diff = gb.changedLines(before, after);

  const gone = gb.scopeOf({ lines: [[1, 1]],
    anchors: [{ lines: [1, 1], quote: 'REMOVED BY THE REVISION' }] }, diff);
  check('text the revision removed scopes as changed', gone.scope === 'changed', gone.reason);

  const born = gb.scopeOf({ lines: [[1, 1]],
    anchors: [{ lines: [1, 1], quote: 'WRITTEN BY THE REVISION' }] }, diff);
  check('text the revision introduced scopes as changed', born.scope === 'changed', born.reason);
}

{
  // Run 5's route 2: a 95-line citation, 64 of its lines touched by an inserted
  // block, and the defect text byte-identical on both sides. Over-breadth in the
  // citation must not decide the verdict when the anchor answers it.
  const body = ['a', 'b', 'DEFECT: lever 2 needs new infrastructure', 'c', 'd'];
  const before = body.join('\n') + '\n';
  const after = ['a', 'b', 'INSERTED', 'INSERTED', 'INSERTED',
    'DEFECT: lever 2 needs new infrastructure', 'c', 'd'].join('\n') + '\n';
  const diff = gb.changedLines(before, after);
  const r = gb.scopeOf({ lines: [[1, 8]],
    anchors: [{ lines: [1, 8], quote: 'DEFECT: lever 2 needs new infrastructure' }] }, diff);
  check('an over-broad citation is settled by its anchor, not its width',
    r.scope === 'unchanged', r.reason);
}

{
  // An element with a changed anchor and an unchanged one is changed. Scanning
  // must not stop at the first anchor that happens to have survived.
  const before = ['alpha', 'GONE', 'omega'].join('\n') + '\n';
  const after = ['alpha', 'omega'].join('\n') + '\n';
  const diff = gb.changedLines(before, after);
  const r = gb.scopeOf({ lines: [[1, 2]], anchors: [
    { lines: [1, 1], quote: 'alpha' },
    { lines: [2, 2], quote: 'GONE' },
  ] }, diff);
  check('one changed anchor outweighs an unchanged one', r.scope === 'changed', r.reason);
}

{
  // Backwards compatibility, and it is load-bearing: every baseline written
  // before anchors existed carries lines and no quote. Those elements must keep
  // the coordinate test rather than silently becoming unscoped, which would have
  // turned the whole lint class unknown on the first run after this change.
  const diff = gb.changedLines(DOC_V1, DOC_V2);
  const r = gb.scopeOf({ lines: [[4, 4]], anchors: [] }, diff);
  check('an element with no anchor still falls through to the coordinate test',
    r.scope === 'changed', r.reason);

  const stale = gb.scopeOf({ lines: [[2, 2]],
    anchors: [{ lines: [2, 2], quote: 'text in neither document' }] }, diff);
  check('an anchor stale against BOTH documents answers nothing and falls through',
    stale.scope === 'unchanged' && /every line cited/.test(stale.reason), stale.reason);
}

{
  // fillFromEvidence used to import line_start and line_end and drop
  // exact_quote. checkQuote already validates that field against the pinned
  // hash, so the strongest signal in the record was the one thing not read.
  const root = tmpdir();
  const evidence = path.join(root, 'evidence');
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(path.join(evidence, 'LINT-03.json'), JSON.stringify({
    criterion: 'LINT-03', verdict: 'UNMET',
    evidence: [{ artifact: 'audit.md', line_start: 4, line_end: 4,
      exact_quote: 'Phase 2: old body', sha256: 'x' }],
  }), 'utf8');

  const els = gb.readElements(baseline({
    lint_results: { 'LINT-03': { status: 'fail' } },
  }), 'cur');
  gb.fillFromEvidence(els, evidence, 'audit.md');
  const el = els.get('lint:LINT-03');
  check('fillFromEvidence carries exact_quote onto the element',
    el.anchors.length === 1 && el.anchors[0].quote === 'Phase 2: old body',
    JSON.stringify(el.anchors));

  fs.writeFileSync(path.join(evidence, 'LINT-09.json'), JSON.stringify({
    criterion: 'LINT-09', verdict: 'UNMET',
    evidence: [{ artifact: 'audit.md', line_start: 2, line_end: 2,
      exact_quote: '   ', sha256: 'x' }],
  }), 'utf8');
  const els2 = gb.readElements(baseline({
    lint_results: { 'LINT-09': { status: 'fail' } },
  }), 'cur');
  gb.fillFromEvidence(els2, evidence, 'audit.md');
  check('a blank exact_quote is not taken as an anchor',
    els2.get('lint:LINT-09').anchors.length === 0);

  // A matrix row with a record must be anchored from it too. The guard here read
  // `el.kind !== 'lint'`, which was a true statement about what existed rather
  // than a rule, and would have made part B a code change as well as a schema
  // one. No matrix row emits a record yet, so this changes no run today.
  fs.writeFileSync(path.join(evidence, 'Auth flow.json'), JSON.stringify({
    evidence: [{ artifact: 'audit.md', line_start: 4, line_end: 4,
      exact_quote: 'Phase 2: old body', sha256: 'x' }],
  }), 'utf8');
  const els3 = gb.readElements(baseline({
    coverage_items: [{ name: 'Auth flow', status: 'gap' }],
  }), 'cur');
  gb.fillFromEvidence(els3, evidence, 'audit.md');
  const matrix = els3.get('coverage:Auth flow');
  check('a matrix row with an evidence record is anchored from it',
    matrix.anchors.length === 1 && matrix.anchors[0].quote === 'Phase 2: old body',
    JSON.stringify(matrix.anchors));
  check('and it scopes by that anchor, not by its line number',
    gb.scopeOf(matrix, gb.changedLines(DOC_V1, DOC_V2)).scope === 'changed');

  // A matrix row with no record is unchanged by any of this: still no anchor,
  // still the coordinate test. That is exactly the R5-01 remainder.
  const els4 = gb.readElements(baseline({
    coverage_items: [{ name: 'No record here', status: 'gap', lines: [[2, 2]] }],
  }), 'cur');
  gb.fillFromEvidence(els4, evidence, 'audit.md');
  check('a matrix row with no record still has no anchor (R5-01 remainder)',
    els4.get('coverage:No record here').anchors.length === 0);
}

{
  // The justification pin() writes must say which regressions were established.
  // In run 5's s8 re-run it claimed all five were on changed text when two
  // carried no line source at all.
  const prev = baseline({ concern_statuses: [{ name: 'API contract', status: 'ok' }] });
  const cur = baseline({ concern_statuses: [{ name: 'API contract', status: 'gap' }] });
  const c = gb.compare(prev, cur, gb.changedLines(DOC_V1, DOC_V2), {});
  check('an unscoped regression still blocks', c.verdict === 'UNMET', c.verdict);
  check('and the justification does not claim it was on changed text',
    /could not be scoped/.test(c.justification) && !/^.*All are on text/.test(c.justification),
    c.justification);
  check('the scoped and unscoped regression counts are reported apart',
    c.counts.regressions_unscoped === 1 && c.counts.regressions_scoped === 0,
    JSON.stringify(c.counts));
}

{
  // The real documents run 5 scoped, replayed. A synthetic case proves the
  // mechanism; only these prove the mechanism answers the case that was wrong.
  const base = 'C:/scratch/toque-run5/logs';
  const v2 = `${base}/s1-canary-artefacts-iter2/doc/make-report-delivery-faster-and-let-customers-schedule-reports.md`;
  const v3 = `${base}/s1-canary-artefacts-iter3/doc/make-report-delivery-faster-and-let-customers-schedule-reports.md`;
  if (!fs.existsSync(v2) || !fs.existsSync(v3)) {
    skip('run 5 route-3 false positive is eliminated on the real documents',
      'retained run-5 documents are not on this host');
  } else {
    const V2 = fs.readFileSync(v2, 'utf8');
    const V3 = fs.readFileSync(v3, 'utf8');
    const diff = gb.changedLines(V2, V3);
    const requirement = V2.replace(/\r\n/g, '\n').split('\n')[777];  // v2:778
    const cited = [[386, 389]];   // the split-by-author table, all four touched

    const before = gb.scopeOf({ lines: cited, anchors: [] }, diff);
    check('run 5: the coordinate citation reproduces the false positive',
      before.scope === 'changed', before.reason);

    const after = gb.scopeOf({ lines: cited,
      anchors: [{ lines: [386, 389], quote: requirement }] }, diff);
    check('run 5: anchored on the surviving requirement it is variance',
      after.scope === 'unchanged', after.reason);
  }
}

// ---------------------------------------------------------------------------
console.log('\n16. R5-01 remainder — a matrix row carries its anchor inline');

{
  // The row quotes the document beside its lines. That quote is the anchor.
  const els = gb.readElements(baseline({
    coverage_items: [{ name: 'Auth flow', status: 'gap', lines: [[4, 4]],
      exact_quote: 'Phase 2: old body', line_source: 'audit.md Coverage Matrix' }],
  }), 'cur');
  const el = els.get('coverage:Auth flow');
  check('an inline exact_quote becomes the row\'s anchor',
    el.anchors.length === 1 && el.anchors[0].quote === 'Phase 2: old body'
      && el.anchors[0].lines[0] === 4, JSON.stringify(el.anchors));
  const s = gb.scopeOf(el, gb.changedLines(DOC_V1, DOC_V2));
  check('and the row scopes by that anchor', s.scope === 'changed' && /removed by this revision/.test(s.reason), s.reason);

  // One quote per range. The run-5 rows cite three and four ranges each.
  const multi = gb.readElements(baseline({
    concern_statuses: [{ name: 'API contract', status: 'gap', lines: [[2, 2], [6, 7]],
      exact_quote: ['line2 unchanged', 'line6\nline7'] }],
  }), 'cur').get('concern:API contract');
  check('an array quote pairs one entry with each range',
    multi.anchors.length === 2 && multi.anchors[1].quote === 'line6\nline7'
      && multi.anchors[1].lines[1] === 7, JSON.stringify(multi.anchors));

  const throwsWith = (over, re) => {
    try { gb.readElements(baseline(over), 'cur'); return 'no error'; } catch (err) {
      return re.test(err.message) ? true : err.message;
    }
  };
  check('a single string against two ranges is refused',
    throwsWith({ coverage_items: [{ name: 'x', status: 'gap', lines: [[2, 2], [6, 6]], exact_quote: 'line2 unchanged' }] },
      /1 entries for 2 line range/) === true);
  check('a blank quote is refused',
    throwsWith({ coverage_items: [{ name: 'x', status: 'gap', lines: [[2, 2]], exact_quote: '  ' }] },
      /blank/) === true);
  check('a quote with no lines to anchor to is refused',
    throwsWith({ coverage_items: [{ name: 'x', status: 'gap', exact_quote: 'line1' }] },
      /no lines/) === true);
  check('and the refusal names the row',
    throwsWith({ coverage_items: [{ name: 'Named row', status: 'gap', lines: [[2, 2]], exact_quote: '' }] },
      /coverage:Named row/) === true);
  check('a row with lines and no quote is still accepted (every pre-anchor baseline)',
    gb.readElements(baseline({ coverage_items: [{ name: 'x', status: 'gap', lines: [[2, 2]] }] }), 'cur')
      .get('coverage:x').anchors.length === 0);
}

{
  // The quote is checked against the document, the way checkQuote checks a
  // record against the pinned hash. A quote that does not match is a citation
  // of text the author did not read.
  const ok = gb.readElements(baseline({
    coverage_items: [{ name: 'a', status: 'gap', lines: [[4, 5]], exact_quote: 'Phase 2: old body\nold detail' }],
  }), 'cur');
  check('checkAnchors passes a quote that matches the document at its lines',
    gb.checkAnchors(ok, DOC_V1, 'cur').length === 0);
  check('checkAnchors survives a CRLF document', gb.checkAnchors(ok, DOC_V1.replace(/\n/g, '\r\n'), 'cur').length === 0);

  const wrong = gb.readElements(baseline({
    coverage_items: [{ name: 'a', status: 'gap', lines: [[4, 4]], exact_quote: 'Phase 2: NEW body' }],
  }), 'cur');
  const f = gb.checkAnchors(wrong, DOC_V1, 'cur');
  check('a quote that does not match the document at its lines fails',
    f.length === 1 && /coverage:a: exact_quote at 4-4 does not match/.test(f[0]), JSON.stringify(f));

  const past = gb.readElements(baseline({
    coverage_items: [{ name: 'a', status: 'gap', lines: [[40, 41]], exact_quote: 'x' }],
  }), 'cur');
  check('a quote past the end of the document fails',
    /past the end/.test(gb.checkAnchors(past, DOC_V1, 'cur')[0] || ''));

  // An anchor a record supplied was validated by tq-evidence-validate.js and is
  // not re-checked here. What says "a record supplied it" is the mark
  // fillFromEvidence sets, not the line_source label: this test used to set
  // only the label and expect the exemption, which is the bypass section 17
  // closes — the label is a baseline field the author writes.
  const filled = gb.readElements(baseline({ lint_results: { 'LINT-03': 'fail' } }), 'cur');
  const el = filled.get('lint:LINT-03');
  el.lines = [[4, 4]]; el.anchors = [{ lines: [4, 4], quote: 'not in the doc' }];
  el.line_source = 'evidence/LINT-03.json';
  check('the evidence/ label alone does not exempt an anchor from the check',
    gb.checkAnchors(filled, DOC_V1, 'cur').length === 1);
  el.filled = true;
  check('an anchor filled from an evidence record is not re-checked against the document',
    gb.checkAnchors(filled, DOC_V1, 'cur').length === 0);
}

{
  // The scope reason names its route. Run 5's records read "line 386 is inside
  // the diff" with nothing to show the coordinate test had decided it.
  const diff = gb.changedLines(DOC_V1, DOC_V2);
  const coord = gb.scopeOf({ lines: [[4, 4]], anchors: [] }, diff);
  check('a coordinate-scoped element says it carries no anchor',
    /carries no anchor quote/.test(coord.reason), coord.reason);
  const stale = gb.scopeOf({ lines: [[2, 2]], anchors: [{ lines: [2, 2], quote: 'in neither' }] }, diff);
  check('an element whose anchor was stale says it fell back',
    /stale against both documents/.test(stale.reason), stale.reason);
}

{
  // End to end through the CLI: compare refuses a baseline whose quote does not
  // match, and snapshot names the rows that carry lines without one.
  const root = tmpdir();
  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V2, 'utf8');
  fs.writeFileSync(path.join(root, 'prev-doc.md'), DOC_V1, 'utf8');
  fs.writeFileSync(path.join(root, 'prev.json'), JSON.stringify({
    run_number: 1, doc_sha256: gb.hashContent(DOC_V1),
    concern_statuses: [{ name: 'API contract', status: 'ok', lines: [[2, 2]], exact_quote: 'line2 unchanged' }],
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'cur-bad.json'), JSON.stringify({
    run_number: 2,
    concern_statuses: [{ name: 'API contract', status: 'gap', lines: [[2, 2]], exact_quote: 'line2 CHANGED' }],
  }), 'utf8');
  const bad = runCli(['compare', 'prev.json', 'cur-bad.json', 'prev-doc.md', 'doc.md'], root);
  check('compare refuses a current baseline whose quote does not match the document',
    bad.code === 2 && /concern:API contract: exact_quote at 2-2 does not match/.test(bad.out), `exit ${bad.code}: ${bad.out}`);

  fs.writeFileSync(path.join(root, 'cur.json'), JSON.stringify({
    run_number: 2,
    concern_statuses: [{ name: 'API contract', status: 'gap', lines: [[2, 2]], exact_quote: 'line2 unchanged' }],
  }), 'utf8');
  const good = runCli(['compare', 'prev.json', 'cur.json', 'prev-doc.md', 'doc.md', '--out', 'cmp.json'], root);
  const cmp = JSON.parse(fs.readFileSync(path.join(root, 'cmp.json'), 'utf8'));
  check('compare accepts a matching quote and scopes the flip by it',
    good.code === 0 && cmp.verdict === 'MET' && cmp.rows[0].klass === 'VARIANCE'
      && /byte-identical/.test(cmp.rows[0].scope_reason), `exit ${good.code}: ${cmp.rows[0] && cmp.rows[0].scope_reason}`);

  // The previous side is re-checked too when its document is supplied.
  fs.writeFileSync(path.join(root, 'prev-bad.json'), JSON.stringify({
    run_number: 1, doc_sha256: gb.hashContent(DOC_V1),
    concern_statuses: [{ name: 'API contract', status: 'ok', lines: [[2, 2]], exact_quote: 'never there' }],
  }), 'utf8');
  const prevBad = runCli(['compare', 'prev-bad.json', 'cur.json', 'prev-doc.md', 'doc.md'], root);
  check('compare refuses a previous baseline whose quote does not match its document',
    prevBad.code === 2 && /previous baseline: concern:API contract/.test(prevBad.out), `exit ${prevBad.code}`);

  fs.writeFileSync(path.join(root, 'snap-bad.json'), JSON.stringify({
    run_number: 3,
    coverage_items: [{ name: 'Auth flow', status: 'gap', lines: [[4, 4]], exact_quote: 'Phase 2: old body' }],
  }), 'utf8');
  const snapBad = runCli(['snapshot', 'snap-bad.json', 'doc.md', 'state.json'], root);
  check('snapshot refuses a baseline whose quote does not match the document it is taken on',
    snapBad.code === 2 && /coverage:Auth flow: exact_quote at 4-4 does not match/.test(snapBad.out)
      && !fs.existsSync(path.join(root, 'state.json')), `exit ${snapBad.code}: ${snapBad.out}`);

  fs.writeFileSync(path.join(root, 'snap.json'), JSON.stringify({
    run_number: 3,
    coverage_items: [
      { name: 'Auth flow', status: 'gap', lines: [[4, 4]], exact_quote: 'Phase 2: NEW body' },
      { name: 'Unquoted row', status: 'gap', lines: [[6, 6]] },
    ],
    lint_results: { 'LINT-03': { status: 'fail', lines: [[4, 4]] } },
  }), 'utf8');
  // runCli returns stdout alone on exit 0; the warning is on stderr.
  const snapRun = require('child_process').spawnSync(process.execPath,
    [CLI, 'snapshot', 'snap.json', 'doc.md', 'state.json'], { cwd: root, encoding: 'utf8' });
  const snap = { code: snapRun.status, out: `${snapRun.stdout}${snapRun.stderr}` };
  check('snapshot accepts a matching quote and names the matrix rows that carry none',
    snap.code === 0 && /1 matrix row\(s\) carry lines but no exact_quote/.test(snap.out)
      && /coverage:Unquoted row/.test(snap.out) && !/coverage:Auth flow/.test(snap.out)
      && !/lint:LINT-03/.test(snap.out), `exit ${snap.code}: ${snap.out}`);
}

{
  // Two of the four run-5 false positives — the iteration-3 pair, route 3 —
  // replayed through compare() with the rows
  // carrying the anchor this change asks the executor to write. Section 15
  // proved scopeOf answers when handed an anchor; this proves a baseline row
  // in the published shape reaches that answer with nothing else in the way.
  const base = 'C:/scratch/toque-run5/logs';
  const v2 = `${base}/s1-canary-artefacts-iter2/doc/make-report-delivery-faster-and-let-customers-schedule-reports.md`;
  const v3 = `${base}/s1-canary-artefacts-iter3/doc/make-report-delivery-faster-and-let-customers-schedule-reports.md`;
  if (!fs.existsSync(v2) || !fs.existsSync(v3)) {
    skip('run 5 false positives are variance through compare() with inline anchors',
      'retained run-5 documents are not on this host');
  } else {
    const V2 = fs.readFileSync(v2, 'utf8');
    const V3 = fs.readFileSync(v3, 'utf8');
    const line = (t, n) => t.replace(/\r\n/g, '\n').split('\n')[n - 1];
    const diff = gb.changedLines(V2, V3);
    // The requirement both rows rest on: v2:778, byte-identical at v3:929.
    check('run 5: the requirement survives verbatim, displaced 151 lines',
      line(V2, 778) === line(V3, 929) && line(V2, 778).length > 20);

    const rows = ['Migration/backward compat'];
    const prevB = baseline({
      concern_statuses: rows.map((name) => ({ name, status: 'ok', lines: [[778, 778]], exact_quote: line(V2, 778) })),
      scenario_statuses: [{ id: 4, name: 'Backward compatibility', status: 'ok', lines: [[778, 778]], exact_quote: line(V2, 778) }],
    });
    const curCoord = baseline({
      concern_statuses: rows.map((name) => ({ name, status: 'gap', lines: [[386, 389]] })),
      scenario_statuses: [{ id: 4, name: 'Backward compatibility', status: 'gap', lines: [[386, 389]] }],
    });
    const curAnch = baseline({
      concern_statuses: rows.map((name) => ({ name, status: 'gap', lines: [[929, 929]], exact_quote: line(V3, 929) })),
      scenario_statuses: [{ id: 4, name: 'Backward compatibility', status: 'gap', lines: [[929, 929]], exact_quote: line(V3, 929) }],
    });
    check('run 5: the inline quotes validate against their documents',
      gb.checkAnchors(gb.readElements(prevB, 'p'), V2, 'p').length === 0
        && gb.checkAnchors(gb.readElements(curAnch, 'c'), V3, 'c').length === 0);

    const before = gb.compare(prevB, curCoord, diff, {});
    check('run 5: without a quote both rows are still REGRESSION and LINT-14 UNMET',
      before.verdict === 'UNMET' && before.counts.regressions === 2
        && before.rows.every((r) => /carries no anchor quote/.test(r.scope_reason)),
      `${before.verdict} ${JSON.stringify(before.counts)}`);
    const after = gb.compare(prevB, curAnch, diff, {});
    check('run 5: with the quote both rows are VARIANCE and LINT-14 MET',
      after.verdict === 'MET' && after.counts.variance === 2 && after.counts.regressions === 0,
      `${after.verdict} ${JSON.stringify(after.counts)}`);
  }
}

// ---------------------------------------------------------------------------
console.log('\n17. The CLI reaches the anchor — a second review of part B');
// ---------------------------------------------------------------------------

{
  // Found by a second reviewer reading the CLI path, not by a run. cmdCompare
  // read the elements, filled anchors from evidence, then handed compare() the
  // raw baseline object, which re-read the elements from scratch; a write-back
  // loop copied the filled `lines` onto the object first — lint rows only — and
  // copied no anchors. So every anchor a record supplied was dropped at the
  // handoff, and the CLI scoped a record-anchored element by coordinate while
  // section 15 and 16, which call compare() directly, scoped it by text.
  //
  // The shape is run 5's route 1: a line inserted above the citation and an
  // edit below it. The cited line survives byte-identical and lands on a seam,
  // so the coordinate test marks it and the anchor test does not. Asserting
  // the diff first makes the disagreement part of the test rather than an
  // assumption about the seam rule.
  const v1 = ['line1', 'line2 unchanged', 'line3', 'line4', 'line5', 'line6'].join('\n') + '\n';
  const v2 = ['line1', 'inserted', 'line2 unchanged', 'line3', 'line4 NEW', 'line5', 'line6'].join('\n') + '\n';
  const d = gb.changedLines(v1, v2);
  check('the surviving line sits on a seam the coordinate test marks',
    d.touched.has(3) && v2.split('\n')[2] === 'line2 unchanged', [...d.touched].join(','));

  const root = tmpdir();
  fs.mkdirSync(path.join(root, 'ev'));
  fs.writeFileSync(path.join(root, 'doc.md'), v2, 'utf8');
  fs.writeFileSync(path.join(root, 'prev-doc.md'), v1, 'utf8');
  fs.writeFileSync(path.join(root, 'prev.json'), JSON.stringify({
    run_number: 1, doc_sha256: gb.hashContent(v1), lint_results: { 'LINT-05': 'pass' },
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'ev', 'LINT-05.json'), JSON.stringify({
    criterion_id: 'LINT-05',
    evidence: [{ artifact: 'doc.md', line_start: 3, line_end: 3, exact_quote: 'line2 unchanged', sha256: gb.hashContent(v2) }],
    reasoning: 'r', verdict: 'UNMET',
  }), 'utf8');
  fs.writeFileSync(path.join(root, 'cur.json'), JSON.stringify({
    run_number: 2, lint_results: { 'LINT-05': 'fail' },
  }), 'utf8');

  // In-process, the coordinate route alone: the flip is a REGRESSION.
  const coord = gb.compare(
    baseline({ lint_results: { 'LINT-05': 'pass' } }),
    baseline({ lint_results: { 'LINT-05': { status: 'fail', lines: [[3, 3]], line_source: 'evidence/LINT-05.json' } } }),
    d, {},
  );
  check('by coordinate alone the same flip is a REGRESSION and LINT-14 UNMET',
    coord.verdict === 'UNMET' && coord.rows[0].klass === 'REGRESSION', `${coord.verdict} ${coord.rows[0].klass}`);

  // Through the CLI with the evidence record: the anchor must reach compare().
  const r = runCli(['compare', 'prev.json', 'cur.json', 'prev-doc.md', 'doc.md',
    '--evidence', 'ev', '--root', root, '--out', 'cmp.json'], root);
  const cmp = fs.existsSync(path.join(root, 'cmp.json'))
    ? JSON.parse(fs.readFileSync(path.join(root, 'cmp.json'), 'utf8')) : { rows: [] };
  const row = cmp.rows.find((x) => x.id === 'LINT-05') || {};
  check('through the CLI the record-anchored flip is VARIANCE and LINT-14 MET',
    r.code === 0 && /LINT-14: MET/.test(r.out), `exit ${r.code}: ${r.out}`);
  check('and the scope reason says the text was found, not that the line was clear',
    /byte-identical/.test(row.scope_reason || ''), row.scope_reason);
  check('the comparison records which element was filled from evidence',
    Array.isArray(cmp.meta && cmp.meta.evidence_filled) && cmp.meta.evidence_filled.includes('LINT-05'),
    JSON.stringify(cmp.meta && cmp.meta.evidence_filled));
}

{
  // The other finding of the same review. checkAnchors skipped any element
  // whose line_source began `evidence/` — the label the schema tells the author
  // to write on a lint row — so an inline quote that matched nothing entered a
  // baseline unchecked under `"line_source": "evidence/anything.json"`. The
  // skip now keys on the mark fillFromEvidence sets, which no baseline field
  // can spell.
  const wrong = baseline({
    coverage_items: [{ name: 'Invented', status: 'gap', lines: [[1, 1]], exact_quote: 'not what line 1 says', line_source: 'evidence/anything.json' }],
  });
  const bad = gb.checkAnchors(gb.readElements(wrong, 'b'), DOC_V2, 'b');
  check('an evidence/ label on an inline row does not exempt its quote from the check',
    bad.length === 1 && /does not match the document/.test(bad[0]), JSON.stringify(bad));
  check('readElements never marks an element as filled',
    [...gb.readElements(wrong, 'b').values()].every((el) => !el.filled));

  const root = tmpdir();
  fs.writeFileSync(path.join(root, 'doc.md'), DOC_V2, 'utf8');
  fs.writeFileSync(path.join(root, 'b.json'), JSON.stringify(wrong), 'utf8');
  const snap = runCli(['snapshot', 'b.json', 'doc.md', 'state.json'], root);
  check('snapshot refuses it, whatever the label says',
    snap.code === 2 && /does not match the document/.test(snap.out), `exit ${snap.code}: ${snap.out}`);

  // And an element that WAS filled from a record still skips the inline check,
  // because its quote was validated against the pinned hash by the validator.
  fs.mkdirSync(path.join(root, 'evidence'));
  fs.writeFileSync(path.join(root, 'evidence', 'LINT-03.json'), JSON.stringify({
    criterion_id: 'LINT-03',
    evidence: [{ artifact: 'docs/spec.md', line_start: 2, line_end: 2, exact_quote: 'line2 unchanged', sha256: gb.hashContent(DOC_V2) }],
    reasoning: 'r', verdict: 'UNMET',
  }), 'utf8');
  const els = gb.readElements(baseline({ lint_results: { 'LINT-03': 'fail' } }), 'c');
  gb.fillFromEvidence(els, path.join(root, 'evidence'), 'docs/spec.md');
  check('fillFromEvidence marks the element it filled',
    els.get('lint:LINT-03') && els.get('lint:LINT-03').filled === true);
}

// ---------------------------------------------------------------------------
for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (err) { /* best effort */ }
}

console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} SKIPPED (not run on this host)` : ''}`);
process.exit(fail > 0 ? 1 : 0);
