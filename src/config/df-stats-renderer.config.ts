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

import path from 'path';

/** Canvas 16:9 — tỷ lệ game UI (reference 512×288 → scale 2.5x) */
export const CANVAS = {
  width: 1280,
  height: 720,
};

/** Asset paths — logos, operator portraits */
export const ASSETS = {
  logos: {
    deltaForce: path.resolve(path.join(__dirname, '../assets/logos/delta-force.png')),
    timi: path.resolve(path.join(__dirname, '../assets/delta-force/logos/timi.png')),
    teamJade: path.resolve(path.join(__dirname, '../assets/delta-force/logos/team-jade.png')),
  },
  /** Operator portraits — map operator name to portrait image */
  operatorPortraits: {
    stinger: path.resolve(path.join(__dirname, '../assets/delta-force/backgrounds/stinger.png')),
    luna: path.resolve(path.join(__dirname, '../assets/delta-force/backgrounds/luna.png')),
    vyron: path.resolve(path.join(__dirname, '../assets/delta-force/backgrounds/vyron.png')),
    hackclaw: path.resolve(path.join(__dirname, '../assets/delta-force/backgrounds/hackclaw.png')),
    sineva: path.resolve(path.join(__dirname, '../assets/delta-force/backgrounds/sineva.png')),
    nox: path.resolve(path.join(__dirname, '../assets/delta-force/backgrounds/nox.png')),
  },
};

/** Spacing tokens — tight, dense (tactical HUD, compact v2) */
export const SPACING = {
  xs: 2,
  sm: 3,
  md: 5,
  lg: 7,
  xl: 9,
};

/** Border radius tokens — sharp/nearly-square */
export const RADIUS = {
  sm: 2,
  md: 3,
};

/** Layout 3-panel: Left(stats) + Center(operator) + Right(rank) */
export const LAYOUT = {
  padding: 20,
  cardGap: 4,
  cardPad: 10,
  /** Panel trái: Basic Info — 1 panel, 9 metrics (2-column grid) */
  leftPanel: {
    x: 24,
    y: 78,
    width: 226,
    height: 270,
  },
  /** Panel phải: CURRENT RANK + MOST USED OPERATOR + SEASON SUMMARY */
  rightPanel: {
    x: 1280 - 24 - 226,
    y: 78,
    width: 226,
    height: 432,
  },
  /** Header baseline Y */
  header: {
    y: 56,
    height: 22,
  },
  /** Footer baseline — cách cạnh dưới canvas 28px */
  footer: {
    y: 692,
    height: 16,
  },
  /** Bottom cards area (right panel, below rank) */
  bottomCards: {
    y: 270,
    h: 120,
    gap: 15,
    cardW: 200,
  },
};

/** Color system — military dark (reference: #080D0E, #101617, #151B1C) */
export const COLORS = {
  bgCanvas: '#070A0C',
  /** Panel dark charcoal — semi-transparent (0.70-0.90 opacity) */
  bgPanel: 'rgba(10,16,19,0.85)',
  /** Panel light — accent panels, rank emblem bg */
  bgPanelLight: 'rgba(17,22,25,0.75)',
  /** Border panel — subtle translucent gray */
  borderPanel: 'rgba(146,153,155,0.25)',
  /** Divider trong panel — thin separator */
  borderDivider: 'rgba(146,153,155,0.12)',
  /** Text primary — off-white for values */
  textPrimary: '#E6E8E5',
  /** Text secondary — slightly dimmer */
  textSecondary: '#92999B',
  /** Text muted — dark gray for labels (reference #59605E) */
  textMuted: '#59605E',
  /** Tactical green — CHỈ dùng cho OPERATIONS, indicators, key values */
  accent: '#00D9A6',
  accentDim: 'rgba(0,217,166,0.3)',
  /** Gold/bronze — CHỈ dùng cho rank/achievement visuals */
  rankGold: '#C9A84C',
  rankGoldDim: 'rgba(201,168,76,0.3)',
  /** Background fallback nếu ảnh load thất bại */
  bgFallback: '#0D1114',
};

/** Typography — condensed military (reference: Rajdhani, Roboto Condensed) */
export const TYPO = {
  /** Ưu tiên Rajdhani, fallback Arial (Windows default) */
  primary: "'Rajdhani', 'Roboto Condensed', Arial, 'Helvetica Neue', Helvetica, sans-serif",
  /** Section title: uppercase, condensed, bold, tactical accent */
  sectionSize: 14,
  sectionWeight: 700,
  /** Panel title: uppercase, condensed, muted */
  panelTitleSize: 11,
  panelTitleWeight: 600,
  /** Label: small, uppercase, muted gray */
  labelSize: 8,
  labelWeight: 400,
  /** Value: bold, bright, visual anchor */
  valueSize: 20,
  valueWeight: 700,
  /** Large value: Operation Level, Rank score */
  valueSizeLarge: 24,
  /** Rank value: large, gold */
  rankValueSize: 32,
  rankValueWeight: 700,
  /** Bottom card title: small, muted */
  bottomCardTitleSize: 8,
  bottomCardTitleWeight: 400,
  /** Footer: tiny, muted */
  footerSize: 6,
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
