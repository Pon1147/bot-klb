import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getSettingsService } from '../../../services/settings.service.js';
import { buildSuccessContainer } from '../../../utils/container.utils.js';

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

  const container = buildSuccessContainer(`Welcome channel set to ${selectedChannel}.`);
  // WHY: Combine IsComponentsV2 + Ephemeral flags thay vì ephemeral: true (deprecated)
  await interaction.reply({
    components: container.toJSON(),
    flags: container.flags | MessageFlags.Ephemeral,
  });
}
