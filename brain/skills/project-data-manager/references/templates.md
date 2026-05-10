# Project Templates

Use these templates when creating project files. Replace all `{placeholder}` tokens.

---

## `_index.md` — Project Overview

```markdown
---
title: "{title}"
type: project
date_created: {YYYY-MM-DD}
date_modified: {YYYY-MM-DD}
tags:
  - type/project
  - project/{slug}
  - status/active
status: active
tech_stack: []
links:
  repo: ""
  docs: ""
  deploy: ""
related: []
---

# {title}

## Goal

[One sentence: what does success look like?]

## Why now

[Why is this project important right now?]

## Current status

[Where things stand, what's blocked.]

## Sub-notes

- [Decisions]({slug}/decisions.md) — technical and product decision log
- [Roadmap]({slug}/roadmap.md) — milestones and sprint plans

## Quick links

| File | Purpose |
|------|---------|
| `_index.md` | Project overview (this file) |
| `decisions.md` | Important decision log |
| `roadmap.md` | Plan, milestones, next actions |
```

---

## `decisions.md` — Decision Log

```markdown
---
title: "Decisions: {title}"
type: project-decisions
date_created: {YYYY-MM-DD}
date_modified: {YYYY-MM-DD}
tags:
  - type/project
  - project/{slug}
  - status/active
status: active
---

# Decisions: {title}

Log of important project decisions — technical, product, and organizational.

## Decision Log

### {YYYY-MM-DD} — [Decision title]

**Context**: [Problem to solve]

**Options considered**:
- Option A: ...
- Option B: ...

**Decision**: [Choice made]

**Rationale**: [Reason for this choice]

**Outcome**: TBD
```

---

## `roadmap.md` — Roadmap & Sprint Plans

```markdown
---
title: "Roadmap: {title}"
type: project-roadmap
date_created: {YYYY-MM-DD}
date_modified: {YYYY-MM-DD}
tags:
  - type/project
  - project/{slug}
  - status/active
status: active
---

# Roadmap: {title}

## Milestones

| Milestone | Target date | Status |
|-----------|-------------|--------|
| [Milestone 1] | {YYYY-MM-DD} | planned |

## Current Sprint

**Sprint goal**: [What is the goal of this sprint?]

### In progress
- [ ] ...

### Todo
- [ ] ...

## Backlog

- [ ] ...

## Done

- [x] ...
```

---

## Generic sub-note (e.g. `architecture.md`, `retrospective.md`)

```markdown
---
title: "{Sub-note title}: {project title}"
type: project-note
date_created: {YYYY-MM-DD}
date_modified: {YYYY-MM-DD}
tags:
  - type/project
  - project/{slug}
  - status/active
status: active
---

# {Sub-note title}: {project title}

[Content]
```

---

## `data/projects/_index.md` — row entry

Add to the table:
```
| [{title}]({slug}/_index.md) | {short description} | {status} |
```
