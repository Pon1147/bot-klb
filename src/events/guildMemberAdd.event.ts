import { Events, GuildMember } from 'discord.js';
import Database from 'better-sqlite3';
import { getWelcomeConfiguration } from '../database/welcome.database.js';
import { buildWelcomeEmbed } from '../utils/embed.utils.js';

/**
 * Handle guildMemberAdd event: send welcome message when a new member joins.
 * Checks database config to determine if welcome is enabled for this guild.
 */
export async function execute(
  member: GuildMember,
  database: Database.Database
): Promise<void> {
  // Guard clause: skip if member is a bot
  if (member.user.bot) {
    return;
  }

  try {
    const welcomeConfig = getWelcomeConfiguration(database, member.guild.id);

    // Guard clause: skip if welcome is disabled for this guild
    if (!welcomeConfig.isEnabled) {
      return;
    }

    // Guard clause: skip if no welcome channel is configured
    if (!welcomeConfig.channelId) {
      return;
    }

    const welcomeChannel = member.guild.channels.cache.get(welcomeConfig.channelId);

    // Guard clause: skip if channel not found or not a text channel
    if (!welcomeChannel || !welcomeChannel.isTextBased()) {
      return;
    }

    // Send welcome embed message
    const welcomeEmbed = buildWelcomeEmbed(member);
    await welcomeChannel.send({ content: `${member}`, embeds: [welcomeEmbed] });

    // Assign welcome role if configured
    if (welcomeConfig.roleId) {
      await assignWelcomeRole(member, welcomeConfig.roleId);
    }
  } catch (error) {
    console.error(`Error sending welcome message for ${member.user.tag}:`, error);
  }
}

/**
 * Assign the configured welcome role to the new member.
 * Handles errors gracefully so role assignment failure doesn't block welcome message.
 */
async function assignWelcomeRole(
  member: GuildMember,
  roleId: string
): Promise<void> {
  const role = member.guild.roles.cache.get(roleId);

  if (!role) {
    console.warn(`Welcome role ${roleId} not found in guild ${member.guild.id}.`);
    return;
  }

  try {
    await member.roles.add(role);
  } catch (error) {
    console.error(`Failed to assign role ${role.name} to ${member.user.tag}:`, error);
  }
}

export default {
  name: Events.GuildMemberAdd,
  once: false,
  execute,
};