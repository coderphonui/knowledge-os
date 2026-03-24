# tichat (Tí Chat)

A Slack bot that lets you query and interact with your Knowledge OS from any device. Send a message from your phone and get answers synthesized from your own notes, projects, journals, and ideas.

## How it works

```
You (Slack DM or @tichat mention)
        ↓
  Slack Bolt — Socket Mode (no public URL needed)
        ↓
  LangGraph ReAct Agent — Gemini Flash 2.0
  + System prompt built from all brain/skills/ SKILL.md files
        ↓
  Tools: execute · read_file · write_file · fetch_url · ls
        ↓
  Runs your Python KB scripts (search.py, index.py, etc.)
        ↓
  Reply in Slack thread
```

The agent loads every `SKILL.md` from `brain/skills/` at startup and injects them into its system prompt, so it knows how to search your KB, capture references, brainstorm, and run any other workflow your skills define — without you having to specify which skill to use.

**Socket Mode** means the bot connects outbound to Slack's servers. No port forwarding or reverse proxy required.

---

## Requirements

- Node.js 20+
- The Knowledge OS repo checked out locally (`brain/skills/query/.venv` must exist — the query skill's Python environment)
- A Slack workspace where you can create apps
- A Google AI Studio API key

---

## 1. Create the Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App → From Scratch**.
2. Name it `tichat`, pick your workspace.

### Enable Socket Mode

- Go to **Settings → Socket Mode**, toggle it on.
- Create an app-level token with the `connections:write` scope.
- Copy the token — it starts with `xapp-`. This is your `SLACK_APP_TOKEN`.

### Add Bot Token Scopes

- Go to **OAuth & Permissions → Scopes → Bot Token Scopes**, add:
  - `chat:write`
  - `im:history`
  - `channels:history`
  - `groups:history` ← required for private channels
  - `groups:read` ← required for private channels
  - `app_mentions:read`

### Subscribe to Events

- Go to **Event Subscriptions**, toggle on.
- Under **Subscribe to bot events**, add:
  - `message.im` ← DMs
  - `message.channels` ← follow-up replies in public channel threads
  - `message.groups` ← follow-up replies in private channel threads
  - `app_mention`

> **Why `message.*` events?** `app_mention` only fires when the bot is explicitly @mentioned. For follow-up messages in the same thread (no mention needed), Bolt's `app.message` handler must receive the event — which requires the corresponding `message.*` subscription for each channel type.

### Install to Workspace

- Go to **OAuth & Permissions → Install to Workspace**.
- Copy the **Bot User OAuth Token** — it starts with `xoxb-`. This is your `SLACK_BOT_TOKEN`.

---

## 2. Get a Gemini API Key

1. Go to [aistudio.google.com](https://aistudio.google.com).
2. Click **Get API key → Create API key**.
3. Copy the key.

---

## 3. Configure

```bash
cd brain/apps/tichat
cp .env.example .env
```

Edit `.env`:

```env
SLACK_BOT_TOKEN=xoxb-...      # from step 1
SLACK_APP_TOKEN=xapp-...      # from step 1
GOOGLE_API_KEY=...             # from step 2
KB_ROOT=/absolute/path/to/my-knowledge-os   # path to your KB repo root
GEMINI_MODEL=gemini-2.0-flash  # optional, this is the default
```

`KB_ROOT` must be the absolute path to the root of your knowledge-os repository — the directory that contains `brain/` and `data/`.

---

## 4. Install dependencies

```bash
npm install
```

---

## 5. Run

**Development** (auto-restarts on file changes):

```bash
npm run dev
```

**Production** (compile then run):

```bash
npm run build
npm start
```

You should see:

```
Starting tichat...
Loaded 23 skills from .../brain/skills
Agent ready — 23 skills loaded, model: gemini-2.0-flash
tichat is live — listening for Slack messages
```

---

## Usage

### Direct message

Open a DM with @tichat in Slack and send any message:

```
what do I know about LangChain?
```

```
save this: https://example.com/article
```

```
brainstorm ideas for a weekend side project
```

### Channel mention

Invite @tichat to a channel, then:

```
@tichat what did I decide about the tichat architecture?
```

Replies always go into the thread of your message.

### Conversation context

Within a thread, tichat remembers the last 20 messages, so you can ask follow-up questions naturally:

```
you: @tichat what's my current project status?
tichat: [summary]
you: which one has the highest priority?   ← follow-up, no need to repeat context
```

---

## What the agent can do

The agent has five tools available:

| Tool | What it does |
| --- | --- |
| `execute` | Runs shell commands — used to invoke `search.py`, `index.py`, and other KB scripts |
| `read_file` | Reads any file by path (absolute or relative to `KB_ROOT`) |
| `write_file` | Creates or overwrites a file, creating parent directories as needed |
| `fetch_url` | Fetches the content of a URL (for capturing web references) |
| `ls` | Lists a directory's contents |

All skills defined in `brain/skills/` are loaded at startup. The agent picks the right workflow based on your message.

---

## How skills are loaded

At startup, `skill-loader.ts` reads every `SKILL.md` file under `brain/skills/` and applies a tool name translation pass before injecting them into the system prompt:

| Claude Code name | tichat name |
| --- | --- |
| `Bash tool` | `execute tool` |
| `Read tool` | `read_file tool` |
| `Write tool` | `write_file tool` |
| `fetch MCP tool` | `fetch_url tool` |
| `filesystem MCP tool` | `read_file tool` |
| `AskUserQuestion` | ask the user a follow-up question in your next response |

This lets the existing skills work without modification.

---

## Troubleshooting

**Bot doesn't respond to DMs**
- Make sure `message.im` is in your Event Subscriptions.
- Verify Socket Mode is enabled and `SLACK_APP_TOKEN` is correct.

**Bot responds to @mention but not follow-up messages in the same thread**
- For **public channels**: add `message.channels` to Event Subscriptions and `channels:history` to Bot Token Scopes.
- For **private channels**: add `message.groups` to Event Subscriptions and `groups:history` + `groups:read` to Bot Token Scopes.
- After adding scopes, go to **OAuth & Permissions → Reinstall to Workspace** for the new scopes to take effect.
- Note: follow-up detection is in-memory. If the bot restarts after the initial @mention but before you reply, it will lose the thread context and stop responding until you @mention again.

`Error: SLACK_BOT_TOKEN is required`
- Your `.env` file is missing or not in `brain/apps/tichat/`. Run from that directory.

`Skills directory not found`
- Check that `KB_ROOT` in `.env` points to the repo root (the folder containing `brain/`), not a subdirectory.

**Search returns no results**
- The KB index may not be built. The agent will run `index.py full` automatically, but you can also run it manually:
```bash
brain/skills/query/.venv/bin/python brain/skills/query/scripts/index.py full
```

`recursionLimit`** errors**
- The agent hit 25 tool-call steps. The query may be too broad — try being more specific.

---

## Project structure

```
brain/apps/tichat/
├── src/
│   ├── index.ts              # Entry point
│   ├── agent/
│   │   ├── index.ts          # createReactAgent() setup
│   │   ├── skill-loader.ts   # Loads brain/skills/ + applies TOOL_MAP
│   │   ├── base-prompt.ts    # Builds system prompt with profile + skills
│   │   └── tools.ts          # execute, read_file, write_file, fetch_url, ls
│   └── slack/
│       ├── app.ts            # Slack Bolt app (Socket Mode)
│       └── handlers.ts       # DM + @mention handlers, thread history
├── .env.example
├── package.json
└── tsconfig.json
```
