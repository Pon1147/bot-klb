import { resolveTemplate } from '../../src/utils/template.utils';
import { TemplateContext } from '../../src/types/settings.types';

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
      premiumSubscriptionCount: 15,
      premiumTier: 2,
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

      it('should resolve {memberCount} and {member_count} variable', () => {
        const context = createMockTemplateContext();
        expect(resolveTemplate('Số member: {memberCount}', context)).toBe('Số member: 42');
        expect(resolveTemplate('Số member: {member_count}', context)).toBe('Số member: 42');
      });

      it('should resolve {server} alias for {guild}', () => {
        const context = createMockTemplateContext();
        expect(resolveTemplate('Server: {server}', context)).toBe('Server: Test Guild');
      });

      it('should resolve boost variables: {boostCount}, {boost_count}, {boostLevel}, {boost_level}', () => {
        const context = createMockTemplateContext();
        expect(resolveTemplate('Boosts: {boostCount} - Level: {boostLevel}', context)).toBe('Boosts: 15 - Level: 2');
        expect(resolveTemplate('Boosts: {boost_count} - Level: {boost_level}', context)).toBe('Boosts: 15 - Level: 2');
      });

      it('should fallback boost variables to 0 when undefined on guild', () => {
        const context = createMockTemplateContext({
          guild: { name: 'No Boost', memberCount: 10 } as unknown as TemplateContext['guild'],
        });
        expect(resolveTemplate('{boost_count} - {boost_level}', context)).toBe('0 - 0');
      });

      it('should resolve timestamp variables: {timestamp}, {timestamp_r}, {date}', () => {
        const context = createMockTemplateContext();
        const res = resolveTemplate('Lúc: {timestamp} ({timestamp_r}) vào ngày {date}', context);
        expect(res).toMatch(/Lúc: <t:\d+:f> \(<t:\d+:R>\) vào ngày \d+/);
      });

      it('should resolve user leave message template with {member_count} and {timestamp}', () => {
        const context = createMockTemplateContext();
        const template =
          'Một thành viên vừa kết thúc hành trình tại cộng đồng chúng ta.\n' +
          '👥 Thành viên hiện tại: {member_count}\n' +
          '🕒 Thời gian rời server: {timestamp}\n' +
          'Cảm ơn bạn đã từng đồng hành cùng Crown Zero.';
        const result = resolveTemplate(template, context);
        expect(result).toContain('👥 Thành viên hiện tại: 42');
        expect(result).toMatch(/🕒 Thời gian rời server: <t:\d+:f>/);
        expect(result).not.toContain('{member_count}');
        expect(result).not.toContain('{timestamp}');
      });

      it('should resolve snake_case aliases for member and dates', () => {
        const context = createMockTemplateContext();
        const res = resolveTemplate(
          '{member_name} ({member_tag}) tạo lúc {account_creation_date}, tuổi: {account_age}, join: {server_joining_date}',
          context,
        );
        expect(res).toContain('TestUser (TestUser#1234)');
        expect(res).not.toContain('{member_name}');
        expect(res).not.toContain('{account_creation_date}');
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