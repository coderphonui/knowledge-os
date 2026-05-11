# Personal Knowledge OS

> Your second brain — built on plain Markdown, powered by AI, and wired into your daily workflow.

Most knowledge tools make you choose: either you get structure (Notion, Confluence) or you get speed (scratchpads, raw files). Knowledge OS gives you both. Plain Markdown files you own forever, semantic search that finds meaning not just keywords, and a growing library of AI skills that turn your notes into an active thinking partner.

**Why people try it:**
- You're drowning in bookmarks, tabs, and browser history you never revisit
- You take notes but can never find them when you need them
- You want AI assistance that actually knows *your* context, not just the internet
- You switch between tools (Notion → Obsidian → whatever) and lose continuity every time

---

## What it is

Knowledge OS is a folder of Markdown files + a collection of AI skills that run inside **pi**, a terminal-based coding agent harness. Everything runs locally. You own all your data.

**The core loop:**
1. **Capture** anything — articles, YouTube videos, meetings, ideas, research
2. **Organize** automatically with AI — frontmatter, tags, wikilinks, folder placement
3. **Query** by meaning — ask "what do I know about X?" and get synthesized answers from *your own notes*
4. **Act** — brainstorm new ideas, analyze documents, prep for interviews, plan your week

---

## Skills — what the AI can do for you

Skills are specialized AI workflows that pi loads on demand. Type `/skill-name` or just describe what you want — pi handles the rest. Run interactively in the terminal or configure VS Code to work alongside pi.

### Capture & Research
| Skill | What it does |
| --- | --- |
| `/capture-reference` | Paste a URL or article → saved as a structured note with your annotations |
| `/markdown-tools` | Convert PDF/DOCX/PPTX → clean Markdown, ready to link into your notes |
| `/mermaid-tools` | Extract Mermaid diagrams from markdown → high-quality PNG images |

### Think & Create
| Skill | What it does |
| --- | --- |
| `/brainstorm` | Thinking partner using SCAMPER, First Principles, Six Hats, JTBD, and more |

### Organize & Review
| Skill | What it does |
| --- | --- |
| `/query` | Semantic search across all your notes — finds by meaning, synthesizes an answer |
| `/project-data-manager` | Create, update, search, and archive project notes with a single command |

### Meta
| Skill | What it does |
| --- | --- |
| `/skill-creator` | Build new skills to extend the platform for your own workflows |
| `/onboarding` | Set up your personal data folder, folder structure, and profile |

---

## Setup

### Prerequisites

- **pi** — the coding agent harness (`npm install -g @earendil-works/pi-coding-agent`)
- Node.js 18+ and Python 3.11+
- [VS Code](https://code.visualstudio.com/) (recommended, optional)
- [Ollama](https://ollama.com/) (for semantic search)

### 1. Clone and run setup

```bash
git clone https://github.com/coderphonui/knowledge-os.git
cd knowledge-os
./setup.sh
```

`setup.sh` installs Python dependencies, copies agent instructions to `AGENTS.md` (auto-read by pi), registers ChromaDB as a background service, and wires up git hooks.

### 2. Onboard

Run pi inside the project directory and type:

```
onboard me
```

The onboarding skill interviews you about your work context, goals, and preferences — then scaffolds your personal `data/` folder and creates your profile. From this point, every skill is personalized to you.

### 3. (Optional) Open in VS Code

If you prefer a visual editor, open the project in VS Code. Install `any-markdown.editor` from the marketplace for a Notion-like reading experience.

---

## Semantic Search

The `/query` skill uses a local vector index (ChromaDB + Ollama) to find notes by meaning — not just keywords. No server, no Docker, no cloud API. Everything runs locally.

### Install Ollama and pull an embedding model

```bash
brew install ollama        # macOS
ollama pull bge-m3         # recommended: handles both Vietnamese and English
ollama serve
```

English-only alternative (faster, smaller):
```bash
ollama pull nomic-embed-text
export KB_EMBED_MODEL=nomic-embed-text
```

### Build the index

```bash
brain/scripts/kb-search/.venv/bin/python brain/scripts/kb-search/index.py full
```

After first setup, the index stays current automatically — a git hook re-indexes after every write, and a file watcher catches edits from other editors.

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `KB_EMBED_MODEL` | `bge-m3` | Ollama embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `KB_CHUNK_WORDS` | `400` | Max words per chunk |

---

## Optional Apps

Two companion apps extend Knowledge OS beyond the terminal.

### kb-web — Web Editor

A Notion-like web editor for your `data/` folder. Browse the file tree, edit markdown with a block editor, tweak YAML frontmatter visually, and search semantically — all in the browser.

**Quick start:**

```bash
cd brain/apps/kb-web
npm install
cp .env.example .env
# Edit .env: KB_ROOT=/absolute/path/to/your/knowledge-os/data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> **Prerequisites:** Node.js 18+, the vector search index built (see [Semantic Search](#semantic-search)).

See [`brain/apps/kb-web/README.md`](brain/apps/kb-web/README.md) for full details.

### tichat — Slack Bot

Chat with your Knowledge OS from any device via Slack. Every message routes through the same Pi agent engine you use in the terminal, delivered in threaded Slack conversations.

**Quick start:**

```bash
cd brain/apps/tichat
npm install
cp .env.example .env
# Edit .env with your Slack tokens and KB_ROOT path
npm run dev
```

> **Prerequisites:** Node.js 20+, a Slack app with Socket Mode enabled, and Pi configured with Ollama Cloud.

See [`brain/apps/tichat/README.md`](brain/apps/tichat/README.md) for the full Slack app setup guide.

---

## Structure

```
data/                        # Your personal knowledge — all plain Markdown
├── _templates/              # topic, project, reference, brainstorm, journal
├── topics/                  # Evergreen concept notes
├── projects/{slug}/         # overview.md, decisions.md, roadmap.md
├── journal/                 # Daily and weekly entries
├── references/              # Captured articles, videos, papers
└── profile.md               # Your profile — personalizes every skill

brain/skills/                # AI skill library
├── query/                   # Semantic search (ChromaDB + Ollama)
├── capture-reference/       # URL and article capture
├── brainstorm/              # Thinking partner
├── project-data-manager/    # Project management
├── markdown-tools/          # Document conversion
├── mermaid-tools/           # Diagram extraction & rendering
├── skill-creator/           # Build new skills
└── onboarding/              # First-time setup

brain/scripts/
└── kb-search/               # Shared vector search engine
```

Your `data/` structure is scaffolded to match your role and preferences during onboarding. You can always reorganize it later — the skills adapt.
