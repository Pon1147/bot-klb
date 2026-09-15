/**
 * SVG Dashboard Renderer — Delta Force tactical side-panel UI.
 *
 * IMPORTANT LAYOUT PRINCIPLE:
 * The background image already contains the main operator/model centered
 * in the composition. Therefore the SVG UI must NOT place any content
 * over the center subject.
 *
 * Layout:
 *
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │ HEADER                                             LOGOS / PLAYER │
 *   │                                                                    │
 *   │ ┌───────────────┐                              ┌─────────────────┐ │
 *   │ │ BASIC INFO    │                              │ CURRENT RANK    │ │
 *   │ │               │                              │                 │ │
 *   │ │ metrics       │          OPERATOR            │     EMBLEM      │ │
 *   │ │               │           CENTER             │    RANK NAME    │ │
 *   │ └───────────────┘                              └─────────────────┘ │
 *   │                                                                    │
 *   │                                                ┌─────────────────┐ │
 *   │                                                │ MOST USED OP.    │ │
 *   │                                                │                 │ │
 *   │                                                │    PORTRAIT      │ │
 *   │                                                └─────────────────┘ │
 *   │                                                                    │
 *   │                                                ┌─────────────────┐ │
 *   │                                                │ SEASON SUMMARY   │ │
 *   │                                                │                 │ │
 *   │                                                └─────────────────┘ │
 *   │                                                                    │
 *   │ SYSTEM STATUS                                      BRANDING       │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Uses SVG for text/UI rendering and Sharp for image compositing.
 */

import path from 'path';
import sharp from 'sharp';
import type { DFStatsViewModel } from './types.js';
import { CANVAS, COLORS, TYPO, RADIUS, ASSETS } from '../../config/df-stats-renderer.config.js';
import { fitText, formatAssets, formatHoursDecimal } from './utils/text-fit.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const BACKGROUND_PATH = path.join(__dirname, '../../assets/delta-force/backgrounds/stinger.png');

/**
 * Keep the operator/background visible.
 *
 * The previous 0.50 overlay was relatively heavy.
 * The side panels themselves provide enough visual separation.
 */
const DARK_OVERLAY_COLOR = 'rgba(7,10,12,0.38)';

/* ============================================================================
 * FIXED SAFE-ZONE LAYOUT
 * ========================================================================== */

/**
 * These coordinates are intentionally explicit.
 *
 * Do NOT calculate the right column from canvas width.
 * The background composition is fixed, so the UI safe zones are fixed too.
 *
 * Canvas is expected to be 1280px wide based on the current renderer config.
 */

/** Left empty area of the background. */
const LEFT_COL = {
  x: 24,
  y: 78,
  w: 226,
};

/** Right empty area of the background. */
const RIGHT_COL = {
  x: CANVAS.width - 24 - 226,
  y: 78,
  w: 226,
};

const GAP = 12;

const HEADER_H = 56;

/* Left panel */
const BASIC_INFO_H = 270;

/* Right panels */
const RANK_H = 176;
const OPERATOR_H = 108;
const SEASON_H = 144;

/* Panel internals */
const PANEL_PAD = 14;
const TITLE_Y = 20;
const DIVIDER_Y = 29;

/* Basic info */
const BI_START_Y = 56;
const BI_ROW_H = 42;

/* Rank */
const RANK_EMBLEM_SIZE = 94;
const RANK_EMBLEM_TOP = RIGHT_COL.y + 40;
const RANK_CENTER_X = RIGHT_COL.x + RIGHT_COL.w / 2;

/* Operator */
const OPERATOR_PORTRAIT_SIZE = 42;

/* Season */
const SS_START_Y = 53;
const SS_ROW_H = 29;

/* ============================================================================
 * RENDER ENTRY
 * ========================================================================== */

/** Render dashboard image from ViewModel. */
export async function renderDashboard(viewModel: DFStatsViewModel): Promise<Buffer> {
  const svgContent = buildSVG(viewModel);
  const svgBuffer = Buffer.from(svgContent, 'utf-8');

  /* --------------------------------------------------------------------------
   * Background fallback
   * ------------------------------------------------------------------------ */

  const gradientOverlay = Buffer.from(
    '<svg xmlns="' +
      SVG_NS +
      '" width="' +
      CANVAS.width +
      '" height="' +
      CANVAS.height +
      '">' +
      '<defs>' +
      '<radialGradient id="bg" cx="50%" cy="45%" r="75%">' +
      '<stop offset="0%" stop-color="#151b1d"/>' +
      '<stop offset="55%" stop-color="#0c1113"/>' +
      '<stop offset="100%" stop-color="#070a0c"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<rect width="' +
      CANVAS.width +
      '" height="' +
      CANVAS.height +
      '" fill="url(#bg)"/>' +
      '</svg>',
    'utf-8',
  );

  /* --------------------------------------------------------------------------
   * Load background
   * ------------------------------------------------------------------------ */

  let bgBuffer: Buffer;

  try {
    bgBuffer = await sharp(BACKGROUND_PATH)
      .resize(CANVAS.width, CANVAS.height, {
        fit: 'cover',
        position: 'center',
      })
      .toBuffer();
  } catch {
    bgBuffer = await sharp(gradientOverlay).toBuffer();
  }

  /* --------------------------------------------------------------------------
   * Dark overlay
   * ------------------------------------------------------------------------ */

  const darkOverlay = Buffer.from(
    '<svg xmlns="' +
      SVG_NS +
      '" width="' +
      CANVAS.width +
      '" height="' +
      CANVAS.height +
      '">' +
      '<rect width="' +
      CANVAS.width +
      '" height="' +
      CANVAS.height +
      '" fill="' +
      DARK_OVERLAY_COLOR +
      '"/>' +
      '</svg>',
    'utf-8',
  );

  /* --------------------------------------------------------------------------
   * Composite background + SVG
   * ------------------------------------------------------------------------ */

  let composite = await sharp(bgBuffer)
    .composite([
      {
        input: darkOverlay,
        top: 0,
        left: 0,
      },
      {
        input: await sharp(svgBuffer).toBuffer(),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  /* --------------------------------------------------------------------------
   * Rank emblem
   *
   * The SVG contains a placeholder circle.
   * The real rank image is composited at the exact same coordinates.
   * ------------------------------------------------------------------------ */

  if (viewModel.rank.imageUrl) {
    try {
      const rankArrayBuffer = await fetch(viewModel.rank.imageUrl).then((response) =>
        response.arrayBuffer(),
      );

      const rankBuffer = await sharp(Buffer.from(new Uint8Array(rankArrayBuffer)))
        .resize(RANK_EMBLEM_SIZE, RANK_EMBLEM_SIZE, {
          fit: 'contain',
        })
        .png()
        .toBuffer();

      const rankLeft = Math.round(RANK_CENTER_X - RANK_EMBLEM_SIZE / 2);

      const rankTop = RANK_EMBLEM_TOP;

      composite = await sharp(composite)
        .composite([
          {
            input: rankBuffer,
            top: rankTop,
            left: rankLeft,
          },
        ])
        .png()
        .toBuffer();
    } catch {
      /*
       * Keep SVG placeholder.
       */
    }
  }

  /* --------------------------------------------------------------------------
   * Player avatar
   *
   * The avatar is kept in the header and does not interfere with
   * the centered operator in the background.
   * ------------------------------------------------------------------------ */

  if (viewModel.player.avatarUrl) {
    try {
      const avatarArrayBuffer = await fetch(viewModel.player.avatarUrl).then((response) =>
        response.arrayBuffer(),
      );

      const avatarBuffer = await sharp(Buffer.from(new Uint8Array(avatarArrayBuffer)))
        .resize(40, 40)
        .png()
        .toBuffer();

      composite = await sharp(composite)
        .composite([
          {
            input: avatarBuffer,
            top: 8,
            left: 1180,
          },
        ])
        .png()
        .toBuffer();
    } catch {
      /*
       * Ignore avatar failure.
       */
    }
  }

  /*
   * Operator portrait is intentionally NOT rendered here.
   *
   * The center operator is already part of BACKGROUND_PATH.
   */

  return composite;
}

/* ============================================================================
 * SVG ROOT
 * ========================================================================== */

function buildSVG(vm: DFStatsViewModel): string {
  const { nickname, level, playDurationHours, playDurationMinutes, totalMatches } = vm.player;

  const { name: rankName } = vm.rank;

  const totalAssets = vm.economy?.totalReward ?? '0';
  const hitRate = vm.combat?.hitRate ?? '0%';

  const totalHours = playDurationHours + playDurationMinutes / 60;

  const kills = vm.combat?.kills ?? 0;
  const extractValue = vm.economy?.extractValue ?? '0';

  const headshotRate = vm.combat?.headshotRate ?? '—';

  let s = '';

  s +=
    '<svg xmlns="' +
    SVG_NS +
    '" width="' +
    CANVAS.width +
    '" height="' +
    CANVAS.height +
    '" viewBox="0 0 ' +
    CANVAS.width +
    ' ' +
    CANVAS.height +
    '">';

  /* --------------------------------------------------------------------------
   * Header
   * ------------------------------------------------------------------------ */

  s += renderHeader(nickname);

  /* --------------------------------------------------------------------------
   * Left side
   * ------------------------------------------------------------------------ */

  s += renderBasicInfo({
    level,
    totalMatches,
    totalAssets,
    totalHours,
    hitRate,
  });

  /* --------------------------------------------------------------------------
   * Right side
   * ------------------------------------------------------------------------ */

  s += renderRank(rankName);
  s += renderOperator();
  s += renderSeasonSummary({
    kills,
    extractValue,
    headshotRate,
  });

  /* --------------------------------------------------------------------------
   * Footer
   * ------------------------------------------------------------------------ */

  s += renderFooter();

  s += '</svg>';

  return s;
}

/* ============================================================================
 * HEADER
 * ========================================================================== */

function renderHeader(nickname: string): string {
  let s = '';

  /*
   * Header baseline.
   */
  s +=
    '<line x1="20" y1="' +
    HEADER_H +
    '" x2="' +
    (CANVAS.width - 20) +
    '" y2="' +
    HEADER_H +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1" opacity="0.55"/>';

  /*
   * Short green tactical accent.
   */
  s +=
    '<line x1="20" y1="' +
    HEADER_H +
    '" x2="185" y2="' +
    HEADER_H +
    '" stroke="' +
    COLORS.accent +
    '" stroke-width="2" opacity="0.75"/>';

  /*
   * Delta Force logo.
   */
  s += imageTag(ASSETS.logos.deltaForce, 24, 10, 112, 26);

  /*
   * Operations label.
   */
  s +=
    '<text x="148" y="27" fill="' +
    COLORS.accent +
    '" font-size="16" font-weight="700" letter-spacing="1.6" font-family="' +
    TYPO.primary +
    '">' +
    'OPERATIONS' +
    '</text>';

  /*
   * Small secondary label.
   */
  s +=
    '<text x="148" y="42" fill="' +
    COLORS.textMuted +
    '" font-size="6.5" font-weight="500" letter-spacing="1.4" font-family="' +
    TYPO.primary +
    '">' +
    'PERSONNEL // FIELD RECORD' +
    '</text>';

  /*
   * Publisher logos.
   */
  s += imageTag(ASSETS.logos.timi, CANVAS.width - 126, 10, 44, 20);

  s += imageTag(ASSETS.logos.teamJade, CANVAS.width - 74, 10, 46, 20);

  /*
   * Username.
   *
   * Positioned below the logos so it remains readable and does not
   * compete with the main operator composition.
   */
  s +=
    '<text x="' +
    (CANVAS.width - 30) +
    '" y="43" fill="' +
    COLORS.textPrimary +
    '" font-size="9" font-weight="700" letter-spacing="0.7" font-family="' +
    TYPO.primary +
    '" text-anchor="end">' +
    fitText(nickname, 125, 9) +
    '</text>';

  return s;
}

/* ============================================================================
 * BASIC INFO
 * ========================================================================== */

function renderBasicInfo(data: {
  level: number;
  totalMatches: number;
  totalAssets: string | number;
  totalHours: number;
  hitRate: string;
}): string {
  const x = LEFT_COL.x;
  const y = LEFT_COL.y;
  const w = LEFT_COL.w;
  const h = BASIC_INFO_H;

  let s = '';

  s += panelRect(x, y, w, h);
  s += tacticalCorners(x, y, w, h);
  s += panelTitle(x, y, w, 'BASIC INFO');

  let my = y + BI_START_Y;

  /*
   * Operation Level.
   */
  s += metricRow(x + PANEL_PAD, my, 'OPERATION LEVEL', String(data.level));

  /*
   * Level icon.
   */
  s += imageTag(
    ASSETS.icons.level,
    x + PANEL_PAD + getTextWidth(String(data.level), TYPO.valueSize) + 20,
    my + 3,
    15,
    15,
  );

  my += BI_ROW_H;

  /*
   * Matches.
   */
  s += metricRow(x + PANEL_PAD, my, 'MATCHES PLAYED', data.totalMatches.toLocaleString('vi-VN'));

  my += BI_ROW_H;

  /*
   * Assets.
   */
  s += metricRow(x + PANEL_PAD, my, 'CURRENT ASSETS', formatAssets(data.totalAssets));

  my += BI_ROW_H;

  /*
   * Duration.
   */
  s += metricRow(x + PANEL_PAD, my, 'MODE DURATION', formatHoursDecimal(data.totalHours));

  my += BI_ROW_H;

  /*
   * Hit rate.
   */
  s += metricRow(x + PANEL_PAD, my, 'HIT RATE', data.hitRate, COLORS.accent);

  return s;
}

/* ============================================================================
 * CURRENT RANK
 * ========================================================================== */

function renderRank(rankName: string): string {
  const x = RIGHT_COL.x;
  const y = RIGHT_COL.y;
  const w = RIGHT_COL.w;
  const h = RANK_H;

  let s = '';

  s += panelRect(x, y, w, h);
  s += tacticalCorners(x, y, w, h);
  s += panelTitle(x, y, w, 'CURRENT RANK');

  /*
   * Placeholder for the real rank emblem.
   *
   * Real image is composited after SVG rendering using exactly
   * the same top/left coordinates.
   */
  const cx = RANK_CENTER_X;

  const cy = RANK_EMBLEM_TOP + RANK_EMBLEM_SIZE / 2;

  s +=
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    (RANK_EMBLEM_SIZE / 2 - 3) +
    '" fill="rgba(7,10,12,0.36)" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1" opacity="0.75"/>';

  /*
   * Decorative inner ring.
   */
  s +=
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    (RANK_EMBLEM_SIZE / 2 - 10) +
    '" fill="none" stroke="' +
    COLORS.accent +
    '" stroke-width="1" stroke-dasharray="2 6" opacity="0.28"/>';

  /*
   * Rank name.
   */
  s +=
    '<text x="' +
    cx +
    '" y="' +
    (y + h - 18) +
    '" fill="' +
    COLORS.textPrimary +
    '" font-size="12" font-weight="700" letter-spacing="0.9" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">' +
    fitText(rankName, w - 30, 12) +
    '</text>';

  return s;
}

/* ============================================================================
 * MOST USED OPERATOR
 * ========================================================================== */

function renderOperator(): string {
  const x = RIGHT_COL.x;
  const y = RIGHT_COL.y + RANK_H + GAP;

  const w = RIGHT_COL.w;
  const h = OPERATOR_H;

  let s = '';

  s += panelRect(x, y, w, h);
  s += tacticalCorners(x, y, w, h);
  s += panelTitle(x, y, w, 'MOST USED OPERATOR');

  /*
   * Current ViewModel does not expose operator portrait/name.
   *
   * Keep this section compact instead of creating a large empty card.
   */
  const cx = x + w / 2;
  const portraitTop = y + 40;

  s +=
    '<rect x="' +
    (cx - OPERATOR_PORTRAIT_SIZE / 2) +
    '" y="' +
    portraitTop +
    '" width="' +
    OPERATOR_PORTRAIT_SIZE +
    '" height="' +
    OPERATOR_PORTRAIT_SIZE +
    '" rx="2" fill="' +
    COLORS.bgPanelLight +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1"/>';

  /*
   * Placeholder tactical cross.
   */
  s +=
    '<line x1="' +
    (cx - 11) +
    '" y1="' +
    (portraitTop + 21) +
    '" x2="' +
    (cx + 11) +
    '" y2="' +
    (portraitTop + 21) +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1"/>';

  s +=
    '<line x1="' +
    cx +
    '" y1="' +
    (portraitTop + 10) +
    '" x2="' +
    cx +
    '" y2="' +
    (portraitTop + 32) +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1"/>';

  s +=
    '<text x="' +
    cx +
    '" y="' +
    (portraitTop + 25) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="7" font-weight="600" letter-spacing="1" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">' +
    'N/A' +
    '</text>';

  return s;
}

/* ============================================================================
 * SEASON SUMMARY
 * ========================================================================== */

function renderSeasonSummary(data: {
  kills: number;
  extractValue: string | number;
  headshotRate: string;
}): string {
  const x = RIGHT_COL.x;

  const y = RIGHT_COL.y + RANK_H + GAP + OPERATOR_H + GAP;

  const w = RIGHT_COL.w;
  const h = SEASON_H;

  let s = '';

  s += panelRect(x, y, w, h);
  s += tacticalCorners(x, y, w, h);
  s += panelTitle(x, y, w, 'SEASON SUMMARY');

  let sy = y + SS_START_Y;

  /*
   * Kills.
   */
  s += compactMetric(x + PANEL_PAD, sy, 'KILLS', data.kills.toLocaleString('vi-VN'));

  sy += SS_ROW_H;

  /*
   * Extract value.
   */
  s += compactMetric(x + PANEL_PAD, sy, 'EXTRACT VALUE', formatAssets(data.extractValue));

  sy += SS_ROW_H;

  /*
   * Headshot rate.
   */
  s += compactMetric(x + PANEL_PAD, sy, 'HEADSHOT RATE', data.headshotRate, COLORS.accent);

  return s;
}

/* ============================================================================
 * FOOTER
 * ========================================================================== */

function renderFooter(): string {
  let s = '';

  const y = CANVAS.height - 28;

  /*
   * Footer separator.
   */
  s +=
    '<line x1="20" y1="' +
    y +
    '" x2="' +
    (CANVAS.width - 20) +
    '" y2="' +
    y +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1" opacity="0.32"/>';

  /*
   * Left status.
   */
  s +=
    '<text x="24" y="' +
    (CANVAS.height - 14) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="6" font-weight="500" letter-spacing="1.1" font-family="' +
    TYPO.primary +
    '">' +
    'SYSTEM STATUS // OPERATIONAL' +
    '</text>';

  /*
   * Right branding.
   */
  s +=
    '<text x="' +
    (CANVAS.width - 24) +
    '" y="' +
    (CANVAS.height - 14) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="6" font-weight="400" letter-spacing="0.8" font-family="' +
    TYPO.primary +
    '" text-anchor="end">' +
    'DELTA FORCE STATS · POWERED BY KLB BOT' +
    '</text>';

  return s;
}

/* ============================================================================
 * UI HELPERS
 * ========================================================================== */

/**
 * HUD panel.
 *
 * Transparent enough to preserve the background while keeping text readable.
 */
function panelRect(x: number, y: number, w: number, h: number): string {
  return (
    '<rect x="' +
    x +
    '" y="' +
    y +
    '" width="' +
    w +
    '" height="' +
    h +
    '" rx="' +
    RADIUS.sm +
    '" fill="rgba(8,12,14,0.72)" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1" opacity="0.94"/>'
  );
}

/**
 * Tactical corner brackets.
 *
 * The corners are intentionally subtle.
 */
function tacticalCorners(x: number, y: number, w: number, h: number): string {
  const accent = COLORS.accent;

  let s = '';

  /*
   * Top-left.
   */
  s +=
    '<path d="M ' +
    (x + 2) +
    ' ' +
    (y + 12) +
    ' L ' +
    (x + 2) +
    ' ' +
    (y + 2) +
    ' L ' +
    (x + 12) +
    ' ' +
    (y + 2) +
    '" fill="none" stroke="' +
    accent +
    '" stroke-width="1.5" opacity="0.68"/>';

  /*
   * Top-right.
   */
  s +=
    '<path d="M ' +
    (x + w - 12) +
    ' ' +
    (y + 2) +
    ' L ' +
    (x + w - 2) +
    ' ' +
    (y + 2) +
    ' L ' +
    (x + w - 2) +
    ' ' +
    (y + 12) +
    '" fill="none" stroke="' +
    accent +
    '" stroke-width="1.5" opacity="0.68"/>';

  /*
   * Bottom-left.
   */
  s +=
    '<path d="M ' +
    (x + 2) +
    ' ' +
    (y + h - 12) +
    ' L ' +
    (x + 2) +
    ' ' +
    (y + h - 2) +
    ' L ' +
    (x + 12) +
    ' ' +
    (y + h - 2) +
    '" fill="none" stroke="' +
    accent +
    '" stroke-width="1.5" opacity="0.4"/>';

  /*
   * Bottom-right.
   */
  s +=
    '<path d="M ' +
    (x + w - 12) +
    ' ' +
    (y + h - 2) +
    ' L ' +
    (x + w - 2) +
    ' ' +
    (y + h - 2) +
    ' L ' +
    (x + w - 2) +
    ' ' +
    (y + h - 12) +
    '" fill="none" stroke="' +
    accent +
    '" stroke-width="1.5" opacity="0.4"/>';

  return s;
}

/**
 * Panel title and divider.
 */
function panelTitle(x: number, y: number, w: number, title: string): string {
  let s = '';

  s +=
    '<text x="' +
    (x + PANEL_PAD) +
    '" y="' +
    (y + TITLE_Y) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" letter-spacing="1.05" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.7)" stroke-width="0.5" stroke-opacity="0.65" paint-order="stroke fill">' +
    title +
    '</text>';

  /*
   * Full divider.
   */
  s +=
    '<line x1="' +
    (x + PANEL_PAD) +
    '" y1="' +
    (y + DIVIDER_Y) +
    '" x2="' +
    (x + w - PANEL_PAD) +
    '" y2="' +
    (y + DIVIDER_Y) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1" opacity="0.62"/>';

  /*
   * Accent segment.
   */
  s +=
    '<line x1="' +
    (x + PANEL_PAD) +
    '" y1="' +
    (y + DIVIDER_Y) +
    '" x2="' +
    (x + PANEL_PAD + 26) +
    '" y2="' +
    (y + DIVIDER_Y) +
    '" stroke="' +
    COLORS.accent +
    '" stroke-width="1.5" opacity="0.72"/>';

  return s;
}

/**
 * Standard vertical metric.
 *
 * Label
 * Value
 */
function metricRow(
  x: number,
  y: number,
  label: string,
  value: string,
  valueColor: string = COLORS.textPrimary,
): string {
  let s = '';

  s +=
    '<text x="' +
    x +
    '" y="' +
    y +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.labelSize +
    '" font-weight="' +
    TYPO.labelWeight +
    '" letter-spacing="0.75" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.65)" stroke-width="0.4" paint-order="stroke fill">' +
    label +
    '</text>';

  s +=
    '<text x="' +
    x +
    '" y="' +
    (y + 17) +
    '" fill="' +
    valueColor +
    '" font-size="' +
    TYPO.valueSize +
    '" font-weight="' +
    TYPO.valueWeight +
    '" letter-spacing="0.25" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.75)" stroke-width="0.5" paint-order="stroke fill">' +
    value +
    '</text>';

  return s;
}

/**
 * Compact horizontal metric.
 *
 * LABEL                    VALUE
 */
function compactMetric(
  x: number,
  y: number,
  label: string,
  value: string,
  valueColor: string = COLORS.textPrimary,
): string {
  const right = RIGHT_COL.x + RIGHT_COL.w - PANEL_PAD;

  let s = '';

  s +=
    '<text x="' +
    x +
    '" y="' +
    y +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.labelSize +
    '" font-weight="' +
    TYPO.labelWeight +
    '" letter-spacing="0.6" font-family="' +
    TYPO.primary +
    '">' +
    label +
    '</text>';

  s +=
    '<text x="' +
    right +
    '" y="' +
    y +
    '" fill="' +
    valueColor +
    '" font-size="' +
    TYPO.valueSize +
    '" font-weight="' +
    TYPO.valueWeight +
    '" font-family="' +
    TYPO.primary +
    '" text-anchor="end" stroke="rgba(0,0,0,0.7)" stroke-width="0.5" paint-order="stroke fill">' +
    fitText(value, 100, TYPO.valueSize) +
    '</text>';

  /*
   * Subtle separator.
   */
  s +=
    '<line x1="' +
    x +
    '" y1="' +
    (y + 9) +
    '" x2="' +
    right +
    '" y2="' +
    (y + 9) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="0.5" opacity="0.3"/>';

  return s;
}

/**
 * Convert local path → file:// URI for SVG <image>.
 */
function toFileUri(filePath: string): string {
  const resolved = path.resolve(filePath);

  return 'file://' + resolved.replace(/\\/g, '/');
}

/**
 * SVG <image> helper.
 */
function imageTag(href: string, x: number, y: number, w: number, h: number): string {
  return (
    '<image href="' +
    toFileUri(href) +
    '" x="' +
    x +
    '" y="' +
    y +
    '" width="' +
    w +
    '" height="' +
    h +
    '" preserveAspectRatio="none"/>'
  );
}

/**
 * Approximate text width.
 *
 * Only used for positioning the level icon.
 */
function getTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}
