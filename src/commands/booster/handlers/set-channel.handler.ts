import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getSettingsService } from '../../../services/settings.service.js';
import { buildSuccessContainer } from '../../../utils/container.utils.js';

/**
 * Handle /booster setchannel: thiết lập channel gửi tin nhắn cảm ơn booster.
 */
export async function handleSetChannel(
  interaction: ChatInputCommandInteraction,
  guildIdentifier: string,
): Promise<void> {
  const selectedChannel = interaction.options.getChannel('channel', true);

  const settingsService = getSettingsService();
  await settingsService.update(guildIdentifier, {
    booster: {
      channelId: selectedChannel.id,
    },
  });

  const container = buildSuccessContainer(`Booster channel set to ${selectedChannel}.`);
  // WHY: Combine IsComponentsV2 + Ephemeral flags thay vì ephemeral: true (deprecated)
  await interaction.reply({
    components: container.components as any,
    flags: container.flags | MessageFlags.Ephemeral,
  });
}
