---
name: project-data-manager
description: >
  Create, edit, archive/delete, and query project notes in the knowledge base.
  Use this skill when the user wants to: create a new project, update project info,
  delete or archive a project, add a note inside a project (decisions, roadmap,
  architecture, retrospective, etc.), search within a project, or get a summary/
  overview of a project's state. Triggers: "create project", "new project", "delete project",
  "archive project", "add note to project", "search in project", "project summary",
  "project overview", "update project", "tạo project", "tạo dự án", "xóa project".
---

# Project Manager Skill

Projects live in `data/projects/{slug}/`. Each project is a folder containing:
- `_index.md` — overview, goal, status, tech stack
- `decisions.md` — decision log
- `roadmap.md` — milestones, sprint plans, next actions
- additional notes as needed (e.g. `architecture.md`, `retrospective.md`)

Main note path: `data/projects/{slug}/_index.md`

**Templates**: See [references/templates.md](references/templates.md) for full frontmatter and content templates for all project file types.

---

## Commands

### CREATE a project

1. Ask for: project title (required), slug/folder name (default: slugify the title), short description, tech stack (optional).
2. Check `data/projects/` for existing folder with same slug — abort if exists.
3. Create `data/projects/{slug}/` with three files: `_index.md`, `decisions.md`, `roadmap.md` using templates from references/templates.md.
4. Add a row to `data/projects/_index.md` table (update `date_modified` to today).
5. Confirm: "Project `{slug}` created with `_index.md`, `decisions.md`, `roadmap.md`."

**Slug rules**: lowercase, hyphens only, no spaces, no special chars. Example: "My SaaS App" → `my-saas-app`.

---

### EDIT a project

Scope: update frontmatter fields (status, tags, tech_stack, links) or sections (Goal, Why now, Current status) in `_index.md`, or any sub-note.

1. Read the target file to understand current state.
2. Apply the change precisely — do not rewrite unrelated sections.
3. Always update `date_modified` to today on every file touched.
4. If user says "mark as done / paused / abandoned" → update `status` in frontmatter of `_index.md`.

---

### DELETE / ARCHIVE a project

**Default (safe) — archive**: Set `status: archived` in `_index.md`, update `date_modified`. Update row in `data/projects/_index.md` to show `archived`. Do NOT delete files.

**Permanent delete** — only when user explicitly says "delete permanently", "xóa hẳn", or "xóa cả thư mục":
1. Confirm with user: "Are you sure you want to permanently delete the entire `data/projects/{slug}/` folder? This cannot be undone."
2. After confirmation: run `rm -rf data/projects/{slug}/`.
3. Remove the row from `data/projects/_index.md`.

---

### ADD a note inside a project

Use when the user wants to add a new sub-note to an existing project.

1. Determine the note type and filename:
   - Decision log entry → append to `decisions.md`
   - Roadmap update → edit `roadmap.md`
   - New sub-note (architecture, retro, spike, etc.) → create `data/projects/{slug}/{name}.md`
2. For new sub-note files, use the generic sub-note template from references/templates.md.
3. Update `date_modified` on `_index.md` to reflect project activity.
4. Add a markdown link in `_index.md`'s Sub-notes section if not already there.

---

### SEARCH within a project

When the user asks to find something inside one or all projects, use semantic search first, then manual grep as fallback.

**Step 1 — Semantic search (preferred):**
```bash
brain/scripts/kb-search/.venv/bin/python brain/scripts/kb-search/search.py "{user query}" --top-k 5 --json
```
Parse JSON results. If hits have `score >= 0.40`, return those.

**Step 2 — Manual scan (fallback if no or low-score results):**
1. **Single project**: List files in `data/projects/{slug}/`, read frontmatter + headings first, then grep for keyword across all files in the folder.
2. **All projects**: Scan `data/projects/_index.md` for project list, then grep `data/projects/` recursively.

Return: matched file + file path + relevant excerpt. Group by project if searching all.

---

### SUMMARIZE / OVERVIEW a project

Produce a structured summary of a project's current state.

1. Read `data/projects/{slug}/_index.md` — get goal, status, tech_stack.
2. Read `data/projects/{slug}/roadmap.md` — get current sprint and next actions.
3. Read `data/projects/{slug}/decisions.md` — get last 2–3 decisions.
4. Scan any other `.md` files in the folder for additional context.

Output format:
```
## {Project Title} — {status}

**Goal**: [one sentence from _index.md]

**Current state**: [Current status section]

**Active sprint / next actions**:
- [ ] ...

**Recent decisions**:
- {date}: [decision summary]

**Files in this project**:
- [_index.md]({slug}/_index.md) — Overview
- [decisions.md]({slug}/decisions.md) — Decisions
- [roadmap.md]({slug}/roadmap.md) — Roadmap
- [other files if any]
```

---

## Rules

- Always check `data/projects/_index.md` before creating — avoid duplicate slugs.
- Always update `date_modified` on every file you touch.
- Never create files outside `data/projects/{slug}/` for project notes.
- For permanent delete: require explicit user confirmation before running `rm -rf`.
- When adding a new sub-note, ensure `_index.md` Sub-notes section links to it.
