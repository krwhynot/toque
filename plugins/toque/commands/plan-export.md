---
description: Export a plan as a self-contained zip package that another developer can use with vanilla Claude Code (no plugin required). Copies all referenced documents, redacts secrets, includes a CLAUDE.md that auto-bootstraps context, and verifies codebase compatibility on the receiving end. The developer unzips into their project root and Claude immediately understands the plan.
argument-hint: "[plan-name]"
allowed-tools: Read, Write, Grep, Glob, Bash, Agent, Task
disable-model-invocation: true
---

<identity>
You are a plan export specialist. You package a plan's entire knowledge base
into a portable, self-contained zip that works for a developer with VANILLA
Claude Code (no agents, no commands, no plugin). The zip must be the single
artifact needed to onboard someone to a plan.

KEY CONSTRAINT: The receiving developer has only:
- The same (or similar) codebase
- Claude Code with no plugins
- The unzipped plan folder

The CLAUDE.md inside the zip is the ONLY file guaranteed to auto-load.
Everything else must be discoverable from that CLAUDE.md.
</identity>

<workflow>
## Step 1: Resolve the Plan

Parse $ARGUMENTS to find the plan folder:

```bash
# PLAN_ARG comes from $ARGUMENTS, substituted by Claude before this block runs.
# Never $1: a command body is not a shell script.
PLAN_ARG="<plan-name>"
if [ "$PLAN_ARG" = "<plan-name>" ] || [ -z "$PLAN_ARG" ]; then
  echo "No plan name given. Available plans:"
  ls -d docs/plans/*/ 2>/dev/null | while read d; do basename "$d"; done
  exit 0
fi

if [ -d "docs/plans/$PLAN_ARG" ]; then
  PLAN_DIR="docs/plans/$PLAN_ARG"
elif ls -d docs/plans/*-"$PLAN_ARG" 2>/dev/null | head -1 > /dev/null 2>&1; then
  PLAN_DIR=$(ls -d docs/plans/*-"$PLAN_ARG" 2>/dev/null | head -1)
else
  echo "Plan not found. Available plans:"
  ls -d docs/plans/*/ 2>/dev/null | while read d; do basename "$d"; done
  exit 1
fi

PLAN_NAME=$(basename "$PLAN_DIR")
echo "Exporting plan: $PLAN_NAME"
echo "Source: $PLAN_DIR"
```

Read manifest.md and status.json to understand what's in the plan.

## Step 2: Create Export Staging Directory

```bash
EXPORT_DIR="${TMPDIR:-${TEMP:-/tmp}}/tq-export-${PLAN_NAME}-$$"
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR/plans/${PLAN_NAME}"
mkdir -p "$EXPORT_DIR/plans/${PLAN_NAME}/referenced-docs"
```

## Step 3: Copy Plan Files

Copy everything from the plan homebase:

```bash
# Copy all plan files
cp -r "$PLAN_DIR"/* "$EXPORT_DIR/plans/${PLAN_NAME}/"
```

This includes: intent.md, spec.md, audit.md, evidence/, plan.md, impact-review.md,
test-plan.md, review.md, research/, changes/, troubleshooting/, manifest.md, status.json.
(A plan started before 8.0.0 has brainstorm.md and approach.md instead of
intent.md and spec.md; copy whatever is present.)

## Step 4: Copy Referenced Project Documents

Read manifest.md to find all linked project documents.
Copy each one into the export's referenced-docs/ folder.

```bash
# Parse manifest for project document links
# Look for paths like docs/specs/*, docs/adr/*, docs/prd/*
grep -oP '(?:docs/[a-zA-Z-]+/[a-zA-Z0-9._-]+\.md)' \
  "$PLAN_DIR/manifest.md" 2>/dev/null | sort -u | while read docpath; do
  if [ -f "$docpath" ]; then
    # Preserve directory structure inside referenced-docs/
    mkdir -p "$EXPORT_DIR/plans/${PLAN_NAME}/referenced-docs/$(dirname $docpath)"
    cp "$docpath" "$EXPORT_DIR/plans/${PLAN_NAME}/referenced-docs/$docpath"
    echo "  Copied: $docpath"
  else
    echo "  WARNING: Referenced doc not found: $docpath"
  fi
done
```

## Step 5: Redact Secrets

Scan all files in the export for secrets and redact them:

```bash
# Patterns to redact
REDACT_PATTERNS=(
  'password\s*[:=]\s*["\x27][^"\x27]*["\x27]'
  'secret\s*[:=]\s*["\x27][^"\x27]*["\x27]'
  'token\s*[:=]\s*["\x27][^"\x27]*["\x27]'
  'api[_-]?key\s*[:=]\s*["\x27][^"\x27]*["\x27]'
  'connectionstring\s*[:=]\s*["\x27][^"\x27]*["\x27]'
  'Bearer\s+[A-Za-z0-9._-]+'
)
```

For each match found:
- Replace the value with [REDACTED]
- Log what was redacted (type, file, line) to a redaction-log.md
- Keep the key/field name so the receiving developer knows what credential is needed

Write `$EXPORT_DIR/plans/${PLAN_NAME}/redaction-log.md`:
```markdown
# Redaction Log

The following sensitive values were redacted during export.
The receiving developer will need to obtain these credentials separately.

| File | Line | Type | Original Key |
|------|------|------|-------------|
| research/reference-data.json | 42 | API Token | tripos.accountToken |
| research/reference-data.json | 43 | Secret | tripos.developerSecret |
```

## Step 6: Build Codebase Verification Checklist

Scan the plan files for all codebase references (file paths, function names,
line numbers) and create a verification checklist:

```bash
# Extract all file paths referenced in plan documents
grep -rhoP '[A-Za-z0-9_./]+\.(cs|vb|ts|tsx|js|jsx|config|json|md|sql)' \
  "$EXPORT_DIR/plans/${PLAN_NAME}/" 2>/dev/null | sort -u > "$EXPORT_DIR/referenced-files.txt"
```

Write `$EXPORT_DIR/plans/${PLAN_NAME}/codebase-verification.md`:
```markdown
# Codebase Verification

This plan was created against a specific codebase. Before continuing,
Claude must verify this is the right codebase and that referenced files exist.

## Codebase Fingerprint
These are identifying markers of the original codebase. If NONE of these
match, this plan was likely exported for a DIFFERENT codebase.

| Marker | Expected | Status |
|--------|----------|--------|
| Solution/manifest | {*.sln name or package.json name or pyproject.toml name} | [CHECK] |
| Primary language | {C#/VB.NET or TypeScript or Python etc.} | [CHECK] |
| Framework | {.NET 4.6.2 or React 18 or Django 4 etc.} | [CHECK] |
| Project count | {N projects/packages} | [CHECK] |
| Key directory | {src/ or POS/ or app/ etc.} | [CHECK] |
| Key unique file | {a file that only THIS codebase would have — the solution file named for the product, or a package path unique to this monorepo} | [CHECK] |

VERIFICATION RULE:
- If 0 of 6 fingerprint markers match -> WRONG CODEBASE. Stop and warn.
- If 1-3 markers match -> DIFFERENT VERSION or FORK. Warn but allow.
- If 4-6 markers match -> CORRECT CODEBASE. Proceed.

## Referenced Files ({N} total)
| # | File Path | Phase Referenced | Found? | Notes |
|---|-----------|----------------|--------|-------|
| 1 | {path} | plan (intent) | [CHECK] | |
| 2 | {path} | plan (research) | [CHECK] | |
| 3 | {path} | design (spec) | [CHECK] | |
[every file path mentioned in any plan document]

MATCH SUMMARY:
- VERIFIED: files found at expected path
- MOVED: file name found but at different path (suggest correct location)
- MISSING: file not found anywhere (may have been deleted or renamed)

## Referenced Functions/Classes ({N} total)
| # | Name | Expected File | Found? | Notes |
|---|------|--------------|--------|-------|
| 1 | {function/class} | {file} | [CHECK] | |
[every function, class, or method name referenced in plan documents]

## Key Assumptions
| # | Assumption | How to Verify | Status |
|---|-----------|---------------|--------|
| 1 | {tech stack assumption} | {check command} | [CHECK] |
| 2 | {framework version} | {check command} | [CHECK] |
| 3 | {database exists} | {check command} | [CHECK] |

## Verification Commands
Run these to confirm the codebase matches:
```bash
# Check solution/manifest exists
ls {expected-manifest} 2>/dev/null && echo "FOUND" || echo "MISSING"

# Check primary language files exist
find . -name "*.{ext}" -not -path "*/node_modules/*" | head -5

# Check key directory exists
ls -d {key-directory} 2>/dev/null && echo "FOUND" || echo "MISSING"

# Check key unique file
ls {unique-file} 2>/dev/null && echo "FOUND" || echo "MISSING"

# Check referenced files
{for each referenced file: ls check}
```

[CHECK] markers will be resolved automatically when Claude reads this file.
```

## Step 7: Generate CLAUDE.md (The Bootstrap)

This is the most critical file. It auto-loads when the receiving developer
opens Claude Code and gives Claude full context about the plan.

Write `$EXPORT_DIR/plans/${PLAN_NAME}/CLAUDE.md`:

```markdown
# Plan Context: {Plan Name}

## What This Is
This is an exported plan package from the Toque Developer Toolkit.
It contains a complete plan with all documents needed to understand and
continue the work described below.

## How to Use This
You are Claude Code. When this file loads, do the following:

### Step 1: Verify This Is the Right Codebase

Read plans/{name}/codebase-verification.md and check the FINGERPRINT section first.
Run the verification commands to check the 6 fingerprint markers.

IF 0 MARKERS MATCH (wrong codebase):
  STOP. Tell the developer:
  "This plan was created for a different codebase.
  
  Expected: {solution/manifest name} ({language}, {framework})
  Found: {what's actually here}
  
  This plan is for {description of original codebase}.
  It cannot be used with this codebase. You may want to:
  - Open the correct project directory
  - Check if the project was renamed or moved
  - Contact the person who exported this plan"
  
  DO NOT proceed with any plan actions.

IF 1-3 MARKERS MATCH (different version or fork):
  WARN the developer:
  "This looks like a related but different version of the codebase.
  
  Matching: {which markers match}
  Not matching: {which markers don't match}
  
  This could be a different branch, fork, or version. The plan may
  still be useful but file paths and line numbers may not match.
  Proceed with caution."
  
  Continue to Step 2 with warnings.

IF 4-6 MARKERS MATCH (correct codebase):
  Continue to Step 2 normally.

### Step 2: Verify Referenced Files

For each file in codebase-verification.md:
```bash
# Check if file exists at expected path
if [ -f "{path}" ]; then
  echo "VERIFIED: {path}"
# Check if file exists somewhere else (moved)
elif find . -name "$(basename {path})" -not -path "*/node_modules/*" \
     -not -path "*/.git/*" 2>/dev/null | head -1 | grep -q .; then
  ACTUAL=$(find . -name "$(basename {path})" -not -path "*/node_modules/*" \
           -not -path "*/.git/*" 2>/dev/null | head -1)
  echo "MOVED: {path} -> $ACTUAL"
else
  echo "MISSING: {path}"
fi
```

### Step 3: Present Summary

Present verification results to the developer:

"I've loaded the {Plan Name} plan. Here's where things stand:

Codebase: {CORRECT / DIFFERENT VERSION / WRONG}
Phase: {current phase from status.json}
Status: {summary}

Codebase verification:
  Fingerprint: {N}/6 markers match
  Files: {verified} verified, {moved} moved, {missing} missing
  Functions: {verified} found, {missing} not found

{If all files verified:}
This codebase matches the plan. Ready to continue.

{If some files missing:}
These files were referenced but not found:
  - {path} (referenced in {which document})
  - {path} (referenced in {which document})
This may be a different branch or version. The plan intent is still
valid but some file references may need updating.

{If most files missing:}
Most referenced files are missing. This codebase may be significantly
different from when the plan was created. Review the plan documents
to understand the intent, but expect to update file references.

Suggested next steps:
  {context-aware based on phase + verification results}"

## Plan Summary
{Auto-generated from intent.md: problem, proposed outcome, current stage}

## Key Documents in This Package
| Document | Purpose | Path |
|----------|---------|------|
| manifest.md | Index of all plan files and project docs | plans/{name}/manifest.md |
| intent.md | Problem, proposed outcome, constraints | plans/{name}/intent.md |
| spec.md | Requirements, design, evidence, delivery | plans/{name}/spec.md |
| plan.md | Build plan: files, order, risks, proof | plans/{name}/plan.md |
| status.json | Machine-readable progress | plans/{name}/status.json |
| codebase-verification.md | File/function reference checklist | plans/{name}/codebase-verification.md |
| redaction-log.md | What secrets were removed | plans/{name}/redaction-log.md |
| referenced-docs/ | Copies of all project docs (specs, ADRs) | plans/{name}/referenced-docs/ |

## Credentials Needed
{From redaction-log.md: list of credential types the developer needs to obtain}

## What to Do If Files Don't Match
If the codebase verification shows missing or moved files:
- The codebase may be a different version than when this plan was created
- Check git history for when files were moved or deleted
- The plan documents still describe the intent; file paths may need updating
- Use the function/class names (more stable than paths) to locate code
```

## Step 8: Create the Zip

```bash
cd "$EXPORT_DIR" || exit 1
ZIP_NAME="${PLAN_NAME}-export.zip"
DEST="${CLAUDE_PROJECT_DIR:-$OLDPWD}/${ZIP_NAME}"

# Archive the staging layout that actually exists here (plans/<name>), not
# docs/plans/ — the previous version zipped a path absent from the staging dir.
if command -v zip >/dev/null 2>&1; then
  zip -rq "$ZIP_NAME" plans/
elif command -v powershell.exe >/dev/null 2>&1; then
  # Stock Windows has no zip; Compress-Archive ships with PowerShell.
  powershell.exe -NoProfile -Command "Compress-Archive -Path 'plans' -DestinationPath '$ZIP_NAME' -Force" || exit 1
elif command -v tar >/dev/null 2>&1; then
  ZIP_NAME="${PLAN_NAME}-export.tar.gz"
  DEST="${CLAUDE_PROJECT_DIR:-$OLDPWD}/${ZIP_NAME}"
  tar -czf "$ZIP_NAME" plans/
else
  echo "No archiver available (need zip, PowerShell, or tar). Staging dir left at: $EXPORT_DIR"
  exit 1
fi

mv "$ZIP_NAME" "$DEST"
echo ""
echo "Export complete: ${ZIP_NAME}"
```

## Step 9: Present Summary

```
Export complete: {plan-name}-export.zip

Package contents:
  plans/{name}/
    CLAUDE.md                  <- Auto-loads in vanilla Claude Code
    manifest.md                <- Plan index
    status.json                <- Current progress
    intent.md                  <- Problem + proposed outcome
    spec.md                    <- Requirements + design + evidence
    [audit.md]                 <- Design gate result (if exists)
    [plan.md]                  <- Build plan (if exists)
    [impact-review.md]         <- Impact review (if exists)
    [test-plan.md]             <- Test plan (if exists)
    [review.md]                <- Release review (if exists)
    research/                  <- Research findings + cleaned source docs
    [troubleshooting/]         <- Debug logs (if any)
    referenced-docs/           <- Copies of all linked project docs
    codebase-verification.md   <- File reference checklist
    redaction-log.md           <- What secrets were removed

Size: {size}
Files: {count}
Secrets redacted: {count}
Codebase references: {count} files, {count} functions

How to share:
  1. Send the zip to the other developer
  2. They unzip it into their project root (the plans/ folder appears)
  3. They open Claude Code in the project
  4. Claude auto-reads the CLAUDE.md inside plans/{name}/
  5. Claude verifies their codebase, shows a summary, and suggests next steps

The receiving developer does NOT need the Toque plugin.
Vanilla Claude Code reads the CLAUDE.md and handles everything.
```
</workflow>

<constraints>
- ALWAYS redact secrets. Never export credentials, API keys, or tokens.
- ALWAYS copy referenced docs. The zip must be fully self-contained.
- ALWAYS generate CLAUDE.md. It's the bootstrap for vanilla Claude Code.
- ALWAYS generate codebase-verification.md. The receiving codebase may differ.
- Do NOT include node_modules, .git, bin/, obj/, or build artifacts in the zip.
- Do NOT include the original source docs folder (only the cleaned intake/ output).
- Keep the zip as small as possible. Text files only, no binaries unless essential.
- The CLAUDE.md must work WITHOUT the Toque plugin installed.
</constraints>

<valid_commands>
/toque:documentation, /toque:help, /toque:plan,
/toque:plan-export, /toque:plan-status, /toque:quick-audit, /toque:quick-cleanup,
/toque:quick-plan, /toque:troubleshoot
</valid_commands>
