#!/usr/bin/env python3
"""Calendar CLI — supports Google Calendar and Microsoft Outlook.

Outputs JSON to stdout for Claude to parse.

Commands:
    list    --range today|tomorrow|this_week|next_week|YYYY-MM-DD
    get     --event-id EVENT_ID
    create  --title TITLE --date YYYY-MM-DD [--time HH:MM] [--duration MIN]
            [--description TEXT] [--location TEXT] [--attendees a@b.com,c@d.com]
    update  --event-id EVENT_ID [--title] [--date] [--time] [--duration]
            [--description] [--location] [--attendees]
    delete  --event-id EVENT_ID

Global options:
    --account NAME    Use a named account from config (default: config.default_account)
    --calendar-id ID  Override the calendar within that account
    --config PATH     Path to config.json (optional)
"""

import argparse
import importlib.util
import json
import re
import sys
from datetime import datetime, timedelta, date
from pathlib import Path
from typing import Optional

SKILL_DIR = Path(__file__).parent.parent
CONFIG_PATH = SKILL_DIR / "config.json"


def _find_project_root() -> Path:
    """Find the project root (contains brain/ dir), with KB_ROOT env override."""
    import os
    env_root = os.environ.get("KB_ROOT")
    if env_root:
        return Path(env_root).resolve()
    # Traverse up from SKILL_DIR until we find the repo root (has brain/)
    candidate = SKILL_DIR
    for _ in range(10):
        if (candidate / "brain").is_dir():
            return candidate
        candidate = candidate.parent
    return SKILL_DIR


PROJECT_ROOT = _find_project_root()


def resolve_path(p: str) -> Path:
    """Resolve a path: absolute → as-is; relative → relative to PROJECT_ROOT."""
    path = Path(p)
    if path.is_absolute():
        return path
    return (PROJECT_ROOT / path).resolve()


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def out_ok(data: dict) -> None:
    print(json.dumps({"status": "success", "data": data}, ensure_ascii=False, indent=2))


def out_err(message: str) -> None:
    print(json.dumps({"status": "error", "message": message}, ensure_ascii=False, indent=2))
    sys.exit(1)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config(config_path: Optional[str] = None) -> dict:
    path = Path(config_path) if config_path else CONFIG_PATH
    if not path.exists():
        out_err(
            f"config.json not found at {path}. "
            "Copy config.json.example and fill in your values, then run setup.py / setup_outlook.py."
        )
    with open(path) as f:
        return json.load(f)


def resolve_account_config(config: dict, account_name: Optional[str]) -> tuple[str, dict]:
    """Return (account_name, account_config) with timezone inherited from top-level."""
    if "accounts" not in config:
        # Backward-compat: old single-Google config format
        return ("default", {**config, "provider": "google"})

    accounts: dict = config["accounts"]
    if not account_name:
        account_name = config.get("default_account") or next(iter(accounts), None)

    # Step 1: exact key match (existing behavior, unchanged)
    if account_name in accounts:
        account = dict(accounts[account_name])
        if "timezone" not in account and "timezone" in config:
            account["timezone"] = config["timezone"]
        return (account_name, account)

    # Step 2: case-insensitive display_name match (new)
    if account_name:
        needle = account_name.lower()
        for key, acc_cfg in accounts.items():
            if acc_cfg.get("display_name", "").lower() == needle:
                account = dict(acc_cfg)
                if "timezone" not in account and "timezone" in config:
                    account["timezone"] = config["timezone"]
                return (key, account)

    # Step 3: error with display_name hints
    available = ", ".join(
        f"{k} ({v['display_name']})" if "display_name" in v else k
        for k, v in accounts.items()
    )
    out_err(
        f"Account '{account_name}' not found in config. "
        f"Available accounts: {available}"
    )


# ---------------------------------------------------------------------------
# Datetime helpers (shared)
# ---------------------------------------------------------------------------

def get_tz(account_config: dict):
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        try:
            from backports.zoneinfo import ZoneInfo  # type: ignore
        except ImportError:
            out_err("zoneinfo not available. Install: pip install backports.zoneinfo")

    tz_name: str = account_config.get("timezone", "UTC")
    try:
        return ZoneInfo(tz_name)
    except Exception:
        out_err(f"Invalid timezone in config: '{tz_name}'")


def parse_range(range_str: str, tz) -> tuple[datetime, datetime]:
    today = datetime.now(tz).date()

    def day_range(d: date) -> tuple[datetime, datetime]:
        start = datetime(d.year, d.month, d.day, tzinfo=tz)
        return start, start + timedelta(days=1)

    def week_range(monday: date) -> tuple[datetime, datetime]:
        start = datetime(monday.year, monday.month, monday.day, tzinfo=tz)
        return start, start + timedelta(days=7)

    if range_str == "today":
        return day_range(today)
    if range_str == "tomorrow":
        return day_range(today + timedelta(days=1))
    if range_str == "this_week":
        return week_range(today - timedelta(days=today.weekday()))
    if range_str == "next_week":
        return week_range(today - timedelta(days=today.weekday()) + timedelta(days=7))

    try:
        return day_range(date.fromisoformat(range_str))
    except ValueError:
        out_err(
            f"Invalid --range '{range_str}'. "
            "Use: today, tomorrow, this_week, next_week, or YYYY-MM-DD."
        )


def parse_event_dt(date_str: str, time_str: Optional[str], tz) -> datetime:
    t = time_str or "09:00"
    try:
        dt = datetime.fromisoformat(f"{date_str}T{t}:00")
        return dt.replace(tzinfo=tz)
    except ValueError as e:
        out_err(f"Invalid date/time '{date_str} {t}': {e}")


def parse_iso_dt(iso_str: str) -> Optional[datetime]:
    if not iso_str:
        return None
    s = re.sub(r"\.\d+", "", iso_str.replace("Z", "+00:00"))
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Google provider
# ---------------------------------------------------------------------------

class GoogleProvider:
    def __init__(self, account_config: dict) -> None:
        self._check_deps()
        self.config = account_config
        self.service = self._build_service()

    @staticmethod
    def _check_deps() -> None:
        modules = [
            ("google.oauth2.credentials", "google-auth"),
            ("google.auth.transport.requests", "google-auth"),
            ("googleapiclient.discovery", "google-api-python-client"),
            ("googleapiclient.errors", "google-api-python-client"),
        ]
        missing: set[str] = set()
        for module, pkg in modules:
            try:
                if importlib.util.find_spec(module) is None:
                    missing.add(pkg)
            except (ModuleNotFoundError, ValueError):
                missing.add(pkg)
        if missing:
            out_err(
                f"Missing packages for Google provider: {', '.join(sorted(missing))}. "
                "Run: pip install google-auth google-auth-oauthlib "
                "google-auth-httplib2 google-api-python-client"
            )

    def _build_service(self):
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request as GoogleRequest
        from googleapiclient.discovery import build as build_google_service

        token_path = resolve_path(self.config["token_path"])
        scopes: list[str] = self.config.get("scopes", ["https://www.googleapis.com/auth/calendar"])

        if not token_path.exists():
            out_err(
                f"token.json not found at {token_path}. "
                "Run: python skills/calendar/scripts/setup.py"
            )

        creds = Credentials.from_authorized_user_file(str(token_path), scopes)
        if not creds.valid:
            if creds.expired and creds.refresh_token:
                try:
                    creds.refresh(GoogleRequest())
                    with open(token_path, "w") as f:
                        f.write(creds.to_json())
                except Exception as e:
                    out_err(f"Token refresh failed: {e}. Re-run setup.py.")
            else:
                out_err("Token invalid. Re-run: python skills/calendar/scripts/setup.py")

        return build_google_service("calendar", "v3", credentials=creds)

    def _calendar_id(self, args: argparse.Namespace) -> str:
        return args.calendar_id or self.config.get("default_calendar_id", "primary")

    @staticmethod
    def _fmt_event(event: dict) -> dict:
        start = event.get("start", {})
        end = event.get("end", {})
        attendees = [
            {"email": a.get("email", ""), "name": a.get("displayName", "")}
            for a in event.get("attendees", [])
        ]
        return {
            "id": event.get("id"),
            "title": event.get("summary", "(No title)"),
            "start": start.get("dateTime", start.get("date", "")),
            "end": end.get("dateTime", end.get("date", "")),
            "location": event.get("location", ""),
            "description": event.get("description", ""),
            "attendees": attendees,
            "html_link": event.get("htmlLink", ""),
            "status": event.get("status", ""),
            "all_day": "date" in start,
        }

    def cmd_list(self, args: argparse.Namespace) -> None:
        from googleapiclient.errors import HttpError
        tz = get_tz(self.config)
        calendar_id = self._calendar_id(args)
        start, end = parse_range(args.range, tz)

        try:
            result = self.service.events().list(
                calendarId=calendar_id,
                timeMin=start.isoformat(),
                timeMax=end.isoformat(),
                singleEvents=True,
                orderBy="startTime",
                maxResults=100,
            ).execute()
        except HttpError as e:
            out_err(f"Google API error: {e}")

        events = [self._fmt_event(e) for e in result.get("items", [])]
        out_ok({"range": args.range, "calendar_id": calendar_id, "count": len(events), "events": events})

    def cmd_get(self, args: argparse.Namespace) -> None:
        from googleapiclient.errors import HttpError
        calendar_id = self._calendar_id(args)
        try:
            event = self.service.events().get(calendarId=calendar_id, eventId=args.event_id).execute()
        except HttpError as e:
            out_err(f"Google API error: {e}")
        out_ok({"event": self._fmt_event(event)})

    def cmd_create(self, args: argparse.Namespace) -> None:
        from googleapiclient.errors import HttpError
        tz = get_tz(self.config)
        tz_str: str = self.config.get("timezone", "UTC")
        calendar_id = self._calendar_id(args)

        start_dt = parse_event_dt(args.date, args.time, tz)
        end_dt = start_dt + timedelta(minutes=args.duration)

        body: dict = {
            "summary": args.title,
            "start": {"dateTime": start_dt.isoformat(), "timeZone": tz_str},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": tz_str},
        }
        if args.description:
            body["description"] = args.description
        if args.location:
            body["location"] = args.location
        if args.attendees:
            body["attendees"] = [
                {"email": e.strip()} for e in args.attendees.split(",") if e.strip()
            ]

        try:
            event = self.service.events().insert(calendarId=calendar_id, body=body).execute()
        except HttpError as e:
            out_err(f"Google API error: {e}")

        out_ok({"event": self._fmt_event(event), "message": "Event created successfully."})

    def cmd_update(self, args: argparse.Namespace) -> None:
        from googleapiclient.errors import HttpError
        tz = get_tz(self.config)
        tz_str: str = self.config.get("timezone", "UTC")
        calendar_id = self._calendar_id(args)

        try:
            event = self.service.events().get(calendarId=calendar_id, eventId=args.event_id).execute()
        except HttpError as e:
            out_err(f"Event not found: {e}")

        if args.title:
            event["summary"] = args.title
        if args.description is not None:
            event["description"] = args.description
        if args.location is not None:
            event["location"] = args.location
        if args.attendees is not None:
            event["attendees"] = [
                {"email": e.strip()} for e in args.attendees.split(",") if e.strip()
            ]

        if args.date or args.time or args.duration:
            current_start = parse_iso_dt(event.get("start", {}).get("dateTime", ""))
            current_end = parse_iso_dt(event.get("end", {}).get("dateTime", ""))
            original_duration = 60
            if current_start and current_end:
                delta = current_end - current_start
                original_duration = max(1, int(delta.total_seconds() / 60))

            duration = args.duration if args.duration else original_duration
            base_date = args.date or (current_start.strftime("%Y-%m-%d") if current_start else datetime.now(tz).strftime("%Y-%m-%d"))
            base_time = args.time or (current_start.strftime("%H:%M") if current_start else "09:00")

            new_start = parse_event_dt(base_date, base_time, tz)
            new_end = new_start + timedelta(minutes=duration)
            event["start"] = {"dateTime": new_start.isoformat(), "timeZone": tz_str}
            event["end"] = {"dateTime": new_end.isoformat(), "timeZone": tz_str}

        try:
            updated = self.service.events().update(
                calendarId=calendar_id, eventId=args.event_id, body=event
            ).execute()
        except HttpError as e:
            out_err(f"Google API error: {e}")

        out_ok({"event": self._fmt_event(updated), "message": "Event updated successfully."})

    def cmd_delete(self, args: argparse.Namespace) -> None:
        from googleapiclient.errors import HttpError
        calendar_id = self._calendar_id(args)
        try:
            self.service.events().delete(calendarId=calendar_id, eventId=args.event_id).execute()
        except HttpError as e:
            out_err(f"Google API error: {e}")
        out_ok({"message": "Event deleted.", "event_id": args.event_id})


# ---------------------------------------------------------------------------
# Microsoft provider (Microsoft Graph API via MSAL)
# ---------------------------------------------------------------------------

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


class MicrosoftProvider:
    def __init__(self, account_config: dict) -> None:
        self._check_deps()
        self.config = account_config
        self._access_token = self._load_token()

    @staticmethod
    def _check_deps() -> None:
        missing: set[str] = set()
        if importlib.util.find_spec("msal") is None:
            missing.add("msal")
        if importlib.util.find_spec("requests") is None:
            missing.add("requests")
        if missing:
            out_err(
                f"Missing packages for Microsoft provider: {', '.join(sorted(missing))}. "
                "Run: pip install msal requests"
            )

    def _load_token(self) -> str:
        import msal

        client_id: str = self.config.get("client_id", "")
        if not client_id:
            out_err("Microsoft account config is missing 'client_id'. Check config.json.")

        token_path = resolve_path(self.config["token_path"])
        scopes: list[str] = self.config.get(
            "scopes", ["Calendars.ReadWrite", "offline_access"]
        )

        cache = msal.SerializableTokenCache()
        if token_path.exists():
            cache.deserialize(token_path.read_text())

        app = msal.PublicClientApplication(client_id, token_cache=cache)

        result = None
        accounts = app.get_accounts()
        if accounts:
            result = app.acquire_token_silent(scopes, account=accounts[0])

        if not result or "access_token" not in result:
            out_err(
                f"Microsoft token not found or expired at {token_path}. "
                "Run: python skills/calendar/scripts/setup_outlook.py"
            )

        if cache.has_state_changed:
            token_path.parent.mkdir(parents=True, exist_ok=True)
            token_path.write_text(cache.serialize())

        return result["access_token"]

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, **kwargs) -> dict:
        import requests as req

        url = f"{GRAPH_BASE}{path}"
        resp = req.request(method, url, headers=self._headers(), **kwargs)

        if resp.status_code == 204:
            return {}
        if not resp.ok:
            try:
                err = resp.json().get("error", {})
                msg = err.get("message", resp.text)
            except Exception:
                msg = resp.text
            out_err(f"Microsoft Graph error {resp.status_code}: {msg}")

        return resp.json()

    def _calendar_id(self, args: argparse.Namespace) -> str:
        return args.calendar_id or self.config.get("default_calendar_id", "primary")

    @staticmethod
    def _fmt_event(event: dict) -> dict:
        start = event.get("start", {})
        end = event.get("end", {})
        attendees = [
            {
                "email": a.get("emailAddress", {}).get("address", ""),
                "name": a.get("emailAddress", {}).get("name", ""),
            }
            for a in event.get("attendees", [])
        ]
        return {
            "id": event.get("id"),
            "title": event.get("subject", "(No title)"),
            "start": start.get("dateTime", ""),
            "end": end.get("dateTime", ""),
            "location": event.get("location", {}).get("displayName", ""),
            "description": event.get("bodyPreview", ""),
            "attendees": attendees,
            "html_link": event.get("webLink", ""),
            "status": event.get("showAs", ""),
            "all_day": event.get("isAllDay", False),
        }

    def _events_base_path(self, calendar_id: str, endpoint: str) -> str:
        """Build the Graph path for events or calendarView."""
        if calendar_id == "primary":
            return f"/me/{endpoint}"
        return f"/me/calendars/{calendar_id}/{endpoint}"

    def cmd_list(self, args: argparse.Namespace) -> None:
        tz = get_tz(self.config)
        calendar_id = self._calendar_id(args)
        start, end = parse_range(args.range, tz)

        path = self._events_base_path(calendar_id, "calendarView")
        params = {
            "startDateTime": start.isoformat(),
            "endDateTime": end.isoformat(),
            "$orderby": "start/dateTime",
            "$top": "100",
            "$select": "id,subject,start,end,location,bodyPreview,attendees,webLink,showAs,isAllDay",
        }
        import requests as req
        url = f"{GRAPH_BASE}{path}"
        resp = req.get(url, headers=self._headers(), params=params)
        if not resp.ok:
            try:
                msg = resp.json().get("error", {}).get("message", resp.text)
            except Exception:
                msg = resp.text
            out_err(f"Microsoft Graph error {resp.status_code}: {msg}")

        items = resp.json().get("value", [])
        events = [self._fmt_event(e) for e in items]
        out_ok({"range": args.range, "calendar_id": calendar_id, "count": len(events), "events": events})

    def cmd_get(self, args: argparse.Namespace) -> None:
        event = self._request("GET", f"/me/events/{args.event_id}")
        out_ok({"event": self._fmt_event(event)})

    def cmd_create(self, args: argparse.Namespace) -> None:
        tz = get_tz(self.config)
        tz_str: str = self.config.get("timezone", "UTC")
        calendar_id = self._calendar_id(args)

        start_dt = parse_event_dt(args.date, args.time, tz)
        end_dt = start_dt + timedelta(minutes=args.duration)

        body: dict = {
            "subject": args.title,
            "start": {"dateTime": start_dt.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": tz_str},
            "end": {"dateTime": end_dt.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": tz_str},
        }
        if args.description:
            body["body"] = {"contentType": "text", "content": args.description}
        if args.location:
            body["location"] = {"displayName": args.location}
        if args.attendees:
            body["attendees"] = [
                {"emailAddress": {"address": e.strip()}, "type": "required"}
                for e in args.attendees.split(",")
                if e.strip()
            ]

        path = self._events_base_path(calendar_id, "events")
        event = self._request("POST", path, json=body)
        out_ok({"event": self._fmt_event(event), "message": "Event created successfully."})

    def cmd_update(self, args: argparse.Namespace) -> None:
        tz = get_tz(self.config)
        tz_str: str = self.config.get("timezone", "UTC")

        # Fetch current event
        current = self._request("GET", f"/me/events/{args.event_id}")
        patch: dict = {}

        if args.title:
            patch["subject"] = args.title
        if args.description is not None:
            patch["body"] = {"contentType": "text", "content": args.description}
        if args.location is not None:
            patch["location"] = {"displayName": args.location}
        if args.attendees is not None:
            patch["attendees"] = [
                {"emailAddress": {"address": e.strip()}, "type": "required"}
                for e in args.attendees.split(",")
                if e.strip()
            ]

        if args.date or args.time or args.duration:
            current_start = parse_iso_dt(current.get("start", {}).get("dateTime", ""))
            current_end = parse_iso_dt(current.get("end", {}).get("dateTime", ""))
            original_duration = 60
            if current_start and current_end:
                delta = current_end - current_start
                original_duration = max(1, int(delta.total_seconds() / 60))

            duration = args.duration if args.duration else original_duration
            base_date = args.date or (current_start.strftime("%Y-%m-%d") if current_start else datetime.now(tz).strftime("%Y-%m-%d"))
            base_time = args.time or (current_start.strftime("%H:%M") if current_start else "09:00")

            new_start = parse_event_dt(base_date, base_time, tz)
            new_end = new_start + timedelta(minutes=duration)
            patch["start"] = {"dateTime": new_start.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": tz_str}
            patch["end"] = {"dateTime": new_end.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": tz_str}

        updated = self._request("PATCH", f"/me/events/{args.event_id}", json=patch)
        out_ok({"event": self._fmt_event(updated), "message": "Event updated successfully."})

    def cmd_delete(self, args: argparse.Namespace) -> None:
        self._request("DELETE", f"/me/events/{args.event_id}")
        out_ok({"message": "Event deleted.", "event_id": args.event_id})


# ---------------------------------------------------------------------------
# Power Automate provider (HTTP endpoints — SAS auth embedded in URL)
# ---------------------------------------------------------------------------

class PowerAutomateProvider:
    def __init__(self, account_config: dict) -> None:
        self.config = account_config
        self._endpoints = self._load_endpoints()

    def _load_endpoints(self) -> dict:
        endpoints = self.config.get("endpoints", {})
        required = {"get", "create", "update", "delete"}
        missing = required - set(endpoints.keys())
        if missing:
            out_err(
                f"Power Automate config is missing endpoints: {', '.join(sorted(missing))}. "
                "Check 'endpoints' in config.json."
            )
        return endpoints

    def _post(self, url: str, payload: dict) -> dict:
        """HTTP POST using stdlib urllib.request — no external dependencies."""
        import urllib.request
        import urllib.error

        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body.strip() else {}
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            out_err(f"Power Automate HTTP {e.code}: {body[:500]}")
        except urllib.error.URLError as e:
            out_err(f"Power Automate connection error: {e.reason}")
        except json.JSONDecodeError as e:
            out_err(f"Power Automate returned non-JSON response: {e}")

    def _to_account_tz(self, iso_str: str) -> str:
        """Convert timezone-aware ISO datetime to account timezone for display."""
        if not iso_str:
            return ""

        dt = parse_iso_dt(iso_str)
        if not dt:
            return iso_str

        # Keep naive datetimes unchanged; they are flow-specific and may already be local.
        if dt.tzinfo is None:
            return iso_str

        return dt.astimezone(get_tz(self.config)).isoformat()

    def _fmt_event(self, event: dict) -> dict:
        """Parse Microsoft Graph event format — same shape as responses from Get calendar view flow."""
        start_raw = event.get("start", {})
        end_raw = event.get("end", {})

        # Power Automate can return either Graph-like nested objects
        # ({"start": {"dateTime": ...}}) or flattened strings
        # ({"start": "...", "startWithTimeZone": "..."}).
        if isinstance(start_raw, dict):
            start = start_raw.get("dateTime", "")
        else:
            start = event.get("startWithTimeZone", "") or start_raw or ""

        if isinstance(end_raw, dict):
            end = end_raw.get("dateTime", "")
        else:
            end = event.get("endWithTimeZone", "") or end_raw or ""

        start = self._to_account_tz(start)
        end = self._to_account_tz(end)

        location_raw = event.get("location", "")
        if isinstance(location_raw, dict):
            location = location_raw.get("displayName", "")
        else:
            location = location_raw or ""

        attendees = [
            {
                "email": a.get("emailAddress", {}).get("address", ""),
                "name": a.get("emailAddress", {}).get("name", ""),
            }
            for a in event.get("attendees", [])
        ]
        return {
            "id": event.get("id"),
            "title": event.get("subject", "(No title)"),
            "start": start,
            "end": end,
            "location": location,
            "description": event.get("bodyPreview", ""),
            "attendees": attendees,
            "html_link": event.get("webLink", ""),
            "status": event.get("showAs", ""),
            "all_day": event.get("isAllDay", False),
        }

    def _fmt_dt(self, dt: datetime) -> str:
        """Format datetime for Power Automate: no timezone suffix — flow handles UTC+07:00."""
        return dt.strftime("%Y-%m-%dT%H:%M:%S")

    def cmd_list(self, args: argparse.Namespace) -> None:
        tz = get_tz(self.config)
        start, end = parse_range(args.range, tz)
        result = self._post(self._endpoints["get"], {
            "start": self._fmt_dt(start),
            "end": self._fmt_dt(end),
        })
        # Power Automate returns Graph calendarView body: {"value": [...]}
        items = result.get("value", result if isinstance(result, list) else [])
        events = [self._fmt_event(e) for e in items]
        out_ok({"range": args.range, "calendar_id": "powerautomate", "count": len(events), "events": events})

    def cmd_get(self, args: argparse.Namespace) -> None:
        # No single-event-by-ID endpoint in the Power Automate flow contract.
        out_err(
            "Power Automate provider does not support single-event GET. "
            "Use 'list' to find events, then 'update' or 'delete' by event ID."
        )

    def cmd_create(self, args: argparse.Namespace) -> None:
        tz = get_tz(self.config)
        start_dt = parse_event_dt(args.date, args.time, tz)
        end_dt = start_dt + timedelta(minutes=args.duration)

        payload: dict = {
            "subject": args.title,
            "start": self._fmt_dt(start_dt),
            "end": self._fmt_dt(end_dt),
        }
        if args.description:
            payload["body"] = args.description
        if args.location:
            payload["location"] = args.location

        result = self._post(self._endpoints["create"], payload)
        event_id = result.get("id", "")
        out_ok({
            "event": {
                "id": event_id,
                "title": args.title,
                "start": self._fmt_dt(start_dt),
                "end": self._fmt_dt(end_dt),
            },
            "message": "Event created successfully.",
        })

    def cmd_update(self, args: argparse.Namespace) -> None:
        tz = get_tz(self.config)
        payload: dict = {"id": args.event_id}

        if args.title:
            payload["subject"] = args.title
        if args.description is not None:
            payload["body"] = args.description
        if args.location is not None:
            payload["location"] = args.location

        if args.date or args.time or args.duration:
            # Cannot fetch current event (no GET endpoint), so date must be explicit.
            if not args.date:
                out_err(
                    "Power Automate update requires --date when changing time "
                    "(no GET endpoint to fetch current event values)."
                )
            start_dt = parse_event_dt(args.date, args.time, tz)
            duration = args.duration or 60
            end_dt = start_dt + timedelta(minutes=duration)
            payload["start"] = self._fmt_dt(start_dt)
            payload["end"] = self._fmt_dt(end_dt)

        result = self._post(self._endpoints["update"], payload)
        event = self._fmt_event(result) if result.get("id") else {"id": args.event_id}
        out_ok({"event": event, "message": "Event updated successfully."})

    def cmd_delete(self, args: argparse.Namespace) -> None:
        self._post(self._endpoints["delete"], {"id": args.event_id})
        out_ok({"message": "Event deleted.", "event_id": args.event_id})


# ---------------------------------------------------------------------------
# Provider factory
# ---------------------------------------------------------------------------

def get_provider(account_config: dict):
    provider = account_config.get("provider", "google").lower()
    if provider == "microsoft":
        return MicrosoftProvider(account_config)
    if provider == "google":
        return GoogleProvider(account_config)
    if provider == "powerautomate":
        return PowerAutomateProvider(account_config)
    out_err(f"Unknown provider '{provider}'. Supported: google, microsoft, powerautomate")


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Calendar CLI (Google + Microsoft Outlook)")
    parser.add_argument("--config", default=None, help="Path to config.json")
    parser.add_argument("--account", default=None, help="Account name from config (default: config.default_account)")
    sub = parser.add_subparsers(dest="command", required=True)

    # list
    p = sub.add_parser("list")
    p.add_argument("--range", default="today",
                   help="today | tomorrow | this_week | next_week | YYYY-MM-DD")
    p.add_argument("--calendar-id", dest="calendar_id", default=None)

    # get
    p = sub.add_parser("get")
    p.add_argument("--event-id", dest="event_id", required=True)
    p.add_argument("--calendar-id", dest="calendar_id", default=None)

    # create
    p = sub.add_parser("create")
    p.add_argument("--title", required=True)
    p.add_argument("--date", required=True, help="YYYY-MM-DD")
    p.add_argument("--time", default=None, help="HH:MM 24h (default 09:00)")
    p.add_argument("--duration", type=int, default=60, help="Minutes (default 60)")
    p.add_argument("--description", default=None)
    p.add_argument("--location", default=None)
    p.add_argument("--attendees", default=None, help="Comma-separated emails")
    p.add_argument("--calendar-id", dest="calendar_id", default=None)

    # update
    p = sub.add_parser("update")
    p.add_argument("--event-id", dest="event_id", required=True)
    p.add_argument("--title", default=None)
    p.add_argument("--date", default=None, help="YYYY-MM-DD")
    p.add_argument("--time", default=None, help="HH:MM 24h")
    p.add_argument("--duration", type=int, default=None, help="Minutes")
    p.add_argument("--description", default=None)
    p.add_argument("--location", default=None)
    p.add_argument("--attendees", default=None, help="Comma-separated emails")
    p.add_argument("--calendar-id", dest="calendar_id", default=None)

    # delete
    p = sub.add_parser("delete")
    p.add_argument("--event-id", dest="event_id", required=True)
    p.add_argument("--calendar-id", dest="calendar_id", default=None)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    config = load_config(args.config)
    _, account_config = resolve_account_config(config, args.account)
    provider = get_provider(account_config)

    dispatch = {
        "list": provider.cmd_list,
        "get": provider.cmd_get,
        "create": provider.cmd_create,
        "update": provider.cmd_update,
        "delete": provider.cmd_delete,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
