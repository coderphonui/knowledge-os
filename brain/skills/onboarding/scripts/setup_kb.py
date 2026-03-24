#!/usr/bin/env python3
"""
setup_kb.py — Knowledge OS onboarding setup script.

Usage:
  python3 setup_kb.py --config profile.json [--data-dir path/to/data] [--dry-run]
  python3 setup_kb.py --interactive [--data-dir path/to/data] [--dry-run]

The script:
  1. Reads a user profile (JSON config or interactive prompts)
  2. Creates the required folder structure under data/
  3. Creates _index.md files for each directory (skips existing)
  4. Creates a data/profile.md with the user's workspace profile
  5. Prints a summary of what was created / skipped
"""

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

TODAY = date.today().isoformat()

# ---------------------------------------------------------------------------
# Folder blueprints per main role
# ---------------------------------------------------------------------------

# fmt: off
BLUEPRINT_SHARED = [
    "journal",
    "meetings",
    "topics",
    "references",
    "_templates",
]

BLUEPRINT_EXTRA = {
    "engineer":      ["projects", "topics"],
    "architect":     ["projects", "topics"],
    "founder":       ["projects", "topics", "investments"],
    "pm":            ["projects", "meetings"],
    "recruiter":     ["interviews", "interviews/interview-report"],
    "researcher":    ["topics", "references"],
    "student":       ["topics", "references"],
    "investor":      ["investments", "topics"],
    "content":       ["topics", "projects", "references"],
}

# _index.md bodies per directory (localisable)
INDEX_BODIES: dict[str, dict[str, str]] = {
    "journal": {
        "en": "Daily and weekly reflections. Format: `YYYY-MM-DD.md` or `week-YYYY-WNN.md`.",
        "vi": "Nhật ký hàng ngày và hàng tuần. Định dạng: `YYYY-MM-DD.md` hoặc `week-YYYY-WNN.md`.",
    },
    "meetings": {
        "en": "Meeting notes. Format: `YYYY-MM-DD-meeting-name.md`.",
        "vi": "Ghi chú meeting. Định dạng: `YYYY-MM-DD-ten-meeting.md`.",
    },
    "topics": {
        "en": "Evergreen notes — concepts, mental models, persistent learnings.",
        "vi": "Ghi chú thường xanh — khái niệm, mental model, kiến thức tích luỹ.",
    },
    "references": {
        "en": "Saved external sources: articles, papers, videos, websites.",
        "vi": "Lưu nguồn bên ngoài: bài viết, paper, video, website.",
    },
    "projects": {
        "en": "One subfolder per project: `_index.md`, `decisions.md`, `roadmap.md`.",
        "vi": "Mỗi dự án một subfolder: `_index.md`, `decisions.md`, `roadmap.md`.",
    },
    "interviews": {
        "en": "Interview notes per candidate. Format: `YYYY-MM-DD-candidate-name.md`.",
        "vi": "Ghi chú phỏng vấn từng candidate. Định dạng: `YYYY-MM-DD-ten-candidate.md`.",
    },
    "interviews/interview-report": {
        "en": "Structured interview reports generated after each interview session.",
        "vi": "Báo cáo phỏng vấn chi tiết sau mỗi buổi phỏng vấn.",
    },
    "investments": {
        "en": "Investment tracking notes per ticker or asset. Format: `TICKER.md`.",
        "vi": "Ghi chú theo dõi đầu tư theo mã chứng khoán hoặc tài sản.",
    },
    "growth": {
        "en": "Personal development: habits, goals, retrospectives.",
        "vi": "Phát triển cá nhân: thói quen, mục tiêu, nhìn lại bản thân.",
    },
}
# fmt: on

# ---------------------------------------------------------------------------
# Template helpers
# ---------------------------------------------------------------------------

def index_frontmatter(title: str, directory: str, lang: str) -> str:
    body = INDEX_BODIES.get(directory, {}).get(lang, INDEX_BODIES.get(directory, {}).get("en", ""))
    return f"""---
title: "{title}"
type: index
date_created: {TODAY}
date_modified: {TODAY}
tags:
  - type/index
status: active
---

# {title}

{body}
"""


def profile_note(profile: dict) -> str:
    name = profile.get("name", "User")
    lang = profile.get("language", "en")
    roles = ", ".join(profile.get("roles", []))
    areas = ", ".join(profile.get("areas", []))
    contexts = ", ".join(profile.get("work_contexts", []))
    lang_label = "Tiếng Việt / English" if lang == "hybrid" else ("Tiếng Việt" if lang == "vi" else "English")

    # Optional enriched fields
    position = profile.get("position", "")
    background = profile.get("background", "")
    expertise = ", ".join(profile.get("expertise", [])) if profile.get("expertise") else ""
    goals_short = profile.get("goals_short_term", "")
    goals_long = profile.get("goals_long_term", "")
    help_focus = profile.get("help_focus", "")
    response_style = profile.get("response_style", "concise")

    def optional_line(label: str, value: str) -> str:
        return f"- **{label}:** {value}\n" if value else ""

    if lang == "vi":
        style_label = "ngắn gọn, đi thẳng vào vấn đề" if response_style == "concise" else "chi tiết, giải thích kỹ"
        identity_block = (
            f"- **Tên:** {name}\n"
            + optional_line("Vị trí hiện tại", position)
            + f"- **Vai trò:** {roles}\n"
            + f"- **Ngôn ngữ ghi chú:** {lang_label}\n"
        )
        background_block = (
            optional_line("Nền tảng", background)
            + optional_line("Chuyên môn", expertise)
        )
        goals_block = (
            optional_line("Ngắn hạn (1-3 tháng)", goals_short)
            + optional_line("Dài hạn", goals_long)
        )
        prefs_block = (
            f"- **Lĩnh vực theo dõi:** {areas}\n"
            + f"- **Bối cảnh làm việc:** {contexts}\n"
            + optional_line("Cần trợ giúp nhiều nhất", help_focus)
            + f"- **Phong cách trả lời ưa thích:** {style_label}\n"
        )
        return f"""---
title: "Hồ sơ cá nhân"
type: profile
date_created: {TODAY}
date_modified: {TODAY}
tags:
  - type/profile
  - status/active
status: active
---

# Hồ sơ cá nhân

## Thông tin cá nhân

{identity_block}
## Nền tảng chuyên môn

{background_block if background_block.strip() else "_(chưa điền)_\n"}
## Mục tiêu

{goals_block if goals_block.strip() else "_(chưa điền)_\n"}
## Sở thích & Ưu tiên

{prefs_block}
## Hướng dẫn nhanh

| Loại ghi chú | Thư mục | Mẫu |
|---|---|---|
| Nhật ký | `journal/` | `_templates/journal.md` |
| Meeting | `meetings/` | `_templates/meeting.md` |
| Chủ đề | `topics/` | `_templates/topic.md` |
| Tài liệu tham khảo | `references/` | `_templates/reference.md` |
| Dự án | `projects/{{slug}}/` | `_templates/project.md` |
"""
    else:
        style_label = "concise and direct" if response_style == "concise" else "detailed with thorough explanations"
        identity_block = (
            f"- **Name:** {name}\n"
            + optional_line("Current position", position)
            + f"- **Roles:** {roles}\n"
            + f"- **Note language:** {lang_label}\n"
        )
        background_block = (
            optional_line("Background", background)
            + optional_line("Expertise", expertise)
        )
        goals_block = (
            optional_line("Short-term (1–3 months)", goals_short)
            + optional_line("Long-term", goals_long)
        )
        prefs_block = (
            f"- **Areas of interest:** {areas}\n"
            + f"- **Work contexts:** {contexts}\n"
            + optional_line("Help focus", help_focus)
            + f"- **Preferred response style:** {style_label}\n"
        )
        return f"""---
title: "Personal Profile"
type: profile
date_created: {TODAY}
date_modified: {TODAY}
tags:
  - type/profile
  - status/active
status: active
---

# Personal Profile

## Identity

{identity_block}
## Professional Background

{background_block if background_block.strip() else "_(not filled)_\n"}
## Goals

{goals_block if goals_block.strip() else "_(not filled)_\n"}
## Preferences

{prefs_block}
## Quick Reference

| Note type | Folder | Template |
|---|---|---|
| Journal | `journal/` | `_templates/journal.md` |
| Meetings | `meetings/` | `_templates/meeting.md` |
| Topics | `topics/` | `_templates/topic.md` |
| References | `references/` | `_templates/reference.md` |
| Projects | `projects/{{slug}}/` | `_templates/project.md` |
"""


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def compute_directories(profile: dict) -> list[str]:
    dirs = list(BLUEPRINT_SHARED)
    for role in profile.get("roles", []):
        for extra in BLUEPRINT_EXTRA.get(role, []):
            if extra not in dirs:
                dirs.append(extra)
    for extra_dir in profile.get("extra_dirs", []):
        if extra_dir not in dirs:
            dirs.append(extra_dir)
    if profile.get("track_growth", False) and "growth" not in dirs:
        dirs.append("growth")
    return dirs


def dir_title(directory: str, lang: str) -> str:
    titles_vi = {
        "journal": "Nhật ký",
        "meetings": "Meetings",
        "topics": "Chủ đề",
        "references": "Tài liệu tham khảo",
        "projects": "Dự án",
        "interviews": "Phỏng vấn",
        "interviews/interview-report": "Báo cáo phỏng vấn",
        "investments": "Đầu tư",
        "growth": "Phát triển cá nhân",
        "_templates": "Templates",
    }
    titles_en = {
        "journal": "Journal",
        "meetings": "Meetings",
        "topics": "Topics",
        "references": "References",
        "projects": "Projects",
        "interviews": "Interviews",
        "interviews/interview-report": "Interview Reports",
        "investments": "Investments",
        "growth": "Growth",
        "_templates": "Templates",
    }
    mapping = titles_vi if lang == "vi" else titles_en
    return mapping.get(directory, directory.replace("/", " / ").title())


def setup_kb(profile: dict, data_dir: Path, dry_run: bool = False) -> None:
    lang = profile.get("language", "en")
    dirs = compute_directories(profile)

    created_dirs = []
    created_files = []
    skipped_files = []

    for rel_dir in dirs:
        full_dir = data_dir / rel_dir
        if not full_dir.exists():
            if not dry_run:
                full_dir.mkdir(parents=True, exist_ok=True)
            created_dirs.append(str(rel_dir))

        index_path = full_dir / "_index.md"
        if index_path.exists():
            skipped_files.append(str(index_path.relative_to(data_dir.parent)))
        else:
            title = dir_title(rel_dir, lang)
            content = index_frontmatter(title, rel_dir, lang)
            if not dry_run:
                index_path.write_text(content, encoding="utf-8")
            created_files.append(str(index_path.relative_to(data_dir.parent)))

    # Write profile note — always overwrite so re-running onboarding updates the profile
    profile_path = data_dir / "profile.md"
    content = profile_note(profile)
    if not dry_run:
        profile_path.write_text(content, encoding="utf-8")
    action = "updated" if profile_path.exists() else "created"
    created_files.append(f"{profile_path.relative_to(data_dir.parent)} ({action})")

    # Print summary
    prefix = "[DRY RUN] " if dry_run else ""

    if created_dirs:
        print(f"\n{prefix}📁 Directories created:")
        for d in created_dirs:
            print(f"   + data/{d}/")

    if created_files:
        print(f"\n{prefix}📝 Files created:")
        for f in created_files:
            print(f"   + {f}")

    if skipped_files:
        print(f"\n{prefix}⏭  Skipped (already exist):")
        for f in skipped_files:
            print(f"   = {f}")

    if not created_dirs and not created_files:
        print(f"\n{prefix}✅ All directories and index files already exist — nothing to do.")
    else:
        print(f"\n{prefix}✅ Setup complete.")


# ---------------------------------------------------------------------------
# Interactive profile builder
# ---------------------------------------------------------------------------

ROLE_CHOICES = list(BLUEPRINT_EXTRA.keys())
AREA_SUGGESTIONS = [
    "engineering", "architecture", "product", "recruitment",
    "investments", "learning", "writing", "design", "marketing",
    "leadership", "research", "health", "side-projects",
]
CONTEXT_CHOICES = ["morning-work", "afternoon-work", "studies", "personal", "freelance"]


def ask(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    val = input(f"{prompt}{suffix}: ").strip()
    return val if val else default


def ask_list(prompt: str, suggestions: list[str]) -> list[str]:
    print(f"{prompt}")
    print(f"  Suggestions: {', '.join(suggestions)}")
    raw = input("  Your answer (comma-separated): ").strip()
    if not raw:
        return []
    return [x.strip().lower() for x in raw.split(",") if x.strip()]


def build_profile_interactive() -> dict:
    print("\n╔══════════════════════════════════════════════════════╗")
    print("║       Knowledge OS — Onboarding Setup Wizard         ║")
    print("╚══════════════════════════════════════════════════════╝\n")

    name = ask("Your name", "User")

    print(f"\nAvailable roles: {', '.join(ROLE_CHOICES)}")
    roles_raw = input("Your roles (comma-separated, e.g. engineer,recruiter): ").strip()
    roles = [r.strip().lower() for r in roles_raw.split(",") if r.strip() in ROLE_CHOICES] if roles_raw else []

    lang_raw = ask("Note language [en / vi / hybrid]", "en")
    lang = lang_raw if lang_raw in ("en", "vi", "hybrid") else "en"

    areas = ask_list("\nAreas of interest:", AREA_SUGGESTIONS)
    contexts = ask_list("\nWork contexts:", CONTEXT_CHOICES)

    track_growth_raw = ask("\nTrack personal growth? (y/n)", "n")
    track_growth = track_growth_raw.lower().startswith("y")

    extra_dirs_raw = input(
        "\nCustom extra folders (comma-separated, leave blank to skip): "
    ).strip()
    extra_dirs = [d.strip().lower() for d in extra_dirs_raw.split(",") if d.strip()] if extra_dirs_raw else []

    return {
        "name": name,
        "roles": roles,
        "language": lang,
        "areas": areas,
        "work_contexts": contexts,
        "track_growth": track_growth,
        "extra_dirs": extra_dirs,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Set up a Knowledge OS data folder for a new user.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive wizard
  python3 setup_kb.py --interactive

  # From JSON config (dry run first)
  python3 setup_kb.py --config profile.json --dry-run
  python3 setup_kb.py --config profile.json

  # Custom data directory
  python3 setup_kb.py --interactive --data-dir /path/to/my/data
""",
    )
    parser.add_argument("--config", metavar="FILE", help="Path to JSON profile config file")
    parser.add_argument("--interactive", action="store_true", help="Run interactive wizard")
    parser.add_argument(
        "--data-dir",
        metavar="DIR",
        default=None,
        help="Path to the data/ directory (default: auto-detect from script location)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created without writing files")
    args = parser.parse_args()

    if not args.config and not args.interactive:
        parser.print_help()
        sys.exit(1)

    # Resolve data directory
    if args.data_dir:
        data_dir = Path(args.data_dir).expanduser().resolve()
    elif os.environ.get("KB_ROOT"):
        data_dir = Path(os.environ["KB_ROOT"]) / "data"
    else:
        def _find_repo_root() -> Path:
            for p in Path(__file__).resolve().parents:
                if (p / ".git").exists() or (p / "CLAUDE.md").exists():
                    return p
            return Path(__file__).resolve().parent.parent.parent.parent  # structural fallback
        data_dir = _find_repo_root() / "data"

    if not data_dir.exists():
        print(f"Error: data directory not found: {data_dir}", file=sys.stderr)
        print("Pass --data-dir to specify the correct path.", file=sys.stderr)
        sys.exit(1)

    # Load profile
    if args.config:
        config_path = Path(args.config).expanduser().resolve()
        if not config_path.exists():
            print(f"Error: config file not found: {config_path}", file=sys.stderr)
            sys.exit(1)
        with open(config_path, encoding="utf-8") as f:
            profile = json.load(f)
    else:
        profile = build_profile_interactive()

    print(f"\nData directory: {data_dir}")
    if args.dry_run:
        print("Mode: DRY RUN (no files will be written)")

    setup_kb(profile, data_dir, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
