---
title: "Calendar Skill Setup Guide"
type: reference
date_created: 2026-03-13
date_modified: 2026-03-23
tags:
- type/reference
  - tech/python
  - tech/google-calendar
  - tech/microsoft-outlook
  - tech/power-automate
  - area/automation
  - project/knowledge-os
status: active
source_url: ""
source_type: docs
author: ""
date_published: 2026-03-13
key_takeaways:
- "Uses Python script (calendar_cli.py) — no MCP server, no background process needed"
  - "Supports multiple accounts from multiple providers: Google Calendar and Microsoft Outlook"
  - "Google: create a personal GCP project, download credentials.json, run setup.py"
  - "Outlook Option A (recommended): register Azure app, MSAL device code flow — no admin required"
  - "Outlook Option B (fallback): Power Automate as middleware when IT blocks direct OAuth"
  - "config.json, credentials.json, token*.json, config.env are all gitignored — never commit"
---

# Calendar Skill Setup Guide

Calendar skill uses a **Python script** (`calendar_cli.py`) to read/write calendar events.
No MCP server, no Node.js, no background process required.

Supports multiple accounts from multiple providers within the same skill:

| Provider | Connection Method | When to Use |
| --- | --- | --- |
| **Google Calendar** | Direct OAuth 2.0 → Google Calendar API | Default for Gmail / Google Workspace |
| **Microsoft Outlook** (Option A) | Direct OAuth 2.0 → Microsoft Graph API + MSAL | Recommended |
| **Microsoft Outlook** (Option B) | HTTP POST → Power Automate Flow → Outlook | Fallback when IT blocks direct OAuth |

---

## Architecture Overview

**Google & Outlook (Option A — Direct):**
```
Claude Code (skill) → calendar_cli.py → Google Calendar API / Microsoft Graph API
```

**Outlook (Option B — Power Automate):**
```
Claude Code (skill) → calendar_cli.py → HTTP POST → Power Automate Flow → Outlook Calendar
```

---

## File Structure

```
skills/calendar/
├── scripts/
│   ├── setup.py             ← Google: run once to get OAuth token
│   ├── setup_outlook.py     ← Outlook Option A: run once, device code flow
│   └── calendar_cli.py      ← Claude calls this each time it needs to read/write calendar (all providers)
├── config.json              ← account configuration (gitignored)
├── config.json.example      ← template
├── config.env               ← Power Automate URLs — Outlook Option B (gitignored)
├── credentials.json         ← Google: download from Google Cloud (gitignored)
├── token.json               ← Google: auto-created after setup (gitignored)
├── token_outlook.json       ← Outlook Option A: auto-created after setup (gitignored)
└── requirements.txt         ← Python dependencies
```

---

## Step 1 — Install Python Dependencies

```bash
pip install -r skills/calendar/requirements.txt
```

Or manually:

```bash
# Google
pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client

# Outlook Option A (MSAL)
pip install msal requests
```

Outlook Option B (Power Automate) uses built-in `urllib` — no additional installation needed.

---

## Step 2 — Create config.json

```bash
cp skills/calendar/config.json.example skills/calendar/config.json
```

`config.json` declares all accounts. Each account only needs its relevant provider configured — you don't need to set up all of them:

```json
{
  "timezone": "Asia/Ho_Chi_Minh",
  "default_account": "personal_google",
  "accounts": {
    "personal_google": {
      "provider": "google",
      "credentials_path": "skills/calendar/credentials.json",
      "token_path": "skills/calendar/token.json",
      "default_calendar_id": "primary",
      "scopes": ["https://www.googleapis.com/auth/calendar"]
    },
    "work_outlook": {
      "provider": "microsoft",
      "client_id": "YOUR_AZURE_APP_CLIENT_ID",
      "token_path": "skills/calendar/token_outlook.json",
      "default_calendar_id": "primary",
      "scopes": ["Calendars.ReadWrite", "offline_access"]
    },
    "work_outlook_pa": {
      "provider": "powerautomate",
      "config_env": "skills/calendar/config.env"
    }
  }
}
```

Set `default_account` to the account you use most. Only declare accounts you will actually use.

---

## Setup Google Calendar

### Step G1 — Create Google Cloud Project & Get credentials.json

> Use your **personal Gmail account** to create the GCP project. Your work email will be added as a test user — no company admin needed.

**1. Create project:**
- Go to [console.cloud.google.com](https://console.cloud.google.com) — sign in with your **personal** Gmail
- Create a new project (any name, e.g. `knowledge-os-calendar`)

**2. Enable Google Calendar API:**
- Sidebar: **APIs & Services → Library**
- Find `Google Calendar API` → **Enable**

**3. Create OAuth credentials:**
- **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
- Application type: **Desktop app**
- Name: `knowledge-os`
- Click **Download JSON** → save the file

**4. Add work email as test user (if using Google Workspace):**
- **APIs & Services → OAuth consent screen**
- User type: **External** (if not already set) → Create → fill in app name + email → Save
- Tab **Test users → Add users** → enter your work email → Save

> **Why is this step needed?** The GCP project is in "Testing" mode, so only emails in the test users list can authorize. Your work email (Google Workspace) will work normally after being added.

### Step G2 — Move Credentials and Run Setup

```bash
mv ~/Downloads/client_secret_*.json skills/calendar/credentials.json

python skills/calendar/scripts/setup.py
```

The script will:
1. Open browser → Google login page
2. Sign in with your **work email** (or personal Gmail, depending on which calendar you want to use)
3. Grant permission → automatically saves `token.json` → done

> If the browser shows "app not verified" → this is normal since the app is in Testing mode. Click **Advanced → Go to [app name] (unsafe)** → you can still authorize.

### Verify Google

```bash
python skills/calendar/scripts/calendar_cli.py list --range today
# or if you have multiple accounts:
python skills/calendar/scripts/calendar_cli.py --account personal_google list --range today
```

---

## Setup Microsoft Outlook — Option A: Direct Graph API (Recommended)

No company admin required. Works with both personal Microsoft accounts and work accounts (Microsoft 365 / Azure AD).

### Step M1 — Register Azure App (~3 minutes)

You will create an app registration in Azure Portal under your own account — this is a right available to any regular user, no admin needed.

1. Go to [portal.azure.com](https://portal.azure.com) → sign in with **any Microsoft account** (personal or work)
2. Find **"App registrations"** → **New registration**
3. Fill in:
  - **Name:** `Calendar CLI` (or any name)
  - **Supported account types:** select `Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts`
  - Redirect URI: leave blank
4. Click **Register**
5. Go to the **Authentication** tab:
  - Click **Add a platform → Mobile and desktop applications**
  - Tick `https://login.microsoftonline.com/common/oauth2/nativeclient`
  - At the bottom of the page, enable **"Allow public client flows"** → Yes
  - Click **Save**
6. Go back to the **Overview** page → Copy **Application (client) ID**

> **Why no admin needed?** The app uses "public client flow" (device code) with delegated permissions — users grant permission to their own app themselves, no IT admin consent required.

### Step M2 — Update config.json

Paste the `client_id` you just copied into `config.json`:

```json
"work_outlook": {
  "provider": "microsoft",
  "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "token_path": "skills/calendar/token_outlook.json",
  "default_calendar_id": "primary",
  "scopes": ["Calendars.ReadWrite", "offline_access"]
}
```

### Step M3 — Run Setup (device code flow)

```bash
python skills/calendar/scripts/setup_outlook.py --account work_outlook
```

The script will print:

```
Setting up Microsoft Outlook for account: work_outlook
============================================================
To sign in, use a web browser to open the page https://microsoft.com/devicelogin
and enter the code XXXXXXXX to authenticate.
============================================================

Waiting for authentication (expires in ~15 minutes)...
```

1. Open a browser (any device, doesn't need to be the same machine)
2. Go to `https://microsoft.com/devicelogin`
3. Enter the 8-character code
4. Sign in with your Outlook / Microsoft 365 account
5. Grant permission → script saves token automatically → done

### Verify Outlook Option A

```bash
python skills/calendar/scripts/calendar_cli.py --account work_outlook list --range today
```

---

## Setup Microsoft Outlook — Option B: Power Automate (Fallback)

Use when IT blocks direct OAuth, or when you don't want to register an Azure App.
Instead of calling Microsoft Graph directly, the script sends HTTP POST requests to 4 Power Automate flows as middleware.

### Step P1 — Create 4 Power Automate flows

Go to [make.powerautomate.com](https://make.powerautomate.com) and create 4 flows:

**Flow 1 — Create Event**

Trigger: `When an HTTP request is received` with schema:
```json
{
  "type": "object",
  "properties": {
    "subject": { "type": "string" },
    "start":   { "type": "string" },
    "end":     { "type": "string" },
    "body":    { "type": "string" },
    "location":{ "type": "string" }
  },
  "required": ["subject", "start", "end"]
}
```

Action: `Create event (V4)` — Office 365 Outlook

| Field | Value |
| --- | --- |
| Calendar Id | `Calendar` |
| Subject | `/` → `subject` |
| Start time | `/` → `start` |
| End time | `/` → `end` |
| Time zone | `(UTC+07:00) Bangkok, Hanoi, Jakarta` |
| Body | Advanced → `/` → `body` |
| Location | Advanced → `/` → `location` |

Response body:
```json
{ "status": "created", "id": "@{outputs('Create_event_(V4)')?['body/id']}" }
```

---

**Flow 2 — Get Events**

Trigger: `When an HTTP request is received` with schema:
```json
{
  "type": "object",
  "properties": {
    "start": { "type": "string" },
    "end":   { "type": "string" }
  },
  "required": ["start", "end"]
}
```

Action: `Get calendar view of events (V3)` — Office 365 Outlook

| Field | Value (using `fx` expression) |
| --- | --- |
| Calendar Id | `Calendar` |
| Start Time | `formatDateTime(triggerBody()?['start'], 'yyyy-MM-ddTHH:mm:ssZ')` |
| End Time | `formatDateTime(triggerBody()?['end'], 'yyyy-MM-ddTHH:mm:ssZ')` |

Response body (using `fx`): `body('Get_calendar_view_of_events_(V3)')`

> **Note:** Response may return a list directly or `{ "value": [...] }`. `calendar_cli.py` handles both shapes. Fields `start`/`end` may be a nested object or flattened string (prefer `startWithTimeZone`/`endWithTimeZone` if available).

---

**Flow 3 — Update Event**

Trigger schema:
```json
{
  "type": "object",
  "properties": {
    "id":      { "type": "string" },
    "subject": { "type": "string" },
    "start":   { "type": "string" },
    "end":     { "type": "string" },
    "body":    { "type": "string" },
    "location":{ "type": "string" }
  },
  "required": ["id"]
}
```

Flow structure: `HTTP trigger → Get event (V3) → Update event (V4) → Response`

Action 1 — `Get event (V3)`: Calendar Id = `Calendar`, Id = `/` → `id`

Action 2 — `Update event (V4)` (Code view):
```json
{
  "type": "OpenApiConnection",
  "inputs": {
    "parameters": {
      "table": "<CALENDAR_TABLE_ID>",
      "id": "@triggerBody()?['id']",
      "item/subject": "@coalesce(triggerBody()?['subject'], body('Get_event_(V3)')?['subject'])",
      "item/start": "@coalesce(triggerBody()?['start'], body('Get_event_(V3)')?['start/dateTime'])",
      "item/end": "@coalesce(triggerBody()?['end'], body('Get_event_(V3)')?['end/dateTime'])",
      "item/timeZone": "(UTC+07:00) Bangkok, Hanoi, Jakarta"
    },
    "host": {
      "apiId": "/providers/Microsoft.PowerApps/apis/shared_office365",
      "connection": "shared_office365",
      "operationId": "V4CalendarPatchItem"
    }
  },
  "runAfter": { "Get_event_(V3)": ["Succeeded"] }
}
```

> `<CALENDAR_TABLE_ID>` — get from the `"table"` field when Power Automate auto-generates it after you first select a Calendar.

Response body (using `fx`): `outputs('Update_event_(V4)')?['body']`

---

**Flow 4 — Delete Event**

Trigger schema:
```json
{ "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
```

Action: `Delete event (V3)` — Calendar Id = `Calendar`, Id = `/` → `id`

Response body:
```json
{ "status": "deleted", "id": "@{triggerBody()?['id']}" }
```

---

### Step P2 — Save URLs to config.env

After saving each flow, copy the HTTP trigger URL and save it to `skills/calendar/config.env` (do not commit):

```
CALENDAR_CREATE_URL=https://prod-xx.logic.azure.com/...
CALENDAR_GET_URL=https://prod-xx.logic.azure.com/...
CALENDAR_UPDATE_URL=https://prod-xx.logic.azure.com/...
CALENDAR_DELETE_URL=https://prod-xx.logic.azure.com/...
```

### Step P3 — Declare in config.json

```json
"work_outlook_pa": {
  "provider": "powerautomate",
  "config_env": "skills/calendar/config.env"
}
```

### Verify Outlook Option B

```bash
python skills/calendar/scripts/calendar_cli.py --account work_outlook_pa list --range today
```

**Date/time format for Power Automate:** ISO 8601 without timezone suffix — the flow already sets `UTC+07:00`.
```
2026-03-14T09:00:00
```

---

## Using Multiple Accounts Simultaneously

The skill automatically selects the account based on context. You can also specify explicitly:

```bash
# Google (default if default_account = personal_google)
python skills/calendar/scripts/calendar_cli.py list --range today

# Outlook (Option A)
python skills/calendar/scripts/calendar_cli.py --account work_outlook list --range this_week

# Outlook (Option B — Power Automate)
python skills/calendar/scripts/calendar_cli.py --account work_outlook_pa list --range this_week

# Create event
python skills/calendar/scripts/calendar_cli.py --account work_outlook create \
  --title "Sprint Planning" \
  --date 2026-03-16 \
  --time 09:00 \
  --duration 90
```

### Adding Multiple Accounts (Multiple Companies)

```json
"accounts": {
  "personal_google": { "provider": "google", ... },
  "company_a_outlook": { "provider": "microsoft", "client_id": "...", "token_path": "skills/calendar/token_company_a.json" },
  "company_b_outlook": { "provider": "microsoft", "client_id": "...", "token_path": "skills/calendar/token_company_b.json" }
}
```

Each account has its own token file. Run `setup_outlook.py --account <name>` for each account.

### Get List of Calendar IDs in an Account

**Google:**
```bash
python - << 'EOF'
import json
from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

config = json.loads(Path("skills/calendar/config.json").read_text())
acc = config["accounts"]["personal_google"]
creds = Credentials.from_authorized_user_file(acc["token_path"], acc["scopes"])
service = build("calendar", "v3", credentials=creds)
for c in service.calendarList().list().execute()["items"]:
    print(c["id"], "—", c["summary"])
EOF
```

**Outlook (Option A — MSAL):**
```bash
python - << 'EOF'
import json, msal, requests
from pathlib import Path

config = json.loads(Path("skills/calendar/config.json").read_text())
acc = config["accounts"]["work_outlook"]
cache = msal.SerializableTokenCache()
cache.deserialize(Path(acc["token_path"]).read_text())
app = msal.PublicClientApplication(acc["client_id"], token_cache=cache)
result = app.acquire_token_silent(acc["scopes"], account=app.get_accounts()[0])
resp = requests.get(
    "https://graph.microsoft.com/v1.0/me/calendars",
    headers={"Authorization": f"Bearer {result['access_token']}"}
)
for c in resp.json().get("value", []):
    print(c["id"], "—", c["name"])
EOF
```

---

## Troubleshooting

### Google

| Error | Cause | Fix |
| --- | --- | --- |
| `credentials.json not found` | Not downloaded or wrong path | Check `credentials_path` in config.json |
| `token.json not found` | Setup not run yet | `python skills/calendar/scripts/setup.py` |
| `Token refresh failed` | Token was revoked | Delete `token.json`, re-run `setup.py` |
| "App not verified" in browser | App is in Testing mode | Normal — click Advanced → Continue |
| Work email cannot authorize | Not added to Test users | GCP Console → OAuth consent screen → Test users → add email |
| `403 insufficientPermissions` | Missing scope | Check `scopes`, delete token.json, re-run setup |

### Outlook Option A (Direct MSAL)

| Error | Cause | Fix |
| --- | --- | --- |
| `client_id not set` | client_id not filled in | Complete Step M1 and add to config.json |
| `Token not found or expired` | Setup not run or token expired | `python skills/calendar/scripts/setup_outlook.py` |
| `Missing packages: msal` | Not installed | `pip install msal requests` |
| `Microsoft Graph error 401` | Invalid token | Re-run `setup_outlook.py` |
| `Microsoft Graph error 403` | Missing permissions | Check scopes; try revoke & re-auth |
| "Need admin approval" on login | IT blocks user consent | See note below — or switch to Option B |
| `Invalid timezone` | Wrong timezone name | Use IANA names: `Asia/Ho_Chi_Minh`, `UTC` |

> **"Need admin approval":** Some companies configure Azure AD to require admin consent for all apps. If you encounter this error:
> - Ask your IT admin to grant consent for the app (provide the `client_id`)
> - Or switch to **Option B (Power Automate)** — no Azure app registration needed

### Outlook Option B (Power Automate)

| Error | Cause | Fix |
| --- | --- | --- |
| `Missing URL for CALENDAR_*_URL` | config.env not filled in | Copy URL from the flow's trigger |
| HTTP 404 / Connection refused | Flow is disabled or URL is wrong | Check that the flow is still enabled in Power Automate |
| HTTP 400 Bad Request | Schema mismatch | Check request body JSON |
| Times display in wrong timezone | Response returns UTC | `calendar_cli.py` prefers `startWithTimeZone`/`endWithTimeZone` if available |
| `AttributeError: 'str' object has no attribute 'get'` | Unexpected response shape | `_fmt_event` must handle both nested object and flat string |

---

## Security

The following files are added to `.gitignore` — **never commit**:

```
skills/calendar/credentials.json      ← Google OAuth client secret
skills/calendar/token.json            ← Google access + refresh token
skills/calendar/token_outlook.json    ← Microsoft access + refresh token
skills/calendar/token_*.json          ← All Microsoft token files
skills/calendar/config.json           ← Contains client_id and credentials paths
skills/calendar/config.env            ← Power Automate URLs (Option B)
```

**If a token is compromised:**
- Google: go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions) → revoke access → delete `token.json` → re-run `setup.py`
- Outlook Option A: go to [myapps.microsoft.com](https://myapps.microsoft.com) → find app → revoke → delete `token_outlook.json` → re-run `setup_outlook.py`
- Outlook Option B: go to Power Automate → disable flows → recreate new flows with new URLs → update `config.env`
