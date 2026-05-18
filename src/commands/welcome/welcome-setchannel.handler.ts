import { ChatInputCommandInteraction } from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { buildSuccessEmbed } from '../../utils/embed.utils.js';

/**
 * Handle /welcome setchannel: lưu channel welcome đã cấu hình.
 */
export async function handleSetChannel(
  interaction: ChatInputCommandInteraction,
  guildIdentifier: string,
): Promise<void> {
  const selectedChannel = interaction.options.getChannel('channel', true);

  const settingsService = getSettingsService();
  settingsService.update(guildIdentifier, {
    welcome: {
      channelId: selectedChannel.id,
    },
  });

  await interaction.reply({
    embeds: [buildSuccessEmbed(`Welcome channel set to ${selectedChannel}.`)],
    ephemeral: true,
  });
}
