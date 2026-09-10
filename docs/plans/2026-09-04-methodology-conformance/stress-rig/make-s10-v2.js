#!/usr/bin/env node
// Build s10's v2 document from v1: the two additions the run-7 charter names
// (scenario-inputs.md, s10) and nothing else. Every edit first asserts the
// exact v1 text at the exact v1 line the charter gives, and the section it sits
// in, so a v1 that has drifted fails here instead of producing a plant that
// quietly lands somewhere else.
//
// Both plants ADD text. The first charter's plants removed text, and the review
// of September 10 showed why that cannot work on this document: every control
// it removed survives elsewhere in unchanged text, and a failure resting on
// deleted text can only be cited on surviving text, which D10 scopes unchanged.
// An addition is text the revision wrote, so a citation of the violation is a
// citation of changed text, and nothing in v1 can satisfy a rule about
// something v1 never contained.
//
//   node make-s10-v2.js <v1.md> <v2.md>
'use strict';
const fs = require('fs');

const [v1Path, v2Path] = process.argv.slice(2);
if (!v1Path || !v2Path) { console.error('usage: make-s10-v2.js <v1.md> <v2.md>'); process.exit(64); }

function fail(msg) { console.error(`make-s10-v2: ${msg}`); process.exit(1); }

const text = fs.readFileSync(v1Path, 'utf8');
if (text.includes('\r')) fail('v1 contains CR bytes; the charter coordinates were measured on an LF file');
const lines = text.split('\n');                 // v1 line n is lines[n - 1]
if (lines.length !== 841 || lines[840] !== '') fail(`v1 has ${lines.length - 1} lines, the charter measured 840`);
if (/lineTotal|invoice/i.test(text)) fail('v1 already mentions lineTotal or an invoice; the plants would not be new text');

function expectLine(n, test, what) {
  if (!test(lines[n - 1])) fail(`v1 line ${n} is not ${what}: ${JSON.stringify(lines[n - 1])}`);
}
function expectSection(n, heading) {
  let i = n - 1;
  while (i >= 0 && !lines[i].startsWith('### ') && !lines[i].startsWith('## ')) i--;
  if (i < 0 || !lines[i].startsWith(heading)) fail(`v1 line ${n} is not under "${heading}"`);
}

// Plant 1, LINT-07: a new behaviour in Phase 2's scope with no test anywhere.
// It sits after the Scope paragraph and its blank line, before Entry Criteria.
const PLANT_1 = [
  '**Also in scope:** `src/pricing.js` additionally exports `lineTotal(row)`,',
  'returning `row.seats * row.unit_price` for a single row, so the invoice export',
  'planned for next quarter can price one line without re-implementing the',
  'arithmetic. `render()` does not call it.',
  '',
];
// Plant 2, LINT-02: a new HIGH-impact risk whose mitigation is TBD. It follows
// from plant 1, so the revision reads as one change rather than two plants.
const PLANT_2 = '| 12 | `lineTotal` and `computeTotal` disagree on a row with a missing or non-numeric field, so the invoice export and the rendered report price the same line differently | MEDIUM | HIGH | TBD |';

// Every assertion runs against v1 before anything is spliced.
expectSection(252, '### Phase 2:');
expectLine(252, (l) => l === 'This is the only phase that modifies production code.', 'the end of the Phase 2 scope paragraph');
expectLine(253, (l) => l === '', 'the blank line after the Phase 2 scope paragraph');
expectLine(254, (l) => l.startsWith('**Entry Criteria:**'), 'the Phase 2 entry criteria');
expectSection(356, '## Risk Assessment');
expectLine(356, (l) => l.startsWith('| 11 | Nothing enforces the tests'), 'the last risk row, Risk 11');
expectLine(357, (l) => l === '', 'the blank line closing the risk table');

// Splice bottom-up, so each edit's v1 coordinate is still valid when it runs.
lines.splice(356, 0, PLANT_2);                  // after v1 356
lines.splice(253, 0, ...PLANT_1);               // after v1 253

fs.writeFileSync(v2Path, lines.join('\n'), 'utf8');
console.log(`s10 v2: ${lines.length - 1} lines (v1 840, +${PLANT_1.length} +1); additions after v1 253 and after v1 356`);
