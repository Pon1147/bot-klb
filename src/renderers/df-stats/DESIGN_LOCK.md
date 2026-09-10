# DF Stats Renderer — Design System Lock

**Status:** LOCKED — Phase 0
**Locked:** 2026-09-08
**Config source:** `src/config/df-stats-renderer.config.ts`

---

## 1. Visual Identity

AAA military tactical shooter game UI. Cinematic, dark, dense, premium.
Tactical intelligence / operations dashboard aesthetic.

**NOT:** minimalist, SaaS dashboard, clean/airy, cyberpunk, neon.

## 2. Canvas

| Property | Value    |
| -------- | -------- |
| Ratio    | 16:9     |
| Width    | 1280px   |
| Height   | 720px    |
| Margin   | 20px     |

Canvas dimensions are fixed. All layout coordinates are absolute.

## 3. Layout Structure

Three-panel layout:

```
┌────────────────────────────────────────────────────────────────┐
│                        HEADER (season label + account ID)       │
├──────────────────────┬─────────────────┬───────────────────────┤
│                      │                 │                       │
│   LEFT PANEL         │  CENTER         │    RIGHT PANEL        │
│   420px wide         │  (background    │    420px wide         │
│   664px tall         │   image area)   │    664px tall         │
│                      │                 │                       │
│   - Operations header│                 │   - Rank              │
│   - Basic Info       │  Operator       │   - Operator          │
│   - Combat Stats     │  artwork        │   - Season Summary    │
│   - Squad Stats      │  belongs here   │                       │
│                      │                 │                       │
├──────────────────────┴─────────────────┴───────────────────────┤
│                        FOOTER                                   │
└────────────────────────────────────────────────────────────────┘
```

Left panel: dense statistics grid (y:20–532, 512px tall).
  Sections: Header 28px, Basic Info 238px, Combat 126px, Squad 106px.
  Inter-panel gaps: 4px.
Center: cinematic operator artwork — must feel integrated with UI, not floating.
Right panel: rank info + secondary data (y:20–528, 508px tall).
  Sections: Rank 170px, Operator 110px, Summary 224px.
  Inter-panel gaps: 4px.
Footer baseline: y=704 (176px margin to canvas bottom at 720).

## 4. Panels

- Dark translucent charcoal (`rgba(11,16,19,0.82)`)
- Compact rectangular panels
- Sharp or very small corner radius (2-3px max)
- 1px subtle borders (`rgba(146,153,155,0.25)`)
- Thin internal dividers (`rgba(146,153,155,0.12)`)
- Compact padding (10px)
- No large empty cards
- No excessive whitespace

## 5. Typography

Font stack: `'Rajdhani', 'Roboto Condensed', 'DIN Condensed', sans-serif`

Hierarchy (strict, descending):

```
Section Title    14px / 700  — Muted color, letter-spacing
Panel Title      11px / 600  — Muted color, letter-spacing
Value            20px / 700  — Primary white, prominent
Rank Value       32px / 700  — Accent green, largest
Label            8px  / 400  — Muted gray
Metadata         8-10px / 400 — Muted gray
Footer           8px  / 400  — Muted gray
```

Numbers must be prominent and readable — always larger than labels.

## 6. Color System

| Token           | Value                    | Usage                                   |
| --------------- | ------------------------ | --------------------------------------- |
| `bgCanvas`      | `#070A0C`                | Canvas background                       |
| `bgPanel`       | `rgba(11,16,19,0.82)`    | Panel fill                              |
| `bgPanelLight`  | `rgba(17,22,25,0.75)`    | Panel accent / placeholder              |
| `borderPanel`   | `rgba(146,153,155,0.25)` | Panel borders                           |
| `borderDivider` | `rgba(146,153,155,0.12)` | Internal dividers                       |
| `textPrimary`   | `#E5E9E8`                | Primary text / values                   |
| `textSecondary` | `#A8B0B2`                | Secondary text                            |
| `textMuted`     | `#7A8587`                | Labels, section titles                    |
| `accent`        | `#00E58A`                | Tactical green — key values, indicators |
| `accentDim`     | `rgba(0,229,138,0.3)`    | Accent glow / subtle highlight          |

**Rules:**

- Accent green (`#00E58A`) is SPARINGLY used — only for key values, operational indicators, and accent lines.
- Never use accent for labels or secondary text.
- Never introduce new colors without explicit approval.

## 7. Visual Language

### Do:

- Subtle tactical lines and corner markers
- Small HUD-style indicators
- Restrained decorative details
- Clear information density
- Compact, tight spacing

### Do NOT:

- Redesign the reference layout
- Make it look like a SaaS dashboard
- Use minimalist aesthetics
- Use huge cards or excessive whitespace
- Use excessive rounded corners (>3px)
- Use excessive glassmorphism
- Use cyberpunk/neon styling
- Remove information density
- Introduce colors outside the defined palette

## 8. Spacing System

| Token | Value | Usage         |
| ----- | ----- | ------------- |
| `xs`  | 2px   | Micro spacing |
| `sm`  | 4px   | Tight gaps    |
| `md`  | 6px   | Panel gaps    |
| `lg`  | 8px   | Section gaps  |
| `xl`  | 10px  | Panel padding |

## 9. Decorative Elements

### Corner Markers

Small L-shaped lines at panel corners. Creates HUD/tactical feel.

- Size: 6-8px
- Thickness: 1px
- Color: `borderPanel`

### Accent Lines

Short colored lines under section headers.

- Used sparingly for visual emphasis
- Color: `accent`

### Internal Dividers

Thin lines separating rows/columns within panels.

- Color: `borderDivider`
- Width: 1px

## 10. Information Density

This is a tactical dashboard, not a presentation slide.

- Panels should feel full, not sparse
- Multiple data points per panel
- 2-column grids where appropriate
- Minimal padding between related items
- Every pixel should earn its place

## 11. Fixed Constants

These values are LOCKED and must not change in future phases:

- `CANVAS.width = 1280`
- `CANVAS.height = 720`
- `COLORS.accent = '#00E58A'`
- `COLORS.bgCanvas = '#070A0C'`
- `COLORS.bgPanel = 'rgba(11,16,19,0.82)'`
- `TYPO.primary` font stack
- `TYPO.valueSize = 20`
- `TYPO.labelSize = 8`
- `RADIUS.sm = 2`, `RADIUS.md = 3`
- `LAYOUT.leftPanel.x = 20`
- `LAYOUT.leftPanel.y = 20`
- `LAYOUT.leftPanel.width = 420`
- `LAYOUT.leftPanel.height = 512`
- `LAYOUT.rightPanel.x = 840`
- `LAYOUT.rightPanel.y = 20`
- `LAYOUT.rightPanel.width = 420`
- `LAYOUT.rightPanel.height = 508`
- `LAYOUT.header.x = 20`
- `LAYOUT.header.y = 20`
- `LAYOUT.footer.x = 20`
- `LAYOUT.footer.y = 704`
- `LAYOUT.padding = 20`
- `LAYOUT.cardGap = 4`
- `LAYOUT.cardPad = 10`

Future phases may adjust Y-coordinates, panel heights, and row gaps
for visual refinement, but MUST preserve the overall layout structure,
color system, typography hierarchy, and 16:9 canvas ratio.

## 12. Phase Gate

Phase 0 is complete when:

- [x] Design system documented here
- [x] Config file matches this lock
- [x] All future phases reference this document

Future phases MUST NOT change the core visual language defined here.
Deviations require explicit re-lock approval.
