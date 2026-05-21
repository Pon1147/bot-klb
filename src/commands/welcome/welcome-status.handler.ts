import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { buildTextOnlyContainer } from '../../utils/container.utils.js';
import { EMBED_COLORS } from '../../config/container.variables.js';

/**
 * Handle /welcome status: hiển thị cấu hình welcome hiện tại.
 * Migrate sang Container V2: dùng TextDisplay + markdown thay vì Embed fields.
 */
export async function handleStatus(
  interaction: ChatInputCommandInteraction,
  guildIdentifier: string,
): Promise<void> {
  const settingsService = getSettingsService();
  const welcome = settingsService.getWelcome(guildIdentifier);

  const channelName = welcome.channelId ? `<#${welcome.channelId}>` : 'Not set';
  const roleName = welcome.roleId ? `<@&${welcome.roleId}>` : 'Not set';

  // Container V2 không hỗ trợ fields → dùng markdown format
  const statusContent = [
    '**✅ Current Welcome Configuration:**',
    '',
    `**Status:** ${welcome.enabled ? 'Enabled' : 'Disabled'}`,
    `**Channel:** ${channelName}`,
    `**Role:** ${roleName}`,
  ].join('\n');

  const container = buildTextOnlyContainer(statusContent, EMBED_COLORS.SUCCESS);
  // WHY: Combine IsComponentsV2 + Ephemeral flags thay vì ephemeral: true (deprecated)
  await interaction.reply({
    components: container.components as any,
    flags: container.flags | MessageFlags.Ephemeral,
  });
}
