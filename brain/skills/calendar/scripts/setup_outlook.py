#!/usr/bin/env python3
"""One-time OAuth2 setup for Microsoft Outlook via MSAL device code flow.

No admin access required. Works with both personal Microsoft accounts
and work/school accounts (Microsoft 365).

Usage:
    python skills/calendar/scripts/setup_outlook.py [--account ACCOUNT_NAME]

The device code flow will:
  1. Print a URL and a short code
  2. You open the URL in any browser and enter the code
  3. Sign in with your Microsoft account
  4. The script saves the token — done
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
            print("Hint: Copy the example and fill in your values:")
            print(f"  cp {example} {CONFIG_PATH}")
        sys.exit(1)
    with open(CONFIG_PATH) as f:
        return json.load(f)


def resolve_account(config: dict, account_name: str | None) -> tuple[str, dict]:
    if "accounts" not in config:
        print("Error: config.json does not have an 'accounts' section.")
        print("Please update your config.json to the new multi-account format (see config.json.example).")
        sys.exit(1)

    accounts = config["accounts"]
    if not account_name:
        # Pick first Microsoft account
        for name, acc in accounts.items():
            if acc.get("provider") == "microsoft":
                account_name = name
                break

    if not account_name or account_name not in accounts:
        ms_accounts = [k for k, v in accounts.items() if v.get("provider") == "microsoft"]
        if not ms_accounts:
            print("Error: No Microsoft accounts found in config.json.")
            print("Add an account with 'provider': 'microsoft' to config.json.")
            sys.exit(1)
        print(f"Error: Account '{account_name}' not found.")
        print(f"Available Microsoft accounts: {', '.join(ms_accounts)}")
        sys.exit(1)

    account = accounts[account_name]
    if account.get("provider") != "microsoft":
        print(f"Error: Account '{account_name}' is not a Microsoft account (provider: {account.get('provider')}).")
        sys.exit(1)

    return account_name, account


def setup(account_name: str | None = None):
    try:
        import msal
    except ImportError:
        print("Error: Required package not installed.")
        print("Run: pip install msal")
        sys.exit(1)

    config = load_config()
    name, account = resolve_account(config, account_name)

    client_id: str = account.get("client_id", "")
    if not client_id:
        print(f"Error: 'client_id' not set for account '{name}' in config.json.")
        print()
        print("To get a client_id:")
        print("  1. Go to https://portal.azure.com → App registrations → New registration")
        print("  2. Name: anything (e.g. 'Calendar CLI')")
        print("  3. Supported account types: 'Accounts in any organizational directory and personal Microsoft accounts'")
        print("  4. Redirect URI: leave empty (device code flow doesn't need it)")
        print("  5. After creating: go to 'Authentication' → enable 'Allow public client flows'")
        print("  6. Copy the 'Application (client) ID' and paste it into config.json")
        sys.exit(1)

    token_path = Path(account["token_path"])
    _reserved = {"offline_access", "profile", "openid"}
    scopes: list[str] = [s for s in account.get("scopes", ["Calendars.ReadWrite"]) if s not in _reserved]

    cache = msal.SerializableTokenCache()
    if token_path.exists():
        cache.deserialize(token_path.read_text())

    tenant_id = account.get("tenant_id", "common")
    authority = f"https://login.microsoftonline.com/{tenant_id}"
    app = msal.PublicClientApplication(client_id, authority=authority, token_cache=cache)

    # Initiate device code flow
    flow = app.initiate_device_flow(scopes=scopes)
    if "user_code" not in flow:
        print("Error: Could not initiate device flow.")
        print(flow.get("error_description", str(flow)))
        sys.exit(1)

    print(f"\nSetting up Microsoft Outlook for account: {name}")
    print("=" * 60)
    print(flow["message"])
    print("=" * 60)
    print("\nWaiting for authentication (expires in ~15 minutes)...")

    result = app.acquire_token_by_device_flow(flow)

    if "access_token" not in result:
        print("Error: Authentication failed.")
        print(result.get("error_description", str(result)))
        sys.exit(1)

    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(cache.serialize())

    print(f"\nAuthentication successful!")
    print(f"Token saved to: {token_path}")
    print(f"\nYou can now use the calendar skill with account '{name}'.")
    print(f"Example: python skills/calendar/scripts/calendar_cli.py --account {name} list --range today")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Microsoft Outlook OAuth2 setup")
    parser.add_argument("--account", default=None, help="Account name in config.json (default: first Microsoft account)")
    args = parser.parse_args()
    setup(args.account)
