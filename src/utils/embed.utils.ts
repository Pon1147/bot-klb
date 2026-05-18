import { EmbedBuilder, GuildMember } from 'discord.js';

/**
 * Color palette for embed messages.
 * Centralized here to ensure consistent styling across all features.
 */
export const embedColors = {
  welcome: 0x00FF00,
  leave: 0xFF0000,
  error: 0xFF0000,
  success: 0x00FF00,
  info: 0x0099FF,
};

/**
 * Format member joining date to readable string.
 */
function formatJoiningDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Build welcome embed message for a new guild member.
 * Uses member data to populate dynamic fields like account age and member count.
 */
export function buildWelcomeEmbed(member: GuildMember): EmbedBuilder {
  const accountCreationDate = formatJoiningDate(member.user.createdTimestamp);
  // joinedAt is Date | null in discord.js v14
  const joinedAtTimestamp = member.joinedAt ? member.joinedAt.getTime() : Date.now();
  const serverJoiningDate = formatJoiningDate(joinedAtTimestamp);
  const currentMemberCount = member.guild.memberCount;

  const embed = new EmbedBuilder()
    .setTitle('Welcome to the Server!')
    .setDescription(
      `Hello ${member.user}! We're glad to have you here.\n\n` +
      `Please read the rules and enjoy your stay!`
    )
    .addFields(
      { name: 'Account Created', value: accountCreationDate, inline: true },
      { name: 'Joined Server', value: serverJoiningDate, inline: true },
      { name: 'Member Count', value: String(currentMemberCount), inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setColor(embedColors.welcome)
    .setFooter({ text: 'Welcome Bot' })
    .setTimestamp();

  return embed;
}

/**
 * Build error embed message for displaying errors to users.
 */
export function buildErrorEmbed(errorMessage: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Error')
    .setDescription(errorMessage)
    .setColor(embedColors.error)
    .setTimestamp();

  return embed;
}

/**
 * Build success embed message for confirming successful operations.
 */
export function buildSuccessEmbed(successMessage: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Success')
    .setDescription(successMessage)
    .setColor(embedColors.success)
    .setTimestamp();

  return embed;
}