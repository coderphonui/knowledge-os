---
name: calendar
description: >
  Manage Google Calendar and Microsoft Outlook through conversation using Python scripts.
  Use this skill when the user wants to create, update, view, or delete calendar events;
  schedule meetings; block focus time; get a daily/weekly schedule overview;
  or link calendar events to knowledge base notes.
  Supports multiple accounts across providers (Google, Microsoft Outlook).
  Triggers: "create meeting", "reschedule", "block time", "what do I have today",
  "schedule a meeting", "cancel event", "view this week", "create meeting with...",
  "list events", "delete event", "tạo meeting", "dời lịch", "xem lịch",
  "lịch outlook", "lịch google", "lịch công ty".
---

# Calendar Skill

Uses `brain/skills/calendar/scripts/calendar_cli.py` for all calendar operations.
Output is always JSON — parse `data.events`, `data.event`, or `data.message` from the response.

Supports **multiple accounts** across providers:
- `provider: google` → Google Calendar API
- `provider: microsoft` → Microsoft Outlook via Microsoft Graph API
- `provider: powerautomate` → Power Automate HTTP flows (no direct OAuth needed)

---

## Account Selection

**Always read `brain/skills/calendar/config.json` first** to discover the available accounts and their `display_name` values before deciding which `--account` to use. Do not guess or rely on hardcoded names.

Steps:
1. Read `brain/skills/calendar/config.json` with `read_file`.
2. Build the list of available accounts: each key under `"accounts"` has a `display_name` field.
3. Match the user's mention to the closest `display_name` (case-insensitive, partial match is fine).
4. Use the matched config **key** (e.g. `work_bestarion`) or its `display_name` as `--account`. Both are accepted.
5. If no mention → use `default_account` (omit `--account`).
6. If ambiguous (user mention matches multiple accounts) → list them and ask.

`--account` accepts both the config key and `display_name` (case-insensitive).

If the user works at multiple companies with different providers, ask which calendar they mean if ambiguous.

Special rule for aggregate requests:
- If user asks to aggregate all calendars → do not use `default_account`.
- Fetch events from all configured accounts in `skills/calendar/config.json` for the same range, then merge and sort by start time.

---

## First-time Setup — Power Automate

No new dependencies — uses stdlib `urllib.request`.

```
1. Create 4 Power Automate flows following the guide in docs/calendar-powerautomate-setup.md

2. Copy the HTTP trigger URLs into config.json under endpoints:
   "work_powerautomate": {
     "provider": "powerautomate",
     "display_name": "work calendar",
     "endpoints": {
       "get":    "https://prod-xx.logic.azure.com/...",
       "create": "https://prod-xx.logic.azure.com/...",
       "update": "https://prod-xx.logic.azure.com/...",
       "delete": "https://prod-xx.logic.azure.com/..."
     }
   }

3. Test:
   python skills/calendar/scripts/calendar_cli.py --account work_powerautomate list --range today
```

**Notes:**
- URLs contain SAS keys — config.json is already gitignored
- Datetime sent without timezone suffix: `2026-03-14T09:00:00` — the flow applies UTC+07:00 automatically
- `get` command is not supported — use `list` instead
- `update` with time changes requires adding `--date`

---

## First-time Setup — Google

```
1. cp skills/calendar/config.json.example skills/calendar/config.json
   # Edit: set credentials_path, token_path, timezone for the google account

2. # Get credentials.json from Google Cloud Console:
   #   - Create project → Enable "Google Calendar API"
   #   - APIs & Services → Credentials → Create OAuth 2.0 Client ID (Desktop app)
   #   - Download and save to the path in config.json

3. python skills/calendar/scripts/setup.py
   # Opens browser for one-time Google auth → saves token.json

4. pip install -r skills/calendar/requirements.txt
```

---

## First-time Setup — Microsoft Outlook

No admin access required. Works with personal Microsoft accounts and work/school (Microsoft 365) accounts.

```
1. Register an Azure app (one-time, ~3 minutes):
   - Go to https://portal.azure.com → App registrations → New registration
   - Name: anything (e.g. "Calendar CLI")
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Click Register
   - Go to Authentication → Add platform → Mobile and desktop → enable http://localhost
   - Enable "Allow public client flows" (toggle at the bottom of Authentication)
   - Copy the "Application (client) ID"

2. In config.json, set client_id for the microsoft account:
   {
     "accounts": {
       "work_outlook": {
         "provider": "microsoft",
         "client_id": "PASTE_CLIENT_ID_HERE",
         "token_path": "skills/calendar/token_outlook.json"
       }
     }
   }

3. python skills/calendar/scripts/setup_outlook.py [--account work_outlook]
   # Prints a URL + code → open in any browser → sign in → done

4. pip install -r skills/calendar/requirements.txt
```

**Error signals:**
- `Token not found or expired` → re-run `setup_outlook.py`
- `client_id not set` → add client_id to config.json
- `Missing packages: msal` → `pip install msal requests`

---

## CLI Reference

All commands: `python skills/calendar/scripts/calendar_cli.py [--account NAME] <command> [args]`

| Command | Required args | Optional args |
|---------|--------------|---------------|
| `list`  | — | `--range today\|tomorrow\|this_week\|next_week\|YYYY-MM-DD` |
| `get`   | `--event-id` | — |
| `create`| `--title`, `--date YYYY-MM-DD` | `--time HH:MM`, `--duration MIN`, `--description`, `--location`, `--attendees a@b.com,c@d.com` |
| `update`| `--event-id` | any field from `create` |
| `delete`| `--event-id` | — |

All commands accept:
- `--account NAME` — select account from config (default: `config.default_account`)
- `--calendar-id ID` — override calendar within that account (default: `primary`)

---

## Intent Detection

| User intent | Command |
|-------------|---------|
| Create meeting / schedule event | `create` |
| Reschedule / modify event | `update` |
| Cancel / delete event | `delete` |
| What do I have today / list schedule | `list` |
| Aggregate all calendars | run `list` for all accounts, merge results |
| Block focus time | `create` with title "Focus: [activity]" |
| Capture meeting note after a meeting | `list --range today` → find most recent past event |
| Prep for upcoming meeting | `list` + query KB |

---

## Workflows

### LIST EVENTS

```bash
# Default account
python skills/calendar/scripts/calendar_cli.py list --range today

# Outlook (work account)
python skills/calendar/scripts/calendar_cli.py --account work_outlook list --range this_week

# Specific date
python skills/calendar/scripts/calendar_cli.py list --range 2026-03-15
```

**Output format to user (respond in user's preferred language):**
```
📅 [Range] schedule — [count] events

- 09:00–10:00 | Event Title
- 14:00–15:30 | Event Title | 📍 Location
- 16:00–17:00 | Event Title | 👥 attendee@email.com
```

If `count == 0`: tell the user there are no events in that time range.

---

### AGGREGATE EVENTS (ALL CALENDARS)

When the user requests all calendars, fetch from all configured accounts (Google/Outlook/Power Automate) — do not use only the default account.

Flow:
1. Determine range (`today`, `tomorrow`, `this_week`, `next_week`, or a specific date).
2. Read the account list from `skills/calendar/config.json`.
3. Run `list` for each account with the same range.
4. Merge all events, sort by start time, display with account source.

```bash
python skills/calendar/scripts/calendar_cli.py --account personal_google list --range today
python skills/calendar/scripts/calendar_cli.py --account work_outlook list --range today
python skills/calendar/scripts/calendar_cli.py --account "work calendar" list --range today
```

If one account errors, continue with the others and report which account failed.

---

### CREATE EVENT

Extract from user message: `title` (required), `date` (required), `time`, `duration`, `attendees`, `location`, `description`.

Missing `title` or `date` → ask the user. Missing `time` → default 09:00. Missing `duration` → default 60 min.

Also detect which account to use. If unclear → ask.

```bash
python skills/calendar/scripts/calendar_cli.py --account work_outlook create \
  --title "Q1 Review with Nam" \
  --date 2026-03-17 \
  --time 15:00 \
  --duration 60 \
  --attendees "nam@company.com"
```

Confirm to user: "Created: **[title]** — [date] [time] ([duration] min)"

Then ask: "Want me to create a meeting note in the KB?" → if yes, create `data/journal/YYYY-MM-DD-meeting-<slug>.md` (template below).

---

### UPDATE EVENT

1. If the user doesn't provide `event_id`: run `list --range today|this_week` → show list → ask user to select event
2. Confirm change: "Change [field] from [old] → [new]?"
3. Run `update`

```bash
python skills/calendar/scripts/calendar_cli.py --account work_outlook update \
  --event-id "abc123" \
  --date 2026-03-18 \
  --time 16:00
```

---

### DELETE EVENT

1. Confirm before deleting: "Confirm deletion of **[title]** on [date] at [time]?"
2. Run `delete` only after user confirms

```bash
python skills/calendar/scripts/calendar_cli.py delete --event-id "abc123"
```

---

### CREATE BLOCK (Focus Time)

```bash
python skills/calendar/scripts/calendar_cli.py create \
  --title "Focus: Deep work" \
  --date 2026-03-14 \
  --time 09:00 \
  --duration 120
```

Confirm: "Blocked **[time range]** — [date]"

---

### CAPTURE MEETING NOTE

1. `list --range today` → find most recent past event
2. Create file `data/journal/YYYY-MM-DD-meeting-<slug>.md`:

```markdown
---
title: "Meeting: [Event Title]"
type: journal
date_created: YYYY-MM-DD
date_modified: YYYY-MM-DD
tags:
  - type/journal
  - area/meeting
status: draft
period: meeting
---

# Meeting: [Event Title]

**Date:** YYYY-MM-DD HH:MM – HH:MM
**Attendees:** [list from event.attendees]

## Agenda / Context

[Pull from event.description if available]

## Notes



## Action Items

- [ ]

## Decisions

-
```

Link to a related project note if one exists.

---

### MEETING PREP

1. Find the event: `list --range today` or `list --range tomorrow`
2. Query KB: search `data/` with keywords from the event title + attendees
3. Surface related notes

```
📋 Meeting Prep: [Event Title]
⏰ [Time] | 👥 [Attendees]

From Knowledge Base:
- [[note-1]]: [summary]

Open items from last time:
- [ ] [outstanding action item]
```

---

## Error Handling

| Error message | Action |
|--------------|--------|
| `token.json not found` | Run `python skills/calendar/scripts/setup.py` (Google) |
| `credentials.json not found` | Guide user to create a Google Cloud project |
| `Token refresh failed` / `Token invalid` | Re-run `setup.py` |
| `Token not found or expired` (Microsoft) | Run `python skills/calendar/scripts/setup_outlook.py` |
| `client_id not set` (Microsoft) | Add client_id to config.json |
| `Missing packages: msal` | `pip install msal requests` |
| `Missing packages: google-*` | `pip install -r skills/calendar/requirements.txt` |
| `Google API error: 404` | Event not found — verify event-id |
| `Microsoft Graph error 404` | Event not found — verify event-id |
| `Google API error: 403` | Insufficient permissions — check scopes |
| `Account 'X' not found` | Verify account name in config.json |
| JSON parse fail | Show raw output to user for debugging |
| `Power Automate HTTP 4xx/5xx` | Wrong URL or flow is disabled — check URL and flow status |
| `Power Automate connection error` | Network / VPN issue — check connectivity |
| `Power Automate config missing endpoints` | Missing URLs in config — add all 4 endpoints |
| `does not support single-event GET` | No endpoint for fetching by ID — use `list` to find event, then `update`/`delete` |
| `requires --date when changing time` | Time update without date — add `--date YYYY-MM-DD` to the command |
