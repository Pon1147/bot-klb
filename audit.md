# CONTINUE — FIX THE CURRENT RENDER, DO NOT RESTART

## Context

You already audited the current implementation and produced the current render.

The current render is still NOT close enough to the reference.

Do NOT restart the project.

Do NOT redesign the UI.

Continue from the current implementation and fix the remaining composition problems.

---

# PRIMARY PROBLEM

The remaining problem is **NOT mainly styling**.

The problem is the way the UI content is being positioned **horizontally inside the image**.

The current render still visually behaves like:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  LEFT CONTENT        CHARACTER              RIGHT CONTENT   │
│                                                              │
│  STAT   STAT                              STAT    STAT       │
│  STAT   STAT                              STAT    STAT       │
│  STAT   STAT                              STAT    STAT       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

````

This creates a dashboard/table composition.

The reference does NOT have this visual behavior.

---

# REFERENCE MENTAL MODEL

The reference should be interpreted as:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│ ┌──────────────┐                          ┌───────────────┐ │
│ │              │                          │               │ │
│ │ BASIC INFO   │          OPERATOR        │ CURRENT RANK  │ │
│ │              │                          │               │ │
│ │ Label        │             ███          │    [ICON]     │ │
│ │ Value        │            █████         │               │ │
│ │              │           ███████        ├───────────────┤ │
│ │ Label        │          █████████       │ MOST USED     │ │
│ │ Value        │           ███████        │ OPERATOR      │ │
│ │              │            █████         │               │ │
│ │ Label        │             ███          │    [IMAGE]    │ │
│ │ Value        │                          ├───────────────┤ │
│ │              │                          │ BADGES        │ │
│ │ Label        │                          │ [○] [○] [○]   │ │
│ │ Value        │                          │               │ │
│ └──────────────┘                          └───────────────┘ │
│                                                              │
│              ONE CONTINUOUS BACKGROUND IMAGE                 │
└──────────────────────────────────────────────────────────────┘
```

The important point is:

> **The operator is the visual center. The UI panels are compact overlays around the operator.**

The UI should NOT form one giant horizontal information table.

---

# PROBLEM 1 — METRICS ARE TOO HORIZONTAL

Current behavior resembles:

```text
┌──────────────────────────────┐
│ 60              509          │
│ 1.97M           102h         │
│ 0.30             86          │
│ 517.99M         509          │
│           659                │
└──────────────────────────────┘
```

This is the wrong visual model.

The metric pairs are visually competing across the entire panel width.

Instead, think in terms of independent metric blocks:

```text
┌──────────────────────────────┐
│ OPERATOR LEVEL               │
│ 60                           │
│                              │
│ TOTAL MATCHES PLAYED         │
│ 509                          │
│                              │
│ CURRENT ASSETS               │
│ 1.97M                        │
│                              │
│ TOTAL MADE                   │
│ 102.1h                       │
│                              │
│ EXTRACTION RATE              │
│ 0.30                         │
│                              │
│ NUMBER OF EXTRACTIONS        │
│ 86                           │
└──────────────────────────────┘
```

Each metric is a visual unit:

```text
LABEL
VALUE
```

not:

```text
LABEL       LABEL
VALUE       VALUE
```

Do NOT automatically use CSS Grid with two equal columns for the statistics.

If the reference does not clearly require a two-column grid, do not create one.

---

# PROBLEM 2 — THE PANEL ITSELF IS TOO WIDE

Do not solve the horizontal problem by only changing font size.

The actual issue is the relationship:

```text
CURRENT

┌───────────────────────────────┐
│ label              label      │
│ value              value      │
│ label              label      │
│ value              value      │
└───────────────────────────────┘
```

The panel becomes a horizontal container for many independent statistics.

Target:

```text
TARGET

┌─────────────────────┐
│ label               │
│ value               │
│                     │
│ label               │
│ value               │
│                     │
│ label               │
│ value               │
│                     │
│ label               │
│ value               │
└─────────────────────┘
```

The panel should feel like a **vertical information card**, not a statistics table.

---

# PROBLEM 3 — DO NOT TURN THE CHARACTER INTO A COLUMN

The current layout implicitly creates:

```text
┌────────────┬───────────────┬────────────┐
│            │               │            │
│ LEFT UI    │   CHARACTER   │ RIGHT UI   │
│            │               │            │
└────────────┴───────────────┴────────────┘
```

This is only a conceptual debugging model.

The actual implementation must instead behave like:

```text
┌───────────────────────────────────────────┐
│                                           │
│   UI         BACKGROUND + OPERATOR       UI│
│   │                  │                    │
│   │                  │                    │
│   │              OPERATOR                 │
│   │                  │                    │
│                                           │
└───────────────────────────────────────────┘
```

The background is one continuous image.

The operator is positioned within that background.

The UI panels are overlays.

---

# PROBLEM 4 — TEXT SHOULD FOLLOW THE PANEL, NOT THE CANVAS

Do NOT position every statistic relative to the global canvas.

Bad mental model:

```text
canvas
├── text A at x=...
├── text B at x=...
├── text C at x=...
├── text D at x=...
└── text E at x=...
```

This causes horizontal drift and makes responsive/layout tuning difficult.

Use:

```text
BasicInfoPanel
│
├── Metric
│   ├── Label
│   └── Value
│
├── Metric
│   ├── Label
│   └── Value
│
├── Metric
│   ├── Label
│   └── Value
│
└── Metric
    ├── Label
    └── Value
```

The panel owns the metrics.

The metric owns its label/value relationship.

---

# PROBLEM 5 — INFORMATION DENSITY

The current output contains too much information competing for attention.

Current concept:

```text
Basic Info
Combat Stats
Squad Stats
Rank
Operator
Season Summary
```

Target concept:

```text
                    PROFILE
                       │
        ┌──────────────┴──────────────┐
        │                             │
    BASIC INFO                    PROFILE INFO
        │                             │
        │                       ┌─────┴─────┐
        │                       │           │
        │                     RANK       OPERATOR
        │                                   │
        │                                 BADGES
```

Do not add information simply because there is available space.

Empty visual space is intentional.

---

# PROBLEM 6 — VISUAL HIERARCHY

The current output has approximately this hierarchy:

```text
STATISTICS
████████████████
       ↓
CHARACTER
████████████
       ↓
STATISTICS
████████████████
```

The target should have:

```text
BACKGROUND / OPERATOR
████████████████████████
          ↓
      PROFILE UI
    ┌─────────────┐
    │ compact     │
    │ information │
    └─────────────┘
```

The operator should remain the primary visual anchor.

The text should remain secondary.

---

# REQUIRED DOM / COMPONENT RELATIONSHIP

The implementation should conceptually look like:

```text
ProfileCanvas
│
├── Background
│   └── Operator
│
├── Header
│
├── LeftProfilePanel
│   └── BasicInfo
│       ├── Metric
│       ├── Metric
│       ├── Metric
│       ├── Metric
│       └── ...
│
└── RightProfilePanel
    ├── CurrentRank
    ├── MostUsedOperator
    └── Badges
```

NOT:

```text
ProfileCanvas
│
├── Stat1
├── Stat2
├── Stat3
├── Stat4
├── Stat5
├── Stat6
├── Character
├── Stat7
├── Stat8
└── ...
```

---

# IMPORTANT — DO NOT JUST SHRINK EVERYTHING

Do NOT respond to the mismatch by doing:

```text
font-size ↓
panel-size ↓
character-size ↓
padding ↓
```

That does not solve the structural problem.

First fix:

```text
COMPONENT HIERARCHY
        ↓
PANEL GEOMETRY
        ↓
METRIC GROUPING
        ↓
HORIZONTAL DISTRIBUTION
        ↓
VISUAL HIERARCHY
```

Only then tune font size and spacing.

---

# REFACTOR TARGET

The final composition should visually read approximately as:

```text
                    1280 × 720

┌──────────────────────────────────────────────────────────────┐
│ LOGO / BRAND                              PLAYER              │
│                                                              │
│  ┌───────────────┐                       ┌───────────────┐  │
│  │ BASIC INFO    │                       │ CURRENT RANK  │  │
│  │               │                       │               │  │
│  │ label         │                       │    rank       │  │
│  │ value         │       OPERATOR        │               │  │
│  │               │                       ├───────────────┤  │
│  │ label         │                       │ MOST USED     │  │
│  │ value         │                       │ OPERATOR      │  │
│  │               │                       │               │  │
│  │ label         │                       │    image      │  │
│  │ value         │                       ├───────────────┤  │
│  │               │                       │ BADGES        │  │
│  │ label         │                       │ ○ ○ ○ ○       │  │
│  │ value         │                       │               │  │
│  └───────────────┘                       └───────────────┘  │
│                                                              │
│                 CONTINUOUS TACTICAL BACKGROUND              │
└──────────────────────────────────────────────────────────────┘
```

This is a **composition reference**, not an instruction to literally draw these boxes.

---

# IMPLEMENTATION INSTRUCTIONS

1. Inspect the current DOM/component hierarchy.
2. Find where the statistics are currently laid out horizontally.
3. Find any `grid-template-columns`, flex rows, absolute X positioning, or width rules responsible for the horizontal distribution.
4. Refactor the statistics into vertical metric units.
5. Make the left panel a compact vertical information card.
6. Keep the operator/background as one continuous composition.
7. Keep the right-side sections vertically stacked.
8. Remove sections that are not present in the reference.
9. Do not introduce new UI.
10. Render again.
11. Compare the new output against the reference.
12. Only after geometry is correct, tune typography and decorative details.

---

# ANTI-HALLUCINATION

- Reference image = source of truth.
- Current output = implementation to be corrected.
- Do not invent missing UI.
- Do not invent exact dimensions without evidence.
- Do not invent fonts.
- Do not invent assets.
- Do not assume that a visually available area must contain content.
- Do not redesign.
- Do not add features.
- If a detail cannot be determined, mark it `UNKNOWN`.
- Preserve the existing tech stack.
- Do not rewrite unrelated code.

---

# EXPECTED RESPONSE

Before modifying code, briefly report:

1. **Root cause of the remaining horizontal composition problem**
2. **Exact component/CSS responsible**
3. **Minimal refactoring required**
4. **Files to modify**

Then implement the fix.

Do not provide generic frontend advice.

Focus specifically on the mismatch visible in the current render versus the reference.

```

```
````
