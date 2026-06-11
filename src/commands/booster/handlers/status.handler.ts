import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getSettingsService } from '../../../services/settings.service.js';
import { buildTextOnlyContainer } from '../../../utils/container.utils.js';
import { CONTAINER_COLORS } from '../../../config/container.variables.js';

/**
 * Handle /booster status: hiển thị cấu hình booster hiện tại.
 * Migrate sang Container V2: dùng TextDisplay + markdown thay vì Embed fields.
 */
export async function handleStatus(
  interaction: ChatInputCommandInteraction,
  guildIdentifier: string,
): Promise<void> {
  const settingsService = getSettingsService();
  const booster = settingsService.getBooster(guildIdentifier);

  const channelName = booster.channelId ? `<#${booster.channelId}>` : 'Not set';
  const roleName = booster.roleId ? `<@&${booster.roleId}>` : 'Not set';

  // Container V2 không hỗ trợ fields → dùng markdown format
  const statusContent = [
    '**🚀 Current Booster Configuration:**',
    '',
    `**Status:** ${booster.enabled ? 'Enabled' : 'Disabled'}`,
    `**Channel:** ${channelName}`,
    `**Role:** ${roleName}`,
  ].join('\n');

  const container = buildTextOnlyContainer(statusContent, CONTAINER_COLORS.BOOSTER);
  // WHY: Combine IsComponentsV2 + Ephemeral flags thay vì ephemeral: true (deprecated)
  await interaction.reply({
    components: container.toJSON(),
    flags: container.flags | MessageFlags.Ephemeral,
  });
}