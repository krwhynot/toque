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
 * Returns { touched: Set<number>, coarse: boolean, changed: number }.
 */
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

  if (n === 0 && m === 0) {
    return { touched, coarse: false, changed: 0, total: cur.length };
  }

  if ((n + 1) * (m + 1) > LCS_CELL_LIMIT) {
    for (let j = 0; j < m; j++) touched.add(p + j + 1);
    if (n > 0 && m === 0) markDeletion(0);
    return { touched, coarse: true, changed: touched.size, total: cur.length };
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

  // Displaced matches count as touched.
  //
  // LCS finds ONE maximal alignment, and when two blocks swap it is free to
  // represent that as "the smaller block moved" — which leaves the larger
  // block's lines matched, unmarked, and therefore eligible for the variance
  // exemption. Swapping two adjacent blocks left the relocated lines outside
  // the touched set entirely, so a concern citing a moved line was exempted on
  // text the revision plainly did move.
  //
  // A line whose offset shifted is marked. This OVER-reports: every line after
  // a single insertion is displaced by one, and all of them are now touched.
  // That is the intended direction — over-reporting can only turn a variance
  // into a regression, and the gate's standing rule is that the exemption is
  // never applied on a guess. The common prefix and suffix are trimmed before
  // this runs, so an ordinary revision to one section does not drag the whole
  // document in with it.
  for (const [pi, cj] of matched) {
    if (pi !== cj) touched.add(p + cj + 1);
  }

  return { touched, coarse: false, changed: touched.size, total: cur.length };
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
    els.set(key, {
      key,
      kind,
      id,
      label: name || id,
      status,
      lines,
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
    if (el.kind !== 'lint' || el.lines.length > 0) continue;
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
    }
    if (lines.length) {
      el.lines = lines;
      el.line_source = `evidence/${el.id}.json`;
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

  for (const [a, b] of el.lines) {
    for (let l = a; l <= b; l++) {
      if (diff.touched.has(l)) return { scope: 'changed', reason: `line ${l} is inside the diff` };
    }
  }
  return { scope: 'unchanged', reason: 'every line cited is unchanged since the previous baseline' };
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
  const prev = readElements(prevBaseline, 'previous baseline');
  const cur = readElements(curBaseline, 'current baseline');

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
  };

  let verdict;
  let justification;
  if (options.docUnchanged) {
    verdict = 'N_A';
    justification = 'caller-decided: {doc} is byte-identical to the previous baseline\'s '
      + 'document, so the diff is empty and every flip is auditor variance.';
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
  } else if (counts.regressions > 0) {
    verdict = 'UNMET';
    justification = `caller-decided from the baseline comparison: ${counts.regressions} `
      + `regression(s) on text the revision changed, ${counts.variance} auditor-variance flip(s) discounted.`;
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
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence === null) {
      if (m) { fence = m[1][0]; inFence[i] = true; }
    } else {
      inFence[i] = true;
      if (m && m[1][0] === fence) fence = null;
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
  const isHeading = (l) => /^##\s+Baseline comparison\s*(\(.*\))?\s*$/.test(l.trim());

  const start = lines.findIndex((l, i) => !inFence[i] && isHeading(l));
  if (start === -1) return null;
  let end = lines.length - 1;
  for (let i = start + 1; i < lines.length; i++) {
    if (!inFence[i] && /^##\s/.test(lines[i])) { end = i - 1; break; }
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
  fs.writeFileSync(auditPath, crlf ? text.replace(/\n/g, '\r\n') : text, 'utf8');
  return locateSection(fs.readFileSync(auditPath, 'utf8'));
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
  if (docUnchanged) {
    diff = { touched: new Set(), coarse: false, changed: 0, total: splitLines(docText).length };
  } else if (prevDocArg !== '-' && fs.existsSync(prevDocArg)) {
    // The supplied previous document must BE the one the previous baseline was
    // taken on. The baseline records doc_sha256 and this used to read it only
    // for the byte-identical exemption, never to check the file it was handed:
    // passing the current document as both arguments produced an empty diff, so
    // every flip became variance and LINT-14 came back MET. A recovery from git
    // history is exactly where a near-miss is likely — an adjacent commit, the
    // right file at the wrong revision — and a near-miss must not silently
    // widen the exemption.
    const prevText = fs.readFileSync(prevDocArg, 'utf8');
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
    // readElements runs again inside compare(); re-inject the filled lines by
    // writing them back onto the baseline object so both reads agree.
    for (const el of curEls.values()) {
      if (el.kind !== 'lint' || !el.lines.length) continue;
      if (!curBaseline.lint_results) curBaseline.lint_results = {};
      const v = curBaseline.lint_results[el.id];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        // Test for EMPTINESS, not truthiness. `[]` is truthy, so a baseline
        // that wrote `"lines": []` — the natural spelling for "I have no lines
        // to give you" — kept its empty array, the filled evidence was thrown
        // away, and the element scoped as unscoped. Omitting the field gave MET
        // and spelling it out gave UNMET, on identical evidence.
        if (!Array.isArray(v.lines) || v.lines.length === 0) {
          v.lines = el.lines;
          v.line_source = el.line_source;
        }
      } else {
        curBaseline.lint_results[el.id] = {
          status: v, lines: el.lines, line_source: el.line_source,
        };
      }
    }
    cmp = compare(prevBaseline, curBaseline, diff, { docUnchanged });
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

  const at = writeSection(auditPath, section);
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
  fillFromEvidence, scopeOf, compare, renderSection, locateSection, fencedLines,
  writeSection, pin, SECTION_HEADING, STATUS_ALIASES, RANK, SELF_REFERENTIAL,
  LCS_CELL_LIMIT, SCOPED_CLASSES,
};
