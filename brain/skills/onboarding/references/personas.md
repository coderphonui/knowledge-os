# Personas Reference

Use this file to understand each role archetype — what they care about, how they work, and how to configure their KB setup.

---

## engineer
**Profile:** Software engineer or backend/frontend developer.
**Focus:** Projects, technical notes, architecture decisions, learning new tech.
**Key directories:** `projects/`, `topics/`, `journal/`, `references/`
**Good questions to ask:**
- Do you track side projects separately?
- Do you do system design / architecture decisions?
- Do you need to log team meetings?

**Tag suggestions:** `tech/`, `area/engineering`, `area/architecture`, `concept/`

---

## architect
**Profile:** Software architect or principal engineer. Designs systems, guides tech decisions, cross-team.
**Focus:** Architecture ADRs, system design, project tech stacks, team alignment.
**Key directories:** `projects/`, `topics/`, `meetings/`, `references/`
**Extra sub-notes:** `projects/{slug}/decisions.md` is critical for ADR logging.

**Tag suggestions:** `tech/`, `area/architecture`, `area/engineering`, `concept/tradeoff`, `concept/trade-off`

---

## founder
**Profile:** Startup founder or indie maker. Manages product, engineering, business, and investors.
**Focus:** Projects, strategy, investments/financials, growth, team.
**Key directories:** `projects/`, `topics/`, `investments/`, `journal/`, `meetings/`
**Unique needs:** Weekly reviews are especially valuable. Track company KPIs as investment notes.

**Tag suggestions:** `area/product`, `area/strategy`, `area/business`, `project/`

---

## pm
**Profile:** Product manager or product owner.
**Focus:** Feature discovery, stakeholder meetings, roadmaps, user research.
**Key directories:** `projects/`, `meetings/`, `topics/`, `references/`
**Unique needs:** Meeting notes link to project roadmaps. OKR tracking in `topics/`.

**Tag suggestions:** `area/product`, `area/ux`, `area/discovery`, `area/roadmap`

---

## recruiter
**Profile:** Recruiter, HR, or hiring manager. Runs interview pipelines.
**Focus:** Candidate notes, interview reports, hiring criteria, pipeline health.
**Key directories:** `interviews/`, `interviews/interview-report/`, `meetings/`, `topics/`
**Unique needs:** Filename format `YYYY-MM-DD-candidate-name.md`. Reports in `interview-report/`.

**Tag suggestions:** `area/recruitment`, `area/hiring`, `company/`

---

## researcher
**Profile:** Academic researcher, data scientist, or analyst.
**Focus:** Literature review, experiment logs, datasets, papers.
**Key directories:** `topics/`, `references/`, `journal/`, `projects/`
**Unique needs:** Heavy reference use. `references/` should track sources with proper citation fields.

**Tag suggestions:** `area/research`, `tech/`, `concept/`, `status/evergreen`

---

## student
**Profile:** University student, bootcamp learner, or self-taught developer.
**Focus:** Course notes, study summaries, problem sets, learning paths.
**Key directories:** `topics/`, `references/`, `journal/`, `projects/`
**Unique needs:** `topics/` as primary dump for learnings. Tag by subject area.
          Weekly review connects study effort to outcomes.

**Tag suggestions:** `area/learning`, `tech/`, `concept/`, `status/seedling`

---

## investor
**Profile:** Stock market investor, angel investor, or crypto trader.
**Focus:** Ticker analysis, portfolio tracking, macro trends, entry/exit logs.
**Key directories:** `investments/`, `topics/`, `journal/`
**File naming:** `investments/{TICKER}.md` (e.g., `VNM.md`, `MSFT.md`)
**Unique needs:** `investments/_index.md` as portfolio dashboard. Journal tracks trading decisions.

**Tag suggestions:** `area/investing`, `area/macro`, `type/investment`

---

## content
**Profile:** Writer, blogger, content marketer, or creator.
**Focus:** Article ideas, drafts, editorial calendar, research notes.
**Key directories:** `topics/`, `projects/`, `references/`, `journal/`
**Unique needs:** `projects/` for content series or campaigns. `topics/` for idea seedbed.

**Tag suggestions:** `area/writing`, `area/content`, `area/marketing`, `status/draft`

---

## Multi-role combinations

Common combinations and how to handle them:

| Combination | Primary role | Secondary extras |
|---|---|---|
| engineer + recruiter | engineer | Add `interviews/`, `interviews/interview-report/` |
| founder + investor | founder | Investments already included in founder blueprint |
| pm + researcher | pm | Add heavy `references/` usage |
| student + content | student | Add `projects/` for content projects |
| architect + founder | architect | Add `investments/` for business tracking |
