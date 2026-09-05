# Methodology conformance audit — September 4, 2026

**Status: documentation corrected; qualified conformance, not an unconditional PASS.** Shipped instruction conflicts remain documented for owner decisions. No plugin behavior, existing historical plan, commit or remote state was changed.

**Update, September 5, 2026:** the six owner decisions were made and applied; see [decisions.md](decisions.md). The audit records above describe the state before those changes.

## Frozen scope

Repository `krwhynot/toque`; checkout HEAD `95c53af1663e4eee57bddb4f32579fefd136e4ef`. Published marketplace subdirectory `plugins/toque`, version `11.0.1`, pin `63a05063ed87b2a9168127ca715208c4cad74d5a`. The baseline included existing user edits to METHODOLOGY.md and 17 other tracked files plus untracked documentation/assets/CI work. Baseline hashes and original methodology were captured before editing; final preservation check is in verification.md. The package delta was seven pre-existing documentation/display files, not new gate handlers.

The audit reads active instructions and scripts first, invocation and tests second, and uses history only for removed capabilities. Current behavior is not inferred from filenames or a README promise. The historical reference version 11.0.0 remains separately labelled from installed 11.0.1.

## Records

| File | Purpose |
| --- | --- |
| [methodology-claims.md](methodology-claims.md) | Individual baseline claims, classifications, evidence, corrections and confidence. |
| [plugin-methods.md](plugin-methods.md) | All 59 package files and 82 reverse-audit items, including four excluded details. |
| [traceability-matrix.md](traceability-matrix.md) | DOC_TO_PLUGIN, PLUGIN_TO_DOC and BOTH rows. |
| [source-audit.md](source-audit.md) | Original citations, current primary sources, credit, support and access limits. |
| [industry-alignment.md](industry-alignment.md) | Per-method industry comparison, adaptations and gaps. |
| [findings.md](findings.md) | Correction plan, applied changes, contradictions and owner decisions. |
| [verification.md](verification.md) | Commands, results, links, anchors, negative controls and preservation. |
| [decisions.md](decisions.md) | The six owner decisions (D1–D6), rationale, and where each change landed. Added 2026-09-05. |

## Counts

These describe the audited baseline and discovered methods; they are not counts of defects remaining in the corrected document. A single historical subsection contains many separate claims. Four AMBIGUOUS baseline statements remain explicitly qualified by conflicting implementation evidence; see findings.md.

| Baseline claim status | Count |
| --- | --- |
| AMBIGUOUS | 4 |
| COMPATIBILITY_ONLY | 1 |
| CONDITIONAL | 24 |
| DOCUMENTARY_ONLY | 65 |
| IMPLEMENTED | 144 |
| PARTIAL | 62 |
| RETIRED | 43 |
| STALE | 238 |
| UNSUPPORTED | 45 |

| Reverse status | Count |
| --- | --- |
| IMPLEMENTATION_DETAIL | 4 |
| MISCLASSIFIED | 1 |
| REFERENCED | 16 |
| UNDEREXPLAINED | 37 |
| UNREFERENCED | 24 |

| Citation change unit | Count |
| --- | --- |
| original_external_urls | 34 |
| own_repo_urls | 3 |
| retained | 4 |
| replaced_old_urls | 7 |
| removed | 23 |
| replacement_destination_urls_new | 3 |
| added | 22 |
| final_external_urls | 29 |
| retained_unresolved | 0 |

## Change boundary

Only [METHODOLOGY.md](../../../METHODOLOGY.md) is modified by this audit outside this new eight-file folder. Every existing heading is retained. New subsections extend existing numbered sections. Canonical lint rule text and historical composite weights remain; inaccurate effectiveness and enforcement claims are withdrawn. No external messages, commit, push, merge or deployment was performed.

**Concurrent-work exception:** root README.md changed after the initial hash snapshot. None of this task's edits targeted it, and inspected test writes target scratch locations. Its current content was re-read and left untouched; authorship of that change was not inferred. All other baseline files outside METHODOLOGY.md remained byte-identical, including the entire shipped plugin and existing historical plans. See verification.md for the deliberately non-passing blanket preservation assertion.
