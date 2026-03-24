---
name: competitor-analysis
description: >
Competitive intelligence skill for researching and analyzing competitors in a market or industry.
Produces structured SWOT analysis, benchmark matrices, positioning maps, and strategic insights
using proven frameworks (Porter's Five Forces, Blue Ocean, JTBD). Two-phase workflow: (1) quick
landscape overview of top competitors, (2) deep-dive analysis on selected competitors.
Saves output to the knowledge base. Use when:
- Starting a new project and need to understand the competitive landscape
  - Building a product and need to compare with specific competitors
  - Making strategic decisions on positioning, pricing, or feature priority
Triggers: "competitor analysis", "market research", "competitive landscape", "benchmark competitors",
"who is doing [X]", "landscape research", "compare competitors",
"phân tích đối thủ", "nghiên cứu thị trường".
---

# Competitor Analysis

## References

- [**frameworks.md**](references/frameworks.md) — Framework application guides (Porter's Five Forces, SWOT, Benchmark Matrix, Positioning Map, Blue Ocean, JTBD). Read before executing Phase 2.
- [**output-template.md**](references/output-template.md) — Full document template with frontmatter schema, section structure, and formatting conventions. Read before writing output.

---

## Workflow

### 0. Gather Context

Determine input type:

- **Project-based**: User provides a project slug or mentions an active project → read `data/projects/{slug}/_index.md` + `roadmap.md` to understand what's being built, target users, and current positioning hypotheses
- **Domain-based**: User provides a topic/industry name → proceed directly to Phase 1

Also search KB for prior competitor research:
```bash
brain/skills/query/.venv/bin/python brain/skills/query/scripts/search.py "competitor analysis {domain}" --top-k 3 --json
```
If prior research exists (score ≥ 0.50), surface it and ask whether to extend or redo.

---

### Phase 1: Landscape Overview

**Goal**: Identify 5–10 relevant competitors and give the user a quick map to decide who to drill down on.

**Steps:**

1. **Web search** for competitors — use multiple queries:
  - `"{domain} competitors {current_year}"`
  - `"best {domain} tools alternatives"`
  - `"top {domain} startups"`
  - `"ProductHunt {domain}"` or `"{domain} site:indiehackers.com"`

1. **Classify competitors into tiers**:
  - Tier 1: Direct (same job, same customer segment)
  - Tier 2: Adjacent (overlapping segment or job)
  - Tier 3: Indirect / substitutes

1. **Quick profile each Tier 1 competitor** (2–4 sentences):
  - What they do, who they serve, pricing model, notable differentiator

1. **Apply Porter's Five Forces** at the industry level (see frameworks.md §1)

1. **Present to user** as a structured summary — ask: *"Which competitor(s) should I deep-dive? I recommend [top 2] based on [reason]."*

---

### Phase 2: Deep Dive

**Goal**: Full competitive profile for each selected competitor.

Read [frameworks.md](references/frameworks.md) before starting this phase.

**Per competitor, collect:**

| Source type | Where to look |
| --- | --- |
| Primary product | Live site, pricing page, feature list, docs, onboarding |
| Customer voice | G2, Capterra, App Store, ProductHunt reviews, Reddit, Twitter/X |
| Business signals | Crunchbase, LinkedIn (team size, job postings), press/funding news |
| Market coverage | Industry reports, analyst posts, news mentions |

**Deliver for each competitor:**
- Overview (founding, funding, size, market)
- Product analysis (features, tech, integrations)
- Target customer + GTM motion
- Full SWOT with cited evidence
- Customer voice quotes (3+ direct quotes or paraphrases)

**After all profiles:**
- Benchmark matrix across key dimensions
- Positioning map (choose 2 most discriminating axes)
- Blue Ocean value curve interpretation (optional — include if differentiation opportunity is non-obvious)

---

### Phase 3: Synthesis & Save

1. Write **Strategic Synthesis** section:
  - What to not fight head-on
  - Where competitors are weak
  - Underserved segment or job-to-be-done
  - Recommended actions (prioritized, actionable)

1. **Determine save location**:
  - Project-based → `data/projects/{slug}/competitor-analysis.md`
  - Domain research → `data/topics/YYYY-MM-DD-competitor-analysis-{domain-slug}.md`

1. Read [output-template.md](references/output-template.md) and write the full document using the template. Always include:
  - Correct frontmatter (title, type, date_created, date_modified, tags, status)
  - All sources cited inline
  - Executive summary at the top

1. Update `date_modified` on the project's `_index.md` if project-based.

---

## Quality Standards

- Every SWOT item must have at least one cited source
- Benchmark matrix dimensions must be relevant to the specific domain (don't use generic dimensions)
- Recommended actions must be concrete and prioritized — avoid vague strategic advice
- Executive summary must state the single most important finding and its direct implication
