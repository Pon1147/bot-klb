import {
  ChatInputCommandInteraction,
} from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { buildSuccessEmbed } from '../../utils/embed.utils.js';

/**
 * Handle /welcome toggle: bật/tắt hệ thống welcome.
 */
export async function handleToggle(
  interaction: ChatInputCommandInteraction,
  guildIdentifier: string
): Promise<void> {
  const shouldBeEnabled = interaction.options.getBoolean('enabled', true);

  const settingsService = getSettingsService();
  settingsService.update(guildIdentifier, {
    welcome: {
      enabled: shouldBeEnabled,
    },
  });

  const statusText = shouldBeEnabled ? 'enabled' : 'disabled';
  await interaction.reply({
    embeds: [buildSuccessEmbed(`Welcome system ${statusText}.`)],
    ephemeral: true,
  });
}