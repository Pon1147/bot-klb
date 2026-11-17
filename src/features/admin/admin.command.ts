import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService, SettingsService } from '../../services/settings.service.js';
import { buildAdminConsoleContainer, buildAdminConsoleFooterRow } from './admin-console.builder.js';
import { resolveUserLocale } from '../../infrastructure/i18n/locale-resolver.js';
import { sendReply } from '../../utils/reply.utils.js';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setNameLocalizations({
    vi: 'quản-trị',
  })
  .setDescription('Mở Bảng Điều Khiển Server (Admin Console V2) tương tác 1-chạm.')
  .setDescriptionLocalizations({
    'en-US': 'Open the Interactive Server Admin Console (Components V2).',
  });

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await sendReply(interaction, { content: 'Lệnh này chỉ dùng được trong máy chủ.' });
    return;
  }

  const db = (database ?? interaction.client.database) as Database.Database;
  let settingsService: SettingsService;
  try {
    settingsService = getSettingsService();
  } catch {
    settingsService = new SettingsService(db);
  }
  const settings = settingsService.get(interaction.guild.id);
  const locale = resolveUserLocale({ locale: interaction.locale });

  const container = buildAdminConsoleContainer(
    interaction.guild,
    settings,
    interaction.user.id,
    locale,
  );
  const footerRow = buildAdminConsoleFooterRow(interaction.user.id, locale);

  await sendReply(
    interaction,
    {
      components: [...container.toJSON(), footerRow.toJSON()],
      flags: MessageFlags.IsComponentsV2,
    },
    true, // Ephemeral: riêng tư chỉ admin nhìn thấy
  );
}
