// Deterministic on-disk invariants for a stress-test scenario.
// usage: node check.js <scenario> <repoDir> <pluginRoot>
// Prints JSON. Never modifies the repo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const [scenario, repo, pluginArg] = process.argv.slice(2);
// Absolute, because run() executes with cwd set to the scenario repository: a
// relative plugin root such as `plugins/toque` would resolve inside it, and the
// embedded validator call would fail (review of September 10).
const plugin = pluginArg ? path.resolve(pluginArg) : pluginArg;
const out = { scenario, repo, checks: {} };
const abs = (p) => path.join(repo, p);
const exists = (p) => fs.existsSync(abs(p));
const sha = (p) => exists(p) ? crypto.createHash('sha256').update(fs.readFileSync(abs(p), 'utf8').replace(/\r\n/g, '\n')).digest('hex') : null;
const listDir = (p) => exists(p) ? fs.readdirSync(abs(p)) : [];
const read = (p) => exists(p) ? fs.readFileSync(abs(p), 'utf8') : '';
const run = (cmd) => { try { return { code: 0, out: execSync(cmd, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; } };

function gateFolderChecks(gateDir, docPath) {
  const c = {};
  c.audit_md = exists(`${gateDir}/audit.md`);
  c.gate_json = exists(`${gateDir}/gate.json`);
  const ev = listDir(`${gateDir}/evidence`).filter(f => f.endsWith('.json'));
  c.evidence_count = ev.length;
  c.canary_dir_absent = !exists(`${gateDir}/.canary`);
  let cites_canary = 0, cites_doc = 0, cites_other = [];
  for (const f of ev) {
    try {
      const rec = JSON.parse(read(`${gateDir}/evidence/${f}`));
      for (const e of (rec.evidence || [])) {
        const a = String(e.artifact || '').replace(/\\/g, '/');
        if (a.includes('.canary/')) cites_canary++;
        else if (docPath && a.endsWith(docPath.replace(/\\/g, '/'))) cites_doc++;
        else cites_other.push(a);
      }
    } catch (e) { cites_other.push(`UNPARSEABLE:${f}`); }
  }
  c.citations = { canary: cites_canary, doc: cites_doc, other: [...new Set(cites_other)].slice(0, 10) };
  if (ev.length) {
    const v = run(`node "${plugin}/scripts/tq-evidence-validate.js" "${abs(gateDir + '/evidence')}" "${repo}"`);
    c.validator_exit = v.code;
    c.validator_flags = [...new Set((v.out.match(/EVIDENCE-[A-Z-]+/g) || []))];
  }
  if (c.gate_json) { try { const g = JSON.parse(read(`${gateDir}/gate.json`)); c.gate_json_keys = Object.keys(g); c.gate_passed = g.gate_passed; c.canary_found = g.canary_found; c.canary_class = g.canary_class; c.canary_reason = g.canary_reason; c.validator_exit_recorded = g.validator_exit; c.mode_recorded = g.mode; } catch (e) { c.gate_json_parse = 'error'; } }
  const audit = read(`${gateDir}/audit.md`);
  // Prose scan, not a citation check: the auditor declining to read .canary/, or the
  // caller quoting an inject command, both hit it. The invariant is citations.canary.
  c.audit_prose_mentions_canary_path = audit.includes('.canary/');
  // mode tolerates the bolded form `Audit mode: **LITE (spec-only)**`, which returned null in run 3 (s6).
  c.audit_mentions = { raw_pass_word_count: (audit.match(/\bPASS\b/g) || []).length, raw_not_pass_mentions: (audit.match(/NOT PASS/g) || []).length, revision_history: /Revision History/.test(audit), mode: (audit.match(/Audit mode:\s*\**\s*([A-Za-z]+)/) || [])[1] || null, not_applicable: /not-applicable/.test(audit) };
  return c;
}

// The spec a quick-plan run produced: the docs/specs/*.md whose gate folder exists, else the newest.
function newSpec() {
  const specs = listDir('docs/specs').filter(f => f.endsWith('.md'));
  const withGate = specs.filter(f => exists(`docs/specs/${f.replace(/\.md$/, '')}`));
  if (withGate.length) return withGate;
  return specs.sort((a, b) => fs.statSync(abs(`docs/specs/${b}`)).mtimeMs - fs.statSync(abs(`docs/specs/${a}`)).mtimeMs);
}

const git = run('git status --porcelain');
out.git_status = git.out.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length > 0);
out.stray_canary_dirs = run('git ls-files --others --ignored --exclude-standard --directory').out.split('\n').filter(l => l.includes('.canary')).concat(run('git ls-files --others --exclude-standard').out.split('\n').filter(l => l.includes('.canary')));

switch (scenario) {
  case 's1':   // quick-plan happy path
  case 's9': { // run 6: quick-plan on the PASS-capable objective; same on-disk shape as s1
    const specs = newSpec();
    out.checks.spec_files = specs;
    const name = specs[0] ? specs[0].replace(/\.md$/, '') : null;
    out.checks.spec_name = name;
    if (name) {
      out.checks.gate = gateFolderChecks(`docs/specs/${name}`, `docs/specs/${name}.md`);
      const spec = read(`docs/specs/${name}.md`);
      out.checks.spec_has_revision_history_table = /## Revision History/.test(spec);
      out.checks.spec_has_last_reinforced = /Last reinforced/.test(spec);
    }
    out.checks.plan_folders = listDir('docs/plans');
    break;
  }
  case 's2': { // quick-plan --plan with existing plan folder
    const plan = 'docs/plans/2026-09-03-plan-centerpiece-alignment';
    out.checks.plan_audit_sha_unchanged = sha(`${plan}/audit.md`) === fs.readFileSync(path.join(repo, '.stress-baseline', 'plan-audit.sha'), 'utf8').trim();
    out.checks.plan_spec_sha_unchanged = sha(`${plan}/spec.md`) === fs.readFileSync(path.join(repo, '.stress-baseline', 'plan-spec.sha'), 'utf8').trim();
    out.checks.plan_evidence_count = listDir(`${plan}/evidence`).length;
    out.checks.plan_evidence_count_baseline = Number(fs.readFileSync(path.join(repo, '.stress-baseline', 'plan-evidence-count'), 'utf8').trim());
    const specs = newSpec();
    out.checks.spec_files = specs;
    const name = specs[0] ? specs[0].replace(/\.md$/, '') : null;
    if (name) out.checks.gate = gateFolderChecks(`docs/specs/${name}`, `docs/specs/${name}.md`);
    const manifest = read(`${plan}/manifest.md`);
    out.checks.manifest_mentions_spec = name ? manifest.includes(`docs/specs/${name}`) || manifest.includes(`${name}.md`) : false;
    try { const st = JSON.parse(read(`${plan}/status.json`)); out.checks.status_documents_keys = Object.keys(st.documents || {}); out.checks.status_phases = Object.fromEntries(Object.entries(st.phases).map(([k, v]) => [k, v.status])); } catch (e) { out.checks.status_json = 'unparseable'; }
    break;
  }
  case 's3': { // quick-audit on a template-shaped standalone spec
    const doc = 'docs/specs/pricing-engine.md';
    out.checks.doc_sha_unchanged = sha(doc) === fs.readFileSync(path.join(repo, '.stress-baseline', 'doc.sha'), 'utf8').trim();
    out.checks.gate = gateFolderChecks('docs/specs/pricing-engine', doc);
    out.checks.docs_audit_dir_absent = !exists('docs/audit/plan-audit.md');
    break;
  }
  case 's4': { // quick-audit on a non-template document
    const doc = 'docs/adr/ADR-reporting-pipeline.md';
    out.checks.doc_sha_unchanged = sha(doc) === fs.readFileSync(path.join(repo, '.stress-baseline', 'doc.sha'), 'utf8').trim();
    out.checks.gate = gateFolderChecks('docs/adr/ADR-reporting-pipeline', doc);
    break;
  }
  case 's5': { // quick-audit on a plan's own spec.md after design completion
    const plan = 'docs/plans/2026-09-03-plan-centerpiece-alignment';
    out.checks.plan_audit_sha_unchanged = sha(`${plan}/audit.md`) === fs.readFileSync(path.join(repo, '.stress-baseline', 'plan-audit.sha'), 'utf8').trim();
    out.checks.plan_spec_sha_unchanged = sha(`${plan}/spec.md`) === fs.readFileSync(path.join(repo, '.stress-baseline', 'plan-spec.sha'), 'utf8').trim();
    out.checks.plan_evidence_count = listDir(`${plan}/evidence`).length;
    out.checks.plan_evidence_count_baseline = Number(fs.readFileSync(path.join(repo, '.stress-baseline', 'plan-evidence-count'), 'utf8').trim());
    const reaudits = listDir(`${plan}/reaudits`);
    out.checks.reaudits = reaudits;
    if (reaudits[0]) out.checks.gate = gateFolderChecks(`${plan}/reaudits/${reaudits[0]}`, `${plan}/spec.md`);
    out.checks.manifest_mentions_reaudit = read(`${plan}/manifest.md`).includes('reaudits/');
    break;
  }
  case 's8': { // run 4: quick-audit re-run over a prior gate folder; D10's diff-scoped LINT-14
    const doc = 'docs/specs/pricing-engine.md';
    const gateDir = 'docs/specs/pricing-engine';
    out.checks.doc_sha_unchanged = sha(doc) === fs.readFileSync(path.join(repo, '.stress-baseline', 'doc.sha'), 'utf8').trim();
    out.checks.gate = gateFolderChecks(gateDir, doc);
    const audit = read(`${gateDir}/audit.md`);
    out.checks.baseline_comparison_section = /## Baseline comparison/.test(audit);
    out.checks.audit_mentions_variance = (audit.match(/AUDITOR VARIANCE/gi) || []).length;
    out.checks.audit_reports_line = (audit.match(/Baseline comparison: [^\n]*/) || [null])[0];
    const verdictOf = (id) => { try { return JSON.parse(read(`${gateDir}/evidence/${id}.json`)).verdict; } catch (e) { return null; } };
    out.checks.verdicts = { 'LINT-03': verdictOf('LINT-03'), 'LINT-13': verdictOf('LINT-13'), 'LINT-14': verdictOf('LINT-14'), 'LINT-15': verdictOf('LINT-15'), 'LINT-16': verdictOf('LINT-16') };
    try {
      const g = JSON.parse(read(`${gateDir}/gate.json`));
      out.checks.baseline_run_number = g.baseline && g.baseline.run_number;
      out.checks.history_length = Array.isArray(g.history) ? g.history.length : null;
      // What goes into `history` is the whole previous BASELINE object, which
      // carries run_number — that is what tq-gate-baseline.js snapshot writes,
      // and stage-2-design.md now says so. The run-4 rig probed for
      // `h.run_number` against hand-written entries that carried no such field
      // and reported a false negative on a scenario that had done it right, so
      // the probe reports WHAT IT FOUND rather than a bare boolean: a reader
      // can tell "the prior run is absent" from "history holds a shape this
      // check does not understand".
      out.checks.history_shapes = Array.isArray(g.history)
        ? g.history.map(h => (h && typeof h === 'object' ? Object.keys(h).slice(0, 8) : typeof h))
        : null;
      out.checks.history_run_numbers = Array.isArray(g.history)
        ? g.history.map(h => (h && typeof h === 'object'
          ? (h.run_number !== undefined ? h.run_number
            : (h.baseline && h.baseline.run_number !== undefined ? h.baseline.run_number : null))
          : null))
        : null;
      out.checks.prior_run_in_history = Array.isArray(out.checks.history_run_numbers)
        && out.checks.history_run_numbers.includes(1);
      out.checks.baseline_lint13 = g.baseline && g.baseline.lint_results && g.baseline.lint_results['LINT-13'];
      out.checks.baseline_lint03 = g.baseline && g.baseline.lint_results && g.baseline.lint_results['LINT-03'];
      out.checks.baseline_comparison_recorded = g.baseline_comparison || null;
    } catch (e) { out.checks.gate_json = 'unparseable'; }
    // The previous document must be recoverable from history by the baseline's sha (D10).
    const v1 = run(`git show HEAD~1:${doc}`);
    out.checks.v1_in_history = v1.code === 0;
    out.checks.v1_sha = v1.code === 0 ? crypto.createHash('sha256').update(v1.out.replace(/\r\n/g, '\n')).digest('hex') : null;
    const commits = run(`git log --format=%h -- ${doc}`);
    out.checks.spec_commits = commits.code === 0 ? commits.out.trim().split('\n').filter(Boolean).length : null;
    if (commits.code !== 0) out.checks.spec_commits_error = commits.out.trim();
    break;
  }
  case 's6': { // quick-audit with pasted text
    const specs = newSpec();
    out.checks.spec_files = specs;
    const name = specs[0] ? specs[0].replace(/\.md$/, '') : null;
    if (name) out.checks.gate = gateFolderChecks(`docs/specs/${name}`, `docs/specs/${name}.md`);
    break;
  }
  case 's10': { // run 7: quick-audit over run 6's quoted gate, on a v2 with two added plants
    const slug = 'move-the-pricing-arithmetic-out-of-render-into-its-own-module-with-tests';
    const doc = `docs/specs/${slug}.md`;
    const gateDir = `docs/specs/${slug}`;
    out.checks.doc_sha_unchanged = sha(doc) === fs.readFileSync(path.join(repo, '.stress-baseline', 'doc.sha'), 'utf8').trim();
    out.checks.gate = gateFolderChecks(gateDir, doc);
    const v1 = run(`git show HEAD~1:${doc}`);
    out.checks.v1_in_history = v1.code === 0;
    out.checks.v1_sha = v1.code === 0 ? crypto.createHash('sha256').update(v1.out.replace(/\r\n/g, '\n')).digest('hex') : null;
    out.checks.fresh = {
      audit_replaced: sha(`${gateDir}/audit.md`) !== null && sha(`${gateDir}/audit.md`) !== sha(path.relative(repo, path.join(__dirname, 'fixture-run6-gate', 'audit.md'))),
      comparison_on_v2: false,
      comparison_prev_is_v1: false,
    };
    out.checks.observation_note = 'Audit and style observations are run-7 candidates only if fresh.audit_replaced; comparison observations require fresh.comparison_on_v2 and fresh.comparison_prev_is_v1. Otherwise they are stale or unestablished. Verdicts are on-disk evidence observations; individual evidence-record freshness is not established.';
    const audit = read(`${gateDir}/audit.md`);
    out.checks.baseline_comparison_section = /## Baseline comparison/.test(audit);
    out.checks.audit_reports_line = (audit.match(/Baseline comparison: [^\n]*/) || [null])[0];
    // R6-01's plugin half, observed rather than tested: the style the operator's
    // settings used to inject into every subprocess.
    out.checks.audit_style_residue = {
      confidence_block: /\[Confidence:\s*\d+%/.test(audit),
      risk_line: /^\*{0,2}Risk:\*{0,2}\s/m.test(audit),
    };
    const verdictOf = (id) => { try { return JSON.parse(read(`${gateDir}/evidence/${id}.json`)).verdict; } catch (e) { return null; } };
    // LINT-02 and LINT-07 carry the plants; LINT-14 is the gate's own reading.
    out.checks.verdicts = { 'LINT-02': verdictOf('LINT-02'), 'LINT-07': verdictOf('LINT-07'), 'LINT-14': verdictOf('LINT-14') };
    try {
      const g = JSON.parse(read(`${gateDir}/gate.json`));
      out.checks.baseline_run_number = g.baseline && g.baseline.run_number;
      out.checks.history_run_numbers = Array.isArray(g.history) ? g.history.map(h => (h && typeof h === 'object' ? h.run_number : null)) : null;
      out.checks.prior_run_in_history = Array.isArray(out.checks.history_run_numbers) && out.checks.history_run_numbers.includes(2);
      out.checks.canary_class = g.canary_class || null;
    } catch (e) { out.checks.gate_json = 'unparseable'; }
    try {
      const cmp = JSON.parse(read(`${gateDir}/baseline-comparison.json`));
      out.checks.fresh.comparison_on_v2 = Boolean(cmp.meta && cmp.meta.doc_sha256 && cmp.meta.doc_sha256 === sha(doc));
      out.checks.fresh.comparison_prev_is_v1 = Boolean(cmp.meta && cmp.meta.previous_doc_sha256 && cmp.meta.previous_doc_sha256 === out.checks.v1_sha);
      out.checks.comparison_counts = cmp.counts || null;
      out.checks.comparison_meta_prev_doc = cmp.meta ? (cmp.meta.previous_doc_file || null) : null;
    } catch (e) { out.checks.comparison = exists(`${gateDir}/baseline-comparison.json`) ? 'unparseable' : 'absent'; }
    const commits = run(`git log --format=%h -- ${doc}`);
    out.checks.spec_commits = commits.code === 0 ? commits.out.trim().split('\n').filter(Boolean).length : null;
    if (commits.code !== 0) out.checks.spec_commits_error = commits.out.trim();
    break;
  }
  default:
    // An unknown scenario used to fall through to `checks: {}` and exit 0, which
    // reads as a clean pass (review of September 10, F5). Say it and fail.
    console.error(`check-invariants: no checks are defined for scenario "${scenario}"`);
    process.exit(2);
}
console.log(JSON.stringify(out, null, 2));
