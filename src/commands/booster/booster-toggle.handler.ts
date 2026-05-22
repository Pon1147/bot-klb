import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { buildSuccessContainer } from '../../utils/container.utils.js';

/**
 * Handle /booster toggle: bật/tắt hệ thống booster.
 */
export async function handleToggle(
  interaction: ChatInputCommandInteraction,
  guildIdentifier: string,
): Promise<void> {
  const shouldBeEnabled = interaction.options.getBoolean('enabled', true);

  const settingsService = getSettingsService();
  await settingsService.update(guildIdentifier, {
    booster: {
      enabled: shouldBeEnabled,
    },
  });

  const statusText = shouldBeEnabled ? 'enabled' : 'disabled';
  const container = buildSuccessContainer(`Booster system ${statusText}.`);
  // WHY: Combine IsComponentsV2 + Ephemeral flags thay vì ephemeral: true (deprecated)
  await interaction.reply({
    components: container.components as any,
    flags: container.flags | MessageFlags.Ephemeral,
  });
}