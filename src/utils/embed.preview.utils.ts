import { EmbedBuilder } from 'discord.js';
import { EmbedSettings } from '../types/settings.types.js';

/**
 * Màu sắc preset cho button color picker.
 */
export const COLOR_PRESETS = [
  { label: '🟢 Xanh lá', value: 0x00FF00, hex: '#00FF00' },
  { label: '🔴 Đỏ', value: 0xFF0000, hex: '#FF0000' },
  { label: '🔵 Xanh dương', value: 0x0099FF, hex: '#0099FF' },
  { label: '🟡 Vàng', value: 0xFFDD00, hex: '#FFDD00' },
  { label: '🟣 Tím', value: 0x9933FF, hex: '#9933FF' },
  { label: '🟠 Cam', value: 0xFF8800, hex: '#FF8800' },
] as const;

/**
 * Parse color (number hoặc hex string) thành number cho EmbedBuilder.
 */
export function parseColorForEmbed(color: number | string): number {
  if (typeof color === 'number') return color;
  const hex = color.replace('#', '');
  const parsed = parseInt(hex, 16);
  return isNaN(parsed) ? 0x0099FF : parsed;
}

/**
 * Format color number thành hex string "#RRGGBB".
 */
export function colorToHex(color: number | string): string {
  const num = typeof color === 'string' ? parseColorForEmbed(color) : color;
  return `#${num.toString(16).padStart(6, '0').toUpperCase()}`;
}

/**
 * Build preview embed từ draft EmbedSettings (không cần template context).
 * Dùng cho interactive edit — hiển thị ngay lập tức mà không resolve templates.
 *
 * Đây là "what you see is what you get" preview.
 */
export function buildDraftPreviewEmbed(settings: EmbedSettings): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(settings.title || 'No title')
    .setDescription(settings.description || 'No description')
    .setColor(parseColorForEmbed(settings.color));

  // Timestamp
  if (settings.timestamp) {
    embed.setTimestamp();
  }

  // Footer
  if (settings.footer) {
    const footerOptions: { text: string; iconURL?: string } = { text: settings.footer };
    if (settings.footerIcon) {
      footerOptions.iconURL = settings.footerIcon;
    }
    embed.setFooter(footerOptions);
  }

  // Thumbnail
  if (settings.thumbnail) {
    // Nếu là string (URL custom), dùng trực tiếp. Nếu true, dùng placeholder.
    const thumbnailUrl = typeof settings.thumbnail === 'string'
      ? settings.thumbnail
      : 'https://cdn.discordapp.com/embed/avatars/0.png';
    embed.setThumbnail(thumbnailUrl);
  }

  // Image
  if (settings.image) {
    embed.setImage(settings.image);
  }

  // URL
  if (settings.url) {
    embed.setURL(settings.url);
  }

  // Fields
  if (settings.fields && settings.fields.length > 0) {
    embed.addFields(...settings.fields.map(f => ({
      name: f.name,
      value: f.value,
      inline: f.inline,
    })));
  }

  return embed;
}

/**
 * Build info embed hiển thị trạng thái hiện tại của embed đang edit.
 * Dùng làm message header trong interactive editor.
 */
export function buildEditorInfoEmbed(
  type: 'welcome' | 'leave',
  settings: EmbedSettings,
): EmbedBuilder {
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: '🎨 Color', value: `\`${colorToHex(settings.color)}\``, inline: true },
    { name: '📌 Thumbnail', value: settings.thumbnail === true ? 'Avatar' : settings.thumbnail ? 'Custom URL' : 'OFF', inline: true },
    { name: '⏰ Timestamp', value: settings.timestamp ? 'ON' : 'OFF', inline: true },
    { name: '🖼️ Image', value: settings.image ? 'SET' : 'NONE', inline: true },
    { name: '🔗 URL', value: settings.url ? 'SET' : 'NONE', inline: true },
    { name: '📎 Fields', value: String(settings.fields?.length ?? 0), inline: true },
  ];

  return new EmbedBuilder()
    .setTitle(`🎨 Edit ${type === 'welcome' ? 'Welcome' : 'Leave'} Embed`)
    .setDescription('Nhấn button bên dưới để chỉnh sửa từng phần. Mọi thay đổi sẽ hiển thị ngay trên preview.')
    .addFields(fields)
    .setColor(0x0099FF)
    .setFooter({ text: 'Nhấn 💾 Save để lưu, ❌ Cancel để hủy' })
    .setTimestamp();
}