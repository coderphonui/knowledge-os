# Competitive Analysis Frameworks

## When to Use Each Framework

| Framework | Use When |
|-----------|----------|
| **SWOT** | Every competitor profile — foundational analysis |
| **Porter's Five Forces** | Industry landscape pass, before individual competitor drill-down |
| **Benchmark Matrix** | Comparing 3+ competitors on specific dimensions |
| **Positioning Map** | Visualizing market gaps / white spaces |
| **Blue Ocean Value Curve** | Identifying differentiation opportunities |
| **Jobs-to-be-Done** | Understanding why customers switch between competitors |

---

## 1. Porter's Five Forces (Industry Level)

Apply once per analysis to frame the industry before diving into individual competitors.

| Force | Key Questions |
|-------|--------------|
| **Threat of new entrants** | How hard is it to enter? Capital, regulation, brand, tech barriers? |
| **Threat of substitutes** | What non-obvious alternatives solve the same job? |
| **Bargaining power of buyers** | How price-sensitive / switching-happy are customers? |
| **Bargaining power of suppliers** | Are there critical dependencies (APIs, data, infra)? |
| **Competitive rivalry** | How intense is competition? Price wars, feature parity, consolidation? |

**Output format:**
```
### Porter's Five Forces
- New entrants threat: HIGH/MEDIUM/LOW — [1-2 sentence rationale]
- Substitutes threat: HIGH/MEDIUM/LOW — [rationale]
- Buyer power: HIGH/MEDIUM/LOW — [rationale]
- Supplier power: HIGH/MEDIUM/LOW — [rationale]
- Rivalry intensity: HIGH/MEDIUM/LOW — [rationale]
**Implication**: [1-2 sentences on what this means strategically]
```

---

## 2. SWOT Analysis (Per Competitor)

Apply to each competitor being profiled. Be concrete — avoid generic statements.

| Quadrant | Guidance |
|----------|----------|
| **Strengths** | What they do better than anyone else? Resources, brand, data, distribution? |
| **Weaknesses** | Where do customers complain? What are they slow to fix? Technical debt? |
| **Opportunities** | Trends, market shifts, or customer segments they're ignoring? |
| **Threats** | Regulatory risk, competitive pressure, technology disruption, churn signals? |

**Quality check**: Each SWOT item should cite at least one evidence source (review, news, funding signal, pricing, job postings).

---

## 3. Competitive Benchmark Matrix

Use to compare 3+ competitors on the dimensions that matter most for the specific market.

**Step 1** — Identify 6–10 benchmark dimensions relevant to the domain:
- Functional (features, integrations, performance, reliability)
- Commercial (pricing model, free tier, trial, contracts)
- Go-to-market (target segment, channel, sales motion)
- Experience (UX quality, onboarding, support)
- Data/AI capabilities (personalization, analytics, ML features)

**Step 2** — Score each competitor per dimension:
- ✅ Strong / ⚠️ Partial / ❌ Missing / — Not applicable

**Output format:**
```markdown
| Dimension         | Competitor A | Competitor B | Competitor C | Our Position |
|-------------------|:---:|:---:|:---:|:---:|
| Feature X         | ✅  | ⚠️  | ❌  | ✅  |
| Pricing model     | Freemium | Enterprise | Usage-based | — |
```

---

## 4. Positioning Map

Plot 2 key axes that define the market (price vs. quality, breadth vs. depth, self-serve vs. enterprise, etc.).

**How to choose axes:**
1. What are the primary trade-offs customers make in this category?
2. Which dimensions most determine willingness to pay or switch?

**Output**: Describe as a 2x2 quadrant in text — identify which quadrant each player occupies and which quadrant is empty (white space).

---

## 5. Blue Ocean Value Curve

Compare which factors the industry competes on (x-axis) vs. how much each competitor invests in each factor (high/medium/low on y-axis).

**Steps:**
1. List 6–8 factors the industry currently competes on
2. Score each competitor's investment in each factor (High / Medium / Low)
3. Look for patterns: Where does everyone invest heavily but users don't care? What's underinvested?

**Output**: Table + 1 paragraph interpretation identifying the "eliminate-reduce-raise-create" opportunity.

---

## 6. Jobs-to-be-Done (JTBD) Lens

Use when analyzing switching behavior or positioning differentiation.

**Key questions:**
- What job is the customer hiring this product to do?
- What were they using before? Why did they switch?
- What triggers the switch? (functional, emotional, social)
- What outcome makes them feel "done"?

**Evidence sources**: G2/Capterra reviews, Reddit threads, Twitter/X mentions, App Store reviews — look for "I switched from X because..." language.

---

## Evidence Collection Standards

For each competitor, collect evidence from at least 3 sources:

1. **Primary product research**: Live product, pricing page, feature list, docs
2. **Customer voice**: G2, Capterra, App Store, ProductHunt, Reddit, Twitter/X
3. **Business signals**: Crunchbase (funding), LinkedIn (team size/growth), job postings (tech stack, priorities), press releases
4. **Market analysis**: Industry reports, analyst coverage, news mentions

Cite sources inline: `[Source: G2 review, Jan 2025]` or `[Source: TechCrunch, funding announcement]`
