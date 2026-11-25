import Database from 'better-sqlite3';
import { initializeSubscriptionTables } from '../../src/database/subscription.db.js';
import { execute, data } from '../../src/features/admin/admin-key.command.js';
import { MessageFlags } from 'discord.js';

describe('Slash Command: /admin-key (Bot Owner Key Management)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');

    initializeSubscriptionTables(db);
  });

  afterEach(() => {
    db.close();
  });

  it('định nghĩa builder với đúng tên và 3 subcommands (create, list, revoke)', () => {
    expect(data.name).toBe('admin-key');
    const json = data.toJSON();
    const subcommands = json.options?.map((opt: any) => opt.name);
    expect(subcommands).toContain('create');
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('revoke');
  });

  describe('Subcommand: create', () => {
    it('sinh mã bản quyền mới và trả về mã cho bot owner', async () => {
      const interaction: any = {
        options: {
          getSubcommand: jest.fn().mockReturnValue('create'),
          getInteger: jest.fn((name: string) => (name === 'duration_days' ? 30 : null)),
          getString: jest.fn((name: string) => (name === 'note' ? 'Server Delta Test' : null)),
        },
        user: { id: 'bot_owner_id' },
        reply: jest.fn().mockResolvedValue({}),
      };

      await execute(interaction, db);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: MessageFlags.Ephemeral,
          embeds: expect.any(Array),
        }),
      );

      // Kiểm tra DB đã có key được lưu
      const keys = db.prepare('SELECT * FROM subscription_keys').all() as any[];
      expect(keys.length).toBe(1);
      expect(keys[0].duration_days).toBe(30);
      expect(keys[0].status).toBe('unused');
      expect(keys[0].note).toBe('Server Delta Test');
      expect(keys[0].key).toMatch(/^KLB-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });
  });

  describe('Subcommand: list', () => {
    it('trả về thông báo không có key nếu danh sách rỗng', async () => {
      const interaction: any = {
        options: {
          getSubcommand: jest.fn().mockReturnValue('list'),
          getString: jest.fn().mockReturnValue('all'),
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await execute(interaction, db);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Không có mã bản quyền nào'),
          flags: MessageFlags.Ephemeral,
        }),
      );
    });

    it('liệt kê danh sách các key đã cấp', async () => {
      db.prepare(
        `INSERT INTO subscription_keys (key, duration_days, status, created_by, note, created_at)
         VALUES ('KLB-1111-2222-3333-4444', 90, 'unused', 'owner_1', 'Test Key 1', 1000),
                ('KLB-5555-6666-7777-8888', 30, 'used', 'owner_1', 'Test Key 2', 2000)`,
      ).run();

      const interaction: any = {
        options: {
          getSubcommand: jest.fn().mockReturnValue('list'),
          getString: jest.fn().mockReturnValue('all'),
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await execute(interaction, db);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          flags: MessageFlags.Ephemeral,
        }),
      );
    });
  });

  describe('Subcommand: revoke', () => {
    it('thu hồi thành công một mã key chưa dùng', async () => {
      db.prepare(
        `INSERT INTO subscription_keys (key, duration_days, status, created_by, created_at)
         VALUES ('KLB-AAAA-BBBB-CCCC-DDDD', 30, 'unused', 'owner_1', 1000)`,
      ).run();

      const interaction: any = {
        options: {
          getSubcommand: jest.fn().mockReturnValue('revoke'),
          getString: jest.fn().mockReturnValue('KLB-AAAA-BBBB-CCCC-DDDD'),
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await execute(interaction, db);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đã thu hồi thành công'),
          flags: MessageFlags.Ephemeral,
        }),
      );

      const keyRecord = db
        .prepare("SELECT status FROM subscription_keys WHERE key = 'KLB-AAAA-BBBB-CCCC-DDDD'")
        .get() as any;
      expect(keyRecord.status).toBe('revoked');
    });

    it('từ chối thu hồi mã đã dùng hoặc không tồn tại', async () => {
      const interaction: any = {
        options: {
          getSubcommand: jest.fn().mockReturnValue('revoke'),
          getString: jest.fn().mockReturnValue('KLB-NON-EXISTENT'),
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await execute(interaction, db);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Không thể thu hồi mã'),
          flags: MessageFlags.Ephemeral,
        }),
      );
    });
  });
});
