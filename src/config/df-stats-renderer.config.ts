/**
 * ============================================================================
 * DF STATS DASHBOARD RENDERER — DESIGN SYSTEM v1.0 (LOCKED)
 * ============================================================================
 * Phase 0 — Design System Lock.
 * Reference visual: src/assets/delta-force/backgrounds/stinger.png (640×361, 16:9).
 *
 * MỤC ĐÍCH:
 *   File này là NGUỒN SÁCH DUY NHẤT cho mọi design decision của renderer.
 *   Các phase sau ĐƯỢC PHÉP sửa svg-render.ts để fix bug — KHÔNG ĐƯỢC
 *   thay đổi design tokens, layout proportions, hay visual language ở đây.
 *
 * PHIÊN BẢN: 1.0 | LOCKED: 2026-09-08 | STATUS: ACTIVE
 * ============================================================================
 *
 * STYLE PRINCIPLES:
 *   AAA military tactical shooter game UI
 *   Cinematic, dark, dense, premium — NOT minimalist
 *   Tactical intelligence / operations dashboard aesthetic
 *   High information density — every pixel serves a purpose
 *   Realistic military aesthetic — no cyberpunk, no neon, no excessive glow
 *
 * CANVAS:
 *   16:9 aspect ratio (1280×720) — preserve in ALL future changes
 *   Background: operator artwork (stinger.png) with dark overlay
 *
 * LAYOUT:
 *   3-panel composition: Left(stats) + Center(operator bg) + Right(rank)
 *   UI and artwork must feel like ONE unified composition, not overlaid
 *
 * PANELS:
 *   Dark translucent charcoal backgrounds
 *   Compact rectangular panels — NO large empty cards
 *   Sharp or very small corner radius (sm=2, md=3)
 *   1px subtle borders (rgba, low opacity)
 *   Thin internal dividers
 *   Compact padding (10px)
 *   No excessive whitespace between elements
 *
 * TYPOGRAPHY:
 *   Font: Rajdhani / Roboto Condensed / DIN Condensed — condensed military
 *   Hierarchy (strict, top → bottom):
 *     Section Title (14px/700) > Panel Title (11px/600) >
 *     Value (20px/700) > Label (8px/400) > Metadata (8px/400)
 *   Numbers must be prominent and readable — larger than labels
 *   Letter-spacing: 1-4px for section titles, 0-1px for body
 *
 * COLORS:
 *   Background: #070A0C (near-black)
 *   Panel: rgba(11,16,19,0.82) (translucent charcoal)
 *   Panel light: rgba(17,22,25,0.75) (accent panels)
 *   Text primary: #E5E9E8 (off-white)
 *   Text secondary: #92999B (gray)
 *   Text muted: #555C5E (dark gray, labels only)
 *   Accent: #00E58A (tactical green — SPARINGLY, only for key values)
 *   Border: rgba(146,153,155,0.25) (panel borders)
 *   Divider: rgba(146,153,155,0.12) (internal dividers)
 *
 * VISUAL LANGUAGE:
 *   Subtle corner markers on panels (HUD detail)
 *   Thin horizontal dividers under panel titles
 *   Small accent color lines (header accent bar)
 *   Restrained HUD details — NOT busy, NOT flashy
 *   NO excessive glow, bloom, or neon effects
 *
 * STRICTLY FORBIDDEN:
 *   ❌ Redesign the reference image aesthetic
 *   ❌ Make it look like SaaS / modern web dashboard
 *   ❌ Minimalist / sparse layouts
 *   ❌ Huge cards with excessive padding
 *   ❌ Large rounded corners (rx > 3)
 *   ❌ Excessive glassmorphism / blur effects
 *   ❌ Cyberpunk / neon / rainbow styling
 *   ❌ Remove information density
 *   ❌ Change CANVAS aspect ratio (must stay 16:9)
 *   ❌ Use RGB/hex for borders — always rgba with opacity
 *   ❌ Use glow filters or blur on text
 *
 * ============================================================================
 */

/** Canvas 16:9 — tỷ lệ game UI */
export const CANVAS = {
  width: 1280,
  height: 720,
};

/** Spacing tokens — tight, dense */
export const SPACING = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
};

/** Border radius tokens — sharp/nearly-square */
export const RADIUS = {
  sm: 2,
  md: 3,
};

/** Layout 3-panel: Left(stats) + Center(operator) + Right(rank) */
export const LAYOUT = {
  padding: 20,
  cardGap: 4, // 4px — compact inter-panel spacing
  cardPad: 10,
  /** Panel trái: dense stats grid (hdr:28 + bi:238 + cb:126 + sq:106 + gaps) */
  leftPanel: {
    x: 20,
    y: 20,
    width: 420,
    height: 512,
  },
  /** Panel phải: rank + secondary (rk:185 + op:110 + sum:224 + gaps) */
  rightPanel: {
    x: 840,
    y: 20,
    width: 420,
    height: 527,
  },
  /** Header season label — baseline Y = padding + 18 */
  header: {
    x: 20,
    y: 20,
    width: 1240,
    height: 24,
  },
  /** Footer baseline — cách cạnh dưới canvas 4px */
  footer: {
    x: 20,
    y: 704,
    width: 1240,
    height: 16,
  },
};

/** Color system — military dark */
export const COLORS = {
  bgCanvas: '#070A0C',
  bgPanel: 'rgba(11,16,19,0.82)',
  bgPanelLight: 'rgba(17,22,25,0.75)',
  borderPanel: 'rgba(146,153,155,0.25)',
  borderDivider: 'rgba(146,153,155,0.12)',
  textPrimary: '#E5E9E8',
  textSecondary: '#A8B0B2',
  textMuted: '#7A8587',
  /** Tactical green — CHỈ dùng cho OPERATIONS, indicators, key values */
  accent: '#00E58A',
  accentDim: 'rgba(0,229,138,0.3)',
};

/** Typography — condensed military fonts */
export const TYPO = {
  primary: "'Rajdhani', 'Roboto Condensed', 'DIN Condensed', sans-serif",
  sectionSize: 14,
  sectionWeight: 700,
  panelTitleSize: 11,
  panelTitleWeight: 600,
  labelSize: 8,
  labelWeight: 400,
  valueSize: 20,
  valueWeight: 700,
  rankValueSize: 32,
  rankValueWeight: 700,
  footerSize: 8,
  footerWeight: 400,
};

/** Season label — header */
export const HEADER_LABELS: Record<string, string> = {
  overview: 'OPERATIONS',
  '10001': 'SEASON 1',
  '10003': 'SEASON 3',
  '10004': 'SEASON 4',
  '10005': 'SEASON 5',
  '10006': 'SEASON 6',
  '10007': 'SEASON 7',
  '10008': 'SEASON 8',
  '10009': 'SEASON 9',
  '10010': 'SEASON 10',
};
