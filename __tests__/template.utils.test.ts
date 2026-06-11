import { resolveTemplate } from '../src/utils/template.utils';
import { TemplateContext } from '../src/types/settings.types';

// ─── Mock helpers ────────────────────────────────────────────────────────────

function createMockTemplateContext(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return {
    member: {
      user: {
        tag: 'TestUser#1234',
        username: 'TestUser',
        createdTimestamp: Date.now() - 100 * 24 * 60 * 60 * 1000, // 100 ngày trước (default)
        displayAvatarURL: jest.fn().mockReturnValue('https://cdn.example.com/avatar.png'),
        toString: jest.fn().mockReturnValue('<@123456789>'),
      },
      joinedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 ngày trước
    } as unknown as TemplateContext['member'],
    guild: {
      name: 'Test Guild',
      memberCount: 42,
    } as unknown as TemplateContext['guild'],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Template Utils', () => {
  describe('resolveTemplate', () => {
    describe('formatAccountAge branches', () => {
      it('should return "Hôm nay" when account created today (diffDays < 1)', () => {
        // Tạo account trong ngày hôm nay (timestamp rất gần hiện tại)
        const context = createMockTemplateContext({
          member: {
            user: {
              tag: 'TestUser#1234',
              username: 'TestUser',
              createdTimestamp: Date.now() - 3600 * 1000, // 1 giờ trước
              displayAvatarURL: jest.fn().mockReturnValue('https://cdn.example.com/avatar.png'),
              toString: jest.fn().mockReturnValue('<@123456789>'),
            },
            joinedAt: new Date(),
          } as unknown as TemplateContext['member'],
        });

        const result = resolveTemplate('Tài khoản tạo: {accountAge}', context);
        expect(result).toBe('Tài khoản tạo: Hôm nay');
      });

      it('should return "X ngày trước" when account created within 30 days', () => {
        // Tạo account 15 ngày trước
        const context = createMockTemplateContext({
          member: {
            user: {
              tag: 'TestUser#1234',
              username: 'TestUser',
              createdTimestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 ngày trước
              displayAvatarURL: jest.fn().mockReturnValue('https://cdn.example.com/avatar.png'),
              toString: jest.fn().mockReturnValue('<@123456789>'),
            },
            joinedAt: new Date(),
          } as unknown as TemplateContext['member'],
        });

        const result = resolveTemplate('Tuổi tài khoản: {accountAge}', context);
        expect(result).toBe('Tuổi tài khoản: 15 ngày trước');
      });

      it('should return "X tháng trước" when account created more than 30 days ago', () => {
        // Tạo account 100 ngày trước → ~3 tháng
        const context = createMockTemplateContext({
          member: {
            user: {
              tag: 'TestUser#1234',
              username: 'TestUser',
              createdTimestamp: Date.now() - 100 * 24 * 60 * 60 * 1000, // 100 ngày trước
              displayAvatarURL: jest.fn().mockReturnValue('https://cdn.example.com/avatar.png'),
              toString: jest.fn().mockReturnValue('<@123456789>'),
            },
            joinedAt: new Date(),
          } as unknown as TemplateContext['member'],
        });

        const result = resolveTemplate('Tuổi tài khoản: {accountAge}', context);
        expect(result).toBe('Tuổi tài khoản: 3 tháng trước');
      });
    });

    describe('template variables resolution', () => {
      it('should resolve {user} variable to user mention', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('Xin chào {user}!', context);
        expect(result).toBe('Xin chào <@123456789>!');
      });

      it('should resolve {member} variable to user mention', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('Xin chào {member}!', context);
        expect(result).toBe('Xin chào <@123456789>!');
      });

      it('should resolve {memberName} variable', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('Tên: {memberName}', context);
        expect(result).toBe('Tên: TestUser');
      });

      it('should resolve {memberTag} variable', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('Tag: {memberTag}', context);
        expect(result).toBe('Tag: TestUser#1234');
      });

      it('should resolve {guild} variable', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('Server: {guild}', context);
        expect(result).toBe('Server: Test Guild');
      });

      it('should resolve {memberCount} variable', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('Số member: {memberCount}', context);
        expect(result).toBe('Số member: 42');
      });

      it('should leave unknown variables unchanged', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('Unknown: {unknownVar}', context);
        expect(result).toBe('Unknown: {unknownVar}');
      });

      it('should resolve multiple variables in one string', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('{user} join {guild} ({memberCount} members)', context);
        expect(result).toBe('<@123456789> join Test Guild (42 members)');
      });

      it('should resolve all occurrences of the same variable', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('{guild} chào {guild}', context);
        expect(result).toBe('Test Guild chào Test Guild');
      });
    });

    describe('date formatting', () => {
      it('should format account creation date in Vietnamese', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('Ngày tạo: {accountCreationDate}', context);
        // Vietnamese toLocaleDateString: "9 tháng 2, 2026" (day month year, year)
        expect(result).toMatch(/Ngày tạo: \d+ [\w\u00C0-\u017F]+ \d+, \d{4}/);
      });

      it('should format server joining date in Vietnamese', () => {
        const context = createMockTemplateContext();
        const result = resolveTemplate('Ngày join: {serverJoiningDate}', context);
        expect(result).toMatch(/Ngày join: \d+ [\w\u00C0-\u017F]+ \d+, \d{4}/);
      });

      it('should use Date.now() when joinedAt is null (branch coverage)', () => {
        const context = createMockTemplateContext({
          member: {
            user: {
              tag: 'TestUser#1234',
              username: 'TestUser',
              createdTimestamp: Date.now() - 100 * 24 * 60 * 60 * 1000,
              displayAvatarURL: jest.fn().mockReturnValue('https://cdn.example.com/avatar.png'),
              toString: jest.fn().mockReturnValue('<@123456789>'),
            },
            joinedAt: null,
          } as unknown as TemplateContext['member'],
        });
        const result = resolveTemplate('Ngày join: {serverJoiningDate}', context);
        // Khi joinedAt = null → dùng Date.now() → ngày hiện tại
        expect(result).toMatch(/Ngày join: \d+ [\w\u00C0-\u017F]+ \d+, \d{4}/);
      });
    });
  });
});