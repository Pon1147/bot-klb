/** /df-code — Mật khẩu hằng ngày của các map (Container V2 pattern) */

import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';

import { MAP_DISPLAY } from '../../config/team-find.config.js';
import { fetchDailyCodes, type DailyCodes } from '../../services/deltaforce.scraper.js';
import {
  handleSectionSetChannel,
  handleSectionSetRole,
  handleSectionStatus,
  type SectionConfig,
} from '../../utils/section-config.handlers.js';
import { buildErrorContainer, buildSuccessContainer } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { requireAdministrator } from '../../utils/df-guards.js';
import { sendReply } from '../../utils/reply.utils.js';
import { getSettingsService } from '../../services/settings.service.js';
import { createLogger } from '../../utils/logger.js';
import { rescheduleDfCodes } from '../../services/df-codes-scheduler.js';

const logger = createLogger('DfCode');

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
    const lines = Object.entries(MAP_DISPLAY).map(([fullName, mapInfo]) => {
      const code = codes[fullName as keyof DailyCodes] || 'Chưa có';
      return `### **${mapInfo.name}**\n\`\`\`ini\n[${code}]\n\`\`\``;
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
    subcommand
      .setName('setrole')
      .setDescription('Đặt role được phép sử dụng lệnh.')
      .addRoleOption((option) =>
        option
          .setName('role')
          .setDescription('Role để giới hạn quyền dùng lệnh.')
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('settime')
      .setDescription('Đặt giờ tự động gửi codes mỗi ngày.')
      .addStringOption((option) =>
        option
          .setName('time')
          .setDescription('Giờ gửi theo định dạng HH:mm (24h), ví dụ 08:00')
          .setRequired(true)
          .setAutocomplete(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('setadminchannel')
      .setDescription('Đặt channel nhận thông báo lỗi scheduler.')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('Channel để bot gửi thông báo khi scrape lỗi.')
          .setRequired(true),
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
  logger.info(`/df-code ${subcommand} called by ${interaction.user.id}`);

  if (subcommand === 'show') {
    // Kiểm tra role được phép dùng lệnh (nếu đã cấu hình)
    const settings = getSettingsService().get(guildId);
    const roleId = settings.dfCodes?.roleId;
    if (roleId) {
      const member = interaction.member as import('discord.js').GuildMember;
      // GuildMember.roles.cache luôn tồn tại trong guild context
      const hasRole = member?.roles?.cache?.some((r) => r.id === roleId) ?? false;
      if (!hasRole) {
        await sendReply(interaction, {
          components: buildErrorContainer(
            'Bạn không có quyền sử dụng lệnh này. Cần role đã được cấu hình.',
          ).toJSON(),
        });
        return;
      }
    }

    await interaction.deferReply();

    try {
      const codes = await fetchDailyCodes().catch(() => null);
      const hasCodes = hasAnyCodes(codes);
      const container = buildCodesContainer(codes, hasCodes);

      await interaction.editReply({
        components: container.toJSON(),
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      const err = buildErrorContainer(`Lỗi khi lấy dữ liệu: ${(error as Error).message}`);
      await interaction.editReply({
        components: err.toJSON(),
        flags: MessageFlags.IsComponentsV2,
      });
    }
    return;
  }

  // Guard: yêu cầu Administrator permission cho setchannel/status
  if (await requireAdministrator(interaction)) return;

  if (subcommand === 'setchannel') {
    logger.info(`Set channel for guild ${guildId}`);
    await handleSectionSetChannel(interaction, guildId, DF_CODES_CONFIG);
    rescheduleDfCodes(interaction.client, interaction.client.database as Database.Database);
    return;
  }

  if (subcommand === 'setrole') {
    await handleSectionSetRole(interaction, guildId, DF_CODES_CONFIG);
    return;
  }

  if (subcommand === 'settime') {
    const timeStr = interaction.options.getString('time', true);
    // Kiểm tra định dạng HH:mm
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      logger.warn(`Invalid time format from ${interaction.user.id}: ${timeStr}`);
      await sendReply(interaction, {
        components: buildErrorContainer(
          'Định dạng giờ không hợp lệ. Dùng HH:mm (24h), ví dụ 08:00',
        ).toJSON(),
      });
      return;
    }
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      await sendReply(interaction, {
        components: buildErrorContainer('Giờ phải từ 00-23, phút từ 00-59.').toJSON(),
      });
      return;
    }
    getSettingsService().update(guildId, { dfCodes: { scheduleTime: timeStr } });
    logger.info(`Set scheduleTime for guild ${guildId}: ${timeStr} (UTC+7)`);
    rescheduleDfCodes(interaction.client, interaction.client.database as Database.Database);
    const result = buildSuccessContainer(`Đã đặt giờ tự động gửi codes: ${timeStr} mỗi ngày.`);
    await sendReply(interaction, { components: result.toJSON() });
    return;
  }

  if (subcommand === 'setadminchannel') {
    const channel = interaction.options.getChannel('channel', true);
    getSettingsService().update(guildId, { dfCodes: { adminChannelId: channel.id } });
    logger.info(`Set admin channel for guild ${guildId}: ${channel.id}`);
    const result = buildSuccessContainer(`Đã đặt channel thông báo lỗi: ${channel}.`);
    await sendReply(interaction, { components: result.toJSON() });
    return;
  }

  if (subcommand === 'status') {
    await handleSectionStatus(interaction, guildId, DF_CODES_CONFIG);
    return;
  }
}
