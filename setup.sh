#!/usr/bin/env bash
# =============================================================================
# setup.sh — Knowledge OS: project setup
#
# Usage:
#   ./setup.sh          # initial project setup (symlinks + Python deps)
#   ./setup.sh --unlink # remove all symlinks
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$REPO_ROOT/brain/skills"
CLAUDE_MD_SRC="$REPO_ROOT/brain/instructions/BRAIN-INSTRUCTION.md"

# Auto-discover all skill folders
discover_skills() {
  local skills=()
  for d in "$SKILLS_SRC"/*/; do
    [[ -d "$d" ]] && skills+=("$(basename "$d")")
  done
  echo "${skills[@]}"
}

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✓${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }

# ── Generic symlink helpers ───────────────────────────────────────────────────

make_symlink() {
  local src="$1" dst="$2" display="$3"
  if [[ -L "$dst" ]]; then
    rm "$dst"
  elif [[ -e "$dst" ]]; then
    warn "$display already exists (not a symlink) — skipping"
    return
  fi
  ln -s "$src" "$dst"
  ok "$display  →  ${src#$REPO_ROOT/}"
}

remove_symlink() {
  local dst="$1" display="$2"
  if [[ -L "$dst" ]]; then
    rm "$dst"
    ok "Removed $display"
  fi
}

# ── Skills ────────────────────────────────────────────────────────────────────

setup_skills() {
  echo ""
  echo "── Skills ────────────────────────────────────────────"
  local dirs=("$REPO_ROOT/.claude/skills" "$REPO_ROOT/.github/skills")
  read -ra skills <<< "$(discover_skills)"
  for dir in "${dirs[@]}"; do
    mkdir -p "$dir"
    local label="${dir#$REPO_ROOT/}"
    for skill in "${skills[@]}"; do
      local src="$SKILLS_SRC/$skill"
      [[ ! -d "$src" ]] && { warn "skills/$skill not found — skipping"; continue; }
      make_symlink "$src" "$dir/$skill" "$label/$skill"
    done
  done
}

unlink_skills() {
  local dirs=("$REPO_ROOT/.claude/skills" "$REPO_ROOT/.github/skills")
  read -ra skills <<< "$(discover_skills)"
  for dir in "${dirs[@]}"; do
    for skill in "${skills[@]}"; do
      remove_symlink "$dir/$skill" "${dir#$REPO_ROOT/}/$skill"
    done
  done
}

# ── CLAUDE.md + settings.json ─────────────────────────────────────────────────

SETTINGS_SRC="$REPO_ROOT/brain/instructions/settings.json"

setup_claude_md() {
  echo ""
  echo "── Context files ─────────────────────────────────────"
  if [[ ! -f "$CLAUDE_MD_SRC" ]]; then
    warn "brain/instructions/BRAIN-INSTRUCTION.md not found — skipping"
    return
  fi
  mkdir -p "$REPO_ROOT/.github"
  mkdir -p "$REPO_ROOT/.claude"
  # Claude Code reads CLAUDE.md from project root automatically
  make_symlink "$CLAUDE_MD_SRC" "$REPO_ROOT/CLAUDE.md" "CLAUDE.md"
  # Copilot reads from .github/copilot-instructions.md
  make_symlink "$CLAUDE_MD_SRC" "$REPO_ROOT/.github/copilot-instructions.md" ".github/copilot-instructions.md"
  # Claude Code settings (hooks, plugins) — single source of truth in brain/instructions/
  if [[ -f "$SETTINGS_SRC" ]]; then
    make_symlink "$SETTINGS_SRC" "$REPO_ROOT/.claude/settings.json" ".claude/settings.json"
  fi
}

unlink_claude_md() {
  remove_symlink "$REPO_ROOT/CLAUDE.md"                          "CLAUDE.md"
  remove_symlink "$REPO_ROOT/.github/copilot-instructions.md"    ".github/copilot-instructions.md"
  remove_symlink "$REPO_ROOT/.claude/settings.json"              ".claude/settings.json"
}

# ── Git hooks ─────────────────────────────────────────────────────────────────

HOOKS_SRC="$REPO_ROOT/scripts/hooks"

setup_hooks() {
  echo ""
  echo "── Git hooks ──────────────────────────────────────────"
  if [[ ! -d "$HOOKS_SRC" ]]; then
    warn "configuration/hooks not found — skipping"
    return
  fi
  for hook in "$HOOKS_SRC"/*; do
    [[ -f "$hook" ]] || continue
    local name
    name="$(basename "$hook")"
    local dst="$REPO_ROOT/.git/hooks/$name"
    cp "$hook" "$dst"
    chmod +x "$dst"
    ok "$name  →  .git/hooks/$name"
  done
}

unlink_hooks() {
  [[ ! -d "$HOOKS_SRC" ]] && return
  for hook in "$HOOKS_SRC"/*; do
    [[ -f "$hook" ]] || continue
    local name
    name="$(basename "$hook")"
    local dst="$REPO_ROOT/.git/hooks/$name"
    [[ -f "$dst" ]] && rm "$dst" && ok "Removed .git/hooks/$name"
  done
}

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

  [[ $found -eq 0 ]] && echo "  No requirements.txt found in any skill — skipping"
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_setup() {
  setup_skills
  setup_claude_md
  setup_hooks
  setup_python_deps

  echo ""
  ok "Done. No global directories touched."
  echo ""
  echo "  Single source of truth: brain/"
  echo ""
  echo "  CLAUDE.md                        — Claude Code (auto-read from project root)"
  echo "  .claude/settings.json            — Claude Code hooks & plugins"
  echo "  .github/copilot-instructions.md  — Copilot (auto-read)"
  echo "  .claude/skills/                  — Claude Code skills"
  echo "  .github/skills/                  — Copilot skills"
  echo ""
  echo "  To add deps for a skill: create brain/skills/<name>/requirements.txt"
  echo "  To remove symlinks:      ./setup.sh --unlink"
  echo "  Skill secrets:           copy brain/skills/<name>/config.env.example → config.env"
}

cmd_unlink() {
  unlink_skills
  unlink_claude_md
  unlink_hooks
  echo ""; ok "All symlinks removed."
}

# ── Entry point ───────────────────────────────────────────────────────────────

case "${1:-}" in
  --unlink) cmd_unlink ;;
  setup|"") cmd_setup ;;
  *)
    echo "Usage:"
    echo "  ./setup.sh          — initial project setup (symlinks + Python deps)"
    echo "  ./setup.sh --unlink — remove all symlinks"
    exit 1
    ;;
esac