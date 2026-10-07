import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { fetchDailyCodes, type DailyCodes } from '../../services/deltaforce.scraper.js';
import { buildErrorContainer, buildSuccessContainer } from '../../utils/container.utils.js';
import {
  handleSectionSetChannel,
  handleSectionSetRole,
  handleSectionStatus,
  type SectionConfig,
} from '../../utils/section-config.handlers.js';
import { requireAdministrator, requireGuild } from '../../utils/df-guards.js';
import { sendReply } from '../../utils/reply.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { getSettingsService } from '../../services/settings.service.js';
import { createLogger } from '../../utils/logger.js';
import { rescheduleDfCodes } from '../../services/df-codes-scheduler.js';
import { buildCodesContainer, hasAnyCodes, MAP_DISPLAY } from './code.renderer.js';

const logger = createLogger('DfCode');

export { buildCodesContainer, hasAnyCodes, MAP_DISPLAY };

const DF_CODES_CONFIG: SectionConfig = {
  sectionKey: 'dfCodes',
  displayName: 'DF Codes',
  statusEmoji: '🔑',
  statusColor: COLORS.DF,
};

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  // Guard: chỉ dùng trong guild
  if (await requireGuild(interaction)) return;

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild!.id;
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
      let codes: DailyCodes | null = null;
      try {
        codes = await fetchDailyCodes();
      } catch (scrapeError: unknown) {
        // Log lỗi chi tiết để debug (Puppeteer thiếu deps, timeout, network fail...)
        logger.error(`Scrape daily codes failed: ${(scrapeError as Error).message}`);
        codes = null;
      }
      const hasCodes = hasAnyCodes(codes);
      const container = buildCodesContainer(codes, hasCodes);

      await interaction.editReply({
        components: container.toJSON(),
        files: container.files,
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
    rescheduleDfCodes(
      interaction.client,
      interaction.client.database as Database.Database,
      guildId,
    );
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
    rescheduleDfCodes(
      interaction.client,
      interaction.client.database as Database.Database,
      guildId,
    );
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
