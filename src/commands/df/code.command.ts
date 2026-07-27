/** /df-code — Mật khẩu hằng ngày của các map (Container V2 pattern) */

import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildMember,
} from 'discord.js';
import Database from 'better-sqlite3';

import { buildErrorContainer, makeResult } from '../../utils/container.utils.js';
import { fetchDailyCodes, type DailyCodes } from '../../services/deltaforce.scraper.js';
import { MAP_DISPLAY, type MapKey, type MapInfo } from '../../config/team-find.config.js';
import {
  handleSectionSetChannel,
  handleSectionStatus,
  type SectionConfig,
} from '../../utils/section-config.handlers.js';
import { COLORS } from '../../config/container.variables.js';

export { MAP_DISPLAY };

const DF_CODES_CONFIG: SectionConfig = {
  sectionKey: 'dfCodes',
  displayName: 'DF Codes',
  statusEmoji: '🔑',
  statusColor: COLORS.DF,
};

export const data = new SlashCommandBuilder()
  .setName('df-code')
  .setDescription('Mật khẩu hằng ngày của các map.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('setchannel')
      .setDescription('Đặt channel tự động gửi codes mỗi ngày.')
      .addChannelOption((option) =>
        option.setName('channel').setDescription('Kênh để gửi codes.').setRequired(true),
      ),
  )
  .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Xem channel cấu hình.'));

/** Check if DailyCodes object has at least one non-null value */
export function hasAnyCodes(codes: DailyCodes | null): boolean {
  if (!codes) return false;
  return Object.values(codes).some((v) => v !== null && v !== undefined);
}

export function buildCodesContainer(codes: DailyCodes | null, hasCodes: boolean) {
  const containerInner: unknown[] = [];

  if (hasCodes && codes) {
    const maps = Object.entries(MAP_DISPLAY) as [MapKey, MapInfo][];

    const lines = maps.map(([fullName, mapInfo]) => {
      const code = codes[fullName] || 'Chưa có';
      return `${mapInfo.name} : ${code}`;
    });

    containerInner.push({
      type: ComponentType.TextDisplay,
      content: lines.join('\n'),
    });
  } else {
    containerInner.push({
      type: ComponentType.TextDisplay,
      content: '_Không tìm thấy mật khẩu hôm nay._',
    });
  }

  return makeResult(
    [{ type: ComponentType.Container, components: containerInner }],
    MessageFlags.IsComponentsV2,
    [],
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.editReply({ content: 'Lệnh này chỉ dùng được trong server.' });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: 'Bạn cần quyền Administrator để sử dụng lệnh này.' });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'setchannel') {
    await handleSectionSetChannel(interaction, guildId, DF_CODES_CONFIG);
    return;
  }

  if (subcommand === 'status') {
    await handleSectionStatus(interaction, guildId, DF_CODES_CONFIG);
    return;
  }

  // Default: show codes (already deferred by event handler)
  try {
    const codes = await fetchDailyCodes().catch(() => null);
    const hasCodes = hasAnyCodes(codes);
    const container = buildCodesContainer(codes, hasCodes);

    await interaction.editReply({
      components: container.toJSON(),
      files: container.files,
      flags: container.flags,
    });
  } catch (error) {
    const err = buildErrorContainer(`Lỗi khi lấy dữ liệu: ${(error as Error).message}`);
    await interaction.editReply({
      components: err.toJSON(),
    });
  }
}
