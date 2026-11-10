export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleResolverInput {
  locale?: string | null;
  guildLocale?: string | null;
}

/**
 * Phân giải ngôn ngữ người dùng:
 * 1. Nếu interaction.locale === 'vi' -> 'vi'
 * 2. Nếu interaction.locale bắt đầu bằng 'en' (en-US, en-GB...) hoặc bất kỳ locale nước ngoài nào (th, id, ja...) -> 'en'
 * 3. Fallback mặc định an toàn -> 'vi'
 */
export function resolveUserLocale(input?: LocaleResolverInput): SupportedLocale {
  if (!input) return 'vi';

  const userLoc = (input.locale || '').toLowerCase().trim();
  if (userLoc === 'vi') {
    return 'vi';
  }

  // Nếu user dùng tiếng Anh hoặc ngôn ngữ quốc tế khác (th, id, ja, fr, de...)
  if (userLoc.length > 0) {
    return 'en';
  }

  const guildLoc = (input.guildLocale || '').toLowerCase().trim();
  if (guildLoc === 'vi') {
    return 'vi';
  }
  if (guildLoc.length > 0) {
    return 'en';
  }

  return 'vi';
}
