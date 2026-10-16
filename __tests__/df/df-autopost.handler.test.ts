/// <reference types="jest" />
import Database from 'better-sqlite3';
import { execute, isBotOwner } from '../../src/features/delta-force/autopost.handler.js';
import { botConfig } from '../../src/config/bot.config.js';
import { initializeAutoPostTable, getAutoPostConfig } from '../../src/database/df-autopost.db.js';
import * as scheduler from '../../src/services/df-autopost-scheduler.js';
import { MessageFlags } from 'discord.js';

jest.mock('../../src/services/df-autopost-scheduler.js', () => ({
  rescheduleDfAutoPost: jest.fn(),
  broadcastAutoPost: jest.fn().mockResolvedValue({
    type: 'map',
    totalGuilds: 3,
    successCount: 3,
    failedCount: 0,
    details: [
      { guildId: 'g1', guildName: 'G1', channelName: 'thong-bao', success: true },
      { guildId: 'g2', guildName: 'G2', channelName: 'general', success: true },
      { guildId: 'g3', guildName: 'G3', channelName: 'announcements', success: true },
    ],
  }),
}));

describe('df-autopost.handler', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeAutoPostTable(db);
    jest.clearAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  it('isBotOwner xác thực đúng botOwnerId', () => {
    expect(isBotOwner(botConfig.botOwnerId)).toBe(true);
    expect(isBotOwner('random-user-id')).toBe(false);
  });

  it('từ chối khi người gọi không phải là Bot Owner', async () => {
    const mockReply = jest.fn().mockResolvedValue({});
    const mockInteraction: any = {
      user: { id: 'non-owner-id' },
      reply: mockReply,
    };

    await execute(mockInteraction, db);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('chỉ dành riêng cho Bot Owner'),
        flags: MessageFlags.Ephemeral,
      }),
    );
  });

  describe('Bot Owner subcommands', () => {
    it('subcommand "set" cập nhật interval, phát sóng ngay và bật autopost', async () => {
      const mockDeferReply = jest.fn().mockResolvedValue({});
      const mockEditReply = jest.fn().mockResolvedValue({});
      const mockInteraction: any = {
        user: { id: botConfig.botOwnerId },
        options: {
          getSubcommand: () => 'set',
          getString: (name: string) => (name === 'type' ? 'map' : null),
          getInteger: (name: string) => (name === 'interval_hours' ? 8 : null),
          getBoolean: (name: string) => (name === 'broadcast_now' ? true : null),
        },
        client: {
          guilds: { cache: new Map([['g1', {}]]) },
        },
        deferReply: mockDeferReply,
        editReply: mockEditReply,
      };

      await execute(mockInteraction, db);

      const config = getAutoPostConfig(db, 'map');
      expect(config.enabled).toBe(true);
      expect(config.intervalHours).toBe(8);
      expect(scheduler.rescheduleDfAutoPost).toHaveBeenCalledWith(
        mockInteraction.client,
        db,
        'map',
      );
      expect(scheduler.broadcastAutoPost).toHaveBeenCalledWith(
        mockInteraction.client,
        db,
        'map',
        { delayMs: 800 },
      );
      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('✅ Cập Nhật & Kích Hoạt Auto-Post Toàn Hệ Thống Thành Công'),
        }),
      );
    });

    it('subcommand "toggle" bật/tắt autopost', async () => {
      const mockReply = jest.fn().mockResolvedValue({});
      const mockInteraction: any = {
        user: { id: botConfig.botOwnerId },
        options: {
          getSubcommand: () => 'toggle',
          getString: (name: string) => (name === 'type' ? 'gun' : null),
          getBoolean: (name: string) => (name === 'enabled' ? true : false),
        },
        client: { guilds: { cache: new Map() } },
        reply: mockReply,
      };

      await execute(mockInteraction, db);

      const config = getAutoPostConfig(db, 'gun');
      expect(config.enabled).toBe(true);
      expect(scheduler.rescheduleDfAutoPost).toHaveBeenCalledWith(
        mockInteraction.client,
        db,
        'gun',
      );
      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('🟢 ĐÃ BẬT'),
        }),
      );
    });

    it('subcommand "status" trả về container tổng hợp', async () => {
      const mockReply = jest.fn().mockResolvedValue({});
      const mockInteraction: any = {
        user: { id: botConfig.botOwnerId },
        options: {
          getSubcommand: () => 'status',
        },
        client: { guilds: { cache: new Map([['g1', {}], ['g2', {}]]) } },
        reply: mockReply,
      };

      await execute(mockInteraction, db);

      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('🛡️ Bảng Điều Khiển Auto-Post Global'),
        }),
      );
    });

    it('subcommand "run" phát sóng ngay lập tức và chỉnh sửa reply với báo cáo', async () => {
      const mockDeferReply = jest.fn().mockResolvedValue({});
      const mockEditReply = jest.fn().mockResolvedValue({});
      const mockInteraction: any = {
        user: { id: botConfig.botOwnerId },
        options: {
          getSubcommand: () => 'run',
          getString: (name: string) => (name === 'type' ? 'map' : null),
        },
        client: { guilds: { cache: new Map([['g1', {}]]) } },
        deferReply: mockDeferReply,
        editReply: mockEditReply,
      };

      await execute(mockInteraction, db);

      expect(mockDeferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(scheduler.broadcastAutoPost).toHaveBeenCalledWith(
        mockInteraction.client,
        db,
        'map',
      );
      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Kết Quả Phát Sóng'),
        }),
      );
    });
  });
});
