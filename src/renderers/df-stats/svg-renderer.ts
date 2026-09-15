/**
 * SVG Dashboard Renderer — AAA military tactical shooter UI.
 * Rebuilt geometry: fixed-width left/right columns, center free space.
 *
 * Sharp/libvips SVG parser strict:
 * - KHÔNG HTML comments (<!-- -->)
 * - font-family đơn giản (dùng single-quote escaped)
 * - self-closing tags
 */

import path from 'path';
import sharp from 'sharp';
import type { DFStatsViewModel } from './types.js';
import { CANVAS, COLORS, TYPO, RADIUS, ASSETS } from '../../config/df-stats-renderer.config.js';
import { fitText, formatAssets, formatHoursDecimal } from './utils/text-fit.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BACKGROUND_PATH = path.join(__dirname, '../../assets/delta-force/backgrounds/stinger.png');
const DARK_OVERLAY_COLOR = 'rgba(7,10,12,0.50)';

/** Render dashboard image từ ViewModel. */
export async function renderDashboard(viewModel: DFStatsViewModel): Promise<Buffer> {
  const svgContent = buildSVG(viewModel);

  const svgBuffer = Buffer.from(svgContent, 'utf-8');

  // Gradient overlay làm background fallback nếu ảnh không load được
  const gradientOverlay = Buffer.from(
    '<svg xmlns="' +
      SVG_NS +
      '" width="' +
      CANVAS.width +
      '" height="' +
      CANVAS.height +
      '">' +
      '<defs><radialGradient id="bg" cx="50%" cy="50%" r="70%">' +
      '<stop offset="0%" stop-color="#111619"/>' +
      '<stop offset="100%" stop-color="#070A0C"/>' +
      '</radialGradient></defs>' +
      '<rect width="' +
      CANVAS.width +
      '" height="' +
      CANVAS.height +
      '" fill="url(#bg)"/>' +
      '</svg>',
    'utf-8',
  );

  // Load background (fallback nếu không tìm thấy file)
  let bgBuffer: Buffer;
  try {
    bgBuffer = await sharp(BACKGROUND_PATH)
      .resize(CANVAS.width, CANVAS.height, { fit: 'cover', position: 'center' })
      .toBuffer();
  } catch {
    bgBuffer = await sharp(gradientOverlay).toBuffer();
  }

  // Dark overlay lên background
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

  // Composite: bg → dark overlay → SVG panels → rank emblem → avatar
  let composite = await sharp(bgBuffer)
    .composite([
      { input: darkOverlay, top: 0, left: 0 },
      {
        input: await sharp(svgBuffer).resize(CANVAS.width, CANVAS.height).toBuffer(),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  // Rank emblem overlay — load ảnh thật từ Delta Force HQ
  if (viewModel.rank.imageUrl) {
    try {
      const rankArrayBuffer = await fetch(viewModel.rank.imageUrl).then((r) => r.arrayBuffer());
      const rankBuffer = await sharp(Buffer.from(new Uint8Array(rankArrayBuffer)))
        .resize(120, 120)
        .png()
        .toBuffer();
      // Right column center X
      const rkCx = RIGHT_COL.x + RIGHT_COL.w / 2;
      // Emblem center matches SVG circle cy (rankSection.y + 80)
      composite = await sharp(composite)
        .composite([{ input: rankBuffer, top: 52, left: rkCx - 60 }])
        .png()
        .toBuffer();
    } catch {
      // Fallback: giữ circle placeholder
    }
  }

  // Avatar overlay (nếu có)
  if (viewModel.player.avatarUrl) {
    try {
      const avatarArrayBuffer = await fetch(viewModel.player.avatarUrl).then((r) =>
        r.arrayBuffer(),
      );
      const avatarBuffer = await sharp(Buffer.from(new Uint8Array(avatarArrayBuffer)))
        .resize(40, 40)
        .png()
        .toBuffer();
      composite = await sharp(composite)
        .composite([{ input: avatarBuffer, top: 8, left: 1180 }])
        .png()
        .toBuffer();
    } catch {
      // Fallback: bỏ qua avatar
    }
  }

  // Operator portrait overlay (预留 — cần API data để populate)
  // TODO: Khi có mostUsedOperator data, enable lại overlay này

  return composite;
}

// ============================================================================
// LAYOUT DEFINITIONS — fixed column widths, content-driven section heights
// ============================================================================

/** Left column: PLAYER PROFILE + BASIC INFO + COMBAT STATS + SQUAD STATS */
const LEFT_COL = { x: 20, w: 380 };

/** Right column: CURRENT RANK + MOST USED OPERATOR + SEASON SUMMARY */
const RIGHT_COL = { x: CANVAS.width - 20 - 380, w: 380 };

/** Spacing between sections within a column */
const GAP = 10;

/** Top padding from canvas edge */
const TOP_PAD = 20;

/** Section heights (content-driven) — fit canvas 740px (right column constraint) */
const PROFILE_H = 36;
const BI_H = 280;
const CB_H = 200;
const SQ_H = 160;
const RK_H = 160;
const OP_H = 140;
const SS_H = 158;

/** Footer Y position — 4px từ cạnh dưới canvas 740px */
const FOOTER_Y = 716;

// ============================================================================
// SECTION POSITIONS (derived from layout constants)
// ============================================================================

/** PLAYER PROFILE header bar */
const PROFILE_SECTION = { y: TOP_PAD, h: PROFILE_H };

/** BASIC INFO — left column, below profile */
const BI_SECTION = { y: PROFILE_SECTION.y + PROFILE_SECTION.h + GAP, h: BI_H };

/** COMBAT STATS — left column */
const CB_SECTION = { y: BI_SECTION.y + BI_SECTION.h + GAP, h: CB_H };

/** SQUAD STATS — left column */
const SQ_SECTION = { y: CB_SECTION.y + CB_SECTION.h + GAP, h: SQ_H };

/** CURRENT RANK — right column */
const RK_SECTION = { y: TOP_PAD, h: RK_H };

/** MOST USED OPERATOR — right column */
const OP_SECTION = { y: RK_SECTION.y + RK_SECTION.h + GAP, h: OP_H };

/** SEASON SUMMARY — right column */
const SS_SECTION = { y: OP_SECTION.y + OP_SECTION.h + GAP, h: SS_H };

// ============================================================================
// INTERNAL GRID POSITIONS
// ============================================================================

/** Basic Info: 2-column grid, 5 rows — giảm gap để fit section height */
const BI_PAD = 14;
const BI_COL_X = [LEFT_COL.x + BI_PAD, LEFT_COL.x + LEFT_COL.w / 2 + BI_PAD];
const BI_ROW_GAP = 44;
const BI_BASE_Y = BI_SECTION.y + 28;
const BI_LABEL_VAL_GAP = 10;

/** Combat Stats: 2-column grid, 4 rows */
const CB_PAD = 14;
const CB_COL_X = [LEFT_COL.x + CB_PAD, LEFT_COL.x + LEFT_COL.w / 2 + CB_PAD];
const CB_ROW_GAP = 36;
const CB_BASE_Y = CB_SECTION.y + 26;
const CB_LABEL_VAL_GAP = 10;

/** Squad Stats: 2-column grid, 3 rows */
const SQ_PAD = 14;
const SQ_COL_X = [LEFT_COL.x + SQ_PAD, LEFT_COL.x + LEFT_COL.w / 2 + SQ_PAD];
const SQ_ROW_GAP = 36;
const SQ_BASE_Y = SQ_SECTION.y + 26;
const SQ_LABEL_VAL_GAP = 10;

/** Rank: centered emblem + name + score */
const RK_CX = RIGHT_COL.x + RIGHT_COL.w / 2;
const RK_EMBLEM_CY = RK_SECTION.y + 76;

/** Most Used Operator: centered portrait + name */
const OP_CX = RIGHT_COL.x + RIGHT_COL.w / 2;
const OP_PORTRAIT_CY = OP_SECTION.y + 56;

/** Season Summary: 3 rows, 2-column grid */
const SS_PAD = 14;
const SS_COL_X = [RIGHT_COL.x + SS_PAD, RIGHT_COL.x + RIGHT_COL.w / 2 + SS_PAD];
const SS_ROW_GAP = 36;
const SS_BASE_Y = SS_SECTION.y + 26;
const SS_LABEL_VAL_GAP = 10;

// ============================================================================
// RENDER
// ============================================================================

/** Build SVG string — military game UI. */
function buildSVG(vm: DFStatsViewModel): string {
  const { nickname, level, playDurationHours, playDurationMinutes, totalMatches } = vm.player;
  const { name: rankName, score: rankScore } = vm.rank;

  const r = RADIUS.sm;

  // Build SVG
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

  // ===== HEADER BAR =====
  // Delta Force logo (left)
  s += imageTag(ASSETS.logos.deltaForce, 20, 8, 120, 28);
  // "OPERATIONS" label (hardcoded, accent green)
  s +=
    '<text x="150" y="28" fill="' +
    COLORS.accent +
    '" font-size="18" font-weight="700" font-family="' +
    TYPO.primary +
    '">OPERATIONS</text>';
  // TIMI + Team Jade logos (right)
  s += imageTag(ASSETS.logos.timi, CANVAS.width - 140, 10, 60, 24);
  s += imageTag(ASSETS.logos.teamJade, CANVAS.width - 70, 10, 60, 24);
  // Username (right-aligned, below header)
  s +=
    '<text x="' +
    (CANVAS.width - 30) +
    '" y="44" fill="' +
    COLORS.textPrimary +
    '" font-size="11" font-weight="600" font-family="' +
    TYPO.primary +
    '" text-anchor="end">' +
    fitText(nickname, 100, 11) +
    '</text>';

  // ===== LEFT COLUMN =====

  // --- PLAYER PROFILE header bar ---
  s += panelRect(LEFT_COL.x, PROFILE_SECTION.y, LEFT_COL.w, PROFILE_SECTION.h, r);
  s +=
    '<text x="' +
    (LEFT_COL.x + BI_PAD) +
    '" y="' +
    (PROFILE_SECTION.y + 24) +
    '" fill="' +
    COLORS.textPrimary +
    '" font-size="' +
    TYPO.sectionSize +
    '" font-weight="' +
    TYPO.sectionWeight +
    '" font-family="' +
    TYPO.primary +
    '" letter-spacing="3">PLAYER PROFILE</text>';
  // Accent line under title
  s +=
    '<line x1="' +
    (LEFT_COL.x + BI_PAD) +
    '" y1="' +
    (PROFILE_SECTION.y + 30) +
    '" x2="' +
    (LEFT_COL.x + LEFT_COL.w - BI_PAD) +
    '" y2="' +
    (PROFILE_SECTION.y + 30) +
    '" stroke="' +
    COLORS.accent +
    '" stroke-width="1.5"/>';
  // Corner markers
  s += cornerMark(LEFT_COL.x + 4, PROFILE_SECTION.y + 4, 8, 8);
  s += cornerMark(LEFT_COL.x + LEFT_COL.w - 12, PROFILE_SECTION.y + 4, 4, 8, -1, 1);

  // --- BASIC INFO ---
  s += panelRect(LEFT_COL.x, BI_SECTION.y, LEFT_COL.w, BI_SECTION.h, r);
  s += cornerMark(LEFT_COL.x + 4, BI_SECTION.y + 4, 8, 8);
  s += cornerMark(LEFT_COL.x + LEFT_COL.w - 12, BI_SECTION.y + 4, 4, 8, -1, 1);
  // Title
  s +=
    '<text x="' +
    (LEFT_COL.x + BI_PAD) +
    '" y="' +
    (BI_SECTION.y + 20) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.6)" stroke-width="0.5" stroke-opacity="0.6" paint-order="stroke fill">' +
    'BASIC INFO</text>';
  s +=
    '<line x1="' +
    (LEFT_COL.x + BI_PAD) +
    '" y1="' +
    (BI_SECTION.y + 26) +
    '" x2="' +
    (LEFT_COL.x + LEFT_COL.w - BI_PAD) +
    '" y2="' +
    (BI_SECTION.y + 26) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  // Row 1: Operation Level + icon | Total Matches Played
  const b1y = BI_BASE_Y;
  s += mutedTextLine(BI_COL_X[0], b1y, 'OPERATION LEVEL', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    BI_COL_X[0],
    b1y + BI_LABEL_VAL_GAP,
    String(level),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );
  s += imageTag(
    ASSETS.icons.level,
    BI_COL_X[0] + getTextWidth(String(level), TYPO.valueSize) + 3,
    b1y + 4,
    18,
    18,
  );
  s += mutedTextLine(BI_COL_X[1], b1y, 'TOTAL MATCHES PLAYED', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    BI_COL_X[1],
    b1y + BI_LABEL_VAL_GAP,
    String(totalMatches),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );

  // Row 2: Current Assets | Total Mode Duration
  const b2y = b1y + BI_ROW_GAP;
  const totalAssets = vm.economy ? vm.economy.totalReward : '0';
  const totalHours = playDurationHours + playDurationMinutes / 60;
  s += mutedTextLine(BI_COL_X[0], b2y, 'CURRENT ASSETS', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    BI_COL_X[0],
    b2y + BI_LABEL_VAL_GAP,
    formatAssets(totalAssets),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );
  s += mutedTextLine(BI_COL_X[1], b2y, 'TOTAL MODE DURATION', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    BI_COL_X[1],
    b2y + BI_LABEL_VAL_GAP,
    formatHoursDecimal(totalHours),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );

  // Row 3: Extraction Rate | Number of Extractions
  const b3y = b2y + BI_ROW_GAP;
  const hitRate = vm.combat ? vm.combat.hitRate : '0%';
  const rescue = vm.squad ? vm.squad.rescue : 0;
  s += mutedTextLine(BI_COL_X[0], b3y, 'HIT RATE', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    BI_COL_X[0],
    b3y + BI_LABEL_VAL_GAP,
    hitRate,
    COLORS.accent,
    TYPO.valueSize,
    TYPO.valueWeight,
  );
  s += mutedTextLine(BI_COL_X[1], b3y, 'NUMBER OF EXTRACTIONS', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    BI_COL_X[1],
    b3y + BI_LABEL_VAL_GAP,
    String(rescue),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );

  // Row 4: Avg Assets/Match | Total Matches
  const b4y = b3y + BI_ROW_GAP;
  const extractValue = vm.economy ? vm.economy.extractValue : '0';
  s += mutedTextLine(BI_COL_X[0], b4y, 'AVG ASSETS / MATCH', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    BI_COL_X[0],
    b4y + BI_LABEL_VAL_GAP,
    formatAssets(extractValue),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );
  s += mutedTextLine(BI_COL_X[1], b4y, 'TOTAL MATCHES', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    BI_COL_X[1],
    b4y + BI_LABEL_VAL_GAP,
    String(totalMatches),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );

  // Row 5: Operators Killed (full-width, centered)
  const b5y = b4y + BI_ROW_GAP;
  const kills = vm.combat ? vm.combat.kills : 0;
  s += mutedTextLine(
    LEFT_COL.x + LEFT_COL.w / 2,
    b5y,
    'OPERATORS KILLED',
    TYPO.labelSize,
    TYPO.labelWeight,
    'middle',
  );
  s += textLine(
    LEFT_COL.x + LEFT_COL.w / 2,
    b5y + BI_LABEL_VAL_GAP,
    String(kills),
    COLORS.accent,
    TYPO.valueSizeLarge,
    TYPO.valueWeight,
    'middle',
  );

  // --- COMBAT STATS ---
  s += panelRect(LEFT_COL.x, CB_SECTION.y, LEFT_COL.w, CB_SECTION.h, r);
  s += cornerMark(LEFT_COL.x + 4, CB_SECTION.y + 4, 8, 8);
  s += cornerMark(LEFT_COL.x + LEFT_COL.w - 12, CB_SECTION.y + 4, 4, 8, -1, 1);
  // Title
  s +=
    '<text x="' +
    (LEFT_COL.x + CB_PAD) +
    '" y="' +
    (CB_SECTION.y + 20) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.6)" stroke-width="0.5" stroke-opacity="0.6" paint-order="stroke fill">' +
    'COMBAT STATS</text>';
  s +=
    '<line x1="' +
    (LEFT_COL.x + CB_PAD) +
    '" y1="' +
    (CB_SECTION.y + 26) +
    '" x2="' +
    (LEFT_COL.x + LEFT_COL.w - CB_PAD) +
    '" y2="' +
    (CB_SECTION.y + 26) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  const combat = vm.combat;
  if (combat) {
    // Row 1: Kills | Hit Rate
    const c1y = CB_BASE_Y;
    s += mutedTextLine(CB_COL_X[0], c1y, 'KILLS', TYPO.labelSize, TYPO.labelWeight);
    s += textLine(
      CB_COL_X[0],
      c1y + CB_LABEL_VAL_GAP,
      String(combat.kills),
      COLORS.textPrimary,
      TYPO.valueSize,
      TYPO.valueWeight,
    );
    s += mutedTextLine(CB_COL_X[1], c1y, 'HIT RATE', TYPO.labelSize, TYPO.labelWeight);
    s += textLine(
      CB_COL_X[1],
      c1y + CB_LABEL_VAL_GAP,
      combat.hitRate,
      COLORS.textPrimary,
      TYPO.valueSize,
      TYPO.valueWeight,
    );

    // Row 2: Headshot Rate | KD (Low)
    const c2y = c1y + CB_ROW_GAP;
    s += mutedTextLine(CB_COL_X[0], c2y, 'HEADSHOT RATE', TYPO.labelSize, TYPO.labelWeight);
    s += textLine(
      CB_COL_X[0],
      c2y + CB_LABEL_VAL_GAP,
      combat.headshotRate,
      COLORS.textPrimary,
      TYPO.valueSize,
      TYPO.valueWeight,
    );
    s += mutedTextLine(CB_COL_X[1], c2y, 'KD RATIO (LOW)', TYPO.labelSize, TYPO.labelWeight);
    s += textLine(
      CB_COL_X[1],
      c2y + CB_LABEL_VAL_GAP,
      combat.kdLow,
      COLORS.accent,
      TYPO.valueSize,
      TYPO.valueWeight,
    );

    // Row 3: KD Ratio (Med) | KD Ratio (High)
    const c3y = c2y + CB_ROW_GAP;
    s += mutedTextLine(CB_COL_X[0], c3y, 'KD RATIO (MED)', TYPO.labelSize, TYPO.labelWeight);
    s += textLine(
      CB_COL_X[0],
      c3y + CB_LABEL_VAL_GAP,
      combat.kdMed,
      COLORS.accent,
      TYPO.valueSize,
      TYPO.valueWeight,
    );
    s += mutedTextLine(CB_COL_X[1], c3y, 'KD RATIO (HIGH)', TYPO.labelSize, TYPO.labelWeight);
    s += textLine(
      CB_COL_X[1],
      c3y + CB_LABEL_VAL_GAP,
      combat.kdHigh,
      COLORS.accent,
      TYPO.valueSize,
      TYPO.valueWeight,
    );

    // Row 4: Operators Killed (full-width, accent)
    const c4y = c3y + CB_ROW_GAP;
    s += mutedTextLine(
      LEFT_COL.x + LEFT_COL.w / 2,
      c4y,
      'OPERATORS KILLED',
      TYPO.labelSize,
      TYPO.labelWeight,
      'middle',
    );
    s += textLine(
      LEFT_COL.x + LEFT_COL.w / 2,
      c4y + CB_LABEL_VAL_GAP,
      String(combat.kills),
      COLORS.accent,
      TYPO.valueSizeLarge,
      TYPO.valueWeight,
      'middle',
    );
  }

  // --- SQUAD STATS ---
  s += panelRect(LEFT_COL.x, SQ_SECTION.y, LEFT_COL.w, SQ_SECTION.h, r);
  s += cornerMark(LEFT_COL.x + 4, SQ_SECTION.y + 4, 8, 8);
  s += cornerMark(LEFT_COL.x + LEFT_COL.w - 12, SQ_SECTION.y + 4, 4, 8, -1, 1);
  // Title
  s +=
    '<text x="' +
    (LEFT_COL.x + SQ_PAD) +
    '" y="' +
    (SQ_SECTION.y + 20) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.6)" stroke-width="0.5" stroke-opacity="0.6" paint-order="stroke fill">' +
    'SQUAD STATS</text>';
  s +=
    '<line x1="' +
    (LEFT_COL.x + SQ_PAD) +
    '" y1="' +
    (SQ_SECTION.y + 26) +
    '" x2="' +
    (LEFT_COL.x + LEFT_COL.w - SQ_PAD) +
    '" y2="' +
    (SQ_SECTION.y + 26) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  const squad = vm.squad;
  if (squad) {
    // Row 1: Revives | Rescue Teammates
    const q1y = SQ_BASE_Y;
    s += mutedTextLine(SQ_COL_X[0], q1y, 'REVIVES', TYPO.labelSize, TYPO.labelWeight);
    s += textLine(
      SQ_COL_X[0],
      q1y + SQ_LABEL_VAL_GAP,
      String(squad.revive),
      COLORS.textPrimary,
      TYPO.valueSize,
      TYPO.valueWeight,
    );
    s += mutedTextLine(SQ_COL_X[1], q1y, 'RESCUE TEAMMATES', TYPO.labelSize, TYPO.labelWeight);
    s += textLine(
      SQ_COL_X[1],
      q1y + SQ_LABEL_VAL_GAP,
      String(squad.rescue),
      COLORS.textPrimary,
      TYPO.valueSize,
      TYPO.valueWeight,
    );

    // Row 2: Retreat Rate | Team Extract Value
    const q2y = q1y + SQ_ROW_GAP;
    s += mutedTextLine(SQ_COL_X[0], q2y, 'RETREAT RATE', TYPO.labelSize, TYPO.labelWeight);
    s += textLine(
      SQ_COL_X[0],
      q2y + SQ_LABEL_VAL_GAP,
      squad.retreatRate,
      COLORS.textPrimary,
      TYPO.valueSize,
      TYPO.valueWeight,
    );
    s += mutedTextLine(SQ_COL_X[1], q2y, 'TEAM EXTRACT', TYPO.labelSize, TYPO.labelWeight);
    s += textLine(
      SQ_COL_X[1],
      q2y + SQ_LABEL_VAL_GAP,
      formatAssets(squad.teamExtract),
      COLORS.textPrimary,
      TYPO.valueSize,
      TYPO.valueWeight,
    );

    // Row 3: Play Duration (full-width)
    const q3y = q2y + SQ_ROW_GAP;
    const totalH = playDurationHours + playDurationMinutes / 60;
    s += mutedTextLine(
      LEFT_COL.x + LEFT_COL.w / 2,
      q3y,
      'TOTAL PLAY TIME',
      TYPO.labelSize,
      TYPO.labelWeight,
      'middle',
    );
    s += textLine(
      LEFT_COL.x + LEFT_COL.w / 2,
      q3y + SQ_LABEL_VAL_GAP,
      formatHoursDecimal(totalH),
      COLORS.textPrimary,
      TYPO.valueSize,
      TYPO.valueWeight,
      'middle',
    );
  }

  // ===== RIGHT COLUMN =====

  // --- CURRENT RANK ---
  s += panelRect(RIGHT_COL.x, RK_SECTION.y, RIGHT_COL.w, RK_SECTION.h, r);
  s += cornerMark(RIGHT_COL.x + 4, RK_SECTION.y + 4, 8, 8);
  s += cornerMark(RIGHT_COL.x + RIGHT_COL.w - 12, RK_SECTION.y + 4, 4, 8, -1, 1);
  // Title
  s +=
    '<text x="' +
    (RIGHT_COL.x + BI_PAD) +
    '" y="' +
    (RK_SECTION.y + 20) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.6)" stroke-width="0.5" stroke-opacity="0.6" paint-order="stroke fill">' +
    'CURRENT RANK</text>';
  s +=
    '<line x1="' +
    (RIGHT_COL.x + BI_PAD) +
    '" y1="' +
    (RK_SECTION.y + 26) +
    '" x2="' +
    (RIGHT_COL.x + RIGHT_COL.w - BI_PAD) +
    '" y2="' +
    (RK_SECTION.y + 26) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  // Rank emblem placeholder (circle) — Sharp overlay ảnh thật lên trên
  s +=
    '<circle cx="' +
    RK_CX +
    '" cy="' +
    RK_EMBLEM_CY +
    '" r="44" fill="' +
    COLORS.bgPanelLight +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1"/>';
  // Rank name
  s +=
    '<text x="' +
    RK_CX +
    '" y="' +
    (RK_EMBLEM_CY + 64) +
    '" fill="' +
    COLORS.textPrimary +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">' +
    rankName +
    '</text>';
  // Rank score
  s +=
    '<text x="' +
    RK_CX +
    '" y="' +
    (RK_EMBLEM_CY + 80) +
    '" fill="' +
    COLORS.accent +
    '" font-size="10" font-weight="600" font-family="' +
    TYPO.primary +
    '" text-anchor="middle" stroke="rgba(0,0,0,0.6)" stroke-width="0.5" stroke-opacity="0.6" paint-order="stroke fill">' +
    rankScore.toLocaleString('vi-VN') +
    ' PTS</text>';

  // --- MOST USED OPERATOR ---
  s += panelRect(RIGHT_COL.x, OP_SECTION.y, RIGHT_COL.w, OP_SECTION.h, r);
  s += cornerMark(RIGHT_COL.x + 4, OP_SECTION.y + 4, 8, 8);
  s += cornerMark(RIGHT_COL.x + RIGHT_COL.w - 12, OP_SECTION.y + 4, 4, 8, -1, 1);
  // Title
  s +=
    '<text x="' +
    (RIGHT_COL.x + BI_PAD) +
    '" y="' +
    (OP_SECTION.y + 20) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.6)" stroke-width="0.5" stroke-opacity="0.6" paint-order="stroke fill">' +
    'MOST USED OPERATOR</text>';
  s +=
    '<line x1="' +
    (RIGHT_COL.x + BI_PAD) +
    '" y1="' +
    (OP_SECTION.y + 26) +
    '" x2="' +
    (RIGHT_COL.x + RIGHT_COL.w - BI_PAD) +
    '" y2="' +
    (OP_SECTION.y + 26) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  // Operator portrait placeholder
  const opName = 'N/A';
  s +=
    '<rect x="' +
    (OP_CX - 25) +
    '" y="' +
    (OP_PORTRAIT_CY - 25) +
    '" width="50" height="50" rx="2" fill="' +
    COLORS.bgPanelLight +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1"/>';
  s +=
    '<text x="' +
    OP_CX +
    '" y="' +
    (OP_PORTRAIT_CY + 4) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="9" font-family="' +
    TYPO.primary +
    '" text-anchor="middle" stroke="rgba(0,0,0,0.6)" stroke-width="0.5" stroke-opacity="0.6" paint-order="stroke fill">' +
    'OP</text>';
  // Operator name
  s +=
    '<text x="' +
    OP_CX +
    '" y="' +
    (OP_SECTION.y + 100) +
    '" fill="' +
    COLORS.textPrimary +
    '" font-size="12" font-weight="600" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">' +
    fitText(opName, 100, 12) +
    '</text>';

  // --- SEASON SUMMARY ---
  s += panelRect(RIGHT_COL.x, SS_SECTION.y, RIGHT_COL.w, SS_SECTION.h, r);
  s += cornerMark(RIGHT_COL.x + 4, SS_SECTION.y + 4, 8, 8);
  s += cornerMark(RIGHT_COL.x + RIGHT_COL.w - 12, SS_SECTION.y + 4, 4, 8, -1, 1);
  // Title
  s +=
    '<text x="' +
    (RIGHT_COL.x + SS_PAD) +
    '" y="' +
    (SS_SECTION.y + 20) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" stroke="rgba(0,0,0,0.6)" stroke-width="0.5" stroke-opacity="0.6" paint-order="stroke fill">' +
    'SEASON SUMMARY</text>';
  s +=
    '<line x1="' +
    (RIGHT_COL.x + SS_PAD) +
    '" y1="' +
    (SS_SECTION.y + 26) +
    '" x2="' +
    (RIGHT_COL.x + RIGHT_COL.w - SS_PAD) +
    '" y2="' +
    (SS_SECTION.y + 26) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  // Row 1: Total Matches | Total Reward
  const s1y = SS_BASE_Y;
  const totalReward = vm.economy ? vm.economy.totalReward : '0';
  s += mutedTextLine(SS_COL_X[0], s1y, 'TOTAL MATCHES', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    SS_COL_X[0],
    s1y + SS_LABEL_VAL_GAP,
    String(totalMatches),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );
  s += mutedTextLine(SS_COL_X[1], s1y, 'TOTAL REWARD', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    SS_COL_X[1],
    s1y + SS_LABEL_VAL_GAP,
    formatAssets(totalReward),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );

  // Row 2: Total Extract Value | Mandel Brick
  const s2y = s1y + SS_ROW_GAP;
  const extractVal = vm.economy ? vm.economy.extractValue : '0';
  const mandel = vm.economy ? vm.economy.mandelBrick : 0;
  s += mutedTextLine(SS_COL_X[0], s2y, 'EXTRACT VALUE', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    SS_COL_X[0],
    s2y + SS_LABEL_VAL_GAP,
    formatAssets(extractVal),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );
  s += mutedTextLine(SS_COL_X[1], s2y, 'MANDEL BRICK', TYPO.labelSize, TYPO.labelWeight);
  s += textLine(
    SS_COL_X[1],
    s2y + SS_LABEL_VAL_GAP,
    mandel.toLocaleString('vi-VN'),
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
  );

  // Row 3: Profit/Loss Ratio (full-width)
  const s3y = s2y + SS_ROW_GAP;
  const profitLoss = vm.economy ? vm.economy.profitLoss : '0';
  s += mutedTextLine(
    RIGHT_COL.x + RIGHT_COL.w / 2,
    s3y,
    'PROFIT / LOSS RATIO',
    TYPO.labelSize,
    TYPO.labelWeight,
    'middle',
  );
  s += textLine(
    RIGHT_COL.x + RIGHT_COL.w / 2,
    s3y + SS_LABEL_VAL_GAP,
    profitLoss,
    COLORS.textPrimary,
    TYPO.valueSize,
    TYPO.valueWeight,
    'middle',
  );

  // ===== FOOTER =====
  s +=
    '<text x="' +
    (FOOTER_Y - 20) +
    '" y="' +
    (FOOTER_Y + 10) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="7" font-weight="400" font-family="' +
    TYPO.primary +
    '" text-anchor="end" stroke="rgba(0,0,0,0.6)" stroke-width="0.5" stroke-opacity="0.6" paint-order="stroke fill">' +
    'DELTA FORCE STATS · POWERED BY KLB BOT</text>';

  s += '</svg>';
  return s;
}

/** Panel rectangle với border. */
function panelRect(x: number, y: number, w: number, h: number, radius: number): string {
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
    radius +
    '" fill="' +
    COLORS.bgPanel +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1"/>'
  );
}

/**
 * Corner marker — tactical UI detail.
 * Vẽ 2 đường nhỏ tạo góc chữ V ở góc panel.
 */
function cornerMark(
  x: number,
  y: number,
  size: number,
  thickness: number,
  flipX?: number,
  flipY?: number,
): string {
  const fx = flipX || 1;
  const fy = flipY || 1;
  const x1 = x,
    y1 = y;
  const x2 = x + size * fx,
    y2 = y;
  const x3 = x,
    y3 = y + size * fy;
  return (
    '<line x1="' +
    x1 +
    '" y1="' +
    y1 +
    '" x2="' +
    x2 +
    '" y2="' +
    y2 +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="' +
    thickness +
    '" stroke-linecap="round"/>' +
    '<line x1="' +
    x1 +
    '" y1="' +
    y1 +
    '" x2="' +
    x3 +
    '" y2="' +
    y3 +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="' +
    thickness +
    '" stroke-linecap="round"/>'
  );
}

/** Convert local path → file:// URI cho SVG <image> (Sharp parser). */
function toFileUri(filePath: string): string {
  const resolved = path.resolve(filePath);
  return 'file://' + resolved.replace(/\\/g, '/');
}

/** SVG <image> tag với error handling. */
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

/** Text line helper — label/value với màu và font nhất quán. */
function textLine(
  x: number,
  y: number,
  value: string,
  fill: string,
  size: number,
  weight: number,
  anchor?: 'start' | 'middle' | 'end',
  stroke?: string,
): string {
  const anchorAttr = anchor ? ' text-anchor="' + anchor + '"' : '';
  const strokeAttr = stroke
    ? ' stroke="' + stroke + '" stroke-width="0.5" stroke-opacity="0.6" paint-order="stroke fill"'
    : '';
  return (
    '<text x="' +
    x +
    '" y="' +
    y +
    '" fill="' +
    fill +
    '" font-size="' +
    size +
    '" font-weight="' +
    weight +
    '" font-family="' +
    TYPO.primary +
    '"' +
    anchorAttr +
    strokeAttr +
    '>' +
    value +
    '</text>'
  );
}

/** Muted text với dark stroke — tăng readability cho labels trên panel dark. */
function mutedTextLine(
  x: number,
  y: number,
  value: string,
  size: number,
  weight: number,
  anchor?: 'start' | 'middle' | 'end',
): string {
  return textLine(x, y, value, COLORS.textMuted, size, weight, anchor, 'rgba(0,0,0,0.6)');
}

/** Ước lượng chiều rộng text (px) — dùng cho icon positioning. */
function getTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}
