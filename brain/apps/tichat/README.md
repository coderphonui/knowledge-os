# tichat (Tí Chat)

A Slack bot powered by **Pi Agent SDK** — chat with your Knowledge OS from any device. Every message goes through the same Pi agent engine you use in the terminal, but delivered over Slack threads.

## How it works

```
You (Slack DM or @tichat mention)
        ↓
  Slack Bolt — Socket Mode (no public URL needed)
        ↓
  Pi AgentSession (per-thread persistent session)
        ↓
  Ollama Cloud — kimi-k2.6 (or any model you select)
        ↓
  Skills, tools, KB search, file I/O — identical to Pi terminal
        ↓
  Reply in Slack thread
```

**Socket Mode** means the bot connects outbound to Slack's servers. No port forwarding or reverse proxy required.

---

## Requirements

- Node.js 20+
- [Pi](https://github.com/mariozechner/pi-coding-agent) installed globally (`npm i -g @mariozechner/pi-coding-agent`)
- The Knowledge OS repo checked out locally (`brain/scripts/kb-search/.venv` must exist — the query skill's Python environment)
- A Slack workspace where you can create apps

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

## 2. Configure Ollama Cloud (Pi)

This bot reuses your existing Pi setup — no separate API key management.

### Ensure Pi has Ollama Cloud configured

Your global Pi config should already have this (check `~/.pi/agent/settings.json`):

```json
{
  "packages": ["npm:pi-ollama-cloud"]
}
```

If not, add it:

```bash
pi --package npm:pi-ollama-cloud
```

### Ensure your Ollama Cloud API key is stored

```bash
cat ~/.pi/agent/auth.json
```

Should contain:

```json
{
  "ollama-cloud": {
    "type": "api_key",
    "key": "YOUR_OLLAMA_CLOUD_KEY"
  }
}
```

If missing, get your key from [ollama.com](https://ollama.com) and add it.

### Choose your model in Pi

The bot will auto-detect `kimi-k2.6` (or `kimi-k2.6:cloud`) from Ollama Cloud. To verify it's available:

```bash
pi --list-models | grep ollama-cloud
```

You should see `kimi-k2.6` in the list.

> **To use a different model**, edit `src/agent/index.ts` and change the `resolveOllamaCloudModel()` function or swap the entire provider.

---

## 3. Configure tichat

```bash
cd brain/apps/tichat
cp .env.example .env
```

Edit `.env`:

```env
SLACK_BOT_TOKEN=xoxb-...      # from step 1
SLACK_APP_TOKEN=xapp-...      # from step 1
KB_ROOT=/absolute/path/to/my-knowledge-os   # path to your KB repo root
```

`KB_ROOT` must be the absolute path to the root of your knowledge-os repository — the directory that contains `brain/` and `data/`.

---

## 4. Install dependencies

```bash
npm install
```

This installs the Pi SDK (`@mariozechner/pi-coding-agent`) and `pi-ollama-cloud` extension.

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
Pi agent ready — KB_ROOT: /Users/.../my-knowledge-os
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

Within a thread, tichat maintains a persistent Pi session, so you can ask follow-up questions naturally:

```
you: @tichat what's my current project status?
tichat: [summary]
you: which one has the highest priority?   ← follow-up, no need to repeat context
```

---

## What the agent can do

The Pi agent comes with built-in tools (`read`, `bash`, `edit`, `write`, `ls`) and automatically loads:

- All **skills** from `brain/skills/*/SKILL.md`
- **Context files** (`AGENTS.md`, `data/profile.md`) walking up from `KB_ROOT`
- **Global extensions** (including `pi-ollama-cloud` for model access)

It behaves exactly like running `pi` in your terminal inside the `KB_ROOT` directory.

---

## Architecture

```
brain/apps/tichat/
├── src/
│   ├── index.ts              # Entry point: init Pi agent, start Slack app
│   ├── agent/
│   │   └── index.ts          # Pi SDK AgentSession wrapper (per-thread)
│   └── slack/
│       ├── app.ts            # Slack Bolt app (Socket Mode)
│       └── handlers.ts       # DM + @mention handlers, thread routing
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

**Key design:** each Slack thread gets its own `AgentSession` instance. Pi manages conversation history, model state, and tool access internally — no manual history map required.

---

## Troubleshooting

**Bot doesn't respond to DMs**
- Make sure `message.im` is in your Event Subscriptions.
- Verify Socket Mode is enabled and `SLACK_APP_TOKEN` is correct.

**Bot responds to @mention but not follow-up messages**
- For **public channels**: add `message.channels` to Event Subscriptions and `channels:history` to Bot Token Scopes.
- For **private channels**: add `message.groups` to Event Subscriptions and `groups:history` + `groups:read` to Bot Token Scopes.
- After adding scopes, go to **OAuth & Permissions → Reinstall to Workspace**.
- Note: follow-up detection is in-memory. If the bot restarts after the initial @mention but before you reply, it will lose the thread context and stop responding until you @mention again.

`Error: Model kimi-k2.6 not found in Ollama Cloud provider`
- Ensure `npm:pi-ollama-cloud` is in your Pi `settings.json` packages list.
- Run `pi --list-models` and verify an `ollama-cloud` model appears.
- Try running `pi /ollama-cloud-refresh` in your terminal to update the model cache.

`Error: SLACK_BOT_TOKEN is required`
- Your `.env` file is missing or not in `brain/apps/tichat/`. Run from that directory.

**Search returns no results**
- The KB index may not be built. Run it manually:
  ```bash
  brain/scripts/kb-search/.venv/bin/python brain/scripts/kb-search/index.py full
  ```
