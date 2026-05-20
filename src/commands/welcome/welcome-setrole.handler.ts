import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { buildSuccessContainer } from '../../utils/container.utils.js';

/**
 * Handle /welcome setrole: lưu role welcome đã cấu hình.
 */
export async function handleSetRole(
  interaction: ChatInputCommandInteraction,
  guildIdentifier: string,
): Promise<void> {
  const selectedRole = interaction.options.getRole('role', true);

  const settingsService = getSettingsService();
  settingsService.update(guildIdentifier, {
    welcome: {
      roleId: selectedRole.id,
    },
  });

  const container = buildSuccessContainer(`Welcome role set to ${selectedRole.name}.`);
  // WHY: Combine IsComponentsV2 + Ephemeral flags thay vì ephemeral: true (deprecated)
  await interaction.reply({
    components: container.components as any,
    flags: container.flags | MessageFlags.Ephemeral,
  });
}
