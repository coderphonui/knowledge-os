---
name: weekly-review
description: >
  Generate a structured weekly review by synthesizing the user's journal entries,
  project notes, and newly created notes from the past 7 days. Use this skill when
  the user asks for a weekly review, says "what did I do this week", "summarize my week",
  "run my weekly", "weekly recap", or asks to reflect on the past week. Also trigger
  for end-of-week or beginning-of-week planning sessions that need a look-back component.
---

# Weekly review skill

The goal is to help the user step back from the day-to-day and see the shape of their week — what actually happened, what they learned, and what deserves attention next week. A good weekly review surfaces things the user has already written but hasn't yet synthesized, and makes implicit progress visible.

## Steps

### 1. Gather the material

Use the filesystem MCP tool to find:
- All files in `data/journal/` modified or created in the last 7 days
- All files in `data/projects/` with `status: active` (read these for progress context)
- All files in `data/topics/` and `data/references/` created in the last 7 days (new notes = recent learning)

If no journal files exist for the week, note this and work from project notes and new notes alone. Don't refuse to produce a review just because the journal is sparse — use what's there.

### 2. Read everything, then synthesize

Read all gathered files in full before writing anything. The synthesis only works if you have the full picture. Look for:
- Recurring themes across entries (the same problem showing up multiple times)
- Progress made on projects (compare against stated goals if available)
- Decisions recorded
- Things flagged as blocked or uncertain
- New concepts or ideas that appear for the first time

### 3. Write the review

Use this structure:

---

```markdown
# Week of [date range]

## What happened

[3–5 sentences in paragraph form. Describe the week as a narrative arc — not a list
of tasks, but what the week was *about*. What were you focused on? What shifted?
This is the part the user will actually remember reading.]

## Progress on projects

[For each active project with notable activity this week, one short paragraph.
Include what moved forward, what got stuck, and any decisions made.
Skip projects with no activity — don't pad with "no updates".]

## Things I learned

[A synthesis of new ideas, concepts, or insights from notes created this week.
This might come from reference notes captured, topic notes written, or insights
recorded in journal entries. 3–7 bullet points, each a discrete takeaway —
not topic labels, but actual statements of something learned.]

## Decisions made

[List any decisions recorded in brainstorm notes or project notes this week.
If none were explicitly recorded, omit this section rather than speculate.]

## Connections I noticed

[The most valuable part of the review: patterns and links across notes that weren't
obvious at the note level. E.g., "The problem you hit in [[project-x]] this week
is essentially the same trade-off described in [[cap-theorem]] — you might want to
link those." 1–3 observations. If you don't see genuine connections, omit rather
than invent.]

## Next week

[2–3 concrete suggestions for what to prioritize, based on blockers, open questions,
and project status. Be specific — not "work on project X" but "resolve the auth
decision blocking [[project-x]] by picking an approach from the [[brainstorm-auth-design]] note".]
```

---

### 4. Save the review

- Path: `data/journal/week-[YYYY]-W[NN].md` (e.g., `week-2025-W12.md`)
- Frontmatter:
  ```yaml
  ---
  title: "Week of [date range]"
  type: journal
  period: weekly
  date_created: [today]
  date_modified: [today]
  tags:
    - type/journal
    - status/active
  status: active
  ---
  ```
- Tell the user the file path and offer to open any of the linked notes they might want to follow up on.

## Tone

Write the "What happened" section in a way that gives the week a sense of meaning — not a productivity report, but a short narrative that captures the texture of what it was like. If the week was fragmented or frustrating, say so. If something exciting happened, reflect that. The user will re-read these entries later; they should feel like something worth reading, not a dashboard printout.

The rest of the sections can be more factual and structured — the narrative intro does the emotional work so the rest can be clear and useful.

## When the week was quiet

If the user wrote very little (few journal entries, no new notes), don't produce a thin review padded with filler. Instead:

1. Note honestly that the week's KB activity was light
2. Check project notes for any standing open questions or blockers to surface
3. Ask the user: "Anything from this week worth capturing before we close it out?"

A short, honest review is more useful than a long one that invents activity that wasn't there.
