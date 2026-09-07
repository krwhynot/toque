// Deterministic on-disk invariants for a stress-test scenario.
// usage: node check.js <scenario> <repoDir> <pluginRoot>
// Prints JSON. Never modifies the repo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const [scenario, repo, plugin] = process.argv.slice(2);
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
  c.audit_mentions = { PASS: /\bPASS\b/.test(audit), NOT_PASS: /NOT PASS/.test(audit), revision_history: /Revision History/.test(audit), mode: (audit.match(/Audit mode:\s*\**\s*([A-Za-z]+)/) || [])[1] || null, not_applicable: /not-applicable/.test(audit) };
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
out.git_status = git.out.trim().split('\n').filter(Boolean);
out.stray_canary_dirs = run('git ls-files --others --ignored --exclude-standard --directory').out.split('\n').filter(l => l.includes('.canary')).concat(run('git ls-files --others --exclude-standard').out.split('\n').filter(l => l.includes('.canary')));

switch (scenario) {
  case 's1': { // quick-plan happy path
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
      out.checks.prior_run_in_history = Array.isArray(g.history) && g.history.some(h => h && h.run_number === 1);
      out.checks.baseline_lint13 = g.baseline && g.baseline.lint_results && g.baseline.lint_results['LINT-13'];
      out.checks.baseline_lint03 = g.baseline && g.baseline.lint_results && g.baseline.lint_results['LINT-03'];
      out.checks.baseline_comparison_recorded = g.baseline_comparison || null;
    } catch (e) { out.checks.gate_json = 'unparseable'; }
    // The previous document must be recoverable from history by the baseline's sha (D10).
    const v1 = run(`git show HEAD~1:${doc}`);
    out.checks.v1_in_history = v1.code === 0;
    out.checks.v1_sha = v1.code === 0 ? crypto.createHash('sha256').update(v1.out.replace(/\r\n/g, '\n')).digest('hex') : null;
    out.checks.spec_commits = run(`git log --format=%h -- ${doc}`).out.trim().split('\n').filter(Boolean).length;
    break;
  }
  case 's6': { // quick-audit with pasted text
    const specs = newSpec();
    out.checks.spec_files = specs;
    const name = specs[0] ? specs[0].replace(/\.md$/, '') : null;
    if (name) out.checks.gate = gateFolderChecks(`docs/specs/${name}`, `docs/specs/${name}.md`);
    break;
  }
}
console.log(JSON.stringify(out, null, 2));
