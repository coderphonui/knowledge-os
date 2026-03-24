# Competitor Analysis Output Template

## File Naming

- Project-based: `data/projects/{slug}/competitor-analysis.md`
- Domain research: `data/topics/YYYY-MM-DD-competitor-analysis-{domain-slug}.md`

---

## Frontmatter

```yaml
---
title: "Competitor Analysis: {Domain or Project Name}"
type: research
date_created: YYYY-MM-DD
date_modified: YYYY-MM-DD
tags:
  - type/research
  - area/{domain}
  - project/{slug}           # if project-based
  - status/active
status: active
---
```

---

## Document Structure

```markdown
# Competitor Analysis: {Title}

## Executive Summary

> 3–5 sentences: Who are the key players, what's the competitive dynamic, and what's the strategic opportunity.

**Key finding**: [Single most important insight]
**Strategic implication for us**: [Direct action implication]

---

## Industry Landscape

### Market Overview
- Market size / growth rate (cite source)
- Primary customer segments
- Key buying triggers

### Porter's Five Forces
[Apply framework — see frameworks.md §1]

---

## Competitors Identified

### Tier 1 — Direct Competitors (same job, same segment)
| Name | Description | Est. Size | Stage |
|------|-------------|-----------|-------|
| ... | ... | ... | ... |

### Tier 2 — Adjacent Competitors (overlapping segment or job)
| Name | Description | Overlap |
|------|-------------|---------|
| ... | ... | ... |

### Tier 3 — Indirect / Substitutes
- [List with 1-line description each]

---

## Deep Dive: {Competitor Name}

> Repeat this section for each Tier 1 competitor

### Overview
- **Website**:
- **Founded**:
- **Funding**:
- **Team size**:
- **Primary market**:
- **Pricing model**:

### Product Analysis
[Key features, technical differentiators, integration ecosystem]

### Target Customer
[ICP, segments served, use cases emphasized in their marketing]

### Go-to-Market
[Channels, sales motion (PLG/SLG/hybrid), partnerships]

### SWOT
**Strengths**
- [Strength 1] `[Source]`
- [Strength 2] `[Source]`

**Weaknesses**
- [Weakness 1] `[Source]`
- [Weakness 2] `[Source]`

**Opportunities** (they're not capturing)
- [Opportunity 1]

**Threats** (facing them)
- [Threat 1]

### Customer Voice
> Key themes from reviews, forums, social media

- "[Direct quote or paraphrase]" — `[Source: G2, date]`
- "[Direct quote or paraphrase]" — `[Source: Reddit thread, date]`

---

## Benchmark Matrix

[Apply framework — see frameworks.md §3]

| Dimension | {Competitor A} | {Competitor B} | {Competitor C} | Our Position |
|-----------|:--------------:|:--------------:|:--------------:|:------------:|
| ...       | ...            | ...            | ...            | ...          |

**Interpretation**: [2–3 sentences on what the matrix reveals]

---

## Positioning Map

**Axes**: X = {axis 1}, Y = {axis 2}

| Quadrant | Players |
|----------|---------|
| High X, High Y | ... |
| High X, Low Y  | ... |
| Low X, High Y  | ... |
| Low X, Low Y   | ... |

**White space**: [Which quadrant is empty and why it's an opportunity]

---

## Strategic Synthesis

### What competitors do well (don't fight head-on)
1.
2.

### Where they're weak (opportunity to win)
1.
2.

### Underserved segment or job
[Description of the customer / use case no one is serving well]

### Blue Ocean opportunity
[Eliminate-Reduce-Raise-Create summary]

---

## Recommended Actions

> Prioritized, actionable — not vague advice

| Priority | Action | Rationale | Owner |
|----------|--------|-----------|-------|
| P1 | ... | ... | ... |
| P2 | ... | ... | ... |

---

## Sources & References

- [Source name](URL) — [What it was used for]
- ...

---

## Appendix (optional)

### Raw Notes
[Unstructured research notes, quotes, links collected during research]
```
