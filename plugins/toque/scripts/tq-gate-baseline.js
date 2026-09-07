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
  const key = String(raw == null ? '' : raw).trim().toLowerCase();
  const mapped = STATUS_ALIASES[key];
  if (!mapped) {
    throw new Error(
      `unknown status ${JSON.stringify(raw)} — known: ${Object.keys(STATUS_ALIASES).join(', ')}`,
    );
  }
  return mapped;
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
  while (i < n && j < m) {
    if (prevMid[i] === curMid[j]) {
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
      if (art !== wanted && path.basename(art) !== path.basename(wanted)) continue;
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

  for (const key of [...keys].sort()) {
    const a = prev.get(key);
    const b = cur.get(key);

    if (!a) {
      rows.push({
        key, kind: b.kind, id: b.id, label: b.label,
        from: null, to: b.status, lines: b.lines, line_source: b.line_source,
        scope: null, scope_reason: null, klass: 'NEW',
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
      row.klass = scope === 'changed' ? 'REGRESSION'
        : scope === 'unchanged' ? 'VARIANCE'
          : 'REGRESSION';
      if (scope === 'unknown') row.unscoped = true;
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
    unscoped: rows.filter((r) => r.unscoped).length,
  };

  let verdict;
  let justification;
  if (options.docUnchanged) {
    verdict = 'N_A';
    justification = 'caller-decided: {doc} is byte-identical to the previous baseline\'s '
      + 'document, so the diff is empty and every flip is auditor variance.';
  } else if (counts.regressions > 0) {
    verdict = 'UNMET';
    justification = `caller-decided from the baseline comparison: ${counts.regressions} `
      + `regression(s) on text the revision changed, ${counts.variance} auditor-variance flip(s) discounted.`;
  } else {
    verdict = 'MET';
    justification = 'caller-decided from the baseline comparison: no element that was passing '
      + `now fails on text the revision changed (${counts.variance} auditor-variance flip(s) discounted).`;
  }

  return { rows, counts, verdict, justification, diff, options };
}

// ---------------------------------------------------------------------------
// The section and the pin
// ---------------------------------------------------------------------------

const SECTION_HEADING = '## Baseline comparison';

/** Classes whose outcome turned on the diff scope, and only those. */
const SCOPED_CLASSES = new Set(['REGRESSION', 'VARIANCE', 'DEGRADATION']);

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
  if (cmp.options && cmp.options.docUnchanged) {
    out.push('- Diff: EMPTY — the document is byte-identical to the previous baseline\'s.');
  } else if (cmp.diff) {
    out.push(`- Diff: ${cmp.diff.changed} of ${cmp.diff.total} current lines changed`
      + `${cmp.diff.coarse ? ' (coarse fallback: the changed region was too large to align line by line, so all of it counts as changed)' : ''}`);
  } else {
    out.push('- Diff: NOT AVAILABLE — no copy of the previous baseline\'s document could be found, '
      + 'so the variance exemption is not applied and every flip below is booked as a regression.');
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
function locateSection(auditText) {
  const lines = splitLines(auditText);
  const start = lines.findIndex((l) => l.trim() === SECTION_HEADING);
  if (start === -1) return null;
  let end = lines.length - 1;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i - 1; break; }
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

  let next;
  if (at) {
    const before = lines.slice(0, at.start - 1);
    const after = lines.slice(at.end);
    next = [...before, ...splitLines(sectionText), ...after];
  } else {
    const body = lines.slice();
    while (body.length && body[body.length - 1].trim() === '') body.pop();
    next = [...body, '', ...splitLines(sectionText)];
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

  // A first audit has nothing to compare against. LINT-14 is N_A and stays in
  // the denominator; the registry reserves N_A for exactly this case.
  if (prevBaselineArg === '-' || !fs.existsSync(prevBaselineArg)) {
    const cmp = {
      rows: [],
      counts: {
        regressions: 0, variance: 0, improvements: 0, degradations: 0,
        new_items: 0, dropped: 0, not_comparable: 0, unchanged: 0, unscoped: 0,
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
    prevDocFile = prevDocArg;
    diff = changedLines(fs.readFileSync(prevDocArg, 'utf8'), docText);
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
        if (!v.lines) { v.lines = el.lines; v.line_source = el.line_source; }
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
  if (state.baseline && Object.keys(state.baseline).length) {
    state.history.push(state.baseline);
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
    console.log('  NO document copy kept — the next comparison cannot diff, and every flip');
    console.log('  it finds will be booked as a regression. Pass --keep <dir>.');
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
  fillFromEvidence, scopeOf, compare, renderSection, locateSection, writeSection,
  pin, SECTION_HEADING, STATUS_ALIASES, RANK, SELF_REFERENTIAL, LCS_CELL_LIMIT,
};
