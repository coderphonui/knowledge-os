---
name: query
description: >
  Search, retrieve, and synthesize information from the personal knowledge base (KB).
  Use this skill whenever the user asks what they know about a topic, wants to find
  notes, wants a summary of their knowledge on something, asks to "look in the KB",
  or phrases a question as if they expect the answer to come from their own notes
  (e.g. "what have I written about X", "do I have anything on Y", "pull up my notes on Z",
  "what do I know about W"). Also trigger when the user asks a technical question that
  could plausibly be answered from their own knowledge base before searching the web.
---

# Query skill

The goal of this skill is to feel like asking a smart research assistant who has read
everything you've ever written. The response should feel synthesized and personal — not
a file listing, not quoted excerpts, but a genuine answer that draws on the user's own
notes and reflects their perspective back at them.

## How to approach a query

Before doing anything, think about what kind of answer the user is looking for:
- **Lookup**: "Do I have a note on X?" → Quick answer, file reference, done.
- **Summary**: "What do I know about X?" → Synthesize across multiple notes.
- **Gap analysis**: "What am I missing on X?" → Synthesize + identify what's not covered.
- **Connection**: "How does X relate to Y?" → Find the thread between concepts.

The scope and depth of the response should match the question. Don't produce a full
synthesis for a simple lookup.

## Steps

**0. Semantic search (preferred — fast, meaning-aware)**

Run the vector search script first. This is far faster than scanning directories
and understands intent, not just keywords.

```bash
skills/query/.venv/bin/python skills/query/scripts/search.py "YOUR QUERY HERE" --top-k 5 --json
```

Parse the JSON output: each result has `file`, `score`, `section`, `type`, `status`.

- If results have `score >= 0.45` → high confidence, proceed to step 2.
- If results have `score 0.30–0.44` → moderate confidence, use as leads but also
  scan the relevant directory in step 1.
- If no results or `score < 0.30` → fall back to step 1 (manual scan).
- If search fails with exit code 2 (index not built) → fall back to step 1 and
  remind the user to build the index (`skills/query/.venv/bin/python skills/query/scripts/index.py full`).

Filter flags when useful:
```bash
# Only evergreen/refined notes
skills/query/.venv/bin/python skills/query/scripts/search.py "query" --status evergreen

# Only a specific note type
skills/query/.venv/bin/python skills/query/scripts/search.py "query" --type topic
```

**1. Manual scan (fallback or complement)**

Use the filesystem tool to list directory contents and read frontmatter — fast,
avoids loading full file bodies. A note's `title`, `tags`, `status`, and `related`
fields usually tell you whether it's relevant before you read the body.

Directories to scan depending on topic type:
- Conceptual / technical → `data/topics/`
- Ongoing work → `data/projects/`
- External sources → `data/references/`
- Time-based context → `data/journal/`

When uncertain, scan all four.

**2. Read the most relevant files in full.**

Based on the search results + frontmatter scan, pick the top 3–5 most relevant
files and read their full content. Prioritize notes with `status: evergreen` or
`status: active` — these are most refined.

**3. Synthesize, don't summarize.**

The difference matters: a summary reproduces what the notes say; a synthesis
reorganizes, connects, and interprets them. The response should add value beyond
what any individual note contains. Point out connections across notes that the
user may not have noticed.

**4. Always close with orientation.**

Tell the user what related notes exist that might be worth exploring, and explicitly
name any gaps — topics the question touched on where the KB has nothing or only
a stub. Gaps are as useful as answers.

## Output format

```
## [Direct answer to the question]

[Synthesized response — prose, not bullets. 2–5 paragraphs depending on complexity.]

---
**Notes referenced**
- [[note-slug]] — one-line description of what it contributed

**Worth exploring**
- [[related-note]] — why it's relevant

**Gaps**
- [topic or question the KB doesn't cover yet]
```

Adapt this structure to the question. A simple lookup doesn't need all sections.
A complex synthesis might need more paragraphs.

## What not to do

- Don't quote file content verbatim — rephrase in a way that serves the user's question.
- Don't list every file in a directory — only surface what's actually relevant.
- Don't answer from general knowledge when the question is clearly about the user's own
  notes. If the KB has nothing, say so, then optionally offer to search the web or
  create a new note.
- Don't invent connections that aren't in the notes — flag them as hypotheses if
  speculating.

## When the KB has nothing

If a scan turns up no relevant notes, say so clearly:

> "I don't see anything in your KB on this yet. Your closest notes are [[X]] and [[Y]],
> which touch on [related concept]. Want me to create a stub note to capture what you
> know now?"

Offering to create a stub is useful — it turns a miss into a capture moment.

## Index maintenance (for reference)

The semantic search depends on a vector index being built and kept current.
This is handled automatically via:

1. **Claude Code hook** — fires after every Write/Edit on `data/`, keeps index current
   in real time as notes are created or modified.
2. **Cron job** — runs every 15 minutes to catch edits from external editors
   (Obsidian, VS Code, etc.)

If the index is missing or stale, fall back to step 1 and remind the user:
```bash
# First-time setup or full rebuild
skills/query/.venv/bin/python skills/query/scripts/index.py full

# Check index status
skills/query/.venv/bin/python skills/query/scripts/index.py status
```
