/** Build interactive UI for /team-find — buttons for Map/Mode, select menu for Rank */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import {
  MAP_DISPLAY,
  MAP_MODES,
  DIFFICULTY_CONFIG,
  TEAM_FIND_RANKS,
} from '../../config/team-find.config.js';
import type { Difficulty, DifficultyConfig } from '../../config/team-find.config.js';

export interface MenuState {
  map: string | null;
  mode: string | null;
  rank: string | null;
}

/** Map button colors for visual distinction */
const MAP_COLORS: Record<string, ButtonStyle> = {
  'Đập Nước Zero': ButtonStyle.Primary,
  'Thung lũng Layali': ButtonStyle.Secondary,
  'Phố Cổ Brakkesh': ButtonStyle.Secondary,
  'Trạm Không Gian': ButtonStyle.Secondary,
  'Ngục Giam Thủy Triều': ButtonStyle.Secondary,
};

/** Mode button colors */
const MODE_COLORS: Record<string, ButtonStyle> = {
  'Dễ': ButtonStyle.Success,
  'Thường': ButtonStyle.Primary,
  'Khó': ButtonStyle.Danger,
};

/** Build status text that shows current selections */
function buildStatusContent(username: string, state: MenuState): string {
  const mapLabel = state.map || '— Chưa chọn —';
  const modeLabel = state.mode || '— Chưa chọn —';
  const rankLabel = state.rank || '— Chưa chọn —';

  return [
    `**${username} — Chọn thông tin tìm đồng đội**`,
    '',
    `**MAP**`,
    mapLabel,
    '',
    `**MODE**`,
    modeLabel,
    '',
    `**RANK**`,
    rankLabel,
  ].join('\n');
}

/** Build the Map button row */
function buildMapButtons(userId: string, selectedMap: string | null) {
  const buttons = Object.keys(MAP_DISPLAY).map((m) => {
    const isSelected = m === selectedMap;
    return new ButtonBuilder()
      .setCustomId(`team-find-map:${m}:${userId}`)
      .setLabel(m)
      .setStyle(MAP_COLORS[m] || ButtonStyle.Secondary)
      .setDisabled(isSelected);
  });
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

/** Build the Mode button row — filtered by map */
function buildModeButtons(userId: string, selectedMap: string | null, selectedMode: string | null) {
  const modes = (selectedMap && (MAP_MODES as any)[selectedMap])
    ? (MAP_MODES as any)[selectedMap] as Difficulty[]
    : Object.values(DIFFICULTY_CONFIG).map((c) => c.id);

  const buttons = modes.map((m: Difficulty) => {
    const cfg = (DIFFICULTY_CONFIG as Record<Difficulty, DifficultyConfig>)[m];
    const isSelected = cfg.label === selectedMode;
    return new ButtonBuilder()
      .setCustomId(`team-find-mode:${cfg.label}:${userId}`)
      .setLabel(cfg.label)
      .setStyle(MODE_COLORS[cfg.label] || ButtonStyle.Primary)
      .setDisabled(isSelected);
  });
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

/** Build the Rank select menu row */
function buildRankMenu(userId: string, selectedRank: string | null) {
  const rankSelect = new StringSelectMenuBuilder()
    .setCustomId(`team-find-rank:${userId}`)
    .setPlaceholder(selectedRank || 'Chọn bậc rank (tùy chọn)...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      TEAM_FIND_RANKS.map((r) => ({
        label: r.name,
        value: r.value,
      })),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(rankSelect);
}

/** Build the Done button row */
function buildDoneButton(userId: string, enabled: boolean) {
  const doneButton = new ButtonBuilder()
    .setCustomId(`team-find-done:${userId}`)
    .setLabel('Xong')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!enabled);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(doneButton);
}

/**
 * Build the full interactive menu message.
 * Shows Map buttons, Mode buttons (filtered by map), Rank select, and Done button.
 */
export function buildSelectMenuMessage(
  userId: string,
  username: string,
  state: MenuState,
) {
  const content = buildStatusContent(username, state);

  // Map buttons — show only if map not selected yet
  const mapRow = buildMapButtons(userId, state.map);

  // Mode buttons — show only if map selected and mode not selected
  const modeRow = buildModeButtons(userId, state.map, state.mode);

  // Rank select menu — show only after map+mode selected
  const rankRow = buildRankMenu(userId, state.rank);

  // Done button — enabled when map + mode selected
  const doneRow = buildDoneButton(userId, state.map !== null && state.mode !== null);

  return {
    content,
    components: [
      mapRow.toJSON(),
      modeRow.toJSON(),
      rankRow.toJSON(),
      doneRow.toJSON(),
    ],
  };
}
