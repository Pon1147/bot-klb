/** /df-code — Mật khẩu hằng ngày của các map (Container V2 pattern) */

import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';

import { MAP_DISPLAY, type MapKey, type MapInfo } from '../../config/team-find.config.js';
import { fetchDailyCodes, type DailyCodes } from '../../services/deltaforce.scraper.js';
import {
  handleSectionSetChannel,
  handleSectionStatus,
  type SectionConfig,
} from '../../utils/section-config.handlers.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { requireAdministrator } from '../../utils/df-guards.js';
import { sendReply } from '../../utils/reply.utils.js';

export { MAP_DISPLAY };

/** Check if DailyCodes object has at least one non-null value (used by scheduler) */
export function hasAnyCodes(codes: DailyCodes | null): boolean {
  if (!codes) return false;
  return Object.values(codes).some((v) => v !== null && v !== undefined);
}

/** Build codes display container (used by scheduler) */
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

  return {
    components: [{ type: ComponentType.Container, components: containerInner }],
    flags: MessageFlags.IsComponentsV2,
    files: [] as unknown[],
    toJSON() {
      return this.components;
    },
  };
}

const DF_CODES_CONFIG: SectionConfig = {
  sectionKey: 'dfCodes',
  displayName: 'DF Codes',
  statusEmoji: '🔑',
  statusColor: COLORS.DF,
};

export const data = new SlashCommandBuilder()
  .setName('df-code')
  .setDescription('Mật khẩu hằng ngày của các map.')
  .addSubcommand((subcommand) => subcommand.setName('show').setDescription('Xem mật khẩu hôm nay.'))
  .addSubcommand((subcommand) =>
    subcommand
      .setName('setchannel')
      .setDescription('Đặt channel tự động gửi codes mỗi ngày.')
      .addChannelOption((option) =>
        option.setName('channel').setDescription('Kênh để gửi codes.').setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('status').setDescription('Xem channel cấu hình.'),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  // Guard: chỉ dùng trong guild
  if (!interaction.guild) {
    await sendReply(interaction, { content: 'Lệnh này chỉ dùng được trong server.' });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'show') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const codes = await fetchDailyCodes().catch(() => null);
      const hasCodes = hasAnyCodes(codes);
      const container = buildCodesContainer(codes, hasCodes);
      await interaction.editReply({
        components: container.toJSON(),
        files: container.files,
        flags: container.flags,
      } as Parameters<typeof interaction.editReply>[0]);
    } catch (error) {
      const err = buildErrorContainer(`Loi khi lay du lieu: ${(error as Error).message}`);
      await interaction.editReply({
        components: err.toJSON(),
      });
    }
    return;
  }

  // Guard: yêu cầu Administrator permission cho setchannel/status
  if (await requireAdministrator(interaction)) return;

  if (subcommand === 'setchannel') {
    await handleSectionSetChannel(interaction, guildId, DF_CODES_CONFIG);
    return;
  }

  if (subcommand === 'status') {
    await handleSectionStatus(interaction, guildId, DF_CODES_CONFIG);
    return;
  }
}
