---
name: onboarding
description: >
  Help a new user set up their personal Knowledge OS data folder (data/) by
  interviewing them about their work context, roles, and goals, then using AI
  to generate a personalized folder structure and profile. Use this skill when
  the user says "set up my KB", "onboard me", "create my knowledge base",
  "setup my data folder", "setup knowledge OS", "tôi muốn thiết lập KB",
  "khởi tạo knowledge base", or any first-time setup request.
---

# Onboarding Skill

Helps new users scaffold a personalised `data/` folder in two phases:
**Interview** (understand context) → **AI Synthesis + Setup** (generate structure, run script).

---

## Phase 1 — Interview the user

Ask **4 questions total**, one at a time. Skip any question where the answer is already known.

**Language note:** If the user answers in Vietnamese → switch to Vietnamese for remaining questions, set `language: vi`.

### Q1 — Name & language

> "What should I call you? And do you prefer notes in Vietnamese, English, or a mix? (`vi` / `en` / `hybrid`)"

### Q2 — Roles

> "What best describes your work? Pick one or more:
> `engineer` · `architect` · `founder` · `pm` · `recruiter` · `researcher` · `student` · `investor` · `content`
>
> (Or describe in your own words if none fit.)"

### Q3 — Daily work & KB goals (open-ended)

> "Tell me a bit about your daily work and what you want this Knowledge OS to help you do.
> For example: *"I manage 2 products and do weekly 1:1s, I want the KB to help me track decisions and meeting notes"* or *"I'm learning ML and want to organize course notes and research papers."*"

Wait for a free-text answer — this is the most important question for personalisation.

### Q4 — Custom areas (optional)

> "Are there any specific areas you want to track that we haven't covered?
> For example: investments, health, language learning, side projects, reading list...
> (Skip if nothing comes to mind.)"

After Q4, proceed directly to Phase 2 — no confirmation step needed.

---

## Phase 2 — AI Synthesis + Setup

### Step 1: Synthesize a rich profile from the interview

Read `brain/skills/onboarding/references/personas.md` and `brain/skills/onboarding/references/folder-blueprints.md`, then synthesize the user's answers into a JSON profile.

Use the Q3 answer to infer:
- `position` — job title or current role description
- `background` — what they already know / where they come from
- `goals_short_term` — what they want to achieve in the next 1-3 months
- `help_focus` — what they want the AI to help them most with
- `response_style` — `concise` (default) or `detailed`
- `extra_dirs` — any folders beyond the standard blueprint (from Q3 and Q4 answers)

**Examples of extra_dirs to add based on Q3/Q4 context:**
- Mentions health/fitness → add `health`
- Mentions language learning → add `learning`
- Mentions reading/books → add `reading` (under references or standalone)
- Mentions side projects beyond main work → add `side-projects`
- Mentions hiring and PM combined → add both `interviews/` and `meetings/` even if not in base blueprint

### Step 2: Build the profile JSON

Save as `data/_onboarding_profile.json` (deleted automatically after setup):

```json
{
  "name": "User Name",
  "roles": ["engineer", "recruiter"],
  "language": "vi",
  "position": "Head of Engineering tại Công ty XYZ",
  "background": "10 năm kinh nghiệm backend, đang học ML",
  "expertise": ["python", "system-design", "hiring"],
  "goals_short_term": "Tổ chức ghi chú phỏng vấn và quyết định kỹ thuật",
  "goals_long_term": "Xây dựng một second brain cho sự nghiệp",
  "help_focus": "Tổng hợp thông tin và đưa ra đề xuất có căn cứ",
  "response_style": "concise",
  "extra_dirs": ["side-projects", "health"]
}
```

**Required fields:** `name`, `roles`, `language`
**Optional enrichment:** `position`, `background`, `expertise`, `goals_short_term`, `goals_long_term`, `help_focus`, `response_style`, `extra_dirs`

**Role values:** `engineer` | `architect` | `founder` | `pm` | `recruiter` | `researcher` | `student` | `investor` | `content`
**Language values:** `en` | `vi` | `hybrid`

### Step 3: Dry run — show the user what will be created

```bash
python3 brain/skills/onboarding/scripts/setup_kb.py \
  --config data/_onboarding_profile.json \
  --dry-run
```

Show the output to the user with a brief explanation of what each folder is for. If it looks correct, run for real:

```bash
python3 brain/skills/onboarding/scripts/setup_kb.py \
  --config data/_onboarding_profile.json
```

Then delete the temp config:

```bash
rm data/_onboarding_profile.json
```

### Step 4: Verify and orient

1. Run `find data/ -name "_index.md" | sort` to show all created index files
2. Show the user `data/profile.md` — their workspace overview
3. Tell the user which 2-3 skills are most relevant to their roles:
   - `recruiter` → `/interview-prep`, `/interview-report`
   - `engineer` / `architect` → `/brainstorm`, `/learn`
   - `founder` → `/startup-idea-stress-test`, `/weekly-review`, `/brainstorm`
   - `pm` → `/pm-feature`, `/pm-review`, `/pm-roadmap`
   - `researcher` / `student` → `/learn`, `/capture-reference`
   - `investor` → `/stock-analysis`
   - All → `/capture-reference`, `/weekly-review`
4. Point to `data/_templates/` for creating new notes manually

---

## What the script creates

- Directories that don't yet exist under `data/`
- `_index.md` in each directory with appropriate description
- `data/profile.md` — workspace identity note (always written/updated)

The script is **idempotent** — safe to re-run, never overwrites existing files (except `profile.md`).

---

## Reference files

- **[references/personas.md](references/personas.md)** — Detailed profile per role: tag conventions, key directories, special workflows.
- **[references/folder-blueprints.md](references/folder-blueprints.md)** — Visual directory blueprints per persona + naming conventions.

---

## Edge cases

| Situation | How to handle |
|---|---|
| `data/` doesn't exist | Ask user to confirm path; pass `--data-dir` flag to script |
| Role not in list | Map to nearest match + add custom dirs via `extra_dirs` |
| User already has some folders | Script skips existing — safe to run |
| User mentions a niche area (e.g., "I track crypto") | Add appropriate extra_dir (e.g., `crypto`) |
| Adding a role later | Re-run `/onboarding` — script only creates missing items |
| User re-runs onboarding | `profile.md` is updated; existing note folders are untouched |
