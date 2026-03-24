# Folder Blueprints

Each blueprint is the canonical `data/` folder structure for a given role combination. Use these as starting points; adjust by removing unneeded dirs or adding custom ones.

---

## Universal base (applied to ALL users)

```
data/
├── _templates/         # Note templates (always present)
├── journal/            # Daily & weekly reflections
├── meetings/           # Meeting notes
├── topics/             # Evergreen conceptual notes
└── references/         # External sources & captured reading
```

---

## engineer / architect

```
data/
├── _templates/
├── journal/
├── meetings/
├── topics/             # System design, patterns, learnings
├── references/         # Papers, docs, tech articles
└── projects/           # One subfolder per project
    └── {slug}/
        ├── _index.md
        ├── decisions.md
        └── roadmap.md
```

---

## founder

```
data/
├── _templates/
├── journal/            # Weekly ops journal
├── meetings/           # Board, investor, team meetings
├── topics/             # Strategy, frameworks
├── references/
├── projects/           # Products, initiatives
│   └── {slug}/
│       ├── _index.md
│       ├── decisions.md
│       └── roadmap.md
└── investments/        # Company financials, portfolio
    └── {TICKER}.md
```

---

## recruiter

```
data/
├── _templates/
├── journal/
├── meetings/           # Team syncs, hiring reviews
├── topics/             # Hiring criteria, comp bands
├── references/
└── interviews/
    ├── _index.md
    ├── YYYY-MM-DD-candidate-name.md
    └── interview-report/
        └── YYYY-MM-DD-candidate-position-report.md
```

---

## researcher / student

```
data/
├── _templates/
├── journal/            # Study log
├── meetings/
├── topics/             # Course notes, concepts — primary store
├── references/         # Papers, books, videos
└── projects/           # Research projects, experiments
```

---

## investor

```
data/
├── _templates/
├── journal/            # Trading log / daily macro
├── meetings/
├── topics/             # Macro thesis, sector analysis
├── references/
└── investments/        # One file per ticker
    ├── _index.md       # Portfolio dashboard
    └── {TICKER}.md
```

---

## Full setup (all features)

```
data/
├── _templates/
├── _assets/            # Images, attachments
├── journal/
├── meetings/
├── topics/
├── references/
├── projects/
│   └── {slug}/
│       ├── _index.md
│       ├── decisions.md
│       └── roadmap.md
├── interviews/
│   ├── _index.md
│   └── interview-report/
├── investments/
└── growth/             # Habits, retrospectives, goals
```

---

## Naming conventions

| Pattern | Example |
|---|---|
| Daily journal | `journal/2026-03-20.md` |
| Weekly journal | `journal/week-2026-W12.md` |
| Meeting note | `meetings/2026-03-20-sprint-planning.md` |
| Candidate note | `interviews/2026-03-20-nguyen-van-a.md` |
| Interview report | `interviews/interview-report/2026-03-20-backend-engineer-report.md` |
| Investment | `investments/VNM.md` |
| Project index | `projects/knowledge-os/_index.md` |
| Topic | `topics/system-design-patterns.md` |
| Reference | `references/2026-03-20-article-title.md` |

---

## Frontmatter required fields (all notes)

```yaml
title: ""
type: ""          # journal | meeting | topic | reference | project | interview | investment | index | profile
date_created: ""  # YYYY-MM-DD
date_modified: "" # YYYY-MM-DD — update on every edit
tags: []          # min 2 tags
status: ""        # active | draft | done | archived | evergreen | seedling
```

Tag prefixes: `type/`, `tech/`, `area/`, `status/`, `project/`, `company/`, `role/`, `concept/`
