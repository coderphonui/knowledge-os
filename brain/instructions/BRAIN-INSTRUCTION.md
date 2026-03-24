# Knowledge Base Agent

## Context

User profile: read `data/profile.md` to understand who you're helping — name, roles, background, goals, communication preferences, and expertise. Use this to personalize tone, depth, and examples in every response. If the file doesn't exist, suggest running the `/onboarding` skill.

**Language policy**: All skill instructions are written in English. Always respond to the user in their preferred language as specified in `data/profile.md` (look for a `language` field, or infer from how they communicate). Mirror the language of the user's message when in doubt.

Data: `data/*.md` with YAML frontmatter + `[[wikilinks]]`.


## Feedback Loops

Always search KB before answering, creating, or brainstorming:

```bash
brain/skills/query/.venv/bin/python brain/skills/query/scripts/search.py "QUERY" --top-k 5 --json
# filters: --type topic|project|reference|journal|interview  --status evergreen
```

Score thresholds: ≥ 0.50 → synthesize | 0.35–0.49 → use as leads, scan directory | < 0.35 → scan `data/topics/`, `data/projects/`, `data/references/`, `data/journal/`, `data/interviews/`

If index missing: `brain/skills/query/.venv/bin/python brain/skills/query/scripts/index.py full`

## Domain Rules

1. **File placement**:
  - Meetings → `data/meetings/YYYY-MM-DD-meeting-name.md`
  - Journal → `data/journal/YYYY-MM-DD.md` or `week-YYYY-WNN.md`
  - Interviews → `data/interviews/YYYY-MM-DD-candidate-name.md`; reports → `data/interviews/interview-report/YYYY-MM-DD-candidate-position-report.md`
  - Topics → `data/topics/`; investments → `data/investments/`; growth → `data/growth/`
  - Projects → `data/projects/{slug}/` with `overview.md`, `decisions.md`, `roadmap.md`; wikilink: `[[{slug}/overview|{title}]]`

1. **Frontmatter required**: `title`, `type`, `date_created`, `date_modified` (ISO 8601), `tags` (min 2), `status`. Check `data/_templates/` for type-specific schema.

1. **Always update **`date_modified` when editing any note.

1. **Wikilinks**: `[[filename]]`, `[[filename|alias]]`, `[[filename#section]]` — no `.md`.

1. **Tags**: prefix required — `type/`, `tech/`, `area/`, `status/`, `project/`, `company/`, `role/`.

1. **Brainstorm notes**: `data/topics/` with `type: brainstorm`. Structure: Context → Assumptions → Ideas → Evaluation → Decision. Update `outcome` at end.

1. **Code blocks**: always specify language. Images → `data/_assets/`.

## Permissions

### Never
- Create files outside `data/`
- Delete files — use `status: archived` instead
- Create a note without searching for duplicates first

## Links

- When creating any note type → `data/_templates/` for type-specific frontmatter schema
- Symlink / skill setup questions → `docs/structure.md`
