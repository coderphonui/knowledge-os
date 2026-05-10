# kb-web — Knowledge OS Web Editor

A Notion-like web editor for your Knowledge OS `data/` folder. Browse, edit, and manage your markdown notes with YAML frontmatter — directly in the browser.

## Features

- **File tree sidebar** — Browse your `data/` folder structure with expandable folders
- **BlockNote editor** — Notion-like block editor for markdown content
- **Frontmatter editor** — Edit YAML metadata (title, tags, status, etc.) with a visual form
- **Semantic search** — Search your KB via the existing vector index
- **Auto-save detection** — Unsaved changes indicator with `Cmd+S` shortcut

## Setup

```bash
cd brain/apps/kb-web

# Install dependencies
npm install

# Set your data folder path (absolute path required)
cp .env.example .env
# Edit .env:
# KB_ROOT=/absolute/path/to/your/my-knowledge-os/data

# Development
npm run dev

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

```
app/
├── api/
│   ├── files/route.ts         # GET/PUT/POST file CRUD
│   ├── files/list/route.ts    # GET directory listing
│   └── search/route.ts        # POST semantic search (Python script)
├── layout.tsx                 # Root layout
└── page.tsx                   # Main UI (sidebar + editor)

components/
├── Sidebar.tsx                # File tree with search
├── Editor.tsx                 # BlockNote + frontmatter editing
└── FrontmatterForm.tsx        # Visual YAML editor

lib/
├── kb-fs.ts                   # Filesystem helpers (data/ access)
└── markdown.ts                # Frontmatter + wikilink parsing
```

## Data conventions

The editor respects your existing KB conventions:
- Markdown files with YAML frontmatter (`---`)
- Standard markdown links `[text](path.md)` for cross-references
- Tags with `type/`, `area/`, `tech/`, `project/`, `status/` prefixes
- `date_modified` is **not** auto-updated — you control your metadata

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+S` | Save current file |
| `Enter` | Submit search |
| `Escape` | Clear search |

## Future (Pi Agent integration)

The architecture预留 slots for Pi Agent SDK integration:
- `app/api/agent/` — SSE streaming agent sessions
- Chat panel alongside editor (like Cursor/Claude Code sidebar)
- Shared session storage with `tichat` Slack bot

## Tech stack

- Next.js 15 (App Router)
- React 19
- BlockNote (Notion-like block editor)
- Tailwind CSS + shadcn/ui patterns
- TypeScript

## Notes

- **Security**: This app reads/writes directly to your filesystem. Run locally only.
- **No database**: Source of truth is your `data/**/*.md` files.
- **No git integration yet**: Save triggers file write only; commit manually or add git hooks.
