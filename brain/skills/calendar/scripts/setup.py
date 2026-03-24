#!/usr/bin/env python3
"""One-time OAuth2 setup for Google Calendar.

Usage:
    python skills/calendar/scripts/setup.py
"""

import json
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).parent.parent
CONFIG_PATH = SKILL_DIR / "config.json"


def load_config():
    if not CONFIG_PATH.exists():
        example = SKILL_DIR / "config.json.example"
        print(f"Error: config.json not found at {CONFIG_PATH}")
        if example.exists():
            print(f"Hint: Copy the example and fill in your values:")
            print(f"  cp {example} {CONFIG_PATH}")
        sys.exit(1)
    with open(CONFIG_PATH) as f:
        return json.load(f)


def setup():
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("Error: Required packages not installed.")
        print("Run: pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client")
        sys.exit(1)

    config = load_config()
    creds_path = Path(config["credentials_path"])
    token_path = Path(config["token_path"])
    scopes = config.get("scopes", ["https://www.googleapis.com/auth/calendar"])

    if not creds_path.exists():
        print(f"Error: credentials.json not found at: {creds_path}")
        print()
        print("To get credentials.json:")
        print("  1. Go to https://console.cloud.google.com/")
        print("  2. Create a project (or select existing)")
        print("  3. Enable 'Google Calendar API'")
        print("  4. Go to APIs & Services > Credentials")
        print("  5. Create OAuth 2.0 Client ID (Desktop app)")
        print("  6. Download and save as:", creds_path)
        sys.exit(1)

    print("Opening browser for Google authentication...")
    flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), scopes)
    creds = flow.run_local_server(port=0)

    token_path.parent.mkdir(parents=True, exist_ok=True)
    with open(token_path, "w") as f:
        f.write(creds.to_json())

    print(f"\nAuthentication successful!")
    print(f"Token saved to: {token_path}")
    print(f"\nYou can now use the calendar skill.")


if __name__ == "__main__":
    setup()
