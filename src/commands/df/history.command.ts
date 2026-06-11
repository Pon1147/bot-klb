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
import { buildErrorContainer } from '../../utils/container.utils.js';
import { getDfToken, touchDfToken } from '../../database/df.token.db.js';
import { getMatchList } from '../../services/deltaforce.api.js';
import { DEFAULT_OPERATOR_AVATAR, resolveOperator } from '../../utils/df-operator.utils.js';
import type { DfMatchEntry } from '../../types/deltaforce.types.js';

const DF_RED = 0xc30027;

const MAP_NAMES: Record<number, string> = {
  2201: 'Haven',
  2202: 'Border',
  2203: 'Bank',
  2204: 'Fortress',
  2205: 'Tomb',
  2206: 'Substation',
  2207: 'Goldshore',
  2208: 'Ridge',
};

const MAX_MATCHES = 10;

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
  const result = match.result === 1 ? '🏆 Win' : '💀 Defeat';
  const extract = Number(match.carry_out_value).toLocaleString('vi-VN');

  const content =
    `**${operator.name}**\n` +
    `Chiến Dịch Sinh Tồn | ${mapName} • ${time}\n` +
    `${result}  ·  💰 ${extract}  ·  ☠ ${match.kill_count}`;

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
  if (!interaction.guild) {
    await interaction.reply({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const token = getDfToken(database, interaction.user.id);
  if (!token) {
    const err = buildErrorContainer('Bạn chưa liên kết tài khoản. Dùng `/df-link` để bắt đầu.');
    await interaction.reply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const apiToken = {
      openid: token.openid,
      token: token.token,
      ts: token.ts ?? undefined,
      s: token.s ?? undefined,
      u: token.u ?? undefined,
    };
    const matchData = await getMatchList(apiToken);
    touchDfToken(database, interaction.user.id);

    const limit = Math.min(interaction.options.getInteger('limit') || MAX_MATCHES, 20);
    const matches = matchData.list.slice(0, limit);

    if (!matches.length) {
      const err = buildErrorContainer('Không có trận đấu nào trong lịch sử.');
      await interaction.editReply({
        components: err.components as any,
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
      accent_color: DF_RED,
    };

    // ── BUTTON ROW (outside container) ──
    const buttonRow = buildViewAllButtonRow();

    await interaction.editReply({
      components: [containerComponent, buttonRow.toJSON()] as any,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  } catch (error) {
    const err = buildErrorContainer(
      `Lỗi khi lấy dữ liệu: ${(error as Error).message}\nNếu lỗi tiếp tục, hãy unlink và link lại tài khoản.`,
    );
    await interaction.editReply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
