/// <reference types="jest" />
import Database from 'better-sqlite3';
import { Client, Guild, MessageFlags, TextChannel } from 'discord.js';
import {
  buildGuildWelcomeContainer,
  findInitialAnnouncementChannel,
  handleGuildCreate,
} from '../../src/features/admin/guild-create.handler.js';
import {
  initializeGuildWelcomeAuditTable,
  claimGuildWelcome,
  updateGuildWelcomeResult,
  getGuildWelcomeAudit,
} from '../../src/database/guild.settings.db.js';

describe('features/admin/guild-create.handler', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeGuildWelcomeAuditTable(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('buildGuildWelcomeContainer', () => {
    it('phải tạo Container V2 ngắn gọn (< 10 dòng), chứa Bot Delta và CTA /df help', () => {
      const result = buildGuildWelcomeContainer('Test Server');
      expect(result.flags).toBe(MessageFlags.IsComponentsV2);
      const jsonStr = JSON.stringify(result.toJSON());

      expect(jsonStr).toContain('Test Server');
      expect(jsonStr).toContain('Bot Delta');
      expect(jsonStr).toContain('/df help');

      // Kiểm tra số dòng ngắn gọn (< 10 dòng)
      const lines = jsonStr.split('\\n');
      expect(lines.length).toBeLessThan(10);
    });
  });

  describe('findInitialAnnouncementChannel', () => {
    function createMockChannel(name: string, canSend: boolean = true) {
      return {
        name,
        isTextBased: () => true,
        isDMBased: () => false,
        isVoiceBased: () => false,
        permissionsFor: jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(canSend),
        }),
        send: jest.fn().mockResolvedValue({}),
      } as unknown as TextChannel;
    }

    it('ưu tiên systemChannel nếu bot có quyền ViewChannel và SendMessages', () => {
      const systemChan = createMockChannel('general-system', true);
      const otherChan = createMockChannel('thông-báo', true);

      const mockGuild = {
        systemChannel: systemChan,
        channels: {
          cache: new Map([
            ['1', systemChan],
            ['2', otherChan],
          ]),
        },
        members: {
          me: { id: 'bot-123' },
        },
      } as unknown as Guild;

      const found = findInitialAnnouncementChannel(mockGuild);
      expect(found).toBe(systemChan);
    });

    it('fallback tới kênh chứa từ khóa ưu tiên khi systemChannel không gửi được', () => {
      const systemChan = createMockChannel('system', false);
      const announceChan = createMockChannel('thông-báo-chung', true);
      const randomChan = createMockChannel('random', true);

      const mockGuild = {
        systemChannel: systemChan,
        channels: {
          cache: new Map([
            ['1', systemChan],
            ['2', announceChan],
            ['3', randomChan],
          ]),
        },
        members: {
          me: { id: 'bot-123' },
        },
      } as unknown as Guild;

      const found = findInitialAnnouncementChannel(mockGuild);
      expect(found).toBe(announceChan);
    });

    it('fallback tới bất kỳ kênh text nào có quyền nếu không có kênh từ khóa', () => {
      const noPermChan = createMockChannel('secret', false);
      const firstValidChan = createMockChannel('lounge', true);

      const mockGuild = {
        systemChannel: null,
        channels: {
          cache: new Map([
            ['1', noPermChan],
            ['2', firstValidChan],
          ]),
        },
        members: {
          me: { id: 'bot-123' },
        },
      } as unknown as Guild;

      const found = findInitialAnnouncementChannel(mockGuild);
      expect(found).toBe(firstValidChan);
    });

    it('trả về null nếu không tìm thấy kênh nào bot có quyền gửi tin', () => {
      const noPermChan = createMockChannel('general', false);

      const mockGuild = {
        systemChannel: noPermChan,
        channels: {
          cache: new Map([['1', noPermChan]]),
        },
        members: {
          me: { id: 'bot-123' },
        },
      } as unknown as Guild;

      const found = findInitialAnnouncementChannel(mockGuild);
      expect(found).toBeNull();
    });
  });

  describe('handleGuildCreate (At-Most-Once & Fail-Closed)', () => {
    function setupMockGuild(sendMock = jest.fn().mockResolvedValue({})) {
      const targetChan = {
        id: 'chan-123',
        name: 'chung',
        isTextBased: () => true,
        isDMBased: () => false,
        isVoiceBased: () => false,
        permissionsFor: jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(true),
        }),
        send: sendMock,
      } as unknown as TextChannel;

      const mockGuild = {
        id: 'guild-999',
        name: 'Gaming Community',
        memberCount: 50,
        systemChannel: targetChan,
        channels: {
          cache: new Map([['chan-123', targetChan]]),
        },
        members: {
          me: { id: 'bot-123' },
        },
      } as unknown as Guild;

      return { mockGuild, targetChan, sendMock };
    }

    it('gửi thông báo chào mừng và cập nhật status "sent" khi claim thành công', async () => {
      const { mockGuild, sendMock } = setupMockGuild();
      const mockClient = { database: db } as unknown as Client;

      await handleGuildCreate(mockClient, mockGuild);

      expect(sendMock).toHaveBeenCalledTimes(1);
      const callArg = sendMock.mock.calls[0][0];
      expect(callArg.flags).toBe(MessageFlags.IsComponentsV2);

      const audit = getGuildWelcomeAudit(db, 'guild-999');
      expect(audit).toBeDefined();
      expect(audit?.status).toBe('sent');
      expect(audit?.channel_id).toBe('chan-123');
    });

    it('Atomic Claim First: Chặn gửi lại nếu guild đã có bản ghi trong DB', async () => {
      const { mockGuild, sendMock } = setupMockGuild();
      const mockClient = { database: db } as unknown as Client;

      // Lần 1: gửi thành công
      await handleGuildCreate(mockClient, mockGuild);
      expect(sendMock).toHaveBeenCalledTimes(1);

      // Lần 2: gọi lại với cùng guild -> bị chặn, không gửi lần 2
      await handleGuildCreate(mockClient, mockGuild);
      expect(sendMock).toHaveBeenCalledTimes(1);
    });

    it('Fail-Closed: Lỗi DB khi claim -> bắt ngoại lệ và tuyệt đối không gửi tin nhắn', async () => {
      const { mockGuild, sendMock } = setupMockGuild();

      // Giả lập DB ném lỗi khi prepare / run
      const brokenDb = {
        prepare: jest.fn().mockImplementation(() => {
          throw new Error('SQLITE_BUSY: database is locked');
        }),
      } as unknown as Database.Database;

      const mockClient = { database: brokenDb } as unknown as Client;

      await expect(handleGuildCreate(mockClient, mockGuild)).resolves.not.toThrow();
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('Không tìm thấy kênh -> cập nhật "failed" và giữ nguyên bản ghi claim, không xóa', async () => {
      const mockGuild = {
        id: 'guild-no-chan',
        name: 'Empty Guild',
        memberCount: 2,
        systemChannel: null,
        channels: {
          cache: new Map(),
        },
        members: {
          me: { id: 'bot-123' },
        },
      } as unknown as Guild;

      const mockClient = { database: db } as unknown as Client;

      await handleGuildCreate(mockClient, mockGuild);

      const audit = getGuildWelcomeAudit(db, 'guild-no-chan');
      expect(audit).toBeDefined();
      expect(audit?.status).toBe('failed');
      expect(audit?.error_message).toContain('No writable channel found');
    });

    it('Bản ghi đã ở trạng thái "failed" -> gọi lại handler vẫn không gửi tin nhắn', async () => {
      const sendMock = jest.fn().mockResolvedValue({});
      const { mockGuild } = setupMockGuild(sendMock);
      const mockClient = { database: db } as unknown as Client;

      // Tạo sẵn bản ghi failed
      claimGuildWelcome(db, mockGuild.id);
      updateGuildWelcomeResult(db, mockGuild.id, 'failed', undefined, 'Manual error');

      await handleGuildCreate(mockClient, mockGuild);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('Edge Case Test 7: DB lỗi khi cập nhật sent sau khi Discord nhận tin -> gọi lại handler vẫn KHÔNG gửi lần 2', async () => {
      const sendMock = jest.fn().mockResolvedValue({});
      const { mockGuild } = setupMockGuild(sendMock);

      // Tạo DB thực tế
      const mockClient = { database: db } as unknown as Client;

      // Spy trên db.prepare để khi gọi UPDATE guild_welcome_audit thì ném lỗi
      const originalPrepare = db.prepare.bind(db);
      jest.spyOn(db, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('UPDATE guild_welcome_audit')) {
          throw new Error('SQLITE_BUSY: database is locked on update');
        }
        return originalPrepare(sql);
      });

      // Lần 1: gửi Discord thành công, nhưng UPDATE sent bị lỗi -> bản ghi giữ pending
      await handleGuildCreate(mockClient, mockGuild);
      expect(sendMock).toHaveBeenCalledTimes(1);

      const audit = originalPrepare('SELECT * FROM guild_welcome_audit WHERE guild_id = ?').get(mockGuild.id) as any;
      expect(audit).toBeDefined();
      expect(audit.status).toBe('pending');

      // Khôi phục prepare bình thường
      (db.prepare as jest.Mock).mockRestore();

      // Lần 2: gọi lại handler với cùng guild.id -> claimGuildWelcome trả về false -> KHÔNG gọi send lần 2
      await handleGuildCreate(mockClient, mockGuild);
      expect(sendMock).toHaveBeenCalledTimes(1);
    });
  });
});
