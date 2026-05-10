#!/usr/bin/env python3
"""
Migrate all KB notes to standardized frontmatter schema.
Run: python brain/scripts/migrate-frontmatter.py [--dry-run]
"""

import argparse
import sys
import re
from datetime import date
from pathlib import Path
from copy import deepcopy

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DATA_DIR = REPO_ROOT / "data"
SKIP_DIRS = {"_templates", "_assets"}
TODAY = date.today().isoformat()

# ── Type mapping ──────────────────────────────────────────────────────────────
# old_type → (new_type, new_subtype, extra_updates_fn or None)
TYPE_MAP = {
    "brainstorm":          ("topic",      "brainstorm", None),
    "project-roadmap":     ("project",    "roadmap",    None),
    "project-decisions":   ("project",    "decisions",  None),
    "project-note":        ("project",    "note",       None),
    "coaching-session":    ("growth",     "session",    None),
    "coaching-profile":    ("growth",     "profile",    None),
    "interview-report":    ("interview",  "report",     None),
    "research":            None,  # handled via location
}

# Types that stay the same but may need subtype set
KEEP_TYPES = {
    "topic":     "",
    "project":   None,  # resolved below based on filename
    "reference": "",
    "journal":   "",
    "meeting":   "",
    "interview": "note",
    "investment":"",
    "growth":    "",
    "index":     "",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_frontmatter(content: str) -> tuple[dict, str, str, str]:
    """Parse YAML frontmatter. Returns (fm_dict, fm_raw_text, body, error)."""
    if not content.startswith("---"):
        return {}, "", content, "no frontmatter"
    try:
        end = content.index("---", 3)
    except ValueError:
        return {}, "", content, "unclosed frontmatter"
    fm_raw = content[3:end]
    body = content[end + 3:].strip()
    try:
        import yaml
        fm = yaml.safe_load(fm_raw) or {}
    except Exception:
        # Try to recover: simple line-by-line parsing
        fm = simple_parse_fm(fm_raw)
    return fm, fm_raw, body, ""


def simple_parse_fm(fm_raw: str) -> dict:
    """Fallback parser for malformed YAML frontmatter."""
    result = {}
    current_key = None
    for line in fm_raw.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        # key: value
        m = re.match(r"^([a-zA-Z_][\w]*)\s*:\s*(.*)", stripped)
        if m:
            current_key = m.group(1)
            val = m.group(2).strip().strip('"').strip("'")
            if val == "" or val == "[]":
                val = [] if val == "[]" else ""
            result[current_key] = val
        # list item: - value
        elif stripped.startswith("- ") and current_key:
            m2 = re.match(r"^-\s+(.*)", stripped)
            if m2:
                val = m2.group(1).strip().strip('"').strip("'")
                if current_key not in result or not isinstance(result[current_key], list):
                    result[current_key] = []
                result[current_key].append(val)
    return result


def determine_type_subtype(fm: dict, rel_path: str) -> tuple[str, str]:
    """Determine new type and subtype based on current fm and file location."""
    old_type = str(fm.get("type", "")).strip()

    # Direct mapping
    if old_type in TYPE_MAP and TYPE_MAP[old_type] is not None:
        return TYPE_MAP[old_type][:2]

    # Research type: determine by location
    if old_type == "research":
        if rel_path.startswith("data/projects/"):
            return ("project", "research")
        else:
            return ("topic", "research")

    # interview-report special case (files without type in frontmatter)
    if "interview-report" in rel_path and old_type not in KEEP_TYPES:
        return ("interview", "report")

    # Keep type, set default subtype
    if old_type in KEEP_TYPES:
        default_sub = KEEP_TYPES[old_type]
        if default_sub is None:  # resolve dynamically
            default_sub = resolve_project_subtype(rel_path, fm)
        return (old_type, default_sub)

    # Unknown type: infer from location
    if rel_path.startswith("data/topics/"):
        return ("topic", "")
    elif rel_path.startswith("data/projects/"):
        return ("project", "")
    elif rel_path.startswith("data/references/"):
        return ("reference", "")
    elif rel_path.startswith("data/journal/"):
        return ("journal", "")
    elif rel_path.startswith("data/interviews/"):
        return ("interview", "report" if "report" in rel_path else "note")
    elif rel_path.startswith("data/growth/"):
        return ("growth", "")
    elif rel_path.startswith("data/meetings/"):
        return ("meeting", "")

    return (old_type or "topic", "")


def resolve_project_subtype(rel_path: str, fm: dict) -> str:
    """Determine subtype for project files based on filename."""
    fname = Path(rel_path).name
    if fname == "_index.md":
        return "overview"
    name_map = {
        "decisions.md": "decisions",
        "roadmap.md": "roadmap",
    }
    if fname in name_map:
        return name_map[fname]
    # Check if content looks like research
    old_type = str(fm.get("type", ""))
    if old_type == "research":
        return "research"
    return "note"


def extract_project_slug(rel_path: str) -> str:
    """Extract project slug from file path. Returns '' for root-level files."""
    if rel_path.startswith("data/projects/"):
        remainder = rel_path[len("data/projects/"):]
        # Root files like _index.md → no slug
        if "/" not in remainder:
            return ""
        # Extract first path component as slug
        slug = remainder.split("/")[0]
        return slug
    return ""


def clean_tags(tags) -> list:
    """Remove type/* and status/* from tags (now in dedicated fields)."""
    if not tags or not isinstance(tags, list):
        return []
    cleaned = []
    for t in tags:
        t_str = str(t).strip().strip('"').strip("'")
        if not t_str.startswith("type/") and not t_str.startswith("status/"):
            cleaned.append(t_str)
    return cleaned


def normalize_related(related, fm: dict) -> list:
    """Normalize related links to consistent format."""
    if not related:
        return []
    if isinstance(related, list):
        return [str(r).strip().strip('"').strip("'") for r in related if r]
    return []


def serialize_fm(fm: dict) -> str:
    """Serialize frontmatter dict to YAML string."""
    lines = ["---"]
    # Define field order for readability
    field_order = [
        "title", "type", "date_created", "date_modified",
        "aliases", "subtype",
        # type-specific fields
        "project_slug", "tech_stack", "links",
        "source", "author", "source_type", "date_published", "layer", "ai_assisted",
        "period", "work_context", "energy_level", "mood",
        "meeting_date", "meeting_time", "company", "attendees", "action_items_count",
        "interview_date", "interview_time", "role", "candidate_name",
        "candidate_level", "result", "recommendation", "organizer", "location",
        "ticker", "market", "position", "entry_price", "current_thesis", "risk_level",
        "session_type", "frameworks_used",
        "problem", "outcome",
        "tags", "status", "related",
    ]

    ordered_keys = [k for k in field_order if k in fm]
    remaining = [k for k in fm if k not in ordered_keys]
    all_keys = ordered_keys + remaining

    def format_val(v, indent=0):
        prefix = " " * indent
        if isinstance(v, list):
            if not v:
                return "[]"
            items = []
            for item in v:
                if isinstance(item, dict):
                    items.append(f"{prefix}  - " + format_val(item, indent + 4).lstrip())
                else:
                    items.append(f'{prefix}  - {item}')
            return "\n" + "\n".join(items)
        elif isinstance(v, dict):
            if not v:
                return "{}"
            items = []
            for dk, dv in v.items():
                items.append(f"{prefix}  {dk}: {dv}")
            return "\n" + "\n".join(items)
        elif isinstance(v, bool):
            return str(v).lower()
        elif isinstance(v, (int, float)):
            return str(v)
        elif v is None:
            return "null"
        else:
            # Check if string needs quoting
            s = str(v)
            if s == "" or any(c in s for c in ['"', "'", ":", "#", "{", "}", "[", "]", ",", "&", "*", "?", "|", "-", "<", ">", "=", "!", "%", "@", "`"]):
                return f'"{s}"'
            return s

    for key in all_keys:
        val = fm[key]
        if val is None or val == "" or val == []:
            if key in {"aliases", "related", "tags"}:
                lines.append(f"{key}: []")
            elif isinstance(val, str) and val == "":
                lines.append(f'{key}: ""')
            else:
                lines.append(f"{key}: {format_val(val)}")
        else:
            lines.append(f"{key}: {format_val(val)}")

    lines.append("---")
    return "\n".join(lines) + "\n"


def migrate_file(filepath: Path, dry_run: bool = False) -> str:
    """Migrate a single file. Returns status message."""
    rel_path = str(filepath.relative_to(REPO_ROOT))
    content = filepath.read_text(encoding="utf-8")

    fm, fm_raw, body, error = parse_frontmatter(content)
    if error and error != "no frontmatter":
        return f"  ⚠ SKIP {rel_path} — {error}"

    if not fm:
        return f"  ⚠ SKIP {rel_path} — no frontmatter"

    # Determine new type/subtype
    new_type, new_subtype = determine_type_subtype(fm, rel_path)

    changes = []
    new_fm = deepcopy(fm)

    # 1. Update type
    old_type = str(new_fm.get("type", ""))
    if old_type != new_type:
        changes.append(f"type: {old_type} → {new_type}")
    new_fm["type"] = new_type

    # 2. Add/update subtype (only if there's a meaningful subtype)
    old_subtype = str(new_fm.get("subtype", ""))
    if new_subtype and new_subtype != old_subtype:
        changes.append(f"subtype: '{old_subtype}' → '{new_subtype}'")
    if new_subtype:
        new_fm["subtype"] = new_subtype
    elif "subtype" in new_fm:
        del new_fm["subtype"]

    # 3. Add project_slug for project files
    slug = extract_project_slug(rel_path)
    if slug:
        old_slug = str(new_fm.get("project_slug", ""))
        if slug != old_slug:
            changes.append(f"project_slug: '{old_slug}' → '{slug}'")
        new_fm["project_slug"] = slug

    # 4. Clean tags — remove type/* and status/*
    old_tags = new_fm.get("tags", [])
    new_tags = clean_tags(old_tags)
    if isinstance(old_tags, list) and old_tags != new_tags:
        removed = set(str(t) for t in old_tags) - set(str(t) for t in new_tags)
        if removed:
            changes.append(f"tags cleaned: removed {removed}")
    new_fm["tags"] = new_tags

    # 5. Add aliases if missing
    if "aliases" not in new_fm:
        new_fm["aliases"] = []
        changes.append("+aliases: []")

    # 6. Update date_modified
    old_dm = str(new_fm.get("date_modified", ""))
    if old_dm != TODAY:
        changes.append(f"date_modified: {old_dm} → {TODAY}")
    new_fm["date_modified"] = TODAY

    # 7. Ensure date_created exists
    if "date_created" not in new_fm or not new_fm["date_created"]:
        # Try to infer from filename
        m = re.match(r"^(\d{4}-\d{2}-\d{2})", filepath.stem)
        if m:
            new_fm["date_created"] = m.group(1)
            changes.append(f"+date_created from filename: {m.group(1)}")
        else:
            new_fm["date_created"] = TODAY
            changes.append(f"+date_created: {TODAY}")

    # 8. Normalize related
    if "related" in new_fm:
        old_related = new_fm["related"]
        new_related = normalize_related(old_related, new_fm)
        if old_related != new_related:
            new_fm["related"] = new_related

    # 9. Remove deprecated fields from old schema
    deprecated_fields = {"interview_subject", "organizer_email", "duration_minutes"}
    for df in deprecated_fields:
        if df in new_fm:
            del new_fm[df]
            changes.append(f"-{df} (deprecated)")

    # 10. Rename interview_subject → role if present
    if "interview_subject" in new_fm:
        new_fm["role"] = new_fm.pop("interview_subject")

    # ── Serialize and write ──
    new_frontmatter = serialize_fm(new_fm)

    if not changes:
        return f"  ✓ no changes  {rel_path}"

    new_content = new_frontmatter + "\n" + body + "\n"

    if dry_run:
        detail = ", ".join(changes[:3])
        if len(changes) > 3:
            detail += f" (+{len(changes)-3} more)"
        return f"  ◌ [DRY-RUN] {detail}  {rel_path}"

    filepath.write_text(new_content, encoding="utf-8")
    detail = ", ".join(changes[:3])
    if len(changes) > 3:
        detail += f" (+{len(changes)-3} more)"
    return f"  ✓ {detail}  {rel_path}"


def main():
    parser = argparse.ArgumentParser(description="Migrate KB frontmatter to new schema")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    md_files = sorted([
        f for f in DATA_DIR.rglob("*.md")
        if not any(skip in f.parts for skip in SKIP_DIRS)
    ])

    print(f"Found {len(md_files)} files to migrate")
    if args.dry_run:
        print("[DRY RUN MODE — no files will be modified]\n")
    else:
        print()

    changed = 0
    skipped = 0
    for f in md_files:
        result = migrate_file(f, dry_run=args.dry_run)
        if "SKIP" in result:
            skipped += 1
        elif "no changes" not in result:
            changed += 1
        print(result)

    print(f"\nDone. {changed} changed, {skipped} skipped, {len(md_files)} total.")


if __name__ == "__main__":
    main()
