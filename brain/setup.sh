#!/usr/bin/env bash
# =============================================================================
# setup.sh — Knowledge OS: project setup (pi-only)
#
# Usage:
#   ./setup.sh          # install Python deps + ChromaDB background service
#   ./setup.sh --unlink # remove ChromaDB background service only
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$REPO_ROOT/brain/skills"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✓${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }

# ── Python dependencies ───────────────────────────────────────────────────────
#
# Convention:
#   - skills with a plain requirements.txt → install into global Python env
#   - skills with requirements.txt AND a .use-venv marker → install into an
#     isolated venv at skills/<name>/.venv/ to avoid dependency conflicts

setup_python_deps() {
  echo ""
  echo "── Python dependencies ────────────────────────────────"

  if ! command -v python3 &>/dev/null; then
    warn "python3 not found — skipping Python dependency install"
    return
  fi

  # Resolve global pip command
  local pip_cmd=""
  if command -v pip3 &>/dev/null; then
    pip_cmd="pip3"
  elif command -v pip &>/dev/null; then
    pip_cmd="pip"
  else
    pip_cmd="python3 -m pip"
  fi

  local found=0
  for req in "$SKILLS_SRC"/*/requirements.txt; do
    [[ -f "$req" ]] || continue
    local skill_dir
    skill_dir="$(dirname "$req")"
    local skill_name
    skill_name="$(basename "$skill_dir")"

    echo "  Installing deps for skill: $skill_name"

    if [[ -f "$skill_dir/.use-venv" ]]; then
      # Isolated venv install — avoids polluting or conflicting with global env
      local venv_dir="$skill_dir/.venv"
      if [[ ! -d "$venv_dir" ]]; then
        python3 -m venv "$venv_dir" \
          && ok "Created venv: skills/$skill_name/.venv"
      fi
      "$venv_dir/bin/pip" install -q -r "$req" \
        && ok "skills/$skill_name/requirements.txt installed (venv)" \
        || warn "Failed to install deps for $skill_name — check requirements.txt"
    else
      # Global install
      $pip_cmd install -q -r "$req" \
        && ok "skills/$skill_name/requirements.txt installed" \
        || warn "Failed to install deps for $skill_name — check requirements.txt"
    fi

    found=1
  done

  if [[ $found -eq 0 ]]; then echo "  No requirements.txt found in any skill — skipping"; fi
}

# ── Git hooks ─────────────────────────────────────────────────────────────────

HOOKS_SRC="$REPO_ROOT/scripts/hooks"

setup_agents_md() {
  echo ""
  echo "── Agent instructions ─────────────────────────────────"
  if [[ ! -f "$REPO_ROOT/brain/instructions/BRAIN-INSTRUCTION.md" ]]; then
    warn "brain/instructions/BRAIN-INSTRUCTION.md not found — skipping"
    return
  fi
  cp "$REPO_ROOT/brain/instructions/BRAIN-INSTRUCTION.md" "$REPO_ROOT/AGENTS.md"
  ok "Copied brain/instructions/BRAIN-INSTRUCTION.md → AGENTS.md (pi auto-read)"
}

unlink_agents_md() {
  if [[ -f "$REPO_ROOT/AGENTS.md" ]]; then
    rm "$REPO_ROOT/AGENTS.md"
    ok "Removed AGENTS.md"
  fi
}

# ── Git hooks ─────────────────────────────────────────────────────────────────

setup_git_hooks() {
  echo ""
  echo "── Git hooks ──────────────────────────────────────────"
  [[ ! -d "$HOOKS_SRC" ]] && { warn "scripts/hooks/ not found — skipping"; return; }
  local hooks_dir="$REPO_ROOT/.git/hooks"
  for hook in "$HOOKS_SRC"/*; do
    [[ -f "$hook" ]] || continue
    local name
    name="$(basename "$hook")"
    chmod +x "$hook"
    cp "$hook" "$hooks_dir/$name"
    ok "Copied .git/hooks/$name"
  done
}

# ── ChromaDB background service ───────────────────────────────────────────────
#
# Registers ChromaDB as a background service that auto-starts on login.
# macOS  → launchd agent  (~/.Library/LaunchAgents/)
# Linux  → systemd user service (~/.config/systemd/user/)
# Other  → prints manual start command, falls back to embedded mode
#
# The service is removed by ./setup.sh --unlink.

CHROMA_LABEL="com.knowledge-os.chroma"
CHROMA_VENV="$REPO_ROOT/brain/skills/query/.venv"
CHROMA_BIN="$CHROMA_VENV/bin/chroma"
CHROMA_DATA="$REPO_ROOT/brain/skills/query/vector_store/chroma"
CHROMA_LOG="$REPO_ROOT/brain/skills/query/vector_store/chroma-server.log"
CHROMA_PORT=8000

# macOS paths
CHROMA_PLIST="$HOME/Library/LaunchAgents/$CHROMA_LABEL.plist"

# Linux paths
CHROMA_SYSTEMD_DIR="$HOME/.config/systemd/user"
CHROMA_SERVICE="$CHROMA_SYSTEMD_DIR/chroma-kb.service"

_chroma_common_checks() {
  mkdir -p "$(dirname "$CHROMA_LOG")"
  if [[ ! -f "$CHROMA_BIN" ]]; then
    warn "ChromaDB binary not found — run setup.sh again after Python deps install"
    return 1
  fi
  return 0
}

_setup_chroma_macos() {
  mkdir -p "$HOME/Library/LaunchAgents"

  cat > "$CHROMA_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$CHROMA_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$CHROMA_BIN</string>
        <string>run</string>
        <string>--path</string>
        <string>$CHROMA_DATA</string>
        <string>--port</string>
        <string>$CHROMA_PORT</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$CHROMA_LOG</string>
    <key>StandardErrorPath</key>
    <string>$CHROMA_LOG</string>
</dict>
</plist>
EOF

  launchctl bootout "gui/$(id -u)/$CHROMA_LABEL" 2>/dev/null || true
  sleep 1
  if launchctl bootstrap "gui/$(id -u)" "$CHROMA_PLIST" 2>/dev/null; then
    ok "ChromaDB registered as launchd agent (port $CHROMA_PORT)"
    ok "Auto-starts on login — no manual action needed"
    echo "     Log: $CHROMA_LOG"
  else
    warn "Could not register launchd agent — start manually: $CHROMA_BIN run --path $CHROMA_DATA --port $CHROMA_PORT"
  fi
}

_setup_chroma_linux() {
  if ! command -v systemctl &>/dev/null; then
    warn "systemd not found — start ChromaDB manually: $CHROMA_BIN run --path $CHROMA_DATA --port $CHROMA_PORT"
    return
  fi

  mkdir -p "$CHROMA_SYSTEMD_DIR"

  cat > "$CHROMA_SERVICE" <<EOF
[Unit]
Description=ChromaDB Knowledge Base Server
After=network.target

[Service]
ExecStart=$CHROMA_BIN run --path $CHROMA_DATA --port $CHROMA_PORT
Restart=always
StandardOutput=append:$CHROMA_LOG
StandardError=append:$CHROMA_LOG

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable chroma-kb.service 2>/dev/null
  systemctl --user restart chroma-kb.service

  # Enable linger so the service starts at boot, not just at interactive login
  if command -v loginctl &>/dev/null; then
    loginctl enable-linger "$USER" 2>/dev/null || true
  fi

  ok "ChromaDB registered as systemd user service (port $CHROMA_PORT)"
  ok "Auto-starts on login — no manual action needed"
  echo "     Log: $CHROMA_LOG"
  echo "     Status: systemctl --user status chroma-kb"
}

setup_chroma_server() {
  echo ""
  echo "── ChromaDB background server ─────────────────────────"

  _chroma_common_checks || return

  case "$(uname)" in
    Darwin) _setup_chroma_macos ;;
    Linux)  _setup_chroma_linux ;;
    *)
      warn "Auto-start not supported on this OS"
      warn "Start manually: $CHROMA_BIN run --path $CHROMA_DATA --port $CHROMA_PORT"
      ;;
  esac
}

unlink_chroma_server() {
  case "$(uname)" in
    Darwin)
      if [[ -f "$CHROMA_PLIST" ]]; then
        launchctl bootout "gui/$(id -u)/$CHROMA_LABEL" 2>/dev/null || true
        rm "$CHROMA_PLIST"
        ok "Removed ChromaDB launchd agent"
      fi
      ;;
    Linux)
      if [[ -f "$CHROMA_SERVICE" ]]; then
        systemctl --user stop chroma-kb.service 2>/dev/null || true
        systemctl --user disable chroma-kb.service 2>/dev/null || true
        rm "$CHROMA_SERVICE"
        systemctl --user daemon-reload
        ok "Removed ChromaDB systemd service"
      fi
      ;;
  esac
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_setup() {
  setup_agents_md
  setup_python_deps
  setup_git_hooks
  setup_chroma_server

  echo ""
  ok "Done."
  echo ""
  echo "  Agent instructions: AGENTS.md  ← copied from brain/instructions/BRAIN-INSTRUCTION.md (pi auto-read)"
  echo "  Pi settings:       .pi/settings.json"
  echo "  Skills:            brain/skills/  (auto-discovered by pi)"
  echo ""
  echo "  To add deps:       create brain/skills/<name>/requirements.txt"
  echo "  To remove ChromaDB svc: ./setup.sh --unlink"
  echo "  Skill secrets:     copy brain/skills/<name>/config.env.example → config.env"
}

cmd_unlink() {
  unlink_agents_md
  unlink_chroma_server
  echo ""; ok "AGENTS.md removed. ChromaDB service removed."
}

# ── Entry point ───────────────────────────────────────────────────────────────

case "${1:-}" in
  --unlink) cmd_unlink ;;
  setup|"") cmd_setup ;;
  *)
    echo "Usage:"
    echo "  ./setup.sh          — install Python deps + ChromaDB background service"
    echo "  ./setup.sh --unlink — remove ChromaDB background service"
    exit 1
    ;;
esac
