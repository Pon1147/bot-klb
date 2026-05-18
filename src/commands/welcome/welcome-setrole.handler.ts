import {
  ChatInputCommandInteraction,
} from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { buildSuccessEmbed } from '../../utils/embed.utils.js';

/**
 * Handle /welcome setrole: lưu role welcome đã cấu hình.
 */
export async function handleSetRole(
  interaction: ChatInputCommandInteraction,
  guildIdentifier: string
): Promise<void> {
  const selectedRole = interaction.options.getRole('role', true);

  const settingsService = getSettingsService();
  settingsService.update(guildIdentifier, {
    welcome: {
      roleId: selectedRole.id,
    },
  });

  await interaction.reply({
    embeds: [buildSuccessEmbed(`Welcome role set to ${selectedRole.name}.`)],
    ephemeral: true,
  });
}