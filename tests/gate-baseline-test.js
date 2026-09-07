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
function check(name, cond, detail) {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); fail++; }
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

// ---------------------------------------------------------------------------
for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (err) { /* best effort */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
