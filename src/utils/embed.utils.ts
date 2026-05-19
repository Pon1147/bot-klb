import { EmbedBuilder } from 'discord.js';
import { EmbedSettings, TemplateContext } from '../types/settings.types.js';
import { resolveTemplate } from './template.utils.js';
import { embedColors } from '../config/embed.variables.js';

// Re-export for backward compatibility
export { embedColors };

/**
 * Build embed từ settings object + template context.
 * Thay thế buildWelcomeEmbed cũ (hardcode).
 * Hỗ trợ đầy đủ Rich Embed: image, footerIcon, url, timestamp.
 */
export function buildEmbedFromSettings(
  embedSettings: EmbedSettings,
  context: TemplateContext,
): EmbedBuilder {
  const { member } = context;

  const embed = new EmbedBuilder()
    .setTitle(resolveTemplate(embedSettings.title, context))
    .setDescription(resolveTemplate(embedSettings.description, context))
    .setColor(parseColor(embedSettings.color));

  // Timestamp (tùy chọn)
  if (embedSettings.timestamp) {
    embed.setTimestamp();
  }

  // Footer (với icon tùy chọn)
  if (embedSettings.footer) {
    const footerText = resolveTemplate(embedSettings.footer, context);
    const footerIconUrl = embedSettings.footerIcon
      ? resolveTemplate(embedSettings.footerIcon, context)
      : undefined;
    embed.setFooter({ text: footerText, iconURL: footerIconUrl });
  }

  // Thumbnail: true = avatar member, string = URL custom
  if (embedSettings.thumbnail) {
    const thumbnailUrl = typeof embedSettings.thumbnail === 'string'
      ? resolveTemplate(embedSettings.thumbnail, context)
      : member.user.displayAvatarURL({ size: 256 });
    embed.setThumbnail(thumbnailUrl);
  }

  // Image: URL ảnh lớn
  if (embedSettings.image) {
    embed.setImage(resolveTemplate(embedSettings.image, context));
  }

  // URL: link cho embed title
  if (embedSettings.url) {
    embed.setURL(resolveTemplate(embedSettings.url, context));
  }

  // Fields
  for (const field of embedSettings.fields) {
    embed.addFields({
      name: resolveTemplate(field.name, context),
      value: resolveTemplate(field.value, context),
      inline: field.inline,
    });
  }

  return embed;
}

/**
 * Parse color từ number hoặc hex string.
 */
function parseColor(color: number | string): number {
  if (typeof color === 'number') {
    return color;
  }
  const hex = color.replace('#', '');
  return parseInt(hex, 16);
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

/**
 * Legacy buildWelcomeEmbed for backward compatibility with tests.
 * Builds a welcome embed from a GuildMember directly.
 */
export function buildWelcomeEmbed(member: {
  user: {
    tag: string;
    createdTimestamp: number;
    displayAvatarURL: () => string;
    toString: () => string;
  };
  guild: { id: string; memberCount: number };
  joinedAt: Date | null;
}): EmbedBuilder {
  const formatDate = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const joinedAtTimestamp = member.joinedAt ? member.joinedAt.getTime() : Date.now();

  return new EmbedBuilder()
    .setTitle('Welcome to the Server!')
    .setDescription(`We are glad to have you here, ${member.user.toString()}!`)
    .setColor(embedColors.welcome)
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: 'Welcome Bot' })
    .setTimestamp()
    .addFields(
      { name: 'Account Created', value: formatDate(member.user.createdTimestamp), inline: true },
      { name: 'Joined Server', value: formatDate(joinedAtTimestamp), inline: true },
      { name: 'Member Count', value: String(member.guild.memberCount), inline: true },
    );
}
