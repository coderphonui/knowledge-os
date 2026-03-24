# Personal Knowledge OS

> Your second brain — built on plain Markdown, supercharged by AI, and wired into your daily workflow.

Most knowledge tools make you choose: either you get structure (Notion, Confluence) or you get speed (scratchpads, raw files). Knowledge OS gives you both. Plain Markdown files you own forever, semantic search that finds meaning not just keywords, and a growing library of AI skills that turn your notes into an active thinking partner.

**Why people try it:**
- You're drowning in bookmarks, tabs, and browser history you never revisit
- You take notes but can never find them when you need them
- You want AI assistance that actually knows *your* context, not just the internet
- You switch between tools (Notion → Obsidian → whatever) and lose continuity every time

---

## What it is

Knowledge OS is a VS Code workspace + Claude Code setup that turns a folder of Markdown files into a personal knowledge platform. Everything runs locally. You own all your data.

**The core loop:**
1. **Capture** anything — articles, YouTube videos, meetings, ideas, research
2. **Organize** automatically with AI — frontmatter, tags, wikilinks, folder placement
3. **Query** by meaning — ask "what do I know about X?" and get synthesized answers from *your own notes*
4. **Act** — brainstorm new ideas, generate slides, prep for interviews, plan your week

---

## Skills — what the AI can do for you

Skills are specialized AI workflows that run inside Claude Code / Github Copilot. You can use it on cli as a developer, or just use extension on VSCode for Claude Code / Github Copilot to interact with the skill. Type a command or your message and the AI handles the rest.

### Capture & Research
| Skill | What it does |
| --- | --- |
| `/capture-reference` | Paste a URL or article → saved as a structured note with your annotations |
| `/youtube-notes` | Drop a YouTube URL → transcript fetched, analyzed by domain lens, saved to KB |
| `/markdown-tools` | Convert PDF/DOCX/PPTX → clean Markdown, ready to link into your notes |

### Think & Create
| Skill | What it does |
| --- | --- |
| `/brainstorm` | Thinking partner using SCAMPER, First Principles, Six Hats, JTBD, and more |
| `/startup-brainstorming` | Six forcing questions that expose whether an idea is actually worth building |
| `/life-coach` | Personal coaching sessions using GROW, Ikigai, Wheel of Life — saves context across sessions |
| `/ppt-creator` | Describe a topic or paste a document → full slide deck with speaker notes |

### Organize & Review
| Skill | What it does |
| --- | --- |
| `/query` | Semantic search across all your notes — finds by meaning, synthesizes an answer |
| `/weekly-review` | Synthesizes your journals, projects, and new notes into a structured weekly recap |
| `/project-data-manager` | Create, update, search, and archive project notes with a single command |
| `/calendar` | Create meetings, block focus time, and view your week — Google & Outlook |

### Strategy & Analysis
| Skill | What it does |
| --- | --- |
| `/marketing-strategy` | GTM strategy, channel selection, ICP definition — for your own projects |
| `/competitor-analysis` | Structured competitive research saved directly to your KB |
| <br> | <br> |

### Meta
| Skill | What it does |
| --- | --- |
| `/skill-creator` | Build new skills to extend the platform for your own workflows |
| `/claude-md-optimizer` | Audit and improve your AI instruction files |
| `/onboarding` | Set up your personal data folder, folder structure, and profile |

---

## Setup

### Prerequisites

- [VS Code](https://code.visualstudio.com/)
- [Claude Code extension](https://marketplace.visualstudio.com/items?itemName=Anthropic.claude-code)
- Node.js 18+ and Python 3.11+

### 1. Clone and run setup

```bash
git clone https://github.com/coderphonui/knowledge-os.git
cd knowledge-os
./setup.sh
```

`setup.sh` symlinks skills into Claude Code, installs Python dependencies, and wires up git hooks that keep the search index current.

### 2. Open in VS Code and onboard

Open the project in VS Code, open the Claude chat panel, and type:

```
onboard me
```

The onboarding skill interviews you about your work context, goals, and preferences — then scaffolds your personal `data/` folder and creates your profile. From this point, every skill is personalized to you.

### 3. (Recommended) Install markdown preview extension

Knowledge OS uses Markdown heavily. For a Notion-like reading experience, install `any-markdown.editor` from the VS Code marketplace.

---

## Semantic Search

The `/query` skill uses a local vector index (ChromaDB + Ollama) to find notes by meaning — not just keywords. No server, no Docker, no cloud API. Everything runs in-process on your machine.

### Install Ollama and pull an embedding model

```bash
brew install ollama
ollama pull bge-m3        # recommended: handles both Vietnamese and English
ollama serve
```

English-only alternative (faster, smaller):
```bash
ollama pull nomic-embed-text
export KB_EMBED_MODEL=nomic-embed-text
```

### Build the index

```bash
brain/skills/query/.venv/bin/python brain/skills/query/scripts/index.py full
```

After first setup the index stays current automatically — a Claude Code hook re-indexes after every write, and a file watcher catches edits from other editors.

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `KB_EMBED_MODEL` | `bge-m3` | Ollama embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `KB_CHUNK_WORDS` | `400` | Max words per chunk |

```bash
source ./setup.sh env            # load into current session
source ./setup.sh env --install  # persist to ~/.zshrc
```

---

## Tí Chat — your KB on Slack

**Tí Chat** (`brain/apps/tichat`) is an optional Slack bot that lets you query your Knowledge OS from anywhere — your phone, a team channel, wherever Slack is open.

Send `what do I know about LangChain?` or `save this: <url>` and the agent synthesizes an answer from your own notes, projects, and journals.

- Runs in **Socket Mode** — no public URL or port forwarding needed
- Powered by **Gemini API** via LangGraph ReAct
- Loads every skill from `brain/skills/` automatically at startup

See [brain/apps/tichat/README.md](brain/apps/tichat/README.md) for setup (Slack app creation, API keys, environment config).

> Best for mobile access. Note: Tí Chat does not have a built-in web search tool — for research-heavy sessions, Claude Code in VS Code is the better choice.

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
├── youtube-notes/           # Video transcript + analysis
├── brainstorm/              # Thinking partner
├── weekly-review/           # Weekly synthesis
├── calendar/                # Calendar management
└── ...                      # 15+ skills total

brain/apps/
└── tichat/                  # Slack bot — query your KB from any device
```

Your `data/` structure is scaffolded to match your role and preferences during onboarding. You can always reorganize it later — the skills adapt.
