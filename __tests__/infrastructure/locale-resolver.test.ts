import { resolveUserLocale } from '../../src/infrastructure/i18n/locale-resolver.js';

describe('Locale Resolver Unit Tests', () => {
  it('trả về vi khi interaction.locale là vi', () => {
    expect(resolveUserLocale({ locale: 'vi' })).toBe('vi');
    expect(resolveUserLocale({ locale: 'VI' })).toBe('vi');
  });

  it('trả về en khi interaction.locale là en-US hoặc en-GB', () => {
    expect(resolveUserLocale({ locale: 'en-US' })).toBe('en');
    expect(resolveUserLocale({ locale: 'en-GB' })).toBe('en');
  });

  it('trả về en cho các locale quốc tế lạ (th, id, ja, ko, fr, de)', () => {
    expect(resolveUserLocale({ locale: 'th' })).toBe('en');
    expect(resolveUserLocale({ locale: 'id' })).toBe('en');
    expect(resolveUserLocale({ locale: 'ja' })).toBe('en');
    expect(resolveUserLocale({ locale: 'ko' })).toBe('en');
  });

  it('sử dụng guildLocale khi interaction.locale rỗng/null', () => {
    expect(resolveUserLocale({ locale: null, guildLocale: 'vi' })).toBe('vi');
    expect(resolveUserLocale({ locale: '', guildLocale: 'en-US' })).toBe('en');
    expect(resolveUserLocale({ locale: undefined, guildLocale: 'th' })).toBe('en');
  });

  it('fallback an toàn về vi khi cả hai đều null/undefined/rỗng', () => {
    expect(resolveUserLocale(undefined)).toBe('vi');
    expect(resolveUserLocale({})).toBe('vi');
    expect(resolveUserLocale({ locale: null, guildLocale: null })).toBe('vi');
    expect(resolveUserLocale({ locale: '', guildLocale: '' })).toBe('vi');
  });
});
