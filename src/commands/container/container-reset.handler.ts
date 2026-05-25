import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { cloneDefaultSettings } from '../../config/default.settings.js';
import { buildSuccessContainer } from '../../utils/container.utils.js';

/**
 * Handle /container reset — reset container settings về default.
 */
export async function handleContainerReset(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  const type = interaction.options.getString('type') as 'welcome' | 'leave' | 'booster';
  const defaults = cloneDefaultSettings();

  const settingsService = getSettingsService();

  // Merge: chỉ reset phần container của type, giữ nguyên các settings khác
  settingsService.update(guildId, {
    [type]: {
      container: defaults[type].container,
    },
  });

  const successContainer = buildSuccessContainer(`Đã reset container "${type}" về mặc định.`);
  await interaction.reply({
    components: successContainer.components as any,
    flags: successContainer.flags | MessageFlags.Ephemeral,
  });
}