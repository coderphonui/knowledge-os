# Session Type Flows

## Detection Guide

| Trigger signal | Session type | Primary framework |
|---|---|---|
| "I want to achieve / build / reach..." | Goal setting | GROW → WOOP |
| "I'm stuck / blocked / can't start..." | Obstacle removal | 5 Whys → WOOP |
| "I feel lost / confused / no direction..." | Direction finding | Wheel of Life → Ikigai |
| "I need to decide / choose between..." | Decision support | Values Alignment → Pre-mortem |
| "I feel unmotivated / burned out / drained..." | Energy restoration | Future Self → MI |
| "I want to review / reflect on my life..." | Life review | Wheel of Life → GROW |
| "I don't know what to do with my life..." | Purpose exploration | Ikigai → Future Self |
| Free-flowing, unclear | Open exploration | Socratic questioning → detect type |

---

## Session Flow Templates

### Goal Setting Session

**Opening:** "Which goal do you want to focus on today?"

**Flow:**
1. Clarify the goal (GROW — G step): specific, meaningful, time-bound
2. Reality check (GROW — R): what exists now, what resources/constraints
3. Surface the obstacle (WOOP — O): what inner barrier will get in the way?
4. Generate options (GROW — O): at least 3–5 paths
5. Commit to next step (GROW — W + WOOP — P): concrete if-then plan
6. Write to `data/growth/goals/SLUG.md`

---

### Obstacle Removal Session

**Opening:** "Tell me exactly what isn't happening that should be happening."

**Flow:**
1. Define the obstacle concretely (not vaguely)
2. Run 5 Whys to find root cause
3. At root cause: "Is this a real constraint or an assumption?"
4. If emotional/belief root → pivot to MI (surface motivation)
5. If practical root → pivot to GROW (generate solutions)
6. End with one if-then commitment

---

### Direction Finding Session

**Opening:** "Let's start by looking at the full picture of your life."

**Flow:**
1. Run Wheel of Life (rate 8 domains 1–10)
2. Identify the most impactful domain to improve
3. If career/purpose related → pivot to Ikigai
4. If life balance related → pivot to GROW for the lowest-scoring domain
5. Future Self visualization to connect with 5-year direction
6. End with one theme/intention for the next 30 days

---

### Decision Support Session

**Opening:** "Tell me about this decision — both options you're weighing."

**Flow:**
1. Map the decision clearly (what are the real options?)
2. Values Alignment Check for each option
3. Pre-mortem for the leading option ("what could go wrong?")
4. Future Self perspective ("what would 5-year-you say?")
5. Gut check: "If both options had the same probability of success, which would you choose?"
6. Commit to a decision or a "decision by" date

---

### Energy Restoration Session

**Opening:** "Tell me about this period — how are you feeling?"

**Flow:**
1. Reflective listening (MI — OARS) — don't advise, just understand
2. Surface what's being depleted (Wheel of Life quick scan)
3. Identify what's being suppressed or ignored
4. Future Self visualization — reconnect with meaning
5. One recovery action this week (small, specific)
6. Explore whether this is a sprint problem (short-term) or direction problem (structural)

---

### Open Exploration Session

**Opening:** "What's been on your mind the most lately?"

**Flow:**
1. Socratic listening — ask clarifying questions, don't lead
2. Reflect patterns back: "I notice you've mentioned [X] a few times..."
3. Detect the real session type from what emerges
4. Pivot to appropriate framework once the core theme surfaces
5. Always end with a concrete takeaway or question to sit with

---

## Session Note Template

Save to `data/growth/sessions/YYYY-MM-DD-topic.md`:

```markdown
---
title: "[Topic] - Coaching Session"
type: coaching-session
date_created: YYYY-MM-DD
date_modified: YYYY-MM-DD
tags: [area/growth, type/coaching-session]
status: active
session_type: [goal-setting|obstacle-removal|direction-finding|decision-support|energy-restoration|open-exploration]
frameworks_used: []
---

## What We Explored

[1–2 sentence summary of the session topic]

## Key Insights

- [insight 1]
- [insight 2]

## Root Causes / Discoveries

[What was uncovered beneath the surface]

## Commitments

- [ ] [action] — by [date]
- [ ] [action] — by [date]

## Open Questions

[Questions left to sit with, or to explore in next session]

## Follow-up

[What to check in on next session]
```

---

## Goal Note Template

Save to `data/growth/goals/SLUG.md`:

```markdown
---
title: "[Goal Name]"
type: goal
date_created: YYYY-MM-DD
date_modified: YYYY-MM-DD
tags: [area/growth, type/goal, area/DOMAIN]
status: active
target_date: YYYY-MM-DD
---

## Goal Statement

[Specific, meaningful, time-bound goal]

## Why This Matters

[Connection to life principles / core values]

## Current Reality

[Where things stand today]

## Key Obstacles

[WOOP obstacles — internal]

## Action Plan

- [ ] [milestone 1] — [date]
- [ ] [milestone 2] — [date]

## Progress Log

### YYYY-MM-DD
[Update]
```
