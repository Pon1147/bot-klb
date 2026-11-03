/// <reference types="jest" />
import Database from 'better-sqlite3';
import {
  intervalToCron,
  broadcastAutoPost,
  scheduleAutoPostTask,
  stopAutoPostTask,
  stopAllAutoPostTasks,
  getActiveAutoPostTypes,
  startDfAutoPostScheduler,
  rescheduleDfAutoPost,
  isAutoPostBroadcasting,
  AutoPostBroadcastInProgressError,
} from '../../src/services/df-autopost-scheduler.js';
import {
  initializeAutoPostTable,
  updateAutoPostConfig,
  getAutoPostConfig,
  saveAutoPostLastMessage,
  getAutoPostLastMessage,
} from '../../src/database/df-autopost.db.js';

// Mock df-channel-matcher
jest.mock('../../src/services/df-channel-matcher.js', () => ({
  findAutoPostTargetChannel: jest.fn(),
}));

import { findAutoPostTargetChannel } from '../../src/services/df-channel-matcher.js';

// Mock settings.service
jest.mock('../../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(() => ({
    get: jest.fn((guildId: string) => ({
      botAnnounce: { channelId: guildId === 'guild-1' ? 'chan-1' : null },
    })),
  })),
}));

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn((expr: string, cb: any) => {
    (global as any).__autopostCronCallback = cb;
    return { stop: jest.fn() };
  }),
}));

describe('df-autopost-scheduler', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeAutoPostTable(db);
    stopAllAutoPostTasks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    stopAllAutoPostTasks();
    db.close();
  });

  describe('intervalToCron', () => {
    it('chuyển 24h thành 08:00 sáng hàng ngày', () => {
      expect(intervalToCron(24)).toBe('0 8 * * *');
    });

    it('chuyển các số giờ khác thành cron interval', () => {
      expect(intervalToCron(6)).toBe('0 */6 * * *');
      expect(intervalToCron(12)).toBe('0 */12 * * *');
      expect(intervalToCron(1)).toBe('0 */1 * * *');
    });

    it('giới hạn an toàn trong khoảng 1-24', () => {
      expect(intervalToCron(0)).toBe('0 */1 * * *');
      expect(intervalToCron(30)).toBe('0 8 * * *');
    });
  });

  describe('broadcastAutoPost', () => {
    it('phát sóng thành công tới các server và cập nhật lastRunAt', async () => {
      const mockChannelSend = jest.fn().mockResolvedValue({});
      const mockGuild1 = { id: 'guild-1', name: 'Server 1' };
      const mockGuild2 = { id: 'guild-2', name: 'Server 2' };

      (findAutoPostTargetChannel as jest.Mock).mockReturnValue({
        channel: { name: 'thong-bao', send: mockChannelSend },
        matchTier: 'content',
        matchReason: 'Khớp chuyên mục Bản Đồ 3D',
      });

      const mockClient: any = {
        guilds: {
          cache: new Map([
            ['guild-1', mockGuild1],
            ['guild-2', mockGuild2],
          ]),
        },
      };

      const result = await broadcastAutoPost(mockClient, db, 'map', { delayMs: 0 });

      expect(result.type).toBe('map');
      expect(result.totalGuilds).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockChannelSend).toHaveBeenCalledTimes(2);

      const config = getAutoPostConfig(db, 'map');
      expect(config.lastRunAt).toBeTruthy();
    });

    it('ghi nhận thất bại khi không tìm thấy channel thích hợp', async () => {
      (findAutoPostTargetChannel as jest.Mock).mockReturnValue({
        channel: null,
        matchTier: 'none',
        reason: 'Không có quyền',
      });

      const mockClient: any = {
        guilds: {
          cache: new Map([['guild-1', { id: 'guild-1', name: 'Server 1' }]]),
        },
      };

      const result = await broadcastAutoPost(mockClient, db, 'gun', { delayMs: 0 });

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.details[0].reason).toContain('Không có quyền');
    });

    it('tự động xóa tin nhắn cũ trước khi gửi tin nhắn mới và cập nhật ID mới', async () => {
      // Lưu tin nhắn cũ vào DB
      saveAutoPostLastMessage(db, 'guild-1', 'map', 'chan-1', 'msg-old-123');

      const mockDeleteOld = jest.fn().mockResolvedValue({});
      const mockOldMessage = { id: 'msg-old-123', delete: mockDeleteOld };
      const mockChannelMessagesFetch = jest.fn().mockResolvedValue(mockOldMessage);

      const mockNewMessage = { id: 'msg-new-456' };
      const mockChannelSend = jest.fn().mockResolvedValue(mockNewMessage);

      const mockChannel = {
        id: 'chan-1',
        name: 'thong-bao',
        send: mockChannelSend,
        messages: { fetch: mockChannelMessagesFetch },
      };

      (findAutoPostTargetChannel as jest.Mock).mockReturnValue({
        channel: mockChannel,
        matchTier: 'content',
        matchReason: 'Khớp chuyên mục',
      });

      const mockGuild = {
        id: 'guild-1',
        name: 'Server 1',
        channels: { cache: new Map([['chan-1', mockChannel]]) },
      };

      const mockClient: any = {
        guilds: { cache: new Map([['guild-1', mockGuild]]) },
        channels: { fetch: jest.fn().mockResolvedValue(mockChannel) },
      };

      const result = await broadcastAutoPost(mockClient, db, 'map', { delayMs: 0 });

      expect(result.successCount).toBe(1);
      // Tin nhắn cũ phải được tìm và xóa
      expect(mockChannelMessagesFetch).toHaveBeenCalledWith('msg-old-123');
      expect(mockDeleteOld).toHaveBeenCalled();

      // Tin nhắn mới được gửi đi
      expect(mockChannelSend).toHaveBeenCalled();

      // DB phải được cập nhật sang ID mới
      const lastMsg = getAutoPostLastMessage(db, 'guild-1', 'map');
      expect(lastMsg?.messageId).toBe('msg-new-456');
    });
  });


  describe('scheduleAutoPostTask & lifecycle', () => {
    it('không lên lịch nếu config enabled = false', () => {
      const mockClient: any = { guilds: { cache: new Map() } };
      scheduleAutoPostTask(mockClient, db, 'map');
      expect(getActiveAutoPostTypes()).not.toContain('map');
    });

    it('lên lịch thành công khi enabled = true', () => {
      updateAutoPostConfig(db, 'map', { enabled: true, intervalHours: 6 });

      const mockClient: any = { guilds: { cache: new Map() } };
      scheduleAutoPostTask(mockClient, db, 'map');
      expect(getActiveAutoPostTypes()).toContain('map');

      stopAutoPostTask('map');
      expect(getActiveAutoPostTypes()).not.toContain('map');
    });

    it('startDfAutoPostScheduler và rescheduleDfAutoPost hoạt động đúng', () => {
      updateAutoPostConfig(db, 'gun', { enabled: true, intervalHours: 8 });

      const mockClient: any = {
        guilds: { cache: new Map() },
        once: jest.fn(),
      };

      startDfAutoPostScheduler(mockClient, db);
      expect(getActiveAutoPostTypes()).toContain('gun');

      rescheduleDfAutoPost(mockClient, db, 'gun');
      expect(getActiveAutoPostTypes()).toContain('gun');

      stopAllAutoPostTasks();
      expect(getActiveAutoPostTypes()).toHaveLength(0);
    });
  });

  describe('Concurrency & Mutual Exclusion (BUG-08)', () => {
    it('chặn các đợt phát sóng cùng loại chạy đồng thời (throws AutoPostBroadcastInProgressError)', async () => {
      let resolveFirst: (() => void) | undefined;
      const firstSendPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      const slowSend = jest.fn().mockImplementation(async () => {
        await firstSendPromise;
        return { id: 'msg-slow' };
      });

      const mockChannel = {
        id: 'chan-slow',
        name: 'game-chat',
        send: slowSend,
        messages: { fetch: jest.fn().mockResolvedValue(null) },
      };

      (findAutoPostTargetChannel as jest.Mock).mockReturnValue({
        channel: mockChannel,
        matchTier: 'content',
      });

      const mockClient: any = {
        guilds: {
          cache: new Map([['guild-1', { id: 'guild-1', name: 'Server 1', channels: { cache: new Map() } }]]),
        },
        channels: { fetch: jest.fn().mockResolvedValue(mockChannel) },
      };

      // Bắt đầu đợt broadcast 1 nhưng chưa giải quyết send
      const firstBroadcast = broadcastAutoPost(mockClient, db, 'map', { delayMs: 0 });

      // Lúc này broadcast đang in-flight
      expect(isAutoPostBroadcasting('map')).toBe(true);

      // Gọi broadcast lần 2 cùng loại 'map' -> phải ném AutoPostBroadcastInProgressError ngay lập tức
      await expect(broadcastAutoPost(mockClient, db, 'map', { delayMs: 0 })).rejects.toThrow(
        AutoPostBroadcastInProgressError,
      );

      // Cho phép đợt 1 hoàn tất
      resolveFirst!();
      const firstResult = await firstBroadcast;

      expect(firstResult.successCount).toBe(1);
      // Khi đợt 1 xong, lock phải được giải phóng
      expect(isAutoPostBroadcasting('map')).toBe(false);

      // Gọi lần tiếp theo sau khi lock giải phóng phải thành công bình thường
      slowSend.mockResolvedValueOnce({ id: 'msg-subsequent' });
      const subsequentResult = await broadcastAutoPost(mockClient, db, 'map', { delayMs: 0 });
      expect(subsequentResult.successCount).toBe(1);
    });

    it('giải phóng lock ngay cả khi broadcast phát sinh lỗi ngoại lệ không lường trước', async () => {
      const mockClient: any = {
        get guilds(): any {
          throw new Error('Fatal Guilds Cache Crash');
        },
      };

      await expect(broadcastAutoPost(mockClient, db, 'map')).rejects.toThrow('Fatal Guilds Cache Crash');
      // Lock phải được dọn dẹp sạch sẽ trong finally
      expect(isAutoPostBroadcasting('map')).toBe(false);
    });

    it('cho phép phát sóng map và gun độc lập đồng thời không bị block lẫn nhau', async () => {
      let resolveMap: (() => void) | undefined;
      const mapPromise = new Promise<void>((resolve) => {
        resolveMap = resolve;
      });

      const mapSend = jest.fn().mockImplementation(async () => {
        await mapPromise;
        return { id: 'msg-map' };
      });

      const gunSend = jest.fn().mockResolvedValue({ id: 'msg-gun' });

      (findAutoPostTargetChannel as jest.Mock).mockImplementation((_g, type) => ({
        channel: {
          id: `chan-${type}`,
          name: `channel-${type}`,
          send: type === 'map' ? mapSend : gunSend,
          messages: { fetch: jest.fn().mockResolvedValue(null) },
        },
        matchTier: 'content',
      }));

      const mockClient: any = {
        guilds: {
          cache: new Map([['guild-1', { id: 'guild-1', name: 'Server 1', channels: { cache: new Map() } }]]),
        },
        channels: { fetch: jest.fn().mockResolvedValue(null) },
      };

      // Chạy map (bị delay bởi mapPromise)
      const mapBroadcast = broadcastAutoPost(mockClient, db, 'map', { delayMs: 0 });
      expect(isAutoPostBroadcasting('map')).toBe(true);
      expect(isAutoPostBroadcasting('gun')).toBe(false);

      // Chạy gun song song: gun không bị block bởi map
      const gunResult = await broadcastAutoPost(mockClient, db, 'gun', { delayMs: 0 });
      expect(gunResult.successCount).toBe(1);
      expect(isAutoPostBroadcasting('gun')).toBe(false);
      expect(isAutoPostBroadcasting('map')).toBe(true);

      // Giải phóng map
      resolveMap!();
      const mapResult = await mapBroadcast;
      expect(mapResult.successCount).toBe(1);
      expect(isAutoPostBroadcasting('map')).toBe(false);
    });
  });

});
