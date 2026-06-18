/** Build select menu UI for /team-find interactive flow */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
} from 'discord.js';
import { MAP_DISPLAY, MAP_MODES, DIFFICULTY_CONFIG, TEAM_FIND_RANKS } from '../../config/team-find.config.js';
import type { Difficulty, DifficultyConfig } from '../../config/team-find.config.js';

export interface MenuState {
  map: string | null;
  mode: string | null;
  rank: string | null;
}

/** Build Map select menu options */
function buildMapOptions(): { label: string; value: string }[] {
  return Object.keys(MAP_DISPLAY).map((k) => ({
    label: k,
    value: k,
  }));
}

/** Build Mode select menu options — filtered by selected map */
function buildModeOptions(selectedMap: string | null): { label: string; value: string }[] {
  if (selectedMap) {
    const modes = (MAP_MODES as any)[selectedMap];
    if (modes) {
      return modes.map((m: Difficulty) => {
        const cfg = (DIFFICULTY_CONFIG as Record<Difficulty, DifficultyConfig>)[m];
        return { label: cfg.label, value: cfg.label };
      });
    }
  }
  // All modes by default
  return Object.values(DIFFICULTY_CONFIG).map((c) => ({
    label: c.label,
    value: c.label,
  }));
}

/** Build the container that shows current selections */
function buildStatusContainer(
  username: string,
  state: MenuState,
): Record<string, unknown> {
  const lines: string[] = [`## ${username} — Chọn thông tin tìm đồng đội`];
  lines.push('');

  const modeLabel = state.mode || '— Chưa chọn —';
  const mapLabel = state.map || '— Chưa chọn —';
  const rankLabel = state.rank || '— Chưa chọn —';

  lines.push(`**MAP**`);
  lines.push(mapLabel);
  lines.push('');
  lines.push(`**MODE**`);
  lines.push(modeLabel);
  lines.push('');
  lines.push(`**RANK**`);
  lines.push(rankLabel);

  const container: Record<string, unknown> = {
    type: ComponentType.Container,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: lines.join('\n'),
      },
    ],
  };
  return container;
}

/**
 * Build the full interactive menu message components.
 * Returns a payload compatible with interaction.reply() / interaction.update().
 */
export function buildSelectMenuMessage(
  userId: string,
  username: string,
  state: MenuState,
) {
  const container = buildStatusContainer(username, state);

  // Map select
  const mapSelect = new StringSelectMenuBuilder()
    .setCustomId(`team-find-select-map:${userId}`)
    .setPlaceholder('Chọn bản đồ...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(buildMapOptions());

  // Mode select — filter by selected map
  const modeSelect = new StringSelectMenuBuilder()
    .setCustomId(`team-find-select-mode:${userId}`)
    .setPlaceholder('Chọn độ khó...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(buildModeOptions(state.map));

  // Rank select
  const rankSelect = new StringSelectMenuBuilder()
    .setCustomId(`team-find-select-rank:${userId}`)
    .setPlaceholder('Chọn bậc rank (tùy chọn)...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      TEAM_FIND_RANKS.map((r) => ({ label: r.name, value: r.value })),
    );

  // Done button
  const isDone = state.map !== null && state.mode !== null;
  const doneButton = new ButtonBuilder()
    .setCustomId(`team-find-done:${userId}`)
    .setLabel('Xong')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!isDone);

  // Action rows
  const mapRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(mapSelect);
  const modeRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(modeSelect);
  const rankRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(rankSelect);
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(doneButton);

  return {
    components: [
      container,
      mapRow.toJSON(),
      modeRow.toJSON(),
      rankRow.toJSON(),
      buttonRow.toJSON(),
    ],
    flags: 0,
    toJSON() {
      return this.components;
    },
  };
}
