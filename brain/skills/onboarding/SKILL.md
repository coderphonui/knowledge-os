---
name: onboarding
description: >
  Help a new user set up their personal Knowledge OS data folder (data/) by
  interviewing them about their work context, roles, and goals, then running
  the setup_kb.py script to scaffold the right folder structure, _index files,
  and a workspace profile note. Use this skill when the user says "set up my KB",
  "onboard me", "create my knowledge base", "setup my data folder", "setup knowledge OS",
  "tôi muốn thiết lập KB", "khởi tạo knowledge base", or any first-time setup request.
---

# Onboarding Skill

Helps new users scaffold a personalised `data/` folder in two phases:
**Interview** (understand context) → **Setup** (run script + verify).

## Phase 1 — Interview the user

Use the **`AskUserQuestion` tool**. Ask **2 questions total** — that's all. Skip any question if the info was already provided.

**`AskUserQuestion` usage rules:**
- If using the `options` field, always provide **at least 2 options** — the tool rejects fewer than 2.
- For open-ended questions, omit `options` entirely.

**Language note:** If the user answers in Vietnamese → switch to Vietnamese for Q2, set `language: vi`.

### Q1 — Name & language (ask together)

> "What should I call you? And do you prefer notes in Vietnamese, English, or a mix? (`vi` / `en` / `hybrid`)"

### Q2 — Roles

> "What best describes your work? Pick one or more:
> `engineer` · `architect` · `founder` · `pm` · `recruiter` · `researcher` · `student` · `investor` · `content`"

Use `options` with all 9 values listed. The user may pick multiple — that's fine.

After Q2, proceed directly to Phase 2 — no confirmation step needed.

---

## Phase 2 — Run setup

### Step 1: Build the profile JSON

Save as `data/_onboarding_profile.json` (delete after setup):

```json
{
  "name": "User Name",
  "roles": ["engineer", "recruiter"],
  "language": "vi"
}
```

**Role values:** `engineer` | `architect` | `founder` | `pm` | `recruiter` | `researcher` | `student` | `investor` | `content`
**Language values:** `en` | `vi` | `hybrid`

### Step 2: Dry run first

```bash
python3 skills/onboarding/scripts/setup_kb.py \
  --config data/_onboarding_profile.json \
  --dry-run
```

Show the output to the user. If it looks correct, run for real:

```bash
python3 skills/onboarding/scripts/setup_kb.py \
  --config data/_onboarding_profile.json
```

Delete the temp config:

```bash
rm data/_onboarding_profile.json
```

### Step 3: Verify and orient

1. Run `find data/ -name "_index.md" | sort` to show all created index files
2. Show the user `data/profile.md` — their workspace overview
3. Point to `data/_templates/` for creating new notes

---

## What the script creates

- Directories that don't yet exist under `data/`
- `_index.md` in each directory with appropriate description
- `data/profile.md` — workspace identity note

The script is **idempotent** — safe to re-run, never overwrites existing files.

---

## Reference files

- **[references/personas.md](references/personas.md)** — Detailed profile per role: tag conventions, key directories, special workflows. Read when user's role is unclear.
- **[references/folder-blueprints.md](references/folder-blueprints.md)** — Visual directory blueprints per persona + naming conventions. Read when explaining structure to the user.

---

## Edge cases

| Situation | How to handle |
|---|---|
| `data/` doesn't exist | Ask user to confirm path; pass `--data-dir` flag to script |
| Role not in list | Map to nearest match + add custom dirs via `extra_dirs` |
| User already has some folders | Script skips existing — safe to run |
| Adding a role later | Re-run the script — only creates missing items |
