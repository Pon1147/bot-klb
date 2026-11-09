import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer, toComponentsV2 } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { getMatchList } from '../../services/deltaforce.api.js';
import { DEFAULT_OPERATOR_AVATAR, resolveOperator } from '../../utils/df-operator.utils.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import {
  EMOJI_WIN,
  EMOJI_DEFEAT,
  EMOJI_MONEY,
  EMOJI_KILL,
} from '../../config/deltaforce.config.js';
import { resolveMapName } from '../../services/df-metadata.service.js';
import { MAX_HISTORY_LIMIT } from '../../config/team-find.config.js';
import { formatVietnamDateTime, formatCoin } from '../../utils/df-format.utils.js';
import { MAX_HISTORY_PAGE } from '../../config/app.constants.js';
import type { DfMatchEntry } from '../../types/deltaforce.types.js';

function buildMatchItemSection(match: DfMatchEntry): Record<string, unknown> {
  const operatorId = match.operator_id;
  const operatorIcon = match.operator_icon;
  const operator = resolveOperator(operatorId);

  const avatarUrl = operatorIcon || operator.avatarUrl;
  const time = formatVietnamDateTime(match.match_time);
  const mapName = resolveMapName(match.map_id);
  const result = match.result === 1 ? `${EMOJI_WIN} Win` : `${EMOJI_DEFEAT} Defeat`;
  const extract = formatCoin(match.carry_out_value, false);

  const content =
    `## **${operator.name}**\n` +
    `**Chế độ**: Chiến Dịch Sinh Tồn\n` +
    `**Map**: ${mapName}\n` +
    `**Thời gian**: ${time}\n` +
    `\n` +
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
      .setStyle(ButtonStyle.Link)
      .setLabel('🌐 Mở Trang Lịch Sử Đấu (Web) ↗')
      .setURL('https://www.playdeltaforce.com/events/hq/vi/index.html'),
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await runDfCommand({ userId: interaction.user.id, database, interaction }, async (apiToken) => {
    const limit = Math.min(
      interaction.options.getInteger('limit') || MAX_HISTORY_LIMIT,
      MAX_HISTORY_PAGE,
    );
    const matchData = await getMatchList(apiToken, { limit });

    // Cắt danh sách theo limit để đảm bảo message trả về đúng số trận user yêu cầu
    // (API có thể ignore limit param và trả về nhiều hơn)
    const matches = matchData.list.slice(0, limit);

    if (!matches.length) {
      const err = buildErrorContainer('Không có trận đấu nào trong lịch sử.');
      return {
        components: err.toJSON(),
        flags: err.flags | MessageFlags.Ephemeral,
      };
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
      content: `${matches.length} trận`,
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

    return {
      components: toComponentsV2([containerComponent, buttonRow.toJSON()]),
      flags: MessageFlags.IsComponentsV2,
    };
  });
}
