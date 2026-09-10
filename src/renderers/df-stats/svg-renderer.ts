/**
 * SVG Dashboard Renderer — AAA military tactical shooter UI.
 * Layout: Left(dense stats) + Center(operator bg) + Right(rank).
 *
 * Sharp/libvips SVG parser strict:
 * - KHÔNG HTML comments (<!-- -->)
 * - font-family đơn giản (dùng single-quote escaped)
 * - self-closing tags
 */

import path from 'path';
import sharp from 'sharp';
import type { DFStatsViewModel } from './types.js';
import {
  CANVAS,
  LAYOUT,
  COLORS,
  TYPO,
  SPACING,
  RADIUS,
  HEADER_LABELS,
} from '../../config/df-stats-renderer.config.js';
import { fitText, formatNumber, formatDuration } from './utils/text-fit.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BACKGROUND_PATH = path.join(__dirname, '../../assets/delta-force/backgrounds/stinger.png');
const DARK_OVERLAY_COLOR = 'rgba(7,10,12,0.45)';

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
      const rankBuffer = await sharp(
        Buffer.from(
          await fetch(viewModel.rank.imageUrl).then((r) => r.arrayBuffer() as Promise<ArrayBuffer>),
        ),
      )
        .resize(72, 72)
        .png()
        .toBuffer();
      composite = await sharp(composite)
        .composite([{ input: rankBuffer, top: 69, left: 1014 }])
        .png()
        .toBuffer();
    } catch {
      // Fallback: giữ circle placeholder
    }
  }

  // Avatar overlay (nếu có)
  if (viewModel.player.avatarUrl) {
    try {
      const avatarBuffer = await sharp(
        Buffer.from(
          await fetch(viewModel.player.avatarUrl).then(
            (r) => r.arrayBuffer() as Promise<ArrayBuffer>,
          ),
        ),
      )
        .resize(40, 40)
        .png()
        .toBuffer();
      composite = await sharp(composite)
        .composite([{ input: avatarBuffer, top: 44, left: 1216 }])
        .png()
        .toBuffer();
    } catch {
      // Fallback: bỏ qua avatar
    }
  }

  return composite;
}

/** Build SVG string — military game UI. */
function buildSVG(vm: DFStatsViewModel): string {
  const { nickname, level, joinDate, playDurationHours, playDurationMinutes, totalMatches } =
    vm.player;
  const displayNickname = fitText(nickname, 320, 14);
  const { name: rankName, score: rankScore } = vm.rank;
  const seasonLabel = HEADER_LABELS[vm.seasonLabel] || vm.seasonLabel;

  const gap = SPACING.sm; // 4px — tighter inter-panel spacing
  const cpad = LAYOUT.cardPad;
  const r = RADIUS.sm;

  // Left panel
  const lx = LAYOUT.leftPanel.x;
  const lw = LAYOUT.leftPanel.width;

  // Right panel
  const rx = LAYOUT.rightPanel.x;
  const rw = LAYOUT.rightPanel.width;

  // === LEFT PANEL layout (tổng height ≈ 512, fit trong 720) ===
  const hdrY = LAYOUT.padding;
  const hdrH = 28;
  const biY = hdrY + hdrH + gap;
  const biH = 238; // 5 rows × 40px + title area
  const cbY = biY + biH + gap;
  const cbH = 126; // 2×2 grid + title, bớt khoảng trống so với 140
  const sqY = cbY + cbH + gap;
  const sqH = 106; // 2×2 grid + title, gọn
  // Footer nằm ở LAYOUT.footer.y = 704, vừa fit

  // === RIGHT PANEL layout (tổng height ≈ 508, fit trong 720) ===
  const rkY = LAYOUT.padding;
  const rkH = 185; // Emblem + title + score, fit trong 720
  const opY = rkY + rkH + gap;
  const opH = 110; // Portrait + label
  const sumY = opY + opH + gap;
  const sumH = 224; // 9 rows × 20px + title, clearance 16px

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

  // ===== HEADER =====
  s +=
    '<text x="' +
    LAYOUT.header.x +
    '" y="' +
    (LAYOUT.header.y + 18) +
    '" fill="' +
    COLORS.accent +
    '" font-size="' +
    TYPO.sectionSize +
    '" font-weight="' +
    TYPO.sectionWeight +
    '" font-family="' +
    TYPO.primary +
    '" letter-spacing="4">' +
    seasonLabel +
    '</text>';
  s +=
    '<text x="' +
    (CANVAS.width - LAYOUT.padding - cpad) +
    '" y="' +
    (LAYOUT.header.y + 18) +
    '" fill="' +
    COLORS.textSecondary +
    '" font-size="10" font-family="' +
    TYPO.primary +
    '" text-anchor="end">ID: ' +
    String(Math.floor(Math.random() * 999999999)) +
    '</text>';
  s +=
    '<line x1="' +
    LAYOUT.header.x +
    '" y1="' +
    (LAYOUT.header.y + 22) +
    '" x2="' +
    (LAYOUT.header.x + 160) +
    '" y2="' +
    (LAYOUT.header.y + 22) +
    '" stroke="' +
    COLORS.accent +
    '" stroke-width="1.5" stroke-linecap="round"/>';

  // ===== LEFT PANEL =====

  // Header bar
  s += panelRect(lx, hdrY, lw, hdrH, r);
  s += cornerMark(lx + 4, hdrY + 4, 8, 8);
  s += cornerMark(lx + lw - 12, hdrY + 4, 4, 8, -1, 1);
  s +=
    '<text x="' +
    (lx + cpad + 16) +
    '" y="' +
    (hdrY + 19) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="9" font-weight="600" font-family="' +
    TYPO.primary +
    '" letter-spacing="2">PLAYER PROFILE</text>';

  // --- Basic Info panel ---
  s += panelRect(lx, biY, lw, biH, r);
  s += cornerMark(lx + 4, biY + 4, 6, 6);
  s += cornerMark(lx + lw - 10, biY + 4, 4, 6, -1, 1);
  s +=
    '<text x="' +
    (lx + cpad) +
    '" y="' +
    (biY + 18) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" letter-spacing="1">BASIC INFO</text>';
  s +=
    '<line x1="' +
    (lx + cpad) +
    '" y1="' +
    (biY + 24) +
    '" x2="' +
    (lx + lw - cpad) +
    '" y2="' +
    (biY + 24) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  // 2-column grid: 5 rows
  const biRows = [
    { label: 'OPERATION LEVEL', value: String(level), col: 0, row: 0 },
    { label: 'TOTAL MATCHES', value: String(totalMatches), col: 1, row: 0 },
    {
      label: 'CURRENT ASSETS',
      value: formatNumber(vm.economy ? vm.economy.totalReward : '0'),
      col: 0,
      row: 1,
    },
    {
      label: 'TOTAL MODE DURATION',
      value: formatDuration(playDurationHours, playDurationMinutes),
      col: 1,
      row: 1,
    },
    { label: 'EXTRACTION RATE', value: vm.combat ? vm.combat.hitRate : '0%', col: 0, row: 2 },
    { label: 'EXTRACTIONS', value: String(vm.squad ? vm.squad.rescue : 0), col: 1, row: 2 },
    {
      label: 'AVG ASSETS / MATCH',
      value: formatNumber(vm.economy ? vm.economy.extractValue : '0'),
      col: 0,
      row: 3,
    },
    { label: 'COLLECTION QTY', value: String(totalMatches), col: 1, row: 3 },
    { label: 'OPERATORS KILLED', value: String(vm.combat ? vm.combat.kills : 0), col: 0, row: 4 },
  ];

  const biColX = [lx + cpad, lx + lw / 2 + cpad];
  const biRowGap = 40; // 5 rows fit trong 228px
  const biBaseY = biY + 36;

  for (const row of biRows) {
    const baseY = biBaseY + row.row * biRowGap;
    const x = biColX[row.col];
    s +=
      '<text x="' +
      x +
      '" y="' +
      baseY +
      '" fill="' +
      COLORS.textMuted +
      '" font-size="' +
      TYPO.labelSize +
      '" font-weight="' +
      TYPO.labelWeight +
      '" font-family="' +
      TYPO.primary +
      '">' +
      row.label +
      '</text>';
    s +=
      '<text x="' +
      x +
      '" y="' +
      (baseY + 20) +
      '" fill="' +
      COLORS.textPrimary +
      '" font-size="' +
      TYPO.valueSize +
      '" font-weight="' +
      TYPO.valueWeight +
      '" font-family="' +
      TYPO.primary +
      '">' +
      row.value +
      '</text>';
    if (row.col === 0 && row.row < 4) {
      s +=
        '<line x1="' +
        (lx + lw / 2) +
        '" y1="' +
        (baseY - 14) +
        '" x2="' +
        (lx + lw / 2) +
        '" y2="' +
        (baseY + 28) +
        '" stroke="' +
        COLORS.borderDivider +
        '" stroke-width="1"/>';
    }
  }

  // --- Combat panel ---
  s += panelRect(lx, cbY, lw, cbH, r);
  s += cornerMark(lx + 4, cbY + 4, 6, 6);
  s += cornerMark(lx + lw - 10, cbY + 4, 4, 6, -1, 1);
  s +=
    '<text x="' +
    (lx + cpad) +
    '" y="' +
    (cbY + 18) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" letter-spacing="1">COMBAT STATS</text>';
  s +=
    '<line x1="' +
    (lx + cpad) +
    '" y1="' +
    (cbY + 24) +
    '" x2="' +
    (lx + lw - cpad) +
    '" y2="' +
    (cbY + 24) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  const cbRows = vm.combat
    ? [
        { label: 'KILLS', value: String(vm.combat.kills) },
        { label: 'HIT RATE', value: vm.combat.hitRate },
        { label: 'HEADSHOT RATE', value: vm.combat.headshotRate },
        {
          label: 'KD RATIO',
          value: vm.combat.kdLow + '/' + vm.combat.kdMed + '/' + vm.combat.kdHigh,
        },
      ]
    : [{ label: 'NO DATA', value: '' }];

  const cbBaseY = cbY + 36;
  const cbColX = [lx + cpad, lx + lw / 2 + cpad];
  const cbRowGap = 28; // 2×2 grid fit trong 128px

  for (let i = 0; i < cbRows.length; i++) {
    const col = i < 2 ? 0 : 1;
    const row = i % 2;
    const x = cbColX[col];
    const baseY = cbBaseY + row * cbRowGap;
    s +=
      '<text x="' +
      x +
      '" y="' +
      baseY +
      '" fill="' +
      COLORS.textMuted +
      '" font-size="' +
      TYPO.labelSize +
      '" font-weight="' +
      TYPO.labelWeight +
      '" font-family="' +
      TYPO.primary +
      '">' +
      cbRows[i].label +
      '</text>';
    s +=
      '<text x="' +
      x +
      '" y="' +
      (baseY + 20) +
      '" fill="' +
      (i === 3 ? COLORS.accent : COLORS.textPrimary) +
      '" font-size="18" font-weight="700" font-family="' +
      TYPO.primary +
      '">' +
      cbRows[i].value +
      '</text>';
    if (col === 0 && row < 1) {
      s +=
        '<line x1="' +
        (lx + lw / 2) +
        '" y1="' +
        (baseY - 10) +
        '" x2="' +
        (lx + lw / 2) +
        '" y2="' +
        (baseY + 22) +
        '" stroke="' +
        COLORS.borderDivider +
        '" stroke-width="1"/>';
    }
  }

  // --- Squad panel ---
  s += panelRect(lx, sqY, lw, sqH, r);
  s += cornerMark(lx + 4, sqY + 4, 6, 6);
  s += cornerMark(lx + lw - 10, sqY + 4, 4, 6, -1, 1);
  s +=
    '<text x="' +
    (lx + cpad) +
    '" y="' +
    (sqY + 18) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" letter-spacing="1">SQUAD STATS</text>';
  s +=
    '<line x1="' +
    (lx + cpad) +
    '" y1="' +
    (sqY + 24) +
    '" x2="' +
    (lx + lw - cpad) +
    '" y2="' +
    (sqY + 24) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  const sqRows = vm.squad
    ? [
        { label: 'REVIVE', value: String(vm.squad.revive) },
        { label: 'RESCUE', value: String(vm.squad.rescue) },
        { label: 'RETREAT RATE', value: vm.squad.retreatRate },
        { label: 'TEAM EXTRACT', value: formatNumber(vm.squad.teamExtract) },
      ]
    : [{ label: 'NO DATA', value: '' }];

  const sqBaseY = sqY + 36;
  const sqColX = [lx + cpad, lx + lw / 2 + cpad];
  const sqRowGap = 28; // 2×2 grid fit trong 106px

  for (let i = 0; i < sqRows.length; i++) {
    const col = i < 2 ? 0 : 1;
    const row = i % 2;
    const x = sqColX[col];
    const baseY = sqBaseY + row * sqRowGap;
    s +=
      '<text x="' +
      x +
      '" y="' +
      baseY +
      '" fill="' +
      COLORS.textMuted +
      '" font-size="' +
      TYPO.labelSize +
      '" font-weight="' +
      TYPO.labelWeight +
      '" font-family="' +
      TYPO.primary +
      '">' +
      sqRows[i].label +
      '</text>';
    s +=
      '<text x="' +
      x +
      '" y="' +
      (baseY + 20) +
      '" fill="' +
      COLORS.textPrimary +
      '" font-size="18" font-weight="700" font-family="' +
      TYPO.primary +
      '">' +
      sqRows[i].value +
      '</text>';
    if (col === 0 && row < 1) {
      s +=
        '<line x1="' +
        (lx + lw / 2) +
        '" y1="' +
        (baseY - 10) +
        '" x2="' +
        (lx + lw / 2) +
        '" y2="' +
        (baseY + 22) +
        '" stroke="' +
        COLORS.borderDivider +
        '" stroke-width="1"/>';
    }
  }

  // ===== RIGHT PANEL =====

  // --- Rank panel ---
  s += panelRect(rx, rkY, rw, rkH, r);
  s += cornerMark(rx + 4, rkY + 4, 6, 6);
  s += cornerMark(rx + rw - 10, rkY + 4, 4, 6, -1, 1);
  s +=
    '<text x="' +
    (rx + cpad) +
    '" y="' +
    (rkY + 20) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" letter-spacing="1">CURRENT RANK</text>';
  s +=
    '<line x1="' +
    (rx + cpad) +
    '" y1="' +
    (rkY + 26) +
    '" x2="' +
    (rx + rw - cpad) +
    '" y2="' +
    (rkY + 26) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  // Rank emblem placeholder (circle) — Sharp sẽ overlay ảnh thật lên trên
  const rkCx = rx + rw / 2;
  const rkCy = rkY + 85;
  s +=
    '<circle cx="' +
    rkCx +
    '" cy="' +
    rkCy +
    '" r="36" fill="' +
    COLORS.bgPanelLight +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1"/>';
  // Rank title (dưới emblem)
  s +=
    '<text x="' +
    rkCx +
    '" y="' +
    (rkCy + 56) +
    '" fill="' +
    COLORS.textPrimary +
    '" font-size="12" font-weight="600" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">' +
    rankName +
    '</text>';
  // Rank score (dưới title)
  s +=
    '<text x="' +
    rkCx +
    '" y="' +
    (rkY + 175) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="9" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">' +
    rankScore.toLocaleString('vi-VN') +
    ' PTS</text>';

  // --- Operator panel ---
  s += panelRect(rx, opY, rw, opH, r);
  s += cornerMark(rx + 4, opY + 4, 6, 6);
  s += cornerMark(rx + rw - 10, opY + 4, 4, 6, -1, 1);
  s +=
    '<text x="' +
    (rx + cpad) +
    '" y="' +
    (opY + 18) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" letter-spacing="1">MOST USED OPERATOR</text>';
  s +=
    '<line x1="' +
    (rx + cpad) +
    '" y1="' +
    (opY + 24) +
    '" x2="' +
    (rx + rw - cpad) +
    '" y2="' +
    (opY + 24) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  // Operator portrait placeholder
  const opCx = rx + rw / 2;
  const opCy = opY + 60;
  s +=
    '<rect x="' +
    (opCx - 30) +
    '" y="' +
    (opCy - 30) +
    '" width="60" height="60" rx="2" fill="' +
    COLORS.bgPanelLight +
    '" stroke="' +
    COLORS.borderPanel +
    '" stroke-width="1"/>';
  s +=
    '<text x="' +
    opCx +
    '" y="' +
    (opCy + 4) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="10" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">OP</text>';
  s +=
    '<text x="' +
    opCx +
    '" y="' +
    (opY + 108) +
    '" fill="' +
    COLORS.textSecondary +
    '" font-size="10" font-weight="500" font-family="' +
    TYPO.primary +
    '" text-anchor="middle">D-wolf</text>';

  // --- Summary panel ---
  s += panelRect(rx, sumY, rw, sumH, r);
  s += cornerMark(rx + 4, sumY + 4, 6, 6);
  s += cornerMark(rx + rw - 10, sumY + 4, 4, 6, -1, 1);
  s +=
    '<text x="' +
    (rx + cpad) +
    '" y="' +
    (sumY + 18) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.panelTitleSize +
    '" font-weight="' +
    TYPO.panelTitleWeight +
    '" font-family="' +
    TYPO.primary +
    '" letter-spacing="1">SEASON SUMMARY</text>';
  s +=
    '<line x1="' +
    (rx + cpad) +
    '" y1="' +
    (sumY + 24) +
    '" x2="' +
    (rx + rw - cpad) +
    '" y2="' +
    (sumY + 24) +
    '" stroke="' +
    COLORS.borderDivider +
    '" stroke-width="1"/>';

  const sumRows = [
    { label: 'TOTAL MATCHES', value: String(totalMatches), y: sumY + 40 },
    {
      label: 'PLAY TIME',
      value: formatDuration(playDurationHours, playDurationMinutes),
      y: sumY + 60,
    },
    { label: 'NICKNAME', value: displayNickname, y: sumY + 80 },
    { label: 'LEVEL', value: String(level), y: sumY + 100 },
    { label: 'OVERALL POINTS', value: String(rankScore), y: sumY + 120 },
    { label: 'JOIN DATE', value: joinDate, y: sumY + 140 },
    { label: 'KILLS', value: String(vm.combat ? vm.combat.kills : 0), y: sumY + 160 },
    { label: 'WIN RATE', value: '39%', y: sumY + 180 },
    { label: 'HEADSHOT RATE', value: vm.combat ? vm.combat.headshotRate : '0%', y: sumY + 200 },
  ];

  for (const row of sumRows) {
    s +=
      '<text x="' +
      (rx + cpad) +
      '" y="' +
      row.y +
      '" fill="' +
      COLORS.textMuted +
      '" font-size="8" font-weight="' +
      TYPO.labelWeight +
      '" font-family="' +
      TYPO.primary +
      '">' +
      row.label +
      '</text>';
    s +=
      '<text x="' +
      (rx + rw - cpad) +
      '" y="' +
      row.y +
      '" fill="' +
      COLORS.textPrimary +
      '" font-size="10" font-weight="600" font-family="' +
      TYPO.primary +
      '" text-anchor="end">' +
      row.value +
      '</text>';
  }

  // ===== FOOTER =====
  s +=
    '<text x="' +
    LAYOUT.footer.x +
    '" y="' +
    (LAYOUT.footer.y + 12) +
    '" fill="' +
    COLORS.textMuted +
    '" font-size="' +
    TYPO.footerSize +
    '" font-weight="' +
    TYPO.footerWeight +
    '" font-family="' +
    TYPO.primary +
    '" letter-spacing="1">DELTA FORCE STATS · POWERED BY KLB BOT</text>';

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
