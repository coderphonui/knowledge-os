# Principles for Optimizing CLAUDE.md

Core rule: **Short, specific, failure-backed instructions beat long aspirational ones.**

These 6 principles guide every review and edit decision.

---

## Principle 1: Give feedback loops, not rules

Tell the agent *how to verify its work*, not *how to write perfectly*.

- **Keep**: "After editing, run `make test` and `make lint` before finishing."
- **Keep**: "If TypeScript types don't compile, fix them before moving on."
- **Cut**: "Always write clean, readable code." ← aspiration, no feedback loop.
- **Cut**: "Make sure your code is well-structured." ← no verification step.

Hooks / CI / pre-commit enforce formatting — those don't need to be in CLAUDE.md.

---

## Principle 2: Let tools do tool work

If ESLint, Prettier, type checkers, or CI already enforce it, remove it from CLAUDE.md. Tool-enforceable rules waste instruction space that should be reserved for **judgment calls** and **domain context**.

- **Cut**: "Always use 2-space indentation." (Prettier handles it)
- **Cut**: "Don't leave unused imports." (ESLint `no-unused-vars`)
- **Keep**: "Prefer event-driven patterns over polling for real-time features." (judgment)
- **Keep**: "Use our internal `createApiClient()` factory — don't instantiate axios directly." (domain)

---

## Principle 3: Document failures, not ideals

The most valuable section is **Gotchas**: real bugs, real mistakes, one-liner lessons. These are instructions that exist because something once broke.

- **Keep**: "Don't use `Date.now()` for scheduling — the server clock drifts. Use `clock.now()` from `@lib/clock`."
- **Keep**: "Calling `user.save()` without `await` silently drops writes in the test environment."
- **Cut**: "Be careful with async operations." ← too vague, not backed by a real incident.
- **Cut**: "Handle errors properly." ← aspirational, no specific failure.

Update the Gotchas section every time something breaks in real use.

---

## Principle 4: The 4-question prune test

Apply this test to each line/instruction:

1. **Was it failure-backed?** Did someone add this because something actually broke? If no — strong candidate for deletion.
2. **Is it tool-enforceable?** Can ESLint, Prettier, tsc, CI catch it automatically? If yes — delete.
3. **Does it encode real domain judgment?** Is this your codebase-specific architecture decision? If no — likely generic advice Claude already has.
4. **Does it include a trigger/condition?** "When X happens, do Y." If pure rule with no context — make it conditional or delete.

**The final test**: "Did removing this ever cause a real problem?" If not — cut it.

---

## Principle 5: Progressive disclosure

Keep the root CLAUDE.md short and scannable. Link to deeper docs with **explicit trigger conditions**.

- **Good**: "If you encounter `TokenExpiredError`, read `auth-flow.md` for the refresh logic."
- **Good**: "For database migrations, see `db-migration-guide.md` — especially the rollback strategy."
- **Bad**: Dumping 200 lines of auth logic directly in CLAUDE.md.

Structure: root file = navigation + critical gotchas. Linked files = deep domain knowledge.

---

## Principle 6: Two-tier permissions only

Use exactly two categories — nothing vague in between.

| Tier | Label | Examples |
|------|-------|---------|
| **Ask First** | Requires confirmation before proceeding | Adding npm/pip deps, schema changes, CI config edits, env var changes |
| **Never** | Hard stop, no exceptions | Committing secrets, pushing to main/production, modifying `node_modules`, bypassing auth checks |

- **Cut**: "Be careful when modifying shared tables." → Too vague. Either it's Ask First or Never.
- **Cut**: "Always think twice before changing the database." → Same problem.
- **Add**: "Ask First: any schema change to the `users` table."

---

## Review Checklist

When reviewing a CLAUDE.md, go through each instruction with this checklist:

```
[ ] Is this aspiration/ideal? → Rewrite as a feedback loop or cut
[ ] Does a tool already enforce this? → Cut
[ ] Is this a real gotcha from a real failure? → Keep (move to Gotchas section)
[ ] Is this generic advice Claude already has? → Cut
[ ] Does this have a trigger condition? → Add one or cut
[ ] Is this a permission instruction? → Classify as Ask First / Never, or cut
```

---

## Output structure for an optimized CLAUDE.md

```
# [Project Name]

## Context
[1-3 sentences: what this is, who uses it, primary tech stack]

## Feedback Loops
[How to verify work: run tests, type check, lint commands]

## Domain Rules
[Judgment calls, architecture decisions, internal APIs — 5–10 max]

## Gotchas
[Real failures, one-liner lessons, specific bug patterns]

## Permissions
### Ask First
- [list]

### Never
- [list]

## Links
[Trigger-gated links to deeper docs]
```
