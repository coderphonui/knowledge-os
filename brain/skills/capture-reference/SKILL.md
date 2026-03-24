---
name: capture-reference
description: >
  Turn an external source — a URL, a pasted article, a paper, a video, a book —
  into a structured reference note in the knowledge base. Use this skill when the user
  shares a link and wants to save it, pastes text from an article they just read,
  says "save this", "add this to my KB", "make a note of this", "I want to remember this",
  "capture this reference", or drops a URL with no other instruction (which usually means
  "save this for me"). Also trigger when the user wants to annotate or add their own
  thoughts to an external source.
---

# Capture-reference skill

The goal is to turn something external into something personal. A good reference note isn't a copy of the source — it's the user's interpretation of it: what was worth saving, what it means for their work, and how it connects to what they already know.

## Steps

**1. Retrieve the source.**

- If a URL was given, use the `fetch` MCP tool to retrieve the full content.
- If text was pasted directly, use that as the source.
- If only a partial excerpt was shared, note this in the frontmatter (`source_type: excerpt`) and ask if the user wants to fetch the full source.

**2. Extract metadata.**

From the source, extract:
- `title` — the actual title of the piece (not invented)
- `author` — name(s) if available, otherwise omit
- `date_published` — publication date if available, otherwise omit
- `source_type` — pick the most accurate: `paper`, `article`, `book`, `video`, `docs`, `thread`, `excerpt`
- `source_url` — the canonical URL if available

If metadata is ambiguous (e.g., a GitHub README has no author), use best judgment and note uncertainty.

**3. Write the summary in the user's voice.**

2–3 sentences. The summary should answer: "Why did I save this?" — not just "What is this about?"

Bad: *"This article discusses the CAP theorem and its implications for distributed systems."*
Good: *"A clear explanation of why you can't have consistency, availability, and partition tolerance simultaneously — useful reference for the trade-off decisions in [[project-database-design]]."*

The difference is perspective. Write as if you're the user explaining to their future self.

**4. Extract key takeaways.**

3–7 bullet points. Each should be:
- A discrete insight, not a topic label
- Specific enough to be useful without re-reading the source
- Phrased as a statement of fact or principle, not a vague category

Bad: *"Discusses partition tolerance"*
Good: *"In a network partition, you must choose either consistency (refuse to answer) or availability (answer with potentially stale data) — there is no third option"*

**5. Suggest connections to existing KB.**

Scan the `data/` directory for notes that relate to this source. Suggest `[[wikilinks]]` to add to the `related` section and body of the note. Don't force connections — only suggest ones that genuinely add context.

**6. Suggest tags.**

Propose tags from the established taxonomy:
- `type/reference` (always)
- `area/` — knowledge domain (e.g., `area/ml`, `area/systems`, `area/product`)
- `tech/` — specific technologies mentioned (e.g., `tech/python`, `tech/llm`)
- `project/` — if this is clearly relevant to an active project

**7. Create the file.**

- Path: `data/references/[kebab-case-title].md`
- Use the template at `data/_templates/reference.md`
- Leave the "My thoughts" section blank — this is for the user to fill in later, not for you to invent

**8. Confirm what was created.**

Reply with:
- The file path created
- One-sentence description of what was saved
- Any suggested `[[wikilinks]]` to add manually

## Edge cases

**Source is paywalled or blocked**: Tell the user the fetch failed and ask them to paste the article text. Don't guess the content.

**Source is a long paper (>20 pages)**: Note that you're summarizing based on abstract, introduction, and conclusion unless the user asks for a full read. Flag this.

**Source is a video or podcast**: You can only work with a transcript or description. If none is available, create a minimal stub with the URL and ask the user to fill in their notes after watching.

**Duplicate detection**: Before creating the file, check `data/references/` for a note with a similar title or the same URL. If a potential duplicate exists, surface it and ask whether to update the existing note or create a new one.
