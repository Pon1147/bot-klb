import { VI_LOCALE } from '../../locales/vi.js';
import { EN_LOCALE } from '../../locales/en.js';
import { SupportedLocale } from './locale-resolver.js';

export function getLocaleDictionary(locale: SupportedLocale) {
  return locale === 'en' ? EN_LOCALE : VI_LOCALE;
}

/**
 * Trích xuất bản dịch an toàn theo đường dẫn key (ví dụ: 'help.title').
 * Nếu locale 'en' thiếu key, tự động fallback về 'vi'.
 * Hỗ trợ nội suy tham số dạng {param}.
 */
export function t(
  keyPath: string,
  params?: Record<string, string | number>,
  locale: SupportedLocale = 'vi',
): string {
  const primary = getLocaleDictionary(locale);
  const fallback = VI_LOCALE;

  const resolveKey = (dict: any, path: string): string | null => {
    const parts = path.split('.');
    let curr = dict;
    for (const part of parts) {
      if (curr === undefined || curr === null || typeof curr !== 'object') {
        return null;
      }
      curr = curr[part];
    }
    return typeof curr === 'string' ? curr : null;
  };

  let template = resolveKey(primary, keyPath);
  if (template === null && locale !== 'vi') {
    template = resolveKey(fallback, keyPath);
  }
  if (template === null) {
    return keyPath;
  }

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return template;
}
