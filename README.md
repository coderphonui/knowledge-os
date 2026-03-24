# Personal Knowledge OS

A structured knowledge base for technical work, research, brainstorming, and learning — designed for use inside VS Code with Claude or GitHub Copilot.

## Setup

### Prerequisites

- [VS Code](https://code.visualstudio.com/)
- [Claude Code extension](https://marketplace.visualstudio.com/items?itemName=Anthropic.claude-code) and/or [GitHub Copilot](https://github.com/features/copilot)
- Node.js 18+
- Python 3.11+

### 1. Clone and run setup

```bash
git clone https://github.com/coderphonui/knowledge-os.git
cd knowledge-os
./setup.sh
```

`setup.sh` automatically:
- Symlinks `skills/` into `.claude/skills/` and `.github/skills/`
- Symlinks `agents/CLAUDE.md` to the project root and `.github/copilot-instructions.md`
- Installs Python dependencies from every `skills/*/requirements.txt`

### 2. Open in VS Code and onboard

Open the project in VS Code, then open the Claude chat panel and type:

```
onboarding me
```

The onboarding skill will interview you about your work context, goals, and preferences — then scaffold your personal `data/` folder and create your profile. That's it.

### 3. Install some recommended VSCode extension
This knowledge-os uses Markdown heavily and we expect to see a good rendering of the content with good experience like Notion. So, we recommend to use the extension: any-markdown.editor for the markdown editor.


---

## Semantic Search (optional but recommended)

The query skill uses a local vector index (ChromaDB + Ollama) to find notes by meaning, not just keywords. No server or Docker required — ChromaDB runs in-process.

### Install Ollama

```bash
brew install ollama   # macOS
# or download from https://ollama.ai
```

### Pull the embedding model

`bge-m3` is recommended — handles both Vietnamese and English.

```bash
ollama pull bge-m3
```

English-only alternative (faster, smaller):
```bash
ollama pull nomic-embed-text
# Then set: export KB_EMBED_MODEL=nomic-embed-text
```

### Build the index

```bash
ollama serve  # start Ollama if not running

skills/query/.venv/bin/python skills/query/scripts/index.py full
```

After first setup, the index stays current automatically — a Claude Code hook re-indexes after every write, and a file watcher catches edits from other editors.

---

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `KB_EMBED_MODEL` | `bge-m3` | Ollama embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `KB_CHUNK_WORDS` | `400` | Max words per chunk |

To load credentials into your shell (needed for calendar, GitHub, etc.):

```bash
source ./setup.sh env            # current session
source ./setup.sh env --install  # persist to ~/.zshrc
```

---

## Tí Chat — Knowledge OS on Slack

**Tí Chat** (`brain/apps/tichat`) is an optional Slack bot that lets you query and interact with your Knowledge OS from anywhere — your phone, a channel, wherever you are in Slack.

Send a message like `what do I know about LangChain?` or `save this: <url>` and the agent synthesizes an answer from your own notes, projects, and journals.

- Runs in **Socket Mode** — no public URL or port forwarding needed.
- Powered by **Gemini API** via LangGraph ReAct.
- Automatically loads every skill from `brain/skills/` at startup.

See [brain/apps/tichat/README.md](brain/apps/tichat/README.md) for the full setup guide (Slack app creation, API keys, and environment config).

Recommend to use TiChat when you're far from your computer only. The limitation of Tí Chat at this stage: it does not have the built-in web search tool to support research skill with data on Internet. However, Claude / Github Copilot can support this very welll on the VSCode extension.

---

## Structure

```
data/
├── _templates/    # topic, project, reference, brainstorm, journal
├── topics/        # Evergreen concept notes

brain/skills/
├── query/         # Semantic search
├── capture-reference/
├── brainstorm/
├── weekly-review/
└── ...

brain/apps/
└── tichat/        # Slack bot — query your KB from any device


The data structure will be setup for your role, preferences after the onboarding process, but you can freely change it later.

```
