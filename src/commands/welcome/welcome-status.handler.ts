import { ChatInputCommandInteraction } from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { buildSuccessEmbed } from '../../utils/embed.utils.js';

/**
 * Handle /welcome status: hiển thị cấu hình welcome hiện tại.
 */
export async function handleStatus(
  interaction: ChatInputCommandInteraction,
  guildIdentifier: string,
): Promise<void> {
  const settingsService = getSettingsService();
  const welcome = settingsService.getWelcome(guildIdentifier);

  const channelName = welcome.channelId ? `<#${welcome.channelId}>` : 'Not set';
  const roleName = welcome.roleId ? `<@&${welcome.roleId}>` : 'Not set';

  const statusEmbed = buildSuccessEmbed('**Current Welcome Configuration:**').addFields(
    { name: 'Status', value: welcome.enabled ? 'Enabled' : 'Disabled', inline: true },
    { name: 'Channel', value: channelName, inline: true },
    { name: 'Role', value: roleName, inline: true },
  );

  await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
}
