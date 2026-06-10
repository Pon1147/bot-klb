import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getSettingsService } from '../../../services/settings.service.js';
import { buildSuccessContainer } from '../../../utils/container.utils.js';

/**
 * Handle /booster setrole: thiết lập role tự động cấp khi member boost.
 */
export async function handleSetRole(
  interaction: ChatInputCommandInteraction,
  guildIdentifier: string,
): Promise<void> {
  const selectedRole = interaction.options.getRole('role', true);

  const settingsService = getSettingsService();
  await settingsService.update(guildIdentifier, {
    booster: {
      roleId: selectedRole.id,
    },
  });

  const container = buildSuccessContainer(`Booster role set to ${selectedRole}.`);
  // WHY: Combine IsComponentsV2 + Ephemeral flags thay vì ephemeral: true (deprecated)
  await interaction.reply({
    components: container.components as any,
    flags: container.flags | MessageFlags.Ephemeral,
  });
}