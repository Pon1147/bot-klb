import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer, toComponentsV2 } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { getMatchList } from '../../services/deltaforce.api.js';
import { DEFAULT_OPERATOR_AVATAR, resolveOperator } from '../../utils/df-operator.utils.js';
import { requireGuild } from '../../utils/df-guards.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { getDfToken, touchDfToken } from '../../database/df.token.db.js';
import { EMOJI_WIN, EMOJI_DEFEAT, EMOJI_MONEY, EMOJI_KILL, MAP_NAMES, MAX_HISTORY_LIMIT } from '../../config/team-find.config.js';
import type { DfMatchEntry } from '../../types/deltaforce.types.js';

export const data = new SlashCommandBuilder()
  .setName('df-history')
  .setDescription('Xem lịch sử trận đấu Delta Force.')
  .addIntegerOption((opt) =>
    opt.setName('limit').setDescription('Số trận hiển thị (1-20)').setMinValue(1).setMaxValue(20),
  );

function buildMatchItemSection(match: DfMatchEntry): Record<string, unknown> {
  const operatorId = match.operator_id;
  const operatorIcon = match.operator_icon;
  const operator = resolveOperator(operatorId);

  const avatarUrl = operatorIcon || operator.avatarUrl;
  const time = new Date(Number(match.match_time) * 1000).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const mapName = MAP_NAMES[match.map_id] || `Map ${match.map_id}`;
  const result = match.result === 1 ? `${EMOJI_WIN} Win` : `${EMOJI_DEFEAT} Defeat`;
  const extract = Number(match.carry_out_value).toLocaleString('vi-VN');

  const content =
    `**${operator.name}**\n` +
    `Chiến Dịch Sinh Tồn | ${mapName} • ${time}\n` +
    `${result}  ·  ${EMOJI_MONEY} ${extract}  ·  ${EMOJI_KILL} ${match.kill_count}`;

  return {
    type: ComponentType.Section,
    components: [
      {
        type: ComponentType.TextDisplay,
        content,
      },
    ],
    accessory: {
      type: ComponentType.Thumbnail,
      media: { url: avatarUrl },
      description: operator.name,
    },
  };
}

function buildViewAllButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('df_history_view_all')
      .setLabel('Xem tất cả')
      .setStyle(ButtonStyle.Secondary),
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const token = getDfToken(database, interaction.user.id);
  if (!token) {
    const err = buildErrorContainer('Bạn chưa liên kết tài khoản. Dùng `/df-link start` hoặc `/df-link manual` để bắt đầu.');
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const apiToken = buildDfApiToken(token);
    const limit = Math.min(interaction.options.getInteger('limit') || MAX_HISTORY_LIMIT, 20);
    // Fetch only needed matches from API (pagination)
    const matchData = await getMatchList(apiToken, { limit });
    touchDfToken(database, interaction.user.id);

    const matches = matchData.list;

    if (!matches.length) {
      const err = buildErrorContainer('Không có trận đấu nào trong lịch sử.');
      await interaction.editReply({
        components: err.toJSON(),
        flags: err.flags | MessageFlags.Ephemeral,
      });
      return;
    }

    // ── 1. HEADER SECTION ──
    const headerSection: Record<string, unknown> = {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: `## Trận Đấu Gần Đây`,
        },
      ],
      accessory: {
        type: ComponentType.Thumbnail,
        media: {
          url: DEFAULT_OPERATOR_AVATAR,
        },
        description: 'Delta Force',
      },
    };

    // ── 2. COUNT TEXT ──
    const countText: Record<string, unknown> = {
      type: ComponentType.TextDisplay,
      content: `${matches.length} / ${matchData.list.length} trận`,
    };

    // ── 3. SEPARATOR ──
    const separator: Record<string, unknown> = {
      type: ComponentType.Separator,
    };

    // ── 4. MATCH ITEMS ──
    const matchSections = matches.map(buildMatchItemSection);

    // ── 5. FOOTER TEXT ──
    const footerText: Record<string, unknown> = {
      type: ComponentType.TextDisplay,
      content: `[Xem trên playdeltaforce.com](https://www.playdeltaforce.com)`,
    };

    // ── ASSEMBLE CONTAINER ──
    const containerInner: unknown[] = [
      headerSection,
      countText,
      separator,
      ...matchSections,
      footerText,
    ];

    const containerComponent: Record<string, unknown> = {
      type: ComponentType.Container,
      components: containerInner,
      accent_color: COLORS.DF,
    };

    // ── BUTTON ROW (outside container) ──
    const buttonRow = buildViewAllButtonRow();

    await interaction.editReply({
      components: toComponentsV2([containerComponent, buttonRow.toJSON()]),
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (error) {
    const err = buildErrorContainer(
      `Lỗi khi lấy dữ liệu: ${(error as Error).message}\nNếu lỗi tiếp tục, hãy unlink và link lại tài khoản.`,
    );
    await interaction.editReply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
