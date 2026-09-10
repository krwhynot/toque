#!/usr/bin/env node
/**
 * Baseline comparison and the LINT-14 record — decision D10, stress run 4 R4-01.
 *
 * The design gate spawns a FRESH auditor every revision iteration, which maximises
 * the chance that two audits of one unchanged passage disagree. D10 settled what
 * that disagreement costs: an element that was passing and now fails is a
 * REGRESSION only when a line it cites lies inside the diff between the previous
 * baseline's document and the current one. A flip on text the revision never
 * touched is AUDITOR VARIANCE — reported, never a LINT-14 failure.
 *
 * The rule was prose, and the prose named "the line the item's new record cites".
 * Coverage rows, scenario rows and concern rows have no evidence record. In stress
 * run 4 the one criterion standing between a spec and the gate's first observed
 * PASS was a cross-cutting concern row, and two readers of the same paragraph
 * reached opposite verdicts about whether it could be a regression at all.
 *
 * A script cannot leave that referent unsupplied. Every element compared here
 * carries a LINE SOURCE — the file and field the cited lines were read from — and
 * an element that carries none is said out loud and booked as a regression rather
 * than guessed either way. That is the whole reason this file exists: not to save
 * the caller typing, but to make the comparison state what it compared.
 *
 * What this module does NOT do: decide any element's status. The auditor decides
 * those and the caller collects them into a baseline. This module diffs two
 * documents, classifies transitions against that diff, renders the section, and
 * pins the record to it. Given the same inputs it returns the same answer, which
 * is the property the prose could not offer.
 *
 * Subcommands, in the order the gate runs them:
 *   compare   diff the two documents and classify every element
 *   record    write `## Baseline comparison` into audit.md and pin evidence/LINT-14.json
 *   repin     recompute that pin after a later append to audit.md
 *   snapshot  write the new baseline into status.json/gate.json and keep the doc copy
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Hash LF-normalized content, never raw bytes — the same rule as
 * tq-evidence-validate.js, and for the same reason. This repository stores LF
 * blobs and checks out CRLF on Windows, so a raw-byte hash would agree with the
 * validator on Ubuntu and disagree on the machine the stress runs execute on.
 * The two scripts must produce the same number for the same file or the pin this
 * one writes fails the validation the gate runs next.
 */
function hashContent(text) {
  return crypto.createHash('sha256')
    .update(String(text).replace(/\r\n/g, '\n'), 'utf8')
    .digest('hex');
}

function splitLines(text) {
  return String(text).replace(/\r\n/g, '\n').split('\n');
}

/**
 * The status vocabulary, closed and mapped in one place.
 *
 * R4-06: the baseline schema enumerated `covered|partial|ok-excluded|gap` while
 * the auditor's own matrices emit `OK|WARNING|GAP` and its lint table emits
 * `PASS|FAIL|N_A`. Nothing mapped them, so the caller mapped them by hand, per
 * row, per iteration. Three vocabularies collapse here into four ranks, and a
 * token outside all three is refused rather than guessed — an unmapped status
 * silently becoming "pass" would turn a real regression into an unchanged row.
 *
 * `ok-excluded` ranks with `pass` deliberately: a scope exclusion the audit
 * accepted is not a gap, and demoting it would make every accepted exclusion
 * read as a degradation the next iteration.
 */
const STATUS_ALIASES = {
  pass: 'pass',
  met: 'pass',
  ok: 'pass',
  covered: 'pass',
  'ok-excluded': 'pass',
  ok_excluded: 'pass',
  excluded: 'pass',
  verified: 'pass',

  partial: 'partial',
  warn: 'partial',
  warning: 'partial',

  addressed: 'pass',

  fail: 'fail',
  unmet: 'fail',
  gap: 'fail',
  falsified: 'fail',
  missing: 'fail',

  n_a: 'n_a',
  na: 'n_a',
  'n/a': 'n_a',
  'not-applicable': 'n_a',
};

/**
 * Ranks order the three comparable statuses. `n_a` has NO rank on purpose.
 *
 * The registry already records why: a vacuous rule written N_A on one run and
 * PASS on the next was being read as a regression on a document nobody changed.
 * Giving N_A a rank puts it back on the ladder and re-opens that. Every
 * transition involving N_A is reported as NOT-COMPARABLE instead, which is what
 * it is — the auditor changed its mind about whether the rule applies, and that
 * is not a statement about the document.
 */
const RANK = { fail: 1, partial: 2, pass: 3 };

function normalizeStatus(raw) {
  // Strip a trailing parenthetical before looking the token up. Real audits
  // write `COVERED (see gap 2)` and `OK (partial — see M13)` in their matrices,
  // and refusing those sends the caller back to hand-mapping every row, which
  // is the transcription step this script exists to remove. The parenthetical
  // is a note to a human; the token before it is the status.
  const key = String(raw == null ? '' : raw)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .toLowerCase();

  // Object.hasOwn, not a truthiness test on the lookup. A plain `in`-style
  // lookup on an object literal reaches Object.prototype, so `constructor`
  // returned a function and `valueOf` a method — both truthy, both accepted as
  // a status, neither a status. An unmapped token must be REFUSED; that promise
  // is in stage-2-design.md and a prototype member silently kept it from being
  // true.
  if (!Object.hasOwn(STATUS_ALIASES, key)) {
    throw new Error(
      `unknown status ${JSON.stringify(raw)} — known: ${Object.keys(STATUS_ALIASES).join(', ')}`,
    );
  }
  return STATUS_ALIASES[key];
}

/**
 * Accept the several spellings a line citation arrives in and return
 * [[start, end], ...] with 1-based inclusive integers.
 *
 * Permissive on input, strict on output. The caller is transcribing from a
 * markdown table by hand; refusing `[100, 103]` because the schema example shows
 * `[[100, 103]]` would send them back to prose, which is the failure this file
 * exists to end. A range that cannot be read at all still throws — a malformed
 * citation must not silently become "no lines", because "no lines" is what books
 * a flip as an unscoped regression.
 */
function normalizeLines(raw) {
  if (raw == null) return [];
  const out = [];

  const pushPair = (a, b) => {
    const start = Number(a);
    const end = Number(b == null ? a : b);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      throw new Error(`invalid line range ${JSON.stringify(raw)}`);
    }
    out.push([start, end]);
  };

  const one = (v) => {
    if (typeof v === 'number') return pushPair(v, v);
    if (typeof v === 'string') {
      const m = v.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
      if (!m) throw new Error(`invalid line range ${JSON.stringify(v)}`);
      return pushPair(m[1], m[2]);
    }
    if (Array.isArray(v)) {
      if (v.length === 1) return pushPair(v[0], v[0]);
      if (v.length === 2) return pushPair(v[0], v[1]);
      throw new Error(`invalid line range ${JSON.stringify(v)}`);
    }
    if (v && typeof v === 'object' && (v.line_start !== undefined || v.start !== undefined)) {
      const s = v.line_start !== undefined ? v.line_start : v.start;
      const e = v.line_end !== undefined ? v.line_end : (v.end !== undefined ? v.end : s);
      return pushPair(s, e);
    }
    throw new Error(`invalid line range ${JSON.stringify(v)}`);
  };

  if (typeof raw === 'number' || typeof raw === 'string') {
    one(raw);
  } else if (Array.isArray(raw)) {
    // A bare pair of integers, [100, 103], is one range and not two lines.
    // Ambiguous by construction; resolved toward the reading that appears in
    // every hand-written baseline seen so far.
    if (raw.length === 2 && raw.every((v) => typeof v === 'number')) {
      pushPair(raw[0], raw[1]);
    } else {
      raw.forEach(one);
    }
  } else {
    one(raw);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The diff
// ---------------------------------------------------------------------------

/**
 * How large an LCS table this will build before falling back.
 *
 * 12M cells is 48MB as an Int32Array, which is fine for the 300-1500 line specs
 * the gate audits after the common prefix and suffix are trimmed off. Past it,
 * the fallback marks the whole changed region touched — the CONSERVATIVE
 * direction, since a line wrongly marked touched can only turn a variance into a
 * regression, and the gate's stated rule is that the exemption is never applied
 * on a guess.
 */
const LCS_CELL_LIMIT = 12000000;

/**
 * Current-document line numbers the revision changed, 1-based.
 *
 * Insertions mark the inserted line. Deletions mark the current lines on BOTH
 * sides of the point the text was removed from, because a deletion changes no
 * current line by itself and yet is unmistakably something the revision did; a
 * citation spanning the join is citing changed text. Marking both neighbours
 * over-reports rather than under-reports, in the same direction as the fallback
 * above and for the same reason.
 *
 * Returns { touched, moved, coarse, changed, total, prevLines, curLines }. The
 * two line arrays are what lets scopeByAnchor ask whether cited TEXT survived,
 * rather than only whether its line number was disturbed. `moved` is the subset
 * of `touched` that crossedByMovedBlocks marked, kept apart because scopeOf
 * consults it AFTER an anchor has answered: a quote that survived verbatim
 * settles a seam or an edit above it, and does not settle a block that was
 * carried across it.
 */
/**
 * The written record carries the diff's numbers, not its sets or line arrays:
 * a Set serialises as `{}` and the two line arrays are the whole document
 * twice over. `moved` is the count of touched lines a relocated block marked.
 */
function diffResult(d) {
  Object.defineProperty(d, 'toJSON', {
    enumerable: false,
    value: () => ({ coarse: d.coarse, changed: d.changed, moved: d.moved ? d.moved.size : 0, total: d.total }),
  });
  return d;
}

function changedLines(prevText, curText) {
  const prev = splitLines(prevText);
  const cur = splitLines(curText);
  const touched = new Set();

  let p = 0;
  while (p < prev.length && p < cur.length && prev[p] === cur[p]) p++;

  let s = 0;
  while (s < prev.length - p && s < cur.length - p
    && prev[prev.length - 1 - s] === cur[cur.length - 1 - s]) s++;

  const prevMid = prev.slice(p, prev.length - s);
  const curMid = cur.slice(p, cur.length - s);

  const markDeletion = (j) => {
    if (p + j >= 1) touched.add(p + j);
    if (p + j + 1 <= cur.length) touched.add(p + j + 1);
  };

  const n = prevMid.length;
  const m = curMid.length;

  const moved = new Set();
  if (n === 0 && m === 0) {
    return diffResult({ touched, moved, coarse: false, changed: 0, total: cur.length, prevLines: prev, curLines: cur });
  }

  if ((n + 1) * (m + 1) > LCS_CELL_LIMIT) {
    for (let j = 0; j < m; j++) touched.add(p + j + 1);
    if (n > 0 && m === 0) markDeletion(0);
    return diffResult({ touched, moved, coarse: true, changed: touched.size, total: cur.length, prevLines: prev, curLines: cur });
  }

  const w = m + 1;
  const dp = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = prevMid[i] === curMid[j]
        ? dp[(i + 1) * w + (j + 1)] + 1
        : Math.max(dp[(i + 1) * w + j], dp[i * w + (j + 1)]);
    }
  }

  let i = 0;
  let j = 0;
  // Matched pairs inside the changed middle, kept so displacement can be judged
  // after the walk. A line that matched at a DIFFERENT offset than its partner
  // did not survive the revision untouched — the revision moved it.
  const matched = [];
  while (i < n && j < m) {
    if (prevMid[i] === curMid[j]) {
      matched.push([i, j]);
      i++; j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) {
      markDeletion(j);
      i++;
    } else {
      touched.add(p + j + 1);
      j++;
    }
  }
  while (i < n) { markDeletion(j); i++; }
  while (j < m) { touched.add(p + j + 1); j++; }

  // The BOUNDARIES of a displaced run count as touched.
  //
  // LCS finds ONE maximal alignment, and when two blocks swap it is free to
  // represent that as "the smaller block moved" — which leaves the larger
  // block's lines matched, unmarked, and therefore eligible for the variance
  // exemption. Swapping two adjacent blocks left the relocated lines outside
  // the touched set entirely, so a concern citing a moved line was exempted on
  // text the revision plainly did move.
  //
  // Marking EVERY displaced line instead is what the first version of this rule
  // did, on the reasoning that over-reporting can only turn a variance into a
  // regression. It cannot be afforded. Measured on a 300-line document: one
  // insertion at the top marks 1 line, but an insertion at the top plus a single
  // edit at the bottom marks 302 of 303 — because trimming the common prefix and
  // suffix only protects a document edited at ONE end. Two ordinary edits, a
  // revision note near the front and a review note near the back, switched the
  // exemption off for the whole document. That kills D10 by the opposite route
  // to the bug this rule exists to close.
  //
  // A run is a maximal stretch of matched pairs sharing one offset. Only the
  // first and last line of a run whose offset differs from the run before it are
  // marked: those are the seams where text actually moved relative to its
  // neighbours. The same 300-line case now marks 4 lines, and the block swap is
  // still caught at both of its seams.
  //
  // Seams alone are NOT enough, and the reason is worth stating because the
  // opposite was asserted here. The offset cj - pi carries no information beyond
  // "text was added or removed above", so no threshold on it can separate a moved
  // block from shifted text. But the ALIGNMENT carries more than the offset, and
  // `crossedByMovedBlocks` below uses it.
  const runs = [];
  for (const [pi, cj] of matched) {
    const off = cj - pi;
    const last = runs[runs.length - 1];
    if (last && last.off === off && last.lastPi === pi - 1) {
      last.lastPi = pi;
      last.lastCj = cj;
    } else {
      runs.push({ off, firstCj: cj, lastCj: cj, lastPi: pi });
    }
  }
  for (let i = 0; i < runs.length; i++) {
    const prevOff = i > 0 ? runs[i - 1].off : 0;
    if (runs[i].off !== prevOff) {
      touched.add(p + runs[i].firstCj + 1);
      touched.add(p + runs[i].lastCj + 1);
    }
  }

  // Lines a MOVED block passed over count as touched, interior included.
  for (const cj of crossedByMovedBlocks(matched, prevMid, curMid, prev, cur)) {
    touched.add(p + cj + 1);
    moved.add(p + cj + 1);
  }

  return diffResult({ touched, moved, coarse: false, changed: touched.size, total: cur.length, prevLines: prev, curLines: cur });
}

/**
 * Find blocks the revision RELOCATED, and return the matched lines they crossed.
 *
 * Seam marking alone left a real regression exempt. Move the "Commit payment"
 * block above "Validate request" and a concern reading "authorization happens
 * before commit" flips pass -> fail citing a validation line — a line whose own
 * text is untouched, in the interior of the run that the commit block passed
 * over. Under seams alone that came back VARIANCE, LINT-14 MET, exit 0, on a
 * revision that reordered the two phases. The ordering IS what the concern is
 * about.
 *
 * It was asserted here that this could not be recovered, on the grounds that
 * cj - pi is identically (insertions above - deletions above) and so says
 * nothing beyond "text changed above". That identity is true and the conclusion
 * drawn from it was wrong: the offset is not the only thing the alignment holds.
 * A maximal unmatched run on the previous side whose content EQUALS a maximal
 * unmatched run on the current side is a block deleted from one place and
 * inserted in another — a move, named by content rather than inferred from
 * position. The matched lines it crossed are those it was on one side of before
 * and is on the other side of now.
 *
 * The cost is a hash map over unmatched runs; the LCS table is not enlarged.
 * Ordinary revisions are untouched because their unmatched runs do not pair:
 * inserting one line at the top and editing the last line of a 300-line document
 * still marks 4 lines, not 302.
 *
 * What this does NOT do: establish that a retained requirement was unaffected
 * when only its surrounding prose was rewritten. Two blocks whose content is
 * merely similar do not pair, and identical text appearing three times leaves
 * provenance ambiguous. The honest limit is that the alignment cannot show a
 * retained line was unaffected — not that its interior is auditor variance.
 */
function crossedByMovedBlocks(matched, prevMid, curMid, prevAll, curAll) {
  const crossed = new Set();
  if (!matched.length) return crossed;

  const matchedPrev = new Set(matched.map(([pi]) => pi));
  const matchedCur = new Set(matched.map(([, cj]) => cj));

  // DISTINCTIVENESS, counted over the whole documents rather than the diff.
  //
  // The first version paired any unmatched run whose bytes were equal. A markdown
  // document is mostly repeated single lines — blanks, `---`, `|---|---|` — and
  // one of those pairing with an identical copy at the far end marks everything
  // between. Measured: deleting one blank line below the title and adding one
  // before the appendix marked 145 of 150 lines, and relocating a single `---`
  // marked 334 of 361. That is the variance exemption switched off by a
  // whitespace edit, which is the third time this file has produced that failure.
  //
  // A line that occurs more than once ANYWHERE cannot identify anything: its
  // provenance is ambiguous, so it supports no claim about what moved. Note that
  // uniqueness among unmatched runs is not enough — the blank-line case has
  // exactly one unmatched blank on each side and still blows up.
  const freq = (lines) => {
    const m = new Map();
    for (const l of lines) m.set(l, (m.get(l) || 0) + 1);
    return m;
  };
  const fp = freq(prevAll);
  const fc = freq(curAll);
  const distinctive = (l) => fp.get(l) === 1 && fc.get(l) === 1;

  const curAt = new Map();
  for (let j = 0; j < curMid.length; j++) {
    if (!matchedCur.has(j) && distinctive(curMid[j])) curAt.set(curMid[j], j);
  }

  // Pairing is LINE by line, not run by run. Requiring two whole unmatched runs
  // to be byte-equal made the detector brittle in the ordinary case: move a block
  // and write one revision note beside it, and the new run is one line longer, so
  // the runs no longer pair, no move is found, and the reordering the note is
  // ABOUT goes back to being auditor variance. Distinctive lines are matched
  // individually and regrouped below, so text added next to a moved block does
  // not hide the move.
  //
  // No `used` set is needed: a distinctive line has at most one home on each
  // side, so there is nothing to disambiguate and no greedy choice to get wrong.
  const pairs = [];
  for (let i = 0; i < prevMid.length; i++) {
    if (matchedPrev.has(i) || !distinctive(prevMid[i])) continue;
    const j = curAt.get(prevMid[i]);
    if (j !== undefined) pairs.push([i, j]);
  }
  if (!pairs.length) return crossed;

  // Regroup: lines that were consecutive before and stayed consecutive after are
  // one block, so the crossing test runs once per block rather than once per line.
  const blocks = [];
  for (const [i, j] of pairs) {
    const last = blocks[blocks.length - 1];
    if (last && last.pEnd === i - 1 && last.cEnd === j - 1) {
      last.pEnd = i;
      last.cEnd = j;
    } else {
      blocks.push({ pStart: i, pEnd: i, cStart: j, cEnd: j });
    }
  }

  for (const b of blocks) {
    for (const [pi, cj] of matched) {
      const crossedDown = pi > b.pEnd && cj < b.cStart;
      const crossedUp = pi < b.pStart && cj > b.cEnd;
      if (crossedDown || crossedUp) crossed.add(cj);
    }
  }
  return crossed;
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

/**
 * LINT-14 is excluded from its own comparison.
 *
 * It is the caller's verdict ABOUT this comparison, so comparing it compares the
 * gate's opinion of the previous iteration with its opinion of this one. The
 * auditor records it N_A every time ("caller compares") and the caller then
 * overwrites it, which means the baseline holds N_A on one run and UNMET on the
 * next — a transition that says nothing about the document and would report as
 * NOT-COMPARABLE noise on every single iteration.
 */
const SELF_REFERENTIAL = new Set(['LINT-14']);

/**
 * Read the four element groups out of a baseline object into one flat map.
 *
 * The four groups keep the field names the published schema uses, so an existing
 * baseline still parses. What is NEW is `lines` and `line_source` on every row:
 * a lint element can fill them from its evidence record, a matrix row has no
 * record and must carry them itself. That is R4-01 closed at the input, before
 * any classification happens.
 */
/**
 * Read a row's inline `exact_quote` into anchors, one per line range.
 *
 * Accepts a string when the row cites exactly one range, or an array with one
 * entry per range. Anything else is a shape error, thrown so the caller can name
 * the row: a quote that cannot be paired with its range cannot be validated, and
 * an unvalidated quote is the fabricated citation this field exists to refuse.
 * A blank quote is refused for the reason tq-evidence-validate.js gives: it
 * survives against any document alive. No quote at all is not an error — it is
 * every baseline written before this field existed.
 */
function readInlineAnchors(raw, lines) {
  if (raw == null) return [];
  const quotes = Array.isArray(raw) ? raw : [raw];
  if (!lines.length) {
    throw new Error('exact_quote given with no lines to anchor it to');
  }
  if (quotes.length !== lines.length) {
    throw new Error(`exact_quote has ${quotes.length} entries for ${lines.length} line range(s); give one quote per range`);
  }
  const anchors = [];
  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    if (typeof q !== 'string') {
      throw new Error(`exact_quote[${i}] is not a string`);
    }
    const quote = q.replace(/\r\n/g, '\n');
    if (!quote.trim()) {
      throw new Error(`exact_quote[${i}] is blank; a quote that says nothing anchors nothing`);
    }
    anchors.push({ lines: lines[i], quote });
  }
  return anchors;
}

/**
 * Check every anchor against the document it claims to quote.
 *
 * The same test checkQuote in tq-evidence-validate.js applies to an evidence
 * record: the lines cited, sliced out of the document, must equal the quote
 * byte for byte after CRLF normalisation. Returns the list of failures, one
 * string per anchor, empty when every quote matches. The caller decides what a
 * failure costs; both callers refuse the baseline, because a quote that does
 * not match the pinned document is a citation of text the author did not read,
 * and the coordinate test it would fall back to is the false positive R5-01
 * exists to end.
 *
 * Only anchors read INLINE are checked here. An anchor fillFromEvidence took
 * from a record was already validated by tq-evidence-validate.js against the
 * pinned hash, and an element that was filled has no inline quote to check.
 * "Filled" is the mark fillFromEvidence sets, not the line_source label: the
 * label is part of the published baseline schema and the author writes it, so
 * it cannot be what decides whether the author's quote is read.
 */
function checkAnchors(els, docText, label) {
  const where = label || 'baseline';
  const docLines = String(docText).replace(/\r\n/g, '\n').split('\n');
  const failures = [];
  for (const el of els.values()) {
    if (el.filled) continue;
    for (const a of el.anchors || []) {
      const [start, end] = a.lines;
      if (end > docLines.length) {
        failures.push(`${where}: ${el.key}: exact_quote at ${start}-${end} cites past the end of a ${docLines.length}-line document`);
        continue;
      }
      const actual = docLines.slice(start - 1, end).join('\n');
      if (actual !== a.quote) {
        failures.push(`${where}: ${el.key}: exact_quote at ${start}-${end} does not match the document at those lines`);
      }
    }
  }
  return failures;
}

function readElements(baseline, label) {
  const els = new Map();
  const where = label || 'baseline';

  const add = (kind, id, name, raw, defaultSource) => {
    if (kind === 'lint' && SELF_REFERENTIAL.has(id)) return;
    const key = `${kind}:${id}`;
    if (els.has(key)) {
      throw new Error(`${where}: duplicate element ${key}`);
    }
    const obj = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : { status: raw };
    let status;
    try {
      status = normalizeStatus(obj.status);
    } catch (err) {
      throw new Error(`${where}: ${key}: ${err.message}`);
    }
    let lines;
    try {
      lines = normalizeLines(obj.lines);
    } catch (err) {
      throw new Error(`${where}: ${key}: ${err.message}`);
    }
    let anchors;
    try {
      anchors = readInlineAnchors(obj.exact_quote, lines);
    } catch (err) {
      throw new Error(`${where}: ${key}: ${err.message}`);
    }
    els.set(key, {
      key,
      kind,
      id,
      label: name || id,
      status,
      lines,
      // A lint element is filled by fillFromEvidence from its record. A matrix
      // row has no record and its NAME is not in the document either — of the
      // five row names run 5 scoped, four appear zero times in both documents,
      // because they are the auditor's rubric categories rather than the
      // document's own text. So a matrix row carries its anchor INLINE: an
      // `exact_quote` beside `lines`, one quote per range, the text of {doc} at
      // that range verbatim. That is R5-01's remainder. The quote is validated
      // against the document by checkAnchors before any comparison runs, so a
      // row that cites lines it did not read cannot enter a baseline. A row
      // that carries lines and no quote is still accepted — every baseline
      // written before this field existed is that shape — and stays on the
      // coordinate test, which the scope reason then says.
      anchors,
      line_source: obj.line_source || (lines.length ? defaultSource : null),
    });
  };

  const lint = baseline.lint_results || {};
  for (const id of Object.keys(lint)) {
    add('lint', id, id, lint[id], `${where} lint_results`);
  }

  for (const row of (baseline.coverage_items || [])) {
    add('coverage', String(row.name), String(row.name), row, `${where} coverage_items`);
  }

  for (const row of (baseline.scenario_statuses || [])) {
    const id = row.id !== undefined && row.id !== null ? String(row.id) : String(row.name);
    add('scenario', id, row.name ? `${id} ${row.name}` : id, row, `${where} scenario_statuses`);
  }

  for (const row of (baseline.concern_statuses || [])) {
    add('concern', String(row.name), String(row.name), row, `${where} concern_statuses`);
  }

  return els;
}

/**
 * Fill a lint element's missing lines from evidence/{id}.json.
 *
 * Only citations pointing at the audited document count. A record may also cite
 * a test file or a config to support its verdict, and a change to THOSE is not a
 * change to the document the baseline diffs — scoping a flip to them would let a
 * regression hide behind an edit in a file the diff never covered.
 */
function fillFromEvidence(els, evidenceDir, docRelPath) {
  const filled = [];
  if (!evidenceDir || !fs.existsSync(evidenceDir)) return filled;

  const wanted = String(docRelPath).split(path.sep).join('/');

  for (const el of els.values()) {
    // Any element with a record, not only a lint one.
    //
    // This read `el.kind !== 'lint'` and that was right when the only anchor was
    // a line number: a matrix row had no record to take one from, so the guard
    // documented an absence rather than imposing a rule. It has now become the
    // rule. Nothing about a coverage, scenario or concern row makes its evidence
    // less usable than a lint criterion's — the id is the file name either way,
    // the artifact must still match the audited document, and the quote is still
    // checked against the pinned hash. Leaving the guard in would mean that when
    // the matrix rows finally emit records, R5-01 needs a code change here as
    // well as a schema change. It does not: the anchor arrives the moment the
    // record does.
    //
    // No such record exists yet, so this changes nothing about today's runs. It
    // is the difference between part B being a data change and a data change
    // plus another edit to this function.
    if (el.lines.length > 0) continue;
    const file = path.join(evidenceDir, `${el.id}.json`);
    if (!fs.existsSync(file)) continue;
    let rec;
    try {
      rec = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      continue;
    }
    const items = Array.isArray(rec.evidence) ? rec.evidence : [];
    const lines = [];
    const anchors = [];
    for (const item of items) {
      if (!item || typeof item.artifact !== 'string') continue;
      const art = item.artifact.split(path.sep).join('/');
      // The path must match, whole. A basename fallback used to stand here so a
      // caller who passed the document under a different root still got their
      // lines filled — and it imported line 1 of `vendor/spec.md` as a
      // coordinate in `docs/spec.md`, then scoped a flip against it. Two files
      // sharing a name are two files; the convenience was worth less than the
      // wrong answer it produced.
      if (art !== wanted) continue;
      const start = Number(item.line_start);
      const end = Number(item.line_end);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) continue;
      lines.push([start, end]);
      // The quote is the anchor; the line range is only where it was last seen.
      //
      // This function used to import line_start and line_end and drop
      // exact_quote on the floor, so an element that carried its own text was
      // reduced to a coordinate — and a coordinate is invalidated by any edit
      // ABOVE it. That is R5-01's whole mechanism: in run 5 the requirement two
      // matrix rows failed on is byte-identical at v2:778 and v3:929, displaced
      // one line by an insertion higher up, and the coordinate test called it
      // changed. checkQuote in tq-evidence-validate.js already validates this
      // field against the pinned hash, so the strongest signal in the record was
      // the one thing not being read.
      const quote = typeof item.exact_quote === 'string'
        ? item.exact_quote.replace(/\r\n/g, '\n')
        : '';
      // An empty quote is not an anchor. tq-evidence-validate.js:175 refuses one
      // for the same reason: '' === '' is true against any document alive.
      if (quote.trim()) anchors.push({ lines: [start, end], quote });
    }
    if (lines.length) {
      el.lines = lines;
      el.anchors = anchors;
      el.line_source = `evidence/${el.id}.json`;
      // Provenance, set only here. checkAnchors skips an element on this mark
      // and on nothing else — it used to skip on the `evidence/` prefix of
      // line_source, a label the baseline author writes, so an inline quote
      // that matched nothing entered a baseline unchecked under
      // `"line_source": "evidence/anything.json"`.
      el.filled = true;
      filled.push(el.id);
    }
  }
  return filled;
}

/**
 * Does this element cite a line the revision changed?
 *
 * Three answers, not two. `unknown` is the one that matters: it means the
 * question could not be asked — no previous document to diff, or no line source
 * on the element — and it is what the prose left the caller to resolve by
 * judgement. It resolves to a regression below, and the section says which
 * elements took that route.
 */
function scopeOf(el, diff) {
  if (!diff) return { scope: 'unknown', reason: 'no previous document to diff against' };
  if (!el.lines.length) return { scope: 'unknown', reason: 'no line source on this element' };

  // A citation past the end of the document is not a citation of unchanged
  // text — it is a citation of nothing, and the only honest answer is that the
  // question could not be asked.
  //
  // Without this, `lines: [[900, 905]]` against a 400-line spec matched no
  // touched line, fell through to "every line cited is unchanged", and earned
  // the variance exemption. A stale line number copied from the PREVIOUS
  // version of the document is the most likely way to produce one, which makes
  // this failure most likely exactly when the document changed most — and the
  // transcription error it rewards is the one this script was written to end.
  const outOfRange = el.lines.filter(([, b]) => b > diff.total);
  if (outOfRange.length) {
    return {
      scope: 'unknown',
      reason: `cites line ${outOfRange[0][1]} of a ${diff.total}-line document`,
    };
  }

  // The anchor test runs BEFORE the coordinate test, and settles the element
  // when it can answer.
  //
  // A coordinate test cannot tell text that MOVED from text that CHANGED, and
  // every false positive run 5 found is that one conflation: a re-wrapped line
  // above the citation, a 61-line block inserted inside its range, a prose
  // paragraph restructured into a table around a requirement that survived
  // verbatim. In all three the cited text is byte-identical across the two
  // documents. Asking whether the TEXT survived instead of whether its line
  // number was disturbed answers all three the same way, and answers them
  // right.
  //
  // The comment on crossedByMovedBlocks names this exact gap: the alignment
  // "cannot show a retained line was unaffected". It cannot, from position
  // alone. From content it can.
  const anchorScope = scopeByAnchor(el, diff);

  // A surviving quote settles displacement, not reordering.
  //
  // "Displacement is not modification" (scopeByAnchor) and "a moved block is a
  // regression for the concern that cites it" (crossedByMovedBlocks) were each
  // written for a different failure, and the anchor rule as first written
  // answered `unchanged` before the block marks were consulted, so a quoted row
  // on a line a relocated block crossed was VARIANCE where the same row
  // unquoted was REGRESSION. The anchor's justification covers the three run-5
  // shapes — a re-wrapped line above, an insertion inside the range, prose
  // restructured around a requirement — none of which relocates anything. The
  // block rule was written after a review found the reordered-phases regression
  // let through, and its comment says the ordering IS what the concern is
  // about. So the anchor yields to `moved` and to nothing else: a seam under a
  // surviving quote stays variance, because a seam is exactly the displacement
  // the quote is there to see past. Decided in the R5-01 design before run 6.
  if (anchorScope && anchorScope.scope === 'unchanged' && diff.moved) {
    for (const [a, b] of el.lines) {
      for (let l = a; l <= b; l++) {
        if (diff.moved.has(l)) {
          return {
            scope: 'changed',
            reason: `the text cited at ${formatLines(el.lines)} survived verbatim, but a relocated block crossed line ${l}: the revision reordered it`,
          };
        }
      }
    }
  }
  if (anchorScope) return anchorScope;

  // The coordinate route says so in its reason. Every false positive run 5
  // recorded took this route, and the record read "line 386 is inside the
  // diff" with nothing to show that no anchor had been asked. A reader of the
  // next run's record can now tell a scoped-by-text row from a scoped-by-
  // position one without re-deriving it.
  const route = (el.anchors && el.anchors.length)
    ? ' (anchor stale against both documents; fell back to the coordinate test)'
    : ' (coordinate test; this element carries no anchor quote)';
  for (const [a, b] of el.lines) {
    for (let l = a; l <= b; l++) {
      if (diff.touched.has(l)) return { scope: 'changed', reason: `line ${l} is inside the diff${route}` };
    }
  }
  return { scope: 'unchanged', reason: `every line cited is unchanged since the previous baseline${route}` };
}

/**
 * Scope an element by whether its quoted text survived, not by where it sits.
 *
 * Returns null when the question cannot be asked — no anchors, or no previous
 * document text to compare against — and the caller falls through to the
 * coordinate test. Returning null rather than `unknown` matters: an element
 * without an anchor is no worse off than it was before this function existed,
 * and silently downgrading every one of them to unknown would have turned the
 * whole lint class unscoped on any baseline written before anchors existed.
 *
 * Four outcomes per anchor, and only two of them are conclusive:
 *
 *   in both     the text survived the revision verbatim -> unchanged
 *   cur only    the revision wrote it                   -> changed
 *   prev only   the revision removed it                 -> changed
 *   in neither  the quote is stale against BOTH sides   -> no answer
 *
 * "In neither" is not evidence of anything. It means the record was pinned to a
 * document that is no longer either side of this comparison, which is a
 * staleness problem for tq-evidence-validate.js to report, not a licence for
 * this function to guess.
 *
 * The known limit: text occurring more than once leaves provenance ambiguous,
 * the same limit crossedByMovedBlocks records for moved blocks. Survival of at
 * least one occurrence is still the honest reading of "this text is still here",
 * and it is strictly better than the coordinate it replaces.
 */
function scopeByAnchor(el, diff) {
  const anchors = el.anchors || [];
  if (!anchors.length) return null;
  if (!Array.isArray(diff.prevLines) || !Array.isArray(diff.curLines)) return null;

  // Joined once per comparison, not once per element. A 1300-line document is
  // ~60KB and compare() calls this for every element it classifies.
  if (diff._prevText === undefined) {
    diff._prevText = diff.prevLines.join('\n');
    diff._curText = diff.curLines.join('\n');
  }
  const prevText = diff._prevText;
  const curText = diff._curText;

  let settled = null;
  for (const a of anchors) {
    const inPrev = prevText.includes(a.quote);
    const inCur = curText.includes(a.quote);
    const at = formatLines([a.lines]);
    if (inCur && !inPrev) {
      return { scope: 'changed', reason: `the text cited at ${at} was written by this revision` };
    }
    if (inPrev && !inCur) {
      return { scope: 'changed', reason: `the text cited at ${at} was removed by this revision` };
    }
    // Both sides carry it. Displacement is not modification, so this anchor is
    // unchanged — but a LATER anchor on the same element may still be changed,
    // so record it and keep looking rather than returning here.
    if (inPrev && inCur) {
      settled = {
        scope: 'unchanged',
        reason: `the text cited at ${at} is byte-identical in both documents`,
      };
    }
  }
  return settled;
}

function formatLines(lines) {
  if (!lines.length) return '(none)';
  return lines.map(([a, b]) => (a === b ? String(a) : `${a}-${b}`)).join(', ');
}

/**
 * Classify every element and decide LINT-14.
 *
 * `docUnchanged` short-circuits the diff: when the current document hashes to
 * the previous baseline's doc_sha256, no line can be inside the diff, so every
 * flip is variance and LINT-14 is N_A. That rule predates D10 and is unchanged.
 */
function compare(prevBaseline, curBaseline, diff, opts) {
  const options = opts || {};
  // A caller that has already read the elements hands them in; otherwise they
  // are read here. cmdCompare reads them, fills anchors from evidence records,
  // and used to hand this function the raw baseline object instead — which was
  // re-read from scratch. The filled `lines` were copied back onto the object
  // first, for lint rows only, and the anchors were not, so every anchor a
  // record supplied was dropped at that handoff: the CLI scoped a
  // record-anchored element by coordinate while the in-process tests, which
  // call this function directly, scoped it by text. Passing the elements
  // through is the whole fix. There is nothing to copy back.
  const prev = options.prevElements || readElements(prevBaseline, 'previous baseline');
  const cur = options.curElements || readElements(curBaseline, 'current baseline');

  const rows = [];
  const keys = new Set([...prev.keys(), ...cur.keys()]);

  // A whole element CLASS missing from the previous baseline is not a set of new
  // elements — it is a class that was never compared, and saying so is the only
  // honest report.
  //
  // Without this, a failing coverage or concern row whose class has no history
  // classified as NEW before its status was looked at, and NEW does not fail
  // LINT-14. So the baselines that record the least produce the most reassuring
  // verdict: a plan whose baseline carries only lint_results gets a clean
  // LINT-14 no matter how badly its coverage matrix is doing. That is the
  // leniency this rule exists to refuse, and it is the shape of R4-01 one level
  // up — R4-01 was rows without line sources, this is rows without any prior
  // record to compare against.
  const KINDS = ['lint', 'coverage', 'scenario', 'concern'];
  const uncompared = [];
  for (const kind of KINDS) {
    const prevHas = [...prev.values()].some((e) => e.kind === kind);
    const curCount = [...cur.values()].filter((e) => e.kind === kind).length;
    if (!prevHas && curCount > 0) uncompared.push({ kind, count: curCount });
  }
  const uncomparedKinds = new Set(uncompared.map((u) => u.kind));

  for (const key of [...keys].sort()) {
    const a = prev.get(key);
    const b = cur.get(key);

    if (!a) {
      rows.push({
        key, kind: b.kind, id: b.id, label: b.label,
        from: null, to: b.status, lines: b.lines, line_source: b.line_source,
        scope: null, scope_reason: null,
        klass: uncomparedKinds.has(b.kind) ? 'UNCOMPARED' : 'NEW',
      });
      continue;
    }
    if (!b) {
      // Not in the published categories, and stress run 4 is why it is here: the
      // caller booked two RENAMED rows as new items and the rename went unseen
      // because nothing reported the disappearance of their old names. A NEW and
      // a DROPPED on the same screen is a rename a reader can spot.
      rows.push({
        key, kind: a.kind, id: a.id, label: a.label,
        from: a.status, to: null, lines: [], line_source: null,
        scope: null, scope_reason: null, klass: 'DROPPED',
      });
      continue;
    }

    const { scope, reason } = scopeOf(b, diff);
    const row = {
      key, kind: b.kind, id: b.id, label: b.label,
      from: a.status, to: b.status, lines: b.lines, line_source: b.line_source,
      scope, scope_reason: reason, klass: null,
    };

    if (a.status === b.status) {
      row.klass = 'UNCHANGED';
    } else if (a.status === 'n_a' || b.status === 'n_a') {
      row.klass = 'NOT-COMPARABLE';
    } else if (a.status === 'pass' && b.status === 'fail') {
      // D10, stated exactly: a regression is a flip on text the revision changed.
      //
      // docUnchanged is tested FIRST, not applied to the verdict afterwards.
      // When the document is byte-identical to the previous baseline's, no line
      // can be inside the diff, so the block's own sentence is "every flip is
      // variance" — but an element with no line source scoped as `unknown` and
      // classified REGRESSION anyway. The section then printed one regression,
      // "Regressions are HIGH priority", and LINT-14 N_A on the same screen.
      row.klass = options.docUnchanged ? 'VARIANCE'
        : scope === 'changed' ? 'REGRESSION'
          : scope === 'unchanged' ? 'VARIANCE'
            : 'REGRESSION';
      if (!options.docUnchanged && scope === 'unknown') row.unscoped = true;
    } else if (RANK[b.status] < RANK[a.status]) {
      // covered -> partial, ok -> warn, partial -> gap. R4-06: three of these
      // occurred in one stress scenario and the executor invented a category for
      // them on the spot. D10 speaks only about an element that WAS passing and
      // NOW fails, so none of these fails LINT-14; they are reported, with their
      // diff scope, so the next decision round has the counts.
      row.klass = 'DEGRADATION';
    } else {
      row.klass = 'IMPROVEMENT';
    }
    rows.push(row);
  }

  const count = (k) => rows.filter((r) => r.klass === k).length;
  const counts = {
    regressions: count('REGRESSION'),
    variance: count('VARIANCE'),
    improvements: count('IMPROVEMENT'),
    degradations: count('DEGRADATION'),
    new_items: count('NEW'),
    dropped: count('DROPPED'),
    not_comparable: count('NOT-COMPARABLE'),
    unchanged: count('UNCHANGED'),
    uncompared: count('UNCOMPARED'),
    unscoped: rows.filter((r) => r.unscoped).length,
    // A regression the diff established and a regression nothing established are
    // both blocking and are NOT the same claim. Splitting the count is what lets
    // the justification below say which it is holding, and what a later decision
    // round needs before it can change the verdict rule for either.
    regressions_scoped: rows.filter((r) => r.klass === 'REGRESSION' && !r.unscoped).length,
    regressions_unscoped: rows.filter((r) => r.klass === 'REGRESSION' && r.unscoped).length,
    // Rows a relocated block decided against a surviving quote. Counted apart so
    // a run can report how often the ordering rule overrode the anchor rule,
    // with the anchored-row total as its denominator.
    moved_over_anchor: rows.filter((r) => r.scope_reason && r.scope_reason.includes('relocated block crossed')).length,
    anchored: rows.filter((r) => r.scope_reason && (r.scope_reason.includes('byte-identical in both') || r.scope_reason.includes('was written by this revision') || r.scope_reason.includes('was removed by this revision') || r.scope_reason.includes('relocated block crossed'))).length,
  };

  let verdict;
  let justification;
  if (options.docUnchanged) {
    verdict = 'N_A';
    justification = 'caller-decided: {doc} is byte-identical to the previous baseline\'s '
      + 'document, so the diff is empty and every flip is auditor variance.';
  } else if (counts.regressions > 0) {
    // A regression is established information, and missing information about a
    // DIFFERENT class cannot erase it. This branch used to sit below the
    // uncompared one, so adding the first concern row to a plan whose baseline
    // had no concerns turned a proven pass-to-fail regression in the lint class
    // into N_A and exit 0 — and N_A does not block the gate. The rule written to
    // remove leniency was opening a wider hole than the one it closed.
    verdict = 'UNMET';
    // Say which regressions were established and which were not.
    //
    // This string is not commentary: pin() writes it into LINT-14.json and into
    // audit.md's verdict line, so it is the sentence a later reader treats as
    // the finding. It used to read "N regression(s) on text the revision
    // changed" whatever the unscoped count — in the run-5 s8 re-run it claimed
    // all five regressions were on changed text when two of them carried no
    // line source at all and were never scoped. An unscoped flip still blocks,
    // because an unestablished flip is not a cleared one; what it must not do
    // is get recorded as evidence that was never gathered.
    justification = `caller-decided from the baseline comparison: ${counts.regressions} `
      + `regression(s), ${counts.variance} auditor-variance flip(s) discounted.`;
    if (counts.regressions_unscoped > 0) {
      justification += ` ${counts.regressions_scoped} of those regression(s) are on text the `
        + `revision changed; ${counts.regressions_unscoped} could not be scoped to the diff and `
        + 'are unestablished — they block, but nothing here shows the revision caused them.';
    } else {
      justification += ' All are on text the revision changed.';
    }
    if (uncompared.length) {
      justification += ` ${uncompared.reduce((n, u) => n + u.count, 0)} further element(s) in `
        + `${uncompared.map((u) => u.kind).join(', ')} had no prior record and were not compared; `
        + 'the regressions above stand on their own.';
    }
  } else if (uncompared.length) {
    // A comparison that could not look at a whole class of element has not
    // established "no regressions" — it has established "no regressions among
    // the classes I could see". MET would be a stronger claim than the inputs
    // support, and UNMET would blame the document for a bookkeeping gap. N_A is
    // what the registry reserves for a comparison that could not be made, and
    // the section names the missing classes so the fix is obvious.
    verdict = 'N_A';
    justification = 'caller-decided: the previous baseline recorded no '
      + `${uncompared.map((u) => u.kind).join(', ')} element(s), so `
      + `${uncompared.reduce((n, u) => n + u.count, 0)} element(s) in this audit have nothing to `
      + 'compare against. A comparison missing a whole class cannot report "no regressions".';
  } else {
    verdict = 'MET';
    justification = 'caller-decided from the baseline comparison: no element that was passing '
      + `now fails on text the revision changed (${counts.variance} auditor-variance flip(s) discounted).`;
  }

  return { rows, counts, verdict, justification, diff, options, uncompared };
}

// ---------------------------------------------------------------------------
// The section and the pin
// ---------------------------------------------------------------------------

const SECTION_HEADING = '## Baseline comparison';

/**
 * Classes whose row shows its diff scope.
 *
 * IMPROVEMENT is here even though nothing turns on it, because decisions.md
 * says every class records its diff scope and the rendered table is the only
 * artifact that survives — the intermediate JSON is explicitly disposable. An
 * improvement on unchanged text is the mirror of a variance, and a reader
 * comparing two runs should be able to see that without re-running anything.
 */
const SCOPED_CLASSES = new Set(['REGRESSION', 'VARIANCE', 'DEGRADATION', 'IMPROVEMENT']);

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Render the section the LINT-14 record cites.
 *
 * The write order in stage-2-design.md asks for "every element compared, the
 * file each baseline value was read from, and the regressions, improvements and
 * new items". Every element means every element, unchanged ones included: a
 * table that lists only the flips cannot be re-derived by a verifier, because
 * nothing on it says which elements were looked at and found the same.
 */
function renderSection(cmp, meta) {
  const m = meta || {};
  const out = [];
  out.push(SECTION_HEADING);
  out.push('');
  out.push('Caller-decided, not the auditor\'s. Produced by `tq-gate-baseline.js compare`.');
  out.push('');

  const prevRun = m.previous_run_number == null ? '(unnumbered)' : m.previous_run_number;
  out.push(`- Previous baseline: run ${prevRun}, read from \`${m.previous_baseline_file || '(unknown)'}\``
    + `${m.previous_date ? ` (${m.previous_date})` : ''}`);
  out.push(`- Previous document: ${m.previous_doc_file ? `\`${m.previous_doc_file}\`` : 'NOT FOUND'}`
    + `${m.previous_doc_sha256 ? `, sha256 \`${m.previous_doc_sha256}\`` : ''}`);
  out.push(`- Current document: \`${m.doc_file || '(unknown)'}\`, sha256 \`${m.doc_sha256 || '(unknown)'}\``);
  if (cmp.options && cmp.options.firstAudit) {
    // Its own branch. This used to fall through to the no-previous-document
    // text, so a first audit's record carried "no copy of the previous
    // baseline's document could be found ... every flip below is booked as a
    // regression" directly above a verdict correctly reading "first audit, no
    // previous baseline". The section a record cites must not contradict the
    // verdict the record carries.
    out.push('- Diff: NOT TAKEN — this is the first audit, so there is no previous '
      + 'baseline and nothing to compare against. LINT-14 is N_A and stays in the denominator.');
  } else if (cmp.options && cmp.options.docUnchanged) {
    out.push('- Diff: EMPTY — the document is byte-identical to the previous baseline\'s, '
      + 'so no line can be inside it and every flip below is auditor variance.');
  } else if (cmp.diff) {
    out.push(`- Diff: ${cmp.diff.changed} of ${cmp.diff.total} current lines changed`
      + `${cmp.diff.moved && cmp.diff.moved.size ? `, ${cmp.diff.moved.size} of them crossed by a relocated block` : ''}`
      + `${cmp.diff.coarse ? ' (coarse fallback: the changed region was too large to align line by line, so all of it counts as changed)' : ''}`);
  } else {
    out.push('- Diff: NOT AVAILABLE — no copy of the previous baseline\'s document could be found, '
      + 'so the variance exemption is not applied and every pass-to-fail flip below is booked as '
      + 'a regression. Other transitions are unaffected.');
  }
  for (const u of (cmp.uncompared || [])) {
    out.push(`- **${u.kind} elements were NOT COMPARED** — the previous baseline records none, `
      + `so this audit's ${u.count} ${u.kind} element(s) have no prior status. They are listed `
      + 'below as UNCOMPARED, not as new, and LINT-14 cannot report "no regressions" over a '
      + 'class it could not see. Record them in the baseline to close this.');
  }
  if (m.evidence_filled && m.evidence_filled.length) {
    out.push(`- Line sources filled from evidence records: ${m.evidence_filled.join(', ')}`);
  }
  out.push('');

  out.push(`Baseline comparison: ${cmp.counts.regressions} regressions, `
    + `${cmp.counts.improvements} improvements, ${cmp.counts.new_items} new items, `
    + `${cmp.counts.variance} auditor-variance flips`);
  out.push('');
  out.push(`Also: ${plural(cmp.counts.degradations, 'degradation', 'degradations')}, `
    + `${plural(cmp.counts.dropped, 'dropped element', 'dropped elements')}, `
    + `${plural(cmp.counts.not_comparable, 'not comparable', 'not comparable')}, `
    + `${plural(cmp.counts.uncompared, 'uncompared', 'uncompared')}, `
    + `${plural(cmp.counts.unchanged, 'unchanged', 'unchanged')}. `
    + 'A DROPPED element beside a NEW one is usually a renamed row, not a lost one.');
  out.push('');
  out.push(`**LINT-14: ${cmp.verdict}** — ${cmp.justification}`);
  if (cmp.counts.regressions > 0) {
    out.push('');
    out.push('Regressions are HIGH priority.');
  }
  if (cmp.counts.unscoped > 0) {
    out.push('');
    out.push(`${cmp.counts.unscoped} flip(s) could not be scoped to the diff and are booked as `
      + 'regressions. The exemption is never applied on a guess; the rows below name why each '
      + 'one could not be scoped.');
  }
  out.push('');

  out.push('| Element | Baseline | Now | Lines cited | Line source | Diff scope | Class |');
  out.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of cmp.rows) {
    const name = `${r.kind}: ${r.label}`.replace(/\|/g, '\\|');
    const src = (r.line_source || '(none named)').replace(/\|/g, '\\|');
    // Diff scope is only load-bearing where it decided something. On an
    // UNCHANGED or IMPROVEMENT row it is noise, and a column of "unknown — no
    // line source" against rows nothing turned on trains the reader to skip the
    // one place it means a flip was booked as a regression unscoped.
    const scopeMatters = SCOPED_CLASSES.has(r.klass);
    const scope = (!scopeMatters || r.scope === null) ? '—'
      : r.scope === 'unknown' ? `unknown — ${r.scope_reason}`
        : r.scope;
    out.push(`| ${name} | ${r.from || '(absent)'} | ${r.to || '(absent)'} | `
      + `${formatLines(r.lines)} | ${src} | ${scope} | ${r.klass} |`);
  }
  out.push('');
  return out.join('\n');
}

/**
 * Locate `## Baseline comparison` in audit.md.
 *
 * Returns 1-based { start, end } over the section's lines with trailing blank
 * lines excluded, or null. Trailing blanks are dropped so that the two appends
 * the gate makes afterwards — `## Evidence notes` and `## Revision History` —
 * cannot change the range this section occupies, only the file's hash. That
 * makes `repin` a hash update rather than a re-location in the common case.
 */
/**
 * Which lines of a markdown file are inside a fenced code block.
 *
 * A heading inside a fence is an EXAMPLE of a heading, not one. The gate's own
 * instructions quote `## Baseline comparison` in a fenced block, so an auditor
 * that reproduces those instructions in its report plants a decoy — and
 * `locateSection` selected the decoy, `writeSection` wrote the real section
 * inside the fence, orphaned its closing backticks and deleted the prose after
 * it. The record still validated, because quote fidelity says nothing about
 * whether the quoted lines are the right ones.
 */
function fencedLines(lines) {
  const inFence = new Array(lines.length).fill(false);
  let fence = null;

  // Literal HTML blocks are not markdown, so neither fences nor headings inside
  // them are structure. Three CommonMark shapes matter here: a raw-text element
  // (type 1), a comment (type 2), and a block-level tag (type 6).
  //
  // The first two were being read as markdown. An audit whose evidence log
  // wrapped a delimiter example in `<pre>` had those backticks open a fence that
  // nothing closed, so `record` refused the file with "close the fence" against a
  // fence that did not exist — an audit no re-run could repair. And an `# H1`
  // written inside an HTML COMMENT terminated the comparison section, so the pin
  // quoted three lines and excluded the verdict and the regression row it rests
  // on. The validator passed that quote: quote fidelity says nothing about
  // whether the quoted span is the right one.
  //
  // Type 6 is here for a narrower reason. `<table><tr><td>` followed by a `<pre>`
  // is an ordinary evidence excerpt; without type 6 the table is invisible, the
  // nested `<pre>` opens raw-text shielding that never closes, and the audit
  // becomes unwritable. A type-6 block ends at a BLANK LINE, so recognising it
  // keeps the nested tag from starting a block of its own.
  //
  // Boundaries follow the spec rather than \s: the character after a tag name
  // must be a space, a tab, `>` or end of line. `\s` also accepted a non-breaking
  // space and a form feed, which are not tag boundaries. A raw-text block is
  // closed by ANY of the four closing tags, not only the one that opened it.
  let html = null;
  const RAW_OPEN = /^ {0,3}<(pre|script|style|textarea)([ \t>]|$)/i;
  const RAW_CLOSE = /<\/(pre|script|style|textarea)>/i;
  const BLOCK_TAGS = 'address|article|aside|base|basefont|blockquote|body|caption'
    + '|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption'
    + '|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html'
    + '|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option'
    + '|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr'
    + '|track|ul';
  const BLOCK_OPEN = new RegExp(`^ {0,3}</?(${BLOCK_TAGS})([ \\t>]|/>|$)`, 'i');

  for (let i = 0; i < lines.length; i++) {
    if (html !== null) {
      // A type-6 block ends at a blank line, which is not part of it; the other
      // two end ON the line carrying their closing tag, which is.
      if (html === 'block') {
        if (lines[i].trim() === '') { html = null; continue; }
        inFence[i] = true;
        continue;
      }
      inFence[i] = true;
      if (html.test(lines[i])) html = null;
      continue;
    }
    if (fence === null) {
      if (/^ {0,3}<!--/.test(lines[i])) {
        inFence[i] = true;
        // `<!-->` and `<!--->` are complete comments in their own right. Stripping
        // the opener and looking for `-->` in what is left missed both, so either
        // one opened a block that swallowed the rest of the file.
        const rest = lines[i].replace(/^ {0,3}<!--/, '');
        if (!/-->/.test(rest) && !/^-?>/.test(rest)) html = /-->/;
        continue;
      }
      if (RAW_OPEN.test(lines[i])) {
        inFence[i] = true;
        if (!RAW_CLOSE.test(lines[i])) html = RAW_CLOSE;
        continue;
      }
      if (BLOCK_OPEN.test(lines[i])) {
        inFence[i] = true;
        html = 'block';
        continue;
      }
    }

    const m = lines[i].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence === null) {
      // An opening backtick fence may not carry a backtick in its info string,
      // or a line of prose holding ``` mid-sentence opens a block nothing closes.
      if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
        fence = { ch: m[1][0], len: m[1].length };
        inFence[i] = true;
      }
    } else {
      inFence[i] = true;
      // A closing fence is the same character, AT LEAST as long as the opener,
      // and carries nothing after the run but whitespace.
      //
      // Tracking only the character closed a four-backtick block on the first
      // three-backtick line inside it, and accepted an info-string line such as
      // ```js as a close. Both put the rest of the document "outside" the fence,
      // so a `## Baseline comparison` written as an EXAMPLE became the section
      // this script rewrites: it replaced the example and left the real section
      // below it, two contradictory comparisons under one heading.
      if (m && m[1][0] === fence.ch && m[1].length >= fence.len && m[2].trim() === '') {
        fence = null;
      }
    }
  }
  return inFence;
}

function locateSection(auditText) {
  const lines = splitLines(auditText);
  const inFence = fencedLines(lines);

  // Match the heading with or without a trailing parenthetical. Real plans
  // write `## Baseline comparison (caller, run 9 → run 10)`, and an exact-match
  // rule returned null against those, so `record` appended a SECOND section and
  // left the first one on disk still asserting the previous verdict — two
  // contradictory comparisons under one heading name.
  //
  // Indentation is load-bearing in both tests below. An ATX heading may be
  // indented at most three spaces; four or more makes it an indented code block.
  // This test used to trim the line first, so a heading written as an indented
  // EXAMPLE — inside a list, or in a plain indented block — matched as a real one.
  const isHeading = (l) => /^ {0,3}##\s+Baseline comparison\s*(\(.*\))?\s*$/.test(l);

  const start = lines.findIndex((l, i) => !inFence[i] && isHeading(l));
  if (start === -1) return null;

  // The section ends at the next heading of level 1 or 2 — not at a column-zero
  // `##` alone. The old test read the raw line against /^##\s/, so an indented
  // `  ## Verdicts` and any `# Appendix` failed to stop it and the section ran to
  // end of file. Every rewrite then DELETED that content, at exit 0, with a
  // success message. A level-3 heading belongs to this section and does not stop it.
  let end = lines.length - 1;
  for (let i = start + 1; i < lines.length; i++) {
    if (!inFence[i] && /^ {0,3}#{1,2}\s/.test(lines[i])) { end = i - 1; break; }
  }
  while (end > start && lines[end].trim() === '') end--;
  return { start: start + 1, end: end + 1 };
}

/**
 * Write the section into audit.md, replacing any section already there.
 *
 * Replacing rather than appending is what makes a re-run of the whole sequence
 * safe. During a revision loop the caller runs this once per iteration against
 * the same audit.md path in some layouts; appending would leave two sections
 * with the same heading and the pin would cite whichever one `locateSection`
 * found first.
 */
function writeSection(auditPath, sectionText) {
  const raw = fs.readFileSync(auditPath, 'utf8');
  const crlf = /\r\n/.test(raw);
  const lines = splitLines(raw);
  const at = locateSection(raw);

  // Trim the section's own trailing blanks and supply exactly one separator, so
  // writing the same section twice is a no-op on the bytes. It used to keep the
  // blank lines already in the file AND the empty final element that splitting
  // a newline-terminated string produces, so every rewrite grew the file by one
  // byte and changed its hash — which makes a re-pin after an idempotent
  // `record` look like a real edit and shifts every section below it.
  const body = splitLines(sectionText);
  while (body.length && body[body.length - 1].trim() === '') body.pop();

  let next;
  if (at) {
    const before = lines.slice(0, at.start - 1);
    const after = lines.slice(at.end);
    // Drop blanks the old section left behind, then emit one.
    while (after.length && after[0].trim() === '') after.shift();
    next = [...before, ...body, ...(after.length ? [''] : []), ...after];
  } else {
    const head = lines.slice();
    while (head.length && head[head.length - 1].trim() === '') head.pop();
    next = [...head, '', ...body];
  }

  let text = next.join('\n');
  if (!text.endsWith('\n')) text += '\n';

  // Refuse to write a section that would not be findable afterwards.
  //
  // An audit.md holding an UNTERMINATED code fence swallows everything after it,
  // so the appended section landed inside that fence and `locateSection` could
  // not see it. `record` then failed at the pin and exited 2 — having already
  // appended. Running it again appended another, and three runs left three
  // contradictory sections on disk behind an exit code that said nothing was
  // written. The check has to happen on the computed text, before the write:
  // once the bytes are on disk the caller has to repair the file by hand.
  const at2 = locateSection(text);
  if (!at2) {
    throw new Error(`the section would not be locatable in ${auditPath} after writing, so `
      + 'nothing was written. The usual cause is an unterminated code fence earlier in the '
      + 'file, which swallows every line after it. Close the fence and re-run.');
  }

  fs.writeFileSync(auditPath, crlf ? text.replace(/\n/g, '\r\n') : text, 'utf8');
  return locateSection(fs.readFileSync(auditPath, 'utf8'));
}

/**
 * The validator's containment rule, lexical then through links.
 *
 * Split out of `pin` so `record` can run it BEFORE it edits audit.md. It used to
 * run only inside `pin`, which happens after `writeSection` — so a path that
 * escaped the root through a junction was rejected with exit 2 and no evidence
 * record, against a file this script had already rewritten. A refusal that
 * still edits the caller's document is not a refusal.
 */
function assertContained(auditPath, rootDir) {
  const rel = path.relative(path.resolve(rootDir), path.resolve(auditPath))
    .split(path.sep).join('/');
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`audit.md is outside the root passed as --root: ${auditPath} vs ${rootDir}`);
  }

  // Containment again, after resolving links — the same check, in the same
  // order, as tq-evidence-validate.js. The test above is lexical, and a Windows
  // junction or a symlink inside the root passes it while pointing outside, so
  // a record could be written happily here and then demoted EVIDENCE-PATH-ESCAPE
  // by the validator the gate runs next. A producer that emits records its own
  // validator rejects is worse than one that refuses: the caller finds out two
  // steps later, against a file they did not edit.
  try {
    const realRoot = fs.realpathSync(path.resolve(rootDir));
    const realAudit = fs.realpathSync(path.resolve(auditPath));
    const realRel = path.relative(realRoot, realAudit);
    if (!realRel || realRel.startsWith('..') || path.isAbsolute(realRel)) {
      throw new Error(`audit.md resolves outside --root through a link: ${realAudit} vs ${realRoot}`);
    }
  } catch (err) {
    if (/resolves outside/.test(err.message)) throw err;
    throw new Error(`could not resolve audit.md against --root: ${err.message}`);
  }
  return rel;
}

/**
 * Write evidence/LINT-14.json citing the section, pinned to audit.md as it now is.
 *
 * The quote is sliced back out of the file rather than taken from what was just
 * written, so the record is pinned to what is ON DISK. A CRLF checkout, a
 * trailing-newline difference or an editor hook between the write and the pin
 * would otherwise produce a record that fails the validator it exists to pass,
 * which is the exact failure five of six stress-run executors had to work around.
 *
 * Field order matches plan-auditor.md's schema block: criterion_id, evidence,
 * reasoning, verdict. That order is load-bearing — the validator's
 * unsupported-citation check silently skips a record with no criterion_id.
 */
function pin(auditPath, evidenceDir, rootDir, verdict, justification) {
  const raw = fs.readFileSync(auditPath, 'utf8');
  const at = locateSection(raw);
  if (!at) {
    throw new Error(`no "${SECTION_HEADING}" section in ${auditPath}`);
  }
  const lines = splitLines(raw);
  const quote = lines.slice(at.start - 1, at.end).join('\n');

  const rel = assertContained(auditPath, rootDir);

  const record = {
    criterion_id: 'LINT-14',
    evidence: [{
      artifact: rel,
      line_start: at.start,
      line_end: at.end,
      exact_quote: quote,
      sha256: hashContent(raw),
    }],
    reasoning: justification,
    verdict,
  };
  if (verdict === 'N_A') {
    record.n_a_justification = justification;
  }

  fs.mkdirSync(evidenceDir, { recursive: true });
  const out = path.join(evidenceDir, 'LINT-14.json');
  fs.writeFileSync(out, JSON.stringify(record, null, 2) + '\n', 'utf8');
  return { file: out, artifact: rel, line_start: at.start, line_end: at.end, sha256: record.evidence[0].sha256 };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function readJson(file, what) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`${what} is not readable JSON: ${file}`);
    console.error(`  ${err.message}`);
    process.exit(2);
  }
}

function takeFlag(argv, name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  if (i + 1 >= argv.length || String(argv[i + 1]).startsWith('--')) {
    console.error(`${name} requires a value`);
    process.exit(2);
  }
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
}

function usage() {
  console.error('usage: tq-gate-baseline.js compare  <prev-baseline.json|-> <cur-baseline.json> <prev-doc|-> <doc>');
  console.error('                                    [--evidence <dir>] [--root <dir>] [--out <file>]');
  console.error('       tq-gate-baseline.js record   <comparison.json> <audit.md> <evidence-dir> [--root <dir>]');
  console.error('       tq-gate-baseline.js repin    <audit.md> <evidence-dir> [--root <dir>]');
  console.error('       tq-gate-baseline.js snapshot <cur-baseline.json> <doc> <status.json|gate.json>');
  console.error('                                    [--comparison <file>] [--keep <dir>]');
  console.error('');
  console.error('exit 0  comparison complete, LINT-14 MET or N_A');
  console.error('exit 1  regressions found, LINT-14 UNMET');
  console.error('exit 2  usage or input error — nothing was written');
  process.exit(2);
}

function cmdCompare(argv) {
  const evidenceDir = takeFlag(argv, '--evidence', null);
  const rootDir = takeFlag(argv, '--root', process.cwd());
  const outFile = takeFlag(argv, '--out', null);
  const [prevBaselineArg, curBaselineArg, prevDocArg, docArg] = argv;

  if (!prevBaselineArg || !curBaselineArg || !prevDocArg || !docArg) usage();
  if (!fs.existsSync(docArg)) {
    console.error(`document not found: ${docArg}`);
    process.exit(2);
  }
  if (!fs.existsSync(curBaselineArg)) {
    console.error(`current baseline not found: ${curBaselineArg}`);
    process.exit(2);
  }

  const docText = fs.readFileSync(docArg, 'utf8');
  const docSha = hashContent(docText);
  const curFile = readJson(curBaselineArg, 'current baseline');
  const curBaseline = curFile.baseline || curFile;

  // A NAMED previous baseline that does not exist is an input error, not a
  // first audit.
  //
  // These two used to share a branch, so a mistyped filename made the script
  // announce "first audit", record LINT-14 N_A and exit 0 — the regression
  // check silently absent, reported as success. That is the worst shape a
  // failure can take in this repository: not a wrong answer, a missing one
  // wearing a green exit code. `-` is the sentinel and the ONLY way to ask for
  // first-audit behaviour.
  if (prevBaselineArg !== '-' && !fs.existsSync(prevBaselineArg)) {
    console.error(`previous baseline not found: ${prevBaselineArg}`);
    console.error('Pass "-" to declare this a first audit. A named baseline that does not');
    console.error('exist is a typo, and treating it as "nothing to compare" would turn the');
    console.error('regression check off and still exit 0.');
    process.exit(2);
  }

  // A first audit has nothing to compare against. LINT-14 is N_A and stays in
  // the denominator; the registry reserves N_A for exactly this case.
  if (prevBaselineArg === '-') {
    const cmp = {
      rows: [],
      counts: {
        regressions: 0, variance: 0, improvements: 0, degradations: 0,
        new_items: 0, dropped: 0, not_comparable: 0, uncompared: 0, unchanged: 0, unscoped: 0,
      },
      verdict: 'N_A',
      justification: 'caller-decided: first audit, no previous baseline exists to compare against.',
      diff: null,
      options: { firstAudit: true },
      meta: { doc_file: docArg, doc_sha256: docSha },
    };
    console.log('Baseline comparison: skipped — no previous baseline (first audit).');
    console.log('LINT-14: N_A');
    if (outFile) fs.writeFileSync(outFile, JSON.stringify(cmp, null, 2) + '\n', 'utf8');
    process.exit(0);
  }

  const prevFile = readJson(prevBaselineArg, 'previous baseline');
  const prevBaseline = prevFile.baseline || prevFile;

  const docUnchanged = Boolean(prevBaseline.doc_sha256)
    && String(prevBaseline.doc_sha256).toLowerCase() === docSha;

  let diff = null;
  let prevDocFile = null;
  let prevText = null;
  if (docUnchanged) {
    // Byte-identical documents: both sides are the same text, so every anchor
    // resolves "in both" and every flip is variance — the rule this branch has
    // always applied, now reached by the anchor test as well as the empty diff.
    const same = splitLines(docText);
    diff = diffResult({
      touched: new Set(), moved: new Set(), coarse: false, changed: 0, total: same.length,
      prevLines: same, curLines: same,
    });
  } else if (prevDocArg !== '-' && fs.existsSync(prevDocArg)) {
    // The supplied previous document must BE the one the previous baseline was
    // taken on. The baseline records doc_sha256 and this used to read it only
    // for the byte-identical exemption, never to check the file it was handed:
    // passing the current document as both arguments produced an empty diff, so
    // every flip became variance and LINT-14 came back MET. A recovery from git
    // history is exactly where a near-miss is likely — an adjacent commit, the
    // right file at the wrong revision — and a near-miss must not silently
    // widen the exemption.
    prevText = fs.readFileSync(prevDocArg, 'utf8');
    const prevSha = hashContent(prevText);
    if (prevBaseline.doc_sha256 && prevSha !== String(prevBaseline.doc_sha256).toLowerCase()) {
      console.error(`previous document does not match the previous baseline's doc_sha256:`);
      console.error(`  supplied ${prevDocArg}`);
      console.error(`    hashes ${prevSha}`);
      console.error(`  baseline ${String(prevBaseline.doc_sha256).toLowerCase()}`);
      console.error('Recover the document that hashes to the baseline value, or pass "-" to');
      console.error('declare no copy is available. A near-miss would widen the variance');
      console.error('exemption over text this diff never saw.');
      process.exit(2);
    }
    if (!prevBaseline.doc_sha256) {
      console.error('WARNING: the previous baseline records no doc_sha256, so the supplied');
      console.error('previous document could not be authenticated. The diff is taken on trust.');
    }
    prevDocFile = prevDocArg;
    diff = changedLines(prevText, docText);
  }

  let cmp;
  let filled = [];
  try {
    const curEls = readElements(curBaseline, 'current baseline');
    const docRel = path.relative(path.resolve(rootDir), path.resolve(docArg));
    filled = fillFromEvidence(curEls, evidenceDir, docRel);
    // An inline quote is checked against the document BEFORE it can scope
    // anything. snapshot checks the same thing when the baseline is written,
    // but compare reads the current baseline from a file the caller hands it,
    // and that file need not have passed through snapshot yet. The previous
    // baseline is re-checked against the previous document when one was
    // supplied; it passed the same check when it was snapshotted, and the hash
    // guard above already proved the document is the one it was taken on.
    const bad = checkAnchors(curEls, docText, 'current baseline');
    if (prevText !== null) {
      bad.push(...checkAnchors(readElements(prevBaseline, 'previous baseline'), prevText, 'previous baseline'));
    }
    if (bad.length) {
      throw new Error(bad.join('\n')
        + '\nA quote that does not match the document at the lines it cites is a citation of text\n'
        + 'the author did not read. Re-read {doc} at those lines and quote it verbatim.');
    }
    // The filled elements go in as read. A write-back loop used to stand here
    // that copied the filled `lines` onto the baseline object for compare() to
    // re-read — lint rows only, lines and source label only — and the anchors
    // fillFromEvidence had attached went with neither. See compare().
    cmp = compare(prevBaseline, curBaseline, diff, { docUnchanged, curElements: curEls });
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  cmp.meta = {
    previous_baseline_file: prevBaselineArg,
    previous_run_number: prevBaseline.run_number,
    previous_date: prevBaseline.date,
    previous_doc_file: prevDocFile,
    previous_doc_sha256: prevBaseline.doc_sha256,
    doc_file: path.relative(path.resolve(rootDir), path.resolve(docArg)).split(path.sep).join('/'),
    doc_sha256: docSha,
    evidence_filled: filled,
  };
  cmp.section = renderSection(cmp, cmp.meta);

  for (const r of cmp.rows) {
    if (r.klass === 'UNCHANGED') continue;
    const mark = r.klass === 'REGRESSION' ? '✗' : r.klass === 'IMPROVEMENT' ? '✓' : '!';
    console.log(`  ${mark} ${r.kind}: ${r.label}: ${r.from || '(absent)'} -> ${r.to || '(absent)'}`
      + `  [${r.klass}${r.scope ? `, ${r.scope}` : ''}]`);
  }
  console.log(`\nBaseline comparison: ${cmp.counts.regressions} regressions, `
    + `${cmp.counts.improvements} improvements, ${cmp.counts.new_items} new items, `
    + `${cmp.counts.variance} auditor-variance flips`);
  console.log(`LINT-14: ${cmp.verdict}`);
  if (!diff) {
    console.log('No copy of the previous document was found — every flip is booked as a regression.');
  }

  if (outFile) fs.writeFileSync(outFile, JSON.stringify(cmp, null, 2) + '\n', 'utf8');
  process.exit(cmp.verdict === 'UNMET' ? 1 : 0);
}

function cmdRecord(argv) {
  const rootDir = takeFlag(argv, '--root', process.cwd());
  const [cmpFile, auditPath, evidenceDir] = argv;
  if (!cmpFile || !auditPath || !evidenceDir) usage();
  if (!fs.existsSync(auditPath)) {
    console.error(`audit.md not found: ${auditPath}`);
    process.exit(2);
  }

  const cmp = readJson(cmpFile, 'comparison');
  const section = cmp.section || renderSection(cmp, cmp.meta || {});

  // Everything that can refuse this run has to refuse it BEFORE audit.md is
  // touched. Both known refusals — a path that escapes --root through a link,
  // and a section that would land inside an unterminated fence — used to fire
  // after the write, so the caller got exit 2, no evidence record, and a
  // modified document. `writeSection` owns the second check; this owns the first.
  let at;
  try {
    assertContained(auditPath, rootDir);
    at = writeSection(auditPath, section);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  let pinned;
  try {
    pinned = pin(auditPath, evidenceDir, rootDir, cmp.verdict, cmp.justification);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  console.log(`${SECTION_HEADING} written to ${auditPath} at lines ${at.start}-${at.end}`);
  console.log(`evidence/LINT-14.json: ${cmp.verdict}, pinned to ${pinned.artifact}:${pinned.line_start}-${pinned.line_end}`);
  console.log('Update the LINT-14 row in audit.md\'s Criterion Verdicts and Plan Lint Results');
  console.log('tables to this verdict, marked "caller-decided", then re-run `repin` — editing');
  console.log('those tables changes audit.md and makes the pin above stale.');
  process.exit(0);
}

function cmdRepin(argv) {
  const rootDir = takeFlag(argv, '--root', process.cwd());
  const [auditPath, evidenceDir] = argv;
  if (!auditPath || !evidenceDir) usage();

  const recFile = path.join(evidenceDir, 'LINT-14.json');
  if (!fs.existsSync(recFile)) {
    console.error(`no LINT-14 record to re-pin: ${recFile}`);
    console.error('Run `record` first — repin updates an existing pin, it does not decide a verdict.');
    process.exit(2);
  }
  const rec = readJson(recFile, 'LINT-14 record');

  let pinned;
  try {
    pinned = pin(auditPath, evidenceDir, rootDir, rec.verdict, rec.reasoning || rec.n_a_justification || '');
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  console.log(`re-pinned LINT-14 to ${pinned.artifact}:${pinned.line_start}-${pinned.line_end}`);
  console.log(`  sha256 ${pinned.sha256}`);
  process.exit(0);
}

function cmdSnapshot(argv) {
  const cmpFile = takeFlag(argv, '--comparison', null);
  const keepDir = takeFlag(argv, '--keep', null);
  const [curBaselineArg, docArg, stateArg] = argv;
  if (!curBaselineArg || !docArg || !stateArg) usage();
  if (!fs.existsSync(docArg)) {
    console.error(`document not found: ${docArg}`);
    process.exit(2);
  }

  const docText = fs.readFileSync(docArg, 'utf8');
  const curFile = readJson(curBaselineArg, 'current baseline');
  const baseline = curFile.baseline || curFile;

  // The baseline entering history must quote the document it is taken on.
  // This is the write that the next run's compare reads as its previous side,
  // so a quote that fails here would fail there too — but there it fails a
  // comparison, here it fails a file the author can still correct.
  let els;
  try {
    els = readElements(baseline, 'baseline');
    const bad = checkAnchors(els, docText, 'baseline');
    if (bad.length) {
      throw new Error(bad.join('\n')
        + '\nA quote that does not match the document at the lines it cites is a citation of text\n'
        + 'the author did not read. Re-read the document at those lines and quote it verbatim.');
    }
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  // A matrix row with lines and no quote is accepted and named. It will be
  // scoped by position in the next comparison, and position is what produced
  // four false positives out of four in run 5. Naming the rows at write time
  // is the one moment the author can still fix them.
  const unanchored = [...els.values()]
    .filter((el) => el.kind !== 'lint' && el.lines.length && !el.anchors.length)
    .map((el) => el.key);
  if (unanchored.length) {
    console.error(`WARNING: ${unanchored.length} matrix row(s) carry lines but no exact_quote:`);
    for (const k of unanchored) console.error(`  ${k}`);
    console.error('These will be scoped by line number in the next comparison, and a line number');
    console.error('is invalidated by any edit above it. Quote the document at each range verbatim.');
  }

  const state = fs.existsSync(stateArg) ? readJson(stateArg, 'state file') : {};

  // What goes into history: the WHOLE previous baseline object, unmodified.
  // R4-06 recorded that the block never said, and two executors put two
  // different things there. A trend line over run_number, date, doc_sha256 and
  // the element statuses needs all of them; a summary would have to be re-chosen
  // every time the baseline schema grows a field.
  if (!Array.isArray(state.history)) state.history = [];

  // Refuse a second snapshot of the same run.
  //
  // This step is not idempotent by nature — it MOVES the standing baseline into
  // history — so running it twice on an unchanged document pushed the same
  // baseline again and incremented run_number again. Three runs produced
  // "run 3" with two history entries: a trend line invented out of one audit.
  // The guard is the recorded document hash plus the run number, which together
  // identify the audit this baseline describes.
  const standing = state.baseline;
  const docSha = hashContent(docText);
  if (standing && Object.keys(standing).length) {
    const sameDoc = standing.doc_sha256 && String(standing.doc_sha256).toLowerCase() === docSha;
    const sameRun = baseline.run_number != null
      && Number(baseline.run_number) === Number(standing.run_number);
    if (sameDoc && (sameRun || baseline.run_number == null)) {
      console.error(`state already holds a baseline for run ${standing.run_number} on this exact document.`);
      console.error(`  ${stateArg}`);
      console.error('Snapshotting again would push a duplicate into history and invent a run.');
      console.error('Take a new audit first, or edit the state file by hand if this is a repair.');
      process.exit(2);
    }
    state.history.push(standing);
  }

  const prevRun = state.history.length
    ? Number(state.history[state.history.length - 1].run_number) || state.history.length
    : 0;
  if (baseline.run_number == null) baseline.run_number = prevRun + 1;
  if (baseline.date == null) baseline.date = new Date().toISOString().slice(0, 10);
  // Always computed here, never transcribed. A hand-copied hash that is one
  // character wrong turns the byte-identical exemption off silently.
  baseline.doc_sha256 = hashContent(docText);

  if (cmpFile && fs.existsSync(cmpFile)) {
    const cmp = readJson(cmpFile, 'comparison');
    baseline.comparison = { verdict: cmp.verdict, counts: cmp.counts };
  }

  // A carried-over audit_sha256 is worse than none. Plans record it beside
  // doc_sha256, and a baseline prepared by copying the previous one brought the
  // OLD audit's hash into the new record — a pin to a file this baseline never
  // describes, indistinguishable on disk from a correct one. Recompute it from
  // the audit this baseline is being taken on, or drop it.
  const auditGuess = path.join(path.dirname(stateArg), 'audit.md');
  if (fs.existsSync(auditGuess)) {
    baseline.audit_sha256 = hashContent(fs.readFileSync(auditGuess, 'utf8'));
  } else if (baseline.audit_sha256) {
    delete baseline.audit_sha256;
    console.error(`WARNING: no audit.md beside ${stateArg}; dropped a carried-over audit_sha256`);
    console.error('rather than record a hash of an audit this baseline does not describe.');
  }

  let kept = null;
  if (keepDir) {
    fs.mkdirSync(keepDir, { recursive: true });
    const ext = path.extname(docArg) || '.md';
    kept = path.join(keepDir, `doc-at-baseline-${baseline.run_number}${ext}`);

    // The copy is named by run number alone, so re-using a run number on a
    // DIFFERENT document overwrote the copy the earlier run's history entry
    // points at. That entry keeps its old doc_sha256 while the file on disk now
    // holds different bytes, and `compare` — which authenticates the previous
    // document against exactly that hash — then refuses to diff it. The caller's
    // only remaining option is "-", which books every flip as an unscoped
    // regression. So this write destroys the one artifact the rest of the script
    // depends on, and the error it eventually produces tells the caller to
    // recover a file this step deleted.
    //
    // The duplicate guard above does not catch it: that guard keys on the
    // document hash, and here the document is what changed.
    if (fs.existsSync(kept) && hashContent(fs.readFileSync(kept, 'utf8')) !== baseline.doc_sha256) {
      console.error(`run ${baseline.run_number} already kept a copy of a DIFFERENT document:`);
      console.error(`  ${kept.split(path.sep).join('/')}`);
      console.error('Overwriting it would leave that run\'s history entry pointing at bytes that no');
      console.error('longer hash to its recorded doc_sha256, and `compare` refuses to diff against');
      console.error('a copy that fails that check — the run becomes permanently unscoped.');
      console.error('Snapshot this document under a run_number it has not already used.');
      process.exit(2);
    }
    fs.writeFileSync(kept, docText, 'utf8');
  }
  baseline.doc_copy = kept ? kept.split(path.sep).join('/') : null;

  state.baseline = baseline;
  fs.writeFileSync(stateArg, JSON.stringify(state, null, 2) + '\n', 'utf8');

  console.log(`baseline run ${baseline.run_number} written to ${stateArg}`);
  console.log(`  doc_sha256 ${baseline.doc_sha256}`);
  console.log(`  history now holds ${state.history.length} prior baseline(s)`);
  if (kept) {
    console.log(`  document copy kept at ${baseline.doc_copy}`);
  } else {
    console.log('  NO document copy kept — the next comparison cannot diff, and every');
    console.log('  pass-to-fail flip it finds will be booked as a regression. Pass --keep <dir>.');
  }
  process.exit(0);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv.shift();
  if (cmd === 'compare') cmdCompare(argv);
  else if (cmd === 'record') cmdRecord(argv);
  else if (cmd === 'repin') cmdRepin(argv);
  else if (cmd === 'snapshot') cmdSnapshot(argv);
  else usage();
}

module.exports = {
  hashContent, normalizeStatus, normalizeLines, changedLines, readElements,
  readInlineAnchors, checkAnchors,
  fillFromEvidence, scopeOf, compare, renderSection, locateSection, fencedLines,
  writeSection, pin, assertContained, SECTION_HEADING, STATUS_ALIASES, RANK, SELF_REFERENTIAL,
  LCS_CELL_LIMIT, SCOPED_CLASSES,
};
