#!/usr/bin/env node
/**
 * Seeded canary — PH5-030..033, spec §5.4.
 *
 * Every other mechanism in the Phase 5 gate checks the PLAN. This one checks the
 * AUDITOR. A known defect is injected into a working copy before the audit runs; an
 * audit that does not report it has not audited anything, and its clean verdicts are
 * worth nothing regardless of how well evidenced they look.
 *
 * The honest claim, per spec §5.4: this reliably detects a LAZY audit and only
 * incidentally an adversarial one. The judge holds Read/Grep/Glob over the
 * repository and can therefore read this file, including the defect table below.
 * Rotating the class per run raises the cost of pre-empting it; it does not make
 * the canary tamper-proof, and it is not claimed to.
 */

/**
 * Each class removes or adds one thing, and names the criterion that thing exists to
 * satisfy. `apply` returns null when it has nothing to act on — never a silent no-op,
 * because a canary that cannot be found makes every audit look broken for a reason
 * unrelated to the audit.
 */
const CLASSES = {
  'rollback-strip': {
    criterion: 'LINT-03',
    describe: 'removed the rollback line from one deployment phase',
    apply(text) {
      const lines = text.split('\n');
      const i = lines.findIndex((l) => /^Rollback:/.test(l));
      if (i === -1) return null;
      lines.splice(i, 1);
      return lines.join('\n');
    },
  },

  'owner-strip': {
    criterion: 'LINT-04',
    describe: 'blanked the owner of one external dependency',
    apply(text) {
      const lines = text.split('\n');
      // A dependency row: | name | owner | status |
      const i = lines.findIndex((l) => /^\|[^|]+\|[^|]+\|[^|]+\|\s*$/.test(l)
        && !/^\|\s*-+/.test(l)
        && !/Dependency\s*\|/i.test(l)
        && /\|\s*[a-z][a-z ]+team\s*\|/i.test(l));
      if (i === -1) return null;
      lines[i] = lines[i].replace(/\|\s*[a-z][a-z ]+team\s*\|/i, '|  |');
      return lines.join('\n');
    },
  },

  'assumption-inject': {
    criterion: 'LINT-08',
    describe: 'added an unverified HIGH-impact assumption',
    apply(text) {
      const lines = text.split('\n');
      // Anchor on the assumption register's HEADER: a table row with a cell that
      // starts "Assumption", followed by a separator row. Matching any row that
      // contained the word anchored on a success-criteria row in one stress run.
      const isRow = (l) => /^\|/.test(l);
      const isSep = (l) => /^\|\s*:?-+/.test(l);
      const header = lines.findIndex((l, i) => isRow(l)
        && /^\|(?:[^|]*\|)*?\s*Assumptions?\b[^|]*\|/i.test(l)
        && isSep(lines[i + 1] || ''));
      if (header === -1) return null;
      // The register ENDS at the first line that is not a table row. An unbounded
      // scan for the next "| 1 |" planted the row 120 lines below a register whose
      // rows were numbered A1..A11 — inside a Testing Strategy table — and exit 0
      // said nothing, so canary.json named a criterion the copy did not violate
      // and a correct audit was condemned as a miss. Inside the register or
      // nothing: a register with no rows is not a site.
      let end = header + 2;
      while (end < lines.length && isRow(lines[end])) end++;
      const last = end - 1;
      if (last < header + 2) return null;
      const cells = (l) => l.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const names = cells(lines[header]);
      const prev = cells(lines[last])[0] || '';
      const m = /^([A-Za-z]*)(\d+)$/.exec(prev);
      const id = m ? `${m[1]}${Number(m[2]) + 1}` : '2';
      // The row takes the register's own column count, filled by header name, so
      // a seven-column register gets a seven-cell row and not a malformed one.
      const row = names.map((name, k) => {
        if (/^assumption/i.test(name)) return 'Peak write throughput fits the current connection pool';
        if (/impact/i.test(name)) return 'Writes stall at launch';
        if (/status/i.test(name)) return 'unverified';
        if (k === 0) return id;
        return '';
      });
      lines.splice(last + 1, 0, `| ${row.join(' | ')} |`);
      return lines.join('\n');
    },
  },

  'criteria-strip': {
    criterion: 'LINT-10',
    describe: 'removed the go/no-go criteria from one phase',
    apply(text) {
      const lines = text.split('\n');
      const i = lines.findIndex((l) => /^Go\/No-Go:/.test(l));
      if (i === -1) return null;
      lines.splice(i, 1);
      return lines.join('\n');
    },
  },

  'test-claim-inject': {
    criterion: 'LINT-15',
    describe: 'claimed coverage from a test file that does not exist',
    apply(text) {
      const lines = text.split('\n');
      const i = lines.findIndex((l) => /tests?\/.*\.test\.js/.test(l));
      if (i === -1) return null;
      lines.splice(i + 1, 0,
        'Rollback behaviour is asserted in tests/integration/rollback-guarantees.test.js.');
      return lines.join('\n');
    },
  },
};

const CLASS_NAMES = Object.keys(CLASSES);

/**
 * Inject one defect. Throws when the class cannot apply — a silent no-op would
 * produce a canary that can never be found.
 */
function inject(text, className) {
  const spec = CLASSES[className];
  if (!spec) {
    throw new Error(`unknown canary class: ${className}`);
  }

  const normalized = String(text).replace(/\r\n/g, '\n');
  const mutated = spec.apply(normalized);

  if (mutated === null) {
    throw new Error(
      `canary class ${className} found nothing to act on in this spec. `
      + 'Refusing to emit a canary that cannot be found: an undetectable canary '
      + 'makes every audit look untrustworthy for a reason unrelated to the audit.'
    );
  }
  if (mutated === normalized) {
    throw new Error(
      `canary class ${className} produced no change. A no-op canary is vacuous.`
    );
  }

  return {
    text: mutated,
    className,
    criterion: spec.criterion,
    describe: spec.describe,
    edit: locateEdit(normalized, mutated),
  };
}

/**
 * Where the mutation landed. Every class inserts, removes or rewrites exactly one
 * line, and the caller needs that line: a finding that rests on it — on any
 * criterion, not only the canary's own — was derived from the mutation, not from
 * the document, and the strip-and-recheck step has to reach every one of them.
 * `line` is 1-based; for an insert or replace it indexes the MUTATED copy, for a
 * delete it indexes the ORIGINAL (the line no longer exists in the copy).
 */
function locateEdit(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (b.length > a.length) return { op: 'insert', line: i + 1, text: b[i] };
  if (b.length < a.length) return { op: 'delete', line: i + 1, text: a[i] };
  return { op: 'replace', line: i + 1, text: b[i] };
}

/**
 * Did the audit report the planted defect?
 *
 * `unmetCriteria` is the set of criterion ids the audit returned as UNMET. Note what
 * this deliberately does NOT do: it does not look for a finding that "resembles" the
 * canary, or score how close the audit got. The planted defect violates exactly one
 * criterion; either that id came back UNMET or the audit did not see it.
 *
 * An audit reporting zero gaps therefore fails here, which is the point. A perfectly
 * clean result on a document known to contain a defect is not evidence of a good
 * plan — it is evidence of an audit that did not run.
 */
function wasFound(canaryRecord, unmetCriteria, applicableCriteria) {
  if (!canaryRecord || !canaryRecord.criterion) {
    throw new Error('wasFound requires a canary record produced by inject()');
  }
  const unmet = new Set((unmetCriteria || []).map((c) => String(c).trim()));
  if (!unmet.has(canaryRecord.criterion)) return false;

  // Hitting the criterion is necessary and not sufficient.
  //
  // The check above, alone, is passed by an auditor that returns EVERY criterion
  // as UNMET. That auditor discriminates nothing — it would "detect" a canary in
  // a document with no defect in it — and this function exists to say whether the
  // audit can tell a defect from its absence. A blanket rejection is the lazy
  // failure mode wearing the opposite mask from the one the canary was built for,
  // and it passed for several releases.
  //
  // So: if the audit rejected everything it looked at, the run is not evidence of
  // anything and the canary reports NOT found. The caller supplies the applicable
  // set; when it does not, this degrades to the old behaviour rather than
  // inventing a denominator, and the caller is the only thing that knows it.
  const applicable = (applicableCriteria || []).map((c) => String(c).trim()).filter(Boolean);
  if (applicable.length > 0) {
    const rejectedAll = applicable.every((c) => unmet.has(c));
    if (rejectedAll) return false;
  }
  return true;
}

/**
 * Remove the canary's finding from the report and queue that criterion for recheck.
 *
 * The audit ran against a mutated copy, so its canary finding is an artefact of the
 * harness and must not reach the reader. Stripping alone would be unsafe: if the plan
 * has a GENUINE gap on the same criterion, removing "the LINT-03 finding" removes the
 * real one with it. The strip therefore only removes the artefact; `resolve` decides
 * the truth once that one criterion has been re-checked against the unmutated
 * original. `recheckRequired` is not advisory — a caller that ignores it has silently
 * deleted a real finding.
 */
function stripFinding(canaryRecord, findings) {
  const list = (findings || []).map((f) => String(f).trim());
  return {
    findings: list.filter((f) => f !== canaryRecord.criterion),
    recheck: canaryRecord.criterion,
    recheckRequired: true,
    className: canaryRecord.className,
  };
}

/**
 * Fold the recheck result back in. `stillFails` is the verdict for the stripped
 * criterion evaluated against the ORIGINAL, unmutated spec.
 */
function resolve(stripped, recheckResult) {
  if (!stripped.recheckRequired) {
    throw new Error('resolve() called on a report that was never stripped');
  }
  if (!recheckResult || typeof recheckResult.stillFails !== 'boolean') {
    throw new Error(
      'resolve() needs the recheck verdict for ' + stripped.recheck
      + ' against the unmutated original. Skipping it would either hide a real gap '
      + 'or report the canary as one.'
    );
  }
  const findings = stripped.findings.slice();
  if (recheckResult.stillFails && !findings.includes(stripped.recheck)) {
    findings.push(stripped.recheck);
  }
  return { findings, recheckRequired: false, recheck: stripped.recheck };
}

/**
 * Decide what the canary rounds mean for the gate.
 *
 * One miss buys a re-run with a different defect class — a single miss can be a
 * genuinely awkward injection site rather than a bad audit. Two consecutive misses
 * end it: the audit is untrustworthy and the gate fails.
 *
 * Critically, a fatal canary also FORBIDS the revision loop. Revising a plan against
 * findings from an audit that could not see a planted defect is worse than not
 * revising: it rewrites the spec to satisfy conclusions that were never derived from
 * reading it.
 */
function assess(rounds) {
  const r = Array.isArray(rounds) ? rounds : [];
  const found = r.some(Boolean);
  const misses = r.filter((x) => x === false).length;
  const fatal = !found && misses >= 2;

  return {
    trustworthy: found,
    retry: !found && misses === 1,
    fatal,
    allowRevision: found,
    reason: fatal
      ? 'audit untrustworthy: the planted defect was missed twice'
      : (found ? 'canary found' : 'canary missed, re-running with a different class'),
  };
}

/**
 * Choose a class deterministically from a seed, so a run can be reproduced from its
 * record while still rotating between runs. Math.random would make a failed audit
 * impossible to replay, and replaying a failure is the first thing anyone wants.
 *
 * The hash depends on the SEED ALONE, not on the document. A fixed seed is therefore
 * a fixed class: pickClass('retry') is always the same class, for every spec. That is
 * why a re-run must EXCLUDE the class already tried (--exclude) rather than hope a
 * different seed lands elsewhere — a one-in-CLASS_NAMES.length chance of repeating
 * the exact trial that was just missed is not a second trial. See the retry rule in
 * skills/plan/stages/stage-2-design.md.
 */
function pickClass(seed) {
  const s = String(seed == null ? '' : seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return CLASS_NAMES[Math.abs(h) % CLASS_NAMES.length];
}

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');

  const argv = process.argv.slice(2);
  const cmd = argv[0];

  // `detected` exists because wasFound had no caller.
  //
  // The blanket-rejection rule was added to wasFound and nothing invoked it: the
  // workflow told the agent to check membership by hand, in prose, so the
  // function was reachable only from its own unit tests. In this plugin the
  // markdown IS the runtime for agent behaviour, and a rule that lives in
  // JavaScript nothing calls is decoration. A subcommand makes the check
  // mechanical and gives the workflow an exit code to branch on instead of a
  // judgement to make.
  if (cmd === 'detected') {
    const recordPath = argv[1];
    const unmetArg = argv[2];
    const applicableArg = argv[3];

    if (!recordPath || unmetArg === undefined) {
      console.error('usage: tq-canary.js detected <canary.json> <unmet-csv> [applicable-csv]');
      console.error('  unmet-csv       criterion ids the audit returned UNMET, comma-separated');
      console.error('  applicable-csv  every criterion the audit considered. Supply it:');
      console.error('                  without it a blanket rejection cannot be distinguished');
      console.error('                  from a real detection.');
      process.exit(2);
    }
    if (!fs.existsSync(recordPath)) {
      console.error(`canary record not found: ${recordPath}`);
      console.error('Without the record there is nothing to detect. This is not a pass.');
      process.exit(2);
    }

    let rec;
    try {
      rec = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    } catch (err) {
      console.error(`canary record is not valid JSON: ${recordPath}`);
      process.exit(2);
    }

    const split = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
    const unmet = split(unmetArg);
    const applicable = split(applicableArg);

    if (applicable.length === 0) {
      console.error('WARNING: no applicable set supplied. An audit that returned every');
      console.error('criterion UNMET cannot be told apart from one that found the canary.');
    }

    const found = wasFound(rec, unmet, applicable);
    const blanket = applicable.length > 0 && applicable.every((c) => unmet.includes(c));

    if (found) {
      console.log(`canary FOUND: ${rec.criterion} (${rec.className})`);
      process.exit(0);
    }
    if (blanket) {
      console.log(`canary NOT FOUND: the audit returned all ${applicable.length} applicable criteria as UNMET.`);
      console.log('An audit that rejects everything hits the canary by construction and');
      console.log('discriminates nothing. This is a miss, not a detection.');
      process.exit(1);
    }
    console.log(`canary MISSED: ${rec.criterion} (${rec.className}) is not in the UNMET set`);
    process.exit(1);
  }

  // --exclude <class> is pulled out before the positional args so it can appear
  // anywhere. A re-run passes the class the first trial used; that class is removed
  // from the rotation entirely, which is the only way to guarantee a different trial.
  const rest = argv.slice(1);
  const exclusions = [];
  // Every occurrence is pulled out, not just the first. Leaving a second one in
  // place made it the positional seed and its VALUE the next positional, so
  // `--exclude a --exclude b` silently selected b — the class the caller asked to
  // exclude. A flag that quietly does the opposite of what it says is worse than
  // one that is refused.
  for (let i = rest.indexOf('--exclude'); i !== -1; i = rest.indexOf('--exclude')) {
    if (i + 1 >= rest.length || String(rest[i + 1]).startsWith('--')) {
      console.error('--exclude requires a class name');
      console.error(`known classes: ${CLASS_NAMES.join(', ')}`);
      process.exit(2);
    }
    exclusions.push(rest[i + 1]);
    rest.splice(i, 2);
  }
  if (exclusions.length > 1) {
    console.error(`--exclude may be given once; got ${exclusions.length}: ${exclusions.join(', ')}`);
    console.error('The gate sanctions ONE re-run, so one class is ever excluded.');
    process.exit(2);
  }
  const excluded = exclusions.length ? exclusions[0] : null;
  const [specPath, outDir, seedArg] = rest;

  if (cmd !== 'inject' || !specPath || !outDir) {
    console.error('usage: tq-canary.js inject <spec-path> <out-dir> [seed] [--exclude <class>]');
    console.error('       tq-canary.js detected <canary.json> <unmet-csv> [applicable-csv]');
    process.exit(2);
  }
  if (excluded !== null && !CLASS_NAMES.includes(excluded)) {
    console.error(`--exclude: unknown canary class: ${excluded}`);
    console.error(`known classes: ${CLASS_NAMES.join(', ')}`);
    process.exit(2);
  }
  if (!fs.existsSync(specPath)) {
    console.error(`spec not found: ${specPath}`);
    process.exit(2);
  }

  const original = fs.readFileSync(specPath, 'utf8');
  const seed = seedArg || `${path.basename(specPath)}:${original.length}`;

  // Try classes in rotation from the seed. A spec may genuinely lack the site one
  // class needs; that is not a reason to emit an undetectable canary, so we move to
  // the next. Exhausting every class is fatal — a spec no class can mark is a spec
  // whose audit cannot be checked, and proceeding would mean trusting it blindly.
  const start = CLASS_NAMES.indexOf(pickClass(seed));
  let record = null;
  const tried = [];
  for (let k = 0; k < CLASS_NAMES.length; k++) {
    const name = CLASS_NAMES[(start + k) % CLASS_NAMES.length];
    if (name === excluded) continue;
    tried.push(name);
    try {
      record = inject(original, name);
      break;
    } catch (err) {
      // fall through to the next class
    }
  }

  if (!record) {
    // Two different failures, two exit codes, because the caller must branch on
    // which one it is. Exit 2: this document carries none of the five shapes, so no
    // audit of it can ever be checked. Exit 3: the document carries one shape and it
    // is the one already tried, so a SECOND trial is impossible — that is not the
    // auditor missing twice, and must not be recorded as such.
    // Exit 3 is only truthful when the EXCLUDED class would itself have applied —
    // that is what makes this document a one-trial document. If nothing applies at
    // all, including the excluded class, the honest answer is exit 2: this document
    // can carry no canary and never could, which is a different verdict with a
    // different recorded reason.
    let excludedApplies = false;
    if (excluded !== null) {
      try { inject(original, excluded); excludedApplies = true; } catch (err) { /* it would not have */ }
    }
    if (excludedApplies) {
      console.error(`no canary class other than ${excluded} could be applied to ${specPath}`);
      console.error(`tried: ${tried.join(', ') || '(none)'}`);
      console.error('Only one trial was ever possible on this document. A re-run cannot');
      console.error('produce an independent second trial; do not record a second miss.');
      process.exit(3);
    }
    console.error(`no canary class could be applied to ${specPath}`);
    console.error(`tried: ${tried.join(', ')}`);
    console.error('A spec that cannot carry a canary is a spec whose audit cannot be');
    console.error('checked. Refusing to proceed unchecked.');
    process.exit(2);
  }

  // The copy sits ALONE in its own folder. The record used to be written beside
  // it, and an auditor that lists the folder of the file it was handed found the
  // answer key there (one holistic judge read it; two plan-auditors declined it
  // on their own initiative — the gate had arranged nothing). The record stays
  // in outDir, one level up, where nothing points the auditor.
  const docDir = path.join(outDir, 'doc');
  fs.mkdirSync(docDir, { recursive: true });
  const mutatedPath = path.join(docDir, path.basename(specPath));
  fs.writeFileSync(mutatedPath, record.text, 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'canary.json'),
    JSON.stringify({
      className: record.className,
      criterion: record.criterion,
      describe: record.describe,
      edit: record.edit,
      seed,
      excluded,
      spec: specPath,
      mutated: mutatedPath,
    }, null, 2) + '\n',
    'utf8'
  );

  console.log(`canary: ${record.className} -> ${record.criterion}`);
  console.log(`  ${record.describe}`);
  console.log(`  audit this copy: ${mutatedPath}`);
  console.log(`  ${record.edit.op} at line ${record.edit.line}; point the auditor at the copy, never at ${outDir}`);
  process.exit(0);
}

module.exports = {
  inject, wasFound, stripFinding, resolve, assess, pickClass, locateEdit, CLASSES, CLASS_NAMES,
};
