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
 * Uses SVG for text/UI rendering và Sharp cho image compositing.
 */

import path from 'path';
import sharp from 'sharp';
import type { DFStatsViewModel } from './types.js';
import { CANVAS, COLORS, TYPO, RADIUS, ASSETS } from '../../config/df-stats-renderer.config.js';
import { fitText, formatAssets, formatHoursDecimal } from './utils/text-fit.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const BACKGROUND_PATH = path.join(__dirname, '../../assets/delta-force/backgrounds/stinger.png');

/**
 * Giữ operator/background visible.
 *
 * Overlay 0.50 cũ khá nặng.
 * Các panel cạnh đã đủ tạo separation thị giác.
 */
const DARK_OVERLAY_COLOR = 'rgba(7,10,12,0.38)';

/* ============================================================================
 * FIXED SAFE-ZONE LAYOUT (v2 — reference composition)
 * ========================================================================== */

/**
 * Tọa độ cố định có chủ đích.
 *
 * Không tính right column từ canvas width.
 * Background composition cố định, nên UI safe zones cũng cố định.
 *
 * Canvas kỳ vọng 1280px dựa trên renderer config hiện tại.
 * Reference: 512×288 → scale 2.5x = 1280×720
 */

/** Khoảng trống bên trái background — Basic Info panel (v3: +15% from v2) */
const LEFT_COL = {
  x: 24,
  y: 78,
  w: 342, // 298 * 1.15 (panel wider)
};

/** Khoảng trống bên phải background — Rank + Operator + Season (v3: +15% from v2) */
const RIGHT_COL = {
  x: CANVAS.width - 24 - 342,
  y: 78,
  w: 342,
};

const GAP = 12; // 16 → 12 (tighter gap between right panels)

const HEADER_H = 56;

/* Panel trái — 9 metrics, 2-column grid (v3: larger) */
const BASIC_INFO_H = 430; // 379 → 430 (taller panels)

/* Panel phải (v3: larger panels) */
const RANK_H = 310; // 279 → 310 (more rank prominence)
const OPERATOR_H = 165; // 148 → 165 (secondary but readable)
const SEASON_H = 200; // 180 → 200 (secondary but spacious)

/* Panel internals (v3: more spacious) */
const PANEL_PAD = 18; // 14 → 18 (more breathing room)
const TITLE_Y = 26; // 22 → 26
const DIVIDER_Y = 38; // 34 → 38

/* Basic info — 2-column grid layout (v3: wider cols) */
const BI_START_Y = 57;
const BI_COL_W = 155; // 121 → 155 (wider cols for larger panels)
const BI_ROW_H = 50; // 44 → 50 (more breathing room)

/* Rank (v3: larger emblem for bigger panel) */
const RANK_EMBLEM_SIZE = 200; // 174 → 200 (prominent rank)
const RANK_EMBLEM_TOP = RIGHT_COL.y + 65; // 55 → 65 (re-center)
const RANK_CENTER_X = RIGHT_COL.x + RIGHT_COL.w / 2;

/* Operator (v3: larger portrait) */
const OPERATOR_PORTRAIT_SIZE = 65; // 51 → 65 (more visible)

/* Season (v3: larger rows) */
const SS_START_Y = 70; // 64 → 70 (more spacing)
const SS_ROW_H = 44; // 38 → 44 (spacious rows)

/* ============================================================================
 * RENDER ENTRY
 * ========================================================================== */

/** Render dashboard image từ ViewModel. */
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
   * SVG có placeholder circle.
   * Ảnh rank thật được composite cùng tọa độ chính xác.
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
       * Giữ SVG placeholder.
       */
    }
  }

  /* --------------------------------------------------------------------------
   * Player avatar
   *
   * Avatar nằm ở header, không can thiệp vào
   * operator centered trong background.
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
       * Bỏ qua nếu avatar fail.
       */
    }
  }

  /*
   * Operator portrait không render ở đây.
   *
   * Operator center đã là phần của BACKGROUND_PATH.
   */

  return composite;
}

/* ============================================================================
 * SVG ROOT
 * ========================================================================== */

function buildSVG(vm: DFStatsViewModel): string {
  const { nickname, level, playDurationHours, playDurationMinutes, totalMatches } = vm.player;

  const { name: rankName, score: rankScore } = vm.rank;

  const totalAssets = vm.economy?.totalReward ?? '0';
  const hitRate = vm.combat?.hitRate ?? '0%';

  const totalHours = playDurationHours + playDurationMinutes / 60;

  const kills = vm.combat?.kills ?? 0;
  const extractValue = vm.economy?.extractValue ?? '0';
  const headshotRate = vm.combat?.headshotRate ?? '—';

  // New metrics for 2-column grid
  const extractionRate = vm.economy?.extractionRate ?? '0%';
  const numberOfExtractions = vm.economy?.numberOfExtractions ?? 0;
  const averageAssetsPerMatch = vm.economy?.averageAssetsPerMatch ?? '0';
  const collectionQuantity = vm.economy?.collectionQuantity ?? 0;
  const operatorsKilled = vm.combat?.operatorsKilled ?? 0;

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
   * Left side — 2-column grid (9 metrics)
   * ------------------------------------------------------------------------ */

  s += renderBasicInfo({
    level,
    totalMatches,
    totalAssets,
    totalHours,
    hitRate,
    extractionRate,
    numberOfExtractions,
    averageAssetsPerMatch,
    collectionQuantity,
    operatorsKilled,
  });

  /* --------------------------------------------------------------------------
   * Right side — Rank + Operator + Season
   * ------------------------------------------------------------------------ */

  s += renderRank(rankName, rankScore);
  s += renderOperator(vm.player.mostUsedOperator);
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
   * Accent tactical xanh lá ngắn.
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
   * Logo Delta Force.
   */
  s += imageTag(ASSETS.logos.deltaForce, 24, 10, 112, 26);

  /*
   * Nhãn Operations — tactical green accent.
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
   * Nhãn phụ nhỏ — muted.
   */
  s +=
    '<text x="148" y="42" fill="' +
    COLORS.textMuted +
    '" font-size="7" font-weight="400" letter-spacing="1.4" font-family="' +
    TYPO.primary +
    '">' +
    'PERSONNEL // FIELD RECORD' +
    '</text>';

  /*
   * Logo publisher.
   */
  s += imageTag(ASSETS.logos.timi, CANVAS.width - 126, 10, 44, 20);

  s += imageTag(ASSETS.logos.teamJade, CANVAS.width - 74, 10, 46, 20);

  /*
   * Tên người chơi.
   *
   * Đặt dưới logos để dễ đọc và không
   * cạnh tranh với operator center composition.
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
 * BASIC INFO — 2-column grid (9 metrics)
 * ========================================================================== */

function renderBasicInfo(data: {
  level: number;
  totalMatches: number;
  totalAssets: string | number;
  totalHours: number;
  hitRate: string;
  extractionRate: string;
  numberOfExtractions: number;
  averageAssetsPerMatch: string;
  collectionQuantity: number;
  operatorsKilled: number;
}): string {
  const x = LEFT_COL.x;
  const y = LEFT_COL.y;
  const w = LEFT_COL.w;
  const h = BASIC_INFO_H;

  let s = '';

  s += panelRect(x, y, w, h);
  s += tacticalCorners(x, y, w, h);
  s += panelTitle(x, y, w, 'BASIC INFO');

  /*
   * 2-column grid layout.
   *
   * Col 1: x + PANEL_PAD
   * Col 2: x + PANEL_PAD + BI_COL_W
   *
   * Row spacing: BI_ROW_H
   */

  const col1x = x + PANEL_PAD;
  const col2x = x + PANEL_PAD + BI_COL_W;

  let row = 0;

  /* Row 0: Operation Level | Total Matches */
  s += metricRow(
    col1x,
    y + BI_START_Y + row * BI_ROW_H,
    'OPERATION LEVEL',
    String(data.level),
    COLORS.accent,
  );
  s += metricRow(
    col2x,
    y + BI_START_Y + row * BI_ROW_H,
    'TOTAL MATCHES',
    data.totalMatches.toLocaleString('vi-VN'),
  );
  row++;

  /* Row 1: Current Assets | Mode Duration */
  s += metricRow(
    col1x,
    y + BI_START_Y + row * BI_ROW_H,
    'CURRENT ASSETS',
    formatAssets(data.totalAssets),
  );
  s += metricRow(
    col2x,
    y + BI_START_Y + row * BI_ROW_H,
    'MODE DURATION',
    formatHoursDecimal(data.totalHours),
  );
  row++;

  /* Row 2: Extraction Rate | Number of Extractions */
  s += metricRow(
    col1x,
    y + BI_START_Y + row * BI_ROW_H,
    'EXTRACTION RATE',
    data.extractionRate,
    COLORS.accent,
  );
  s += metricRow(
    col2x,
    y + BI_START_Y + row * BI_ROW_H,
    'EXTRACTIONS',
    String(data.numberOfExtractions),
  );
  row++;

  /* Row 3: Avg Assets/Match | Collection Quantity */
  s += metricRow(
    col1x,
    y + BI_START_Y + row * BI_ROW_H,
    'AVG ASSETS/MATCH',
    data.averageAssetsPerMatch,
  );
  s += metricRow(
    col2x,
    y + BI_START_Y + row * BI_ROW_H,
    'COLLECTION',
    String(data.collectionQuantity),
  );
  row++;

  /* Row 4: Hit Rate | Operators Killed */
  s += metricRow(col1x, y + BI_START_Y + row * BI_ROW_H, 'HIT RATE', data.hitRate, COLORS.accent);
  s += metricRow(
    col2x,
    y + BI_START_Y + row * BI_ROW_H,
    'OPERATORS KILLED',
    String(data.operatorsKilled),
  );

  return s;
}

/* ============================================================================
 * CURRENT RANK — large emblem, score, gold accent
 * ========================================================================== */

function renderRank(rankName: string, rankScore: number): string {
  const x = RIGHT_COL.x;
  const y = RIGHT_COL.y;
  const w = RIGHT_COL.w;
  const h = RANK_H;

  let s = '';

  s += panelRect(x, y, w, h);
  s += tacticalCorners(x, y, w, h);
  s += panelTitle(x, y, w, 'CURRENT RANK');

  /*
   * Placeholder cho ảnh rank thật.
   *
   * Ảnh thật được composite sau SVG render
   * với cùng tọa độ top/left.
   */
  const cx = RANK_CENTER_X;
  const cy = RANK_EMBLEM_TOP + RANK_EMBLEM_SIZE / 2;

  /*
   * Outer circle — dark bg for rank emblem (thicker border, v2)
   */
  s +=
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    (RANK_EMBLEM_SIZE / 2 - 3) +
    '" fill="rgba(7,10,12,0.55)" stroke="' +
    COLORS.rankGold +
    '" stroke-width="2" opacity="0.9"/>';

  /*
   * Inner decorative circle — gold accent (stronger, double ring)
   */
  s +=
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    (RANK_EMBLEM_SIZE / 2 - 10) +
    '" fill="none" stroke="' +
    COLORS.rankGold +
    '" stroke-width="1.5" stroke-dasharray="3 5" opacity="0.55"/>';

  /*
   * Outer thin ring — extra depth
   */
  s +=
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    (RANK_EMBLEM_SIZE / 2 + 2) +
    '" fill="none" stroke="' +
    COLORS.rankGoldDim +
    '" stroke-width="0.5" opacity="0.3"/>';

  /*
   * Rank score — numeric value below emblem (larger, bold).
   * Dùng textSecondary (sáng) để readable trên panel tối.
   */
  s +=
    '<text x="' +
    cx +
    '" y="' +
    (RANK_EMBLEM_TOP + RANK_EMBLEM_SIZE + 22) +
    '" fill="' +
    COLORS.rankGold +
    '" font-size="14" font-weight="700" letter-spacing="0.6" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">' +
    rankScore.toLocaleString('vi-VN') +
    '</text>';

  /*
   * Rank name — centered, bold, gold accent
   */
  s +=
    '<text x="' +
    cx +
    '" y="' +
    (y + h - 14) +
    '" fill="' +
    COLORS.rankGold +
    '" font-size="12" font-weight="700" letter-spacing="1.0" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">' +
    fitText(rankName, w - 30, 12) +
    '</text>';

  return s;
}

/* ============================================================================
 * MOST USED OPERATOR — portrait + name
 * ========================================================================== */

function renderOperator(mostUsedOperator?: string): string {
  const x = RIGHT_COL.x;
  const y = RIGHT_COL.y + RANK_H + GAP;

  const w = RIGHT_COL.w;
  const h = OPERATOR_H;

  let s = '';

  s += panelRect(x, y, w, h);
  s += tacticalCorners(x, y, w, h);
  s += panelTitle(x, y, w, 'MOST USED OPERATOR');

  const cx = x + w / 2;
  const portraitTop = y + 32;

  /*
   * Portrait placeholder — secondary (smaller, muted)
   */
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
    'rgba(10,16,19,0.6)' +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="0.5" opacity="0.7"/>';

  /*
   * Cross tactical placeholder (thinner, secondary).
   */
  s +=
    '<line x1="' +
    (cx - 9) +
    '" y1="' +
    (portraitTop + OPERATOR_PORTRAIT_SIZE / 2) +
    '" x2="' +
    (cx + 9) +
    '" y2="' +
    (portraitTop + OPERATOR_PORTRAIT_SIZE / 2) +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="0.5" opacity="0.5"/>';

  s +=
    '<line x1="' +
    cx +
    '" y1="' +
    (portraitTop + 8) +
    '" x2="' +
    cx +
    '" y2="' +
    (portraitTop + OPERATOR_PORTRAIT_SIZE - 8) +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="0.5" opacity="0.5"/>';

  /*
   * Operator name — secondary (smaller, muted)
   */
  const operatorLabel = mostUsedOperator || 'N/A';
  s +=
    '<text x="' +
    cx +
    '" y="' +
    (portraitTop + OPERATOR_PORTRAIT_SIZE + 14) +
    '" fill="' +
    COLORS.textSecondary +
    '" font-size="8" font-weight="500" letter-spacing="0.5" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">' +
    fitText(operatorLabel, w - 28, 8) +
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
   * Status trái.
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
   * Branding phải.
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
 * HUD panel — dark charcoal, semi-transparent.
 *
 * Reference: rgba(10-25,25-35,25-35,0.70-0.90)
 *
 * v2: Giảm border weight để giảm "card" feel.
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
    '" fill="' +
    COLORS.bgPanel +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="0.5" opacity="0.6"/>'
  );
}

/**
 * Góc tactical brackets.
 *
 * Các góc cố ý tinh tế.
 */
function tacticalCorners(x: number, y: number, w: number, h: number): string {
  const accent = COLORS.accent;

  let s = '';

  /*
   * Top-left (v2: reduced opacity for less card feel).
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
    '" stroke-width="1" opacity="0.45"/>';

  /*
   * Top-right (v2: reduced opacity).
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
    '" stroke-width="1" opacity="0.45"/>';

  /*
   * Bottom-left (v2: reduced opacity).
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
    '" stroke-width="1" opacity="0.25"/>';

  /*
   * Bottom-right (v2: reduced opacity).
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
    '" stroke-width="1" opacity="0.25"/>';

  return s;
}

/**
 * Panel title và divider (v2: reduced weight for less card feel).
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
    '" stroke="rgba(0,0,0,0.6)" stroke-width="0.4" stroke-opacity="0.5" paint-order="stroke fill">' +
    title +
    '</text>';

  /*
   * Divider (v2: thinner, more transparent).
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
    '" stroke-width="0.5" opacity="0.35"/>';

  /*
   * Segment accent (v2: thinner).
   */
  s +=
    '<line x1="' +
    (x + PANEL_PAD) +
    '" y1="' +
    (y + DIVIDER_Y) +
    '" x2="' +
    (x + PANEL_PAD + 22) +
    '" y2="' +
    (y + DIVIDER_Y) +
    '" stroke="' +
    COLORS.accent +
    '" stroke-width="1" opacity="0.55"/>';

  return s;
}

/**
 * Metric dọc tiêu chuẩn — 2-column grid (v3: large, clear).
 *
 * LABEL (8px, muted, uppercase)
 * VALUE (24px, bold, prominent — reference game UI style)
 */
function metricRow(
  x: number,
  y: number,
  label: string,
  value: string,
  valueColor: string = COLORS.textPrimary,
): string {
  let s = '';

  /*
   * Label — small, uppercase, muted (reference: tiny gray labels)
   */
  s +=
    '<text x="' +
    x +
    '" y="' +
    y +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="8" font-weight="500" letter-spacing="0.8" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.7)" stroke-width="0.4" paint-order="stroke fill">' +
    label +
    '</text>';

  /*
   * Value — LARGE, bold, visual anchor (reference: big prominent numbers)
   * Dark stroke for readability on dark panel bg
   */
  s +=
    '<text x="' +
    x +
    '" y="' +
    (y + 24) +
    '" fill="' +
    valueColor +
    '" font-size="24" font-weight="800" letter-spacing="0.15" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.8)" stroke-width="0.6" paint-order="stroke fill">' +
    fitText(value, BI_COL_W - 6, 24) +
    '</text>';

  return s;
}

/**
 * Metric ngang compact (v2: smaller, secondary).
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
    '" font-size="7" font-weight="400" letter-spacing="0.5" font-family="' +
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
    '" font-size="16" font-weight="600" font-family="' +
    TYPO.primary +
    '" text-anchor="end" stroke="rgba(0,0,0,0.6)" stroke-width="0.4" paint-order="stroke fill">' +
    fitText(value, 100, 16) +
    '</text>';

  /*
   * Separator (v2: thinner).
   */
  s +=
    '<line x1="' +
    x +
    '" y1="' +
    (y + 8) +
    '" x2="' +
    right +
    '" y2="' +
    (y + 8) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="0.3" opacity="0.25"/>';

  return s;
}

/**
 * Convert local path → file:// URI cho SVG <image>.
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
