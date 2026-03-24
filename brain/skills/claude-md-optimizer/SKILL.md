---
name: claude-md-optimizer
description: "Review, clean up, and optimize CLAUDE.md instruction files so they follow 6 evidence-based principles: feedback loops over rules, letting tools do tool work, documenting failures not ideals, pruning with 4 questions, progressive disclosure, and two-tier permissions. Use this skill when the user says \"review my CLAUDE.md\", \"optimize my instructions\", \"audit my agent prompt\", \"clean up CLAUDE.md\", \"apply the 6 principles to my instructions\", or asks to make a CLAUDE.md shorter, more focused, or more effective."
---

# CLAUDE.md Optimizer

## Goal

Produce a CLAUDE.md that is shorter, more specific, and more useful — by cutting aspirational noise and keeping only failure-backed, judgment-encoding instructions.

Read the full principles before starting: [references/principles.md](references/principles.md)

---

## Workflow

### Step 1: Read and audit the file

Read the target CLAUDE.md. Identify which file to review — if the user doesn't specify, check:
1. The repo-level `CLAUDE.md` (workspace root)
2. A global `~/.claude/CLAUDE.md`

Classify every instruction into one of these buckets:

| Bucket | Action |
|--------|--------|
| **Keep** | Failure-backed, domain-specific, has a trigger condition |
| **Rewrite** | Good intent but aspirational/vague → rewrite with feedback loop or trigger |
| **Cut** | Tool-enforceable, generic advice, no failure history |
| **Relocate** | Belongs in a linked deep-doc, not the root file |

### Step 2: Apply the 4-question prune test to each line

For every instruction, ask:

1. Was it failure-backed? (No → cut candidate)
2. Is it tool-enforceable? (Yes → cut)
3. Does it encode real domain judgment? (No → cut)
4. Does it have a trigger/condition? (No → add one or cut)

**The final test**: "Did removing this ever cause a real problem?" If not — cut it.

### Step 3: Restructure using the output template

Produce the optimized file with this structure:

```
# [Project Name]

## Context
[1-3 sentences max: what this is, primary tech stack, who uses it]

## Feedback Loops
[Verification commands: test runner, type checker, linter — not style rules]

## Domain Rules
[Judgment calls and internal API conventions — 5–10 items max]

## Gotchas
[Real failures, one-liners. Each entry = specific incident → specific fix]

## Permissions
### Ask First
- [concrete list]
### Never
- [concrete list]

## Links
[Trigger-gated: "If you see X, read Y.md"]
```

Sections that have no content should be omitted.

### Step 4: Report changes

Present the optimized file AND a brief diff summary:
- Lines cut (and why: tool-enforceable / aspirational / no trigger)
- Lines rewritten (what changed)
- Sections added (Gotchas, Permissions if missing)

Ask the user to confirm before overwriting the original file.

---

## Key rules

- **Never add length**. Every rewrite should be ≤ the original length of that instruction. If you can't make it shorter and more precise, cut it.
- **Keep domain context**: persona descriptions, language preferences, company-specific workflows — these are real domain context, not noise.
- **Gotchas section is mandatory** for any repo with real usage history. If none exists, prompt the user: "What's broken before that I should know about?"
- **Two-tier permissions only**: Ask First / Never. Rephrase any vague "be careful" instructions into one of these tiers or cut them.
- **Progressive disclosure**: if any section approaches 10+ lines of dense reference material, suggest extracting it to a linked file with a trigger condition.

**4. Capabilities-Based** (best for integrated systems)
- Works well when the skill provides multiple interrelated features
- Example: Product Management with "Core Capabilities" → numbered capability list
- Structure: ## Overview → ## Core Capabilities → ### 1. Feature → ### 2. Feature...

Patterns can be mixed and matched as needed. Most skills combine patterns (e.g., start with task-based, add workflow for complex operations).

Delete this entire "Structuring This Skill" section when done - it's just guidance.]

## [TODO: Replace with the first main section based on chosen structure]

[TODO: Add content here. See examples in existing skills:
- Code samples for technical skills
- Decision trees for complex workflows
- Concrete examples with realistic user requests
- References to scripts/templates/references as needed]

## Resources

This skill includes example resource directories that demonstrate how to organize different types of bundled resources:

### scripts/
Executable code (Python/Bash/etc.) that can be run directly to perform specific operations.

**Examples from other skills:**
- PDF skill: `fill_fillable_fields.py`, `extract_form_field_info.py` - utilities for PDF manipulation
- DOCX skill: `document.py`, `utilities.py` - Python modules for document processing

**Appropriate for:** Python scripts, shell scripts, or any executable code that performs automation, data processing, or specific operations.

**Note:** Scripts may be executed without loading into context, but can still be read by Claude for patching or environment adjustments.

### references/
Documentation and reference material intended to be loaded into context to inform Claude's process and thinking.

**Examples from other skills:**
- Product management: `communication.md`, `context_building.md` - detailed workflow guides
- BigQuery: API reference documentation and query examples
- Finance: Schema documentation, company policies

**Appropriate for:** In-depth documentation, API references, database schemas, comprehensive guides, or any detailed information that Claude should reference while working.

### assets/
Files not intended to be loaded into context, but rather used within the output Claude produces.

**Examples from other skills:**
- Brand styling: PowerPoint template files (.pptx), logo files
- Frontend builder: HTML/React boilerplate project directories
- Typography: Font files (.ttf, .woff2)

**Appropriate for:** Templates, boilerplate code, document templates, images, icons, fonts, or any files meant to be copied or used in the final output.

---

**Any unneeded directories can be deleted.** Not every skill requires all three types of resources.
