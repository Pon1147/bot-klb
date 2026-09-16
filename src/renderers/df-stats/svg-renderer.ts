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
 * FIXED SAFE-ZONE LAYOUT
 * ========================================================================== */

/**
 * Tọa độ cố định có chủ đích.
 *
 * Không tính right column từ canvas width.
 * Background composition cố định, nên UI safe zones cũng cố định.
 *
 * Canvas kỳ vọng 1280px dựa trên renderer config hiện tại.
 */

/** Khoảng trống bên trái background. */
const LEFT_COL = {
  x: 24,
  y: 78,
  w: 226,
};

/** Khoảng trống bên phải background. */
const RIGHT_COL = {
  x: CANVAS.width - 24 - 226,
  y: 78,
  w: 226,
};

const GAP = 12;

const HEADER_H = 56;

/* Panel trái */
const BASIC_INFO_H = 270;

/* Panel phải */
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
   * Nhãn Operations.
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
   * Nhãn phụ nhỏ.
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
   * Operation Level — CSS accent làm nổi bật value.
   */
  s += metricRow(x + PANEL_PAD, my, 'OPERATION LEVEL', String(data.level), COLORS.accent);

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
   * Placeholder cho ảnh rank thật.
   *
   * Ảnh thật được composite sau SVG render
   * với cùng tọa độ top/left.
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
   * Vòng tròn trang trí inner.
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
   * Tên rank.
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
   * ViewModel hiện tại chưa expose operator portrait/name.
   *
   * Giữ section compact thay vì tạo card trống lớn.
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
   * Cross tactical placeholder.
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
 * HUD panel.
 *
 * Translucent đủ để giữ background trong khi text vẫn readable.
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
 * Góc tactical brackets.
 *
 * Các góc cố ý tinh tế.
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
 * Panel title và divider.
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
   * Divider đầy đủ.
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
   * Segment accent.
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
 * Metric dọc tiêu chuẩn.
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
 * Metric ngang compact.
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
   * Separator tinh tế.
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
