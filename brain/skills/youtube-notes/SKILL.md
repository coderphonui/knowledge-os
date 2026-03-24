---
name: youtube-notes
description: >
  Summarize a YouTube video into structured watch notes saved to the knowledge base.
  Fetches the transcript from a YouTube URL, analyzes it through a domain-specific lens
  (tech, startup, personal development, investment, tutorial), and produces a reference note
  with key takeaways, actionable items, mental models, and KB connections.

  Trigger when the user provides a YouTube URL with intent to learn from it, or says:
  "watch notes for", "save this video", "note video", "summarize this video",
  "tóm tắt video", "làm notes cho video".
---

## Workflow

### Step 1 — Fetch transcript and metadata

```bash
brain/skills/youtube-notes/.venv/bin/python brain/skills/youtube-notes/scripts/fetch_transcript.py "<URL>" --json
```

Output is JSON with: `title`, `channel`, `upload_date`, `description`, `transcript`, `duration_seconds`.

**How it works internally (3-method fallback):**
1. Exports Chrome browser cookies via yt-dlp → passes them to `youtube-transcript-api` (bypasses YouTube IP blocking)
2. Falls back to yt-dlp subtitle download with cookies (may fail if JS challenge unsolvable)
3. Last resort: `youtube-transcript-api` without cookies (works on home IPs, fails on cloud/dev IPs)

**If this fails**, check:
- Chrome is open and logged into YouTube
- yt-dlp is installed in the venv: `brain/skills/youtube-notes/.venv/bin/pip install yt-dlp`
- Try `--no-cookies` flag if running on a home IP without need for auth

If all methods fail, inform the user and stop.

### Step 2 — Detect video type

From `title`, `channel`, `description`, classify as one of:
`tech-talk` | `startup-business` | `personal-development` | `investment` | `tutorial` | `general`

Read `references/analysis-lens.md` for the matching lens before proceeding.

### Step 3 — Search KB for duplicates / related notes

```bash
brain/skills/query/.venv/bin/python brain/skills/query/scripts/search.py "<video title>" --top-k 3 --json
```

Note any existing notes to reference in the Connections section.

### Step 4 — Analyze and write the note

Apply the lens from Step 2. Write a reference note to:
```
data/references/YYYY-MM-DD-{title-slug}.md
```

Use today's date. Slug: lowercase, hyphens, max 6 words from the title.

#### Frontmatter schema

```yaml
---
title: "<Full video title>"
type: reference
date_created: YYYY-MM-DD
date_modified: YYYY-MM-DD
source: "<YouTube URL>"
author: "<Channel name>"
source_type: video
duration_minutes: <rounded to nearest minute>
tags:
  - type/reference
  - area/<domain>        # e.g. area/startup, area/engineering, area/personal-development
  - area/video
status: processed
related:
  - "[[related-note]]"
---
```

#### Note body structure

```markdown
## Summary

[2–4 sentences: the core argument or what the video is about. Your own words, not a transcript dump.]

## Key takeaways

- **[Insight title]** — [Why this matters to you, 1–2 sentences]
- ...

<!-- 3–7 takeaways max. Filter ruthlessly: only what's valuable to YOU. -->

## Quotes worth keeping

> "[Memorable quote]" — [Speaker/Channel]

<!-- Only include if genuinely reusable as a mental model. Skip if nothing qualifies. -->

## Actions / Experiments

- [ ] [Concrete thing to try, test, or read — this week or this month]

<!-- Must be time-bound and actionable. Skip if video is purely informational. -->

## My reaction

[Do you agree? What are you skeptical about? What surprised you? What do you want to verify?]

## Connections

- [[related-note]] — because ...
```

### Step 5 — Confirm to user

After saving, output:
- File path created
- 2–3 sentence summary of what was captured
- Any follow-up actions if present
