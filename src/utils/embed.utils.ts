import { EmbedBuilder } from 'discord.js';
import { EmbedSettings, TemplateContext } from '../types/settings.types.js';
import { resolveTemplate } from './template.utils.js';

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
 * Build embed từ settings object + template context.
 * Thay thế buildWelcomeEmbed cũ (hardcode).
 */
export function buildEmbedFromSettings(
  embedSettings: EmbedSettings,
  context: TemplateContext,
): EmbedBuilder {
  const { member } = context;

  const embed = new EmbedBuilder()
    .setTitle(resolveTemplate(embedSettings.title, context))
    .setDescription(resolveTemplate(embedSettings.description, context))
    .setColor(parseColor(embedSettings.color))
    .setTimestamp();

  // Footer
  if (embedSettings.footer) {
    embed.setFooter({ text: resolveTemplate(embedSettings.footer, context) });
  }

  // Thumbnail (avatar member)
  if (embedSettings.thumbnail) {
    embed.setThumbnail(member.user.displayAvatarURL());
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