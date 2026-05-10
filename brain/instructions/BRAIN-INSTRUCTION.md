# Knowledge Base Agent

## Context

**First — check if this is a new user:**
If `data/profile.md` does not exist, stop and tell the user:
> "It looks like this is your first time. Run `/onboarding` to set up your personal knowledge base — it only takes a few minutes."

Otherwise, read `data/profile.md` to understand who you're helping — name, roles, background, goals, communication preferences, and expertise. Use this to personalize tone, depth, and examples in every response.

Data: markdown files under `data/` with YAML frontmatter.

---

## Feedback Loops

Always search KB before answering, creating, or brainstorming:

```bash
brain/skills/query/.venv/bin/python brain/skills/query/scripts/search.py "QUERY" --top-k 5 --json
# filters: --type topic|project|reference|journal|interview|meeting|growth|investment  --status evergreen|active|draft  --subtype brainstorm|roadmap|report  --project knowledge-os|langfun
```

Score thresholds: ≥ 0.50 → synthesize | 0.35–0.49 → use as leads, scan directory | < 0.35 → scan `data/topics/`, `data/projects/`, `data/references/`, `data/journal/`

If index missing: `brain/skills/query/.venv/bin/python brain/skills/query/scripts/index.py full`

---

## Domain Rules

1. **File placement** — place notes only in existing folders under `data/`; if a folder doesn't exist, the user may not have that role configured — suggest `/onboarding` to add it:
  - Meetings → `data/meetings/YYYY-MM-DD-ten-meeting.md`
  - Journal → `data/journal/YYYY-MM-DD.md` or `week-YYYY-WNN.md`
  - Interviews → `data/interviews/YYYY-MM-DD-candidate-name.md`; reports → `data/interviews/interview-report/YYYY-MM-DD-candidate-position-report.md`
  - Topics → `data/topics/`; investments → `data/investments/`; growth → `data/growth/`
  - Projects → `data/projects/{slug}/` with `_index.md`, `decisions.md`, `roadmap.md`

2. **Frontmatter required**: `title`, `type`, `date_created`, `date_modified` (ISO 8601), `status`, `aliases` (min `[]`). Check `data/_templates/` for type-specific schema.

   **Core fields (all notes)**:
   - `title` — display title
   - `type` — `topic` | `project` | `reference` | `journal` | `meeting` | `interview` | `growth` | `investment`
   - `date_created`, `date_modified` — ISO 8601 (YYYY-MM-DD)
   - `status` — topic: `draft|seedling|evergreen`; project: `active|paused|done|archived`; reference: `captured|processed`; meeting: `draft|done`; interview: `active|done|cancelled|no-show`; growth: `active|done`; investment: `active|closed`
   - `aliases` — list of alt names, min `[]`
   - `tags` — min 2 tags. Prefixes: `area/`, `tech/`, `concept/`, `project/`, `company/`, `role/`. Do NOT use `type/` or `status/` in tags.
   - `related` — list of wikilinks to related notes

   **Type-specific fields**:
   - `project`: `project_slug`, `tech_stack`, `links`
   - `reference`: `source`, `author`, `source_type`, `date_published`, `layer`, `ai_assisted`
   - `journal`: `period`, `work_context`, `energy_level`, `mood`
   - `meeting`: `meeting_date`, `meeting_time`, `company`, `attendees`, `action_items_count`
   - `interview`: `interview_date`, `interview_time`, `role`, `candidate_name`, `candidate_level`, `result`, `recommendation`, `organizer`
   - `growth`: `session_type`, `frameworks_used`
   - `investment`: `ticker`, `market`, `position`, `entry_price`, `current_thesis`, `risk_level`
   - `topic`: `problem`, `outcome` (for subtype brainstorm)

3. **Always update `date_modified`** when editing any note.

4. **Tags**: prefix required — `area/`, `tech/`, `concept/`, `project/`, `company/`, `role/`. Min 2 tags (except journal).

6. **Brainstorm notes**: `data/topics/` with `type: topic`, `subtype: brainstorm`. Structure: Context → Assumptions → Ideas → Evaluation → Decision. Update `outcome` at end.

7. **Code blocks**: always specify language. Images → `data/_assets/`.

---

## Permissions

### Never
- Create files outside `data/`
- Delete files — use `status: archived` instead
- Create a note without searching for duplicates first

---

## Links

- Note templates → `data/_templates/` (type-specific frontmatter schema)
- Tooling structure → `brain/docs/structure.md`
- Add new skill → `brain/skills/<name>/SKILL.md` + run `./setup.sh`
