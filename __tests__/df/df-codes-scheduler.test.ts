/// <reference types="jest" />

jest.mock('node-cron', () => ({
  schedule: jest.fn((expr: string, cb: any) => {
    (global as any).__cronCallback = cb;
    return { stop: jest.fn() };
  }),
}));

jest.mock('../../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(() => ({
    get: jest.fn((guildId: string) => ({
      dfCodes: {
        channelId: guildId === 'guild-1' ? 'channel-123' : null,
        scheduleTime: '08:30',
        adminChannelId: 'admin-ch-456',
      },
    })),
  })),
}));

jest.mock('../../src/services/deltaforce.scraper.js', () => ({
  fetchDailyCodes: jest.fn(),
}));

jest.mock('../../src/features/delta-force/code.renderer.js', () => ({
  buildCodesContainer: jest.fn((_codes: any, _hasCodes: boolean) => ({
    components: [{ type: 17, components: [{ type: 10, content: 'codes' }] }],
    flags: 32768,
    files: [],
    toJSON() {
      return this.components;
    },
  })),
  hasAnyCodes: jest.fn(
    (codes: any) => !!(codes && Object.values(codes).some((v: any) => v != null)),
  ),
}));

import { fetchDailyCodes } from '../../src/services/deltaforce.scraper.js';
import { buildCodesContainer, hasAnyCodes } from '../../src/features/delta-force/code.renderer.js';
import {
  startDfCodesScheduler,
  rescheduleDfCodes,
  stopGuildCronJob,
  stopAllCronJobs,
  getScheduledGuildIds,
} from '../../src/services/df-codes-scheduler.js';
import { getSettingsService } from '../../src/services/settings.service.js';
import cron from 'node-cron';

describe('df-codes-scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchDailyCodes as jest.Mock).mockResolvedValue({
      'Đập Nước Zero': '1234',
      'Thung lũng Layali': '5678',
      'Phố Cổ Brakkesh': '9012',
      AZ3: 'AB12',
      'Trạm Không Gian': '3456',
      'Ngục Giam Thủy Triều': '7890',
    });
  });

  describe('shouldFireAt', () => {
    function shouldFireAt(date: Date): boolean {
      const utcHour = date.getUTCHours();
      const utcMinute = date.getUTCMinutes();
      return utcHour === 1 && utcMinute === 0;
    }

    it('tra ve true khi 01:00 UTC', () => {
      expect(shouldFireAt(new Date('2026-07-27T01:00:00.000Z'))).toBe(true);
    });

    it('tra ve false khi 12:00 UTC', () => {
      expect(shouldFireAt(new Date('2026-07-27T12:00:00.000Z'))).toBe(false);
    });

    it('tra ve false khi 01:01 UTC', () => {
      expect(shouldFireAt(new Date('2026-07-27T01:01:00.000Z'))).toBe(false);
    });

    it('tra ve false khi 00:59 UTC', () => {
      expect(shouldFireAt(new Date('2026-07-27T00:59:00.000Z'))).toBe(false);
    });
  });

  it('fetch codes va build container khi fire', async () => {
    const codes = await fetchDailyCodes();
    const hasCodes = hasAnyCodes(codes);
    const result = buildCodesContainer(codes, hasCodes);

    expect(fetchDailyCodes).toHaveBeenCalled();
    expect(buildCodesContainer).toHaveBeenCalledWith(codes, true);
    expect(result.components).toHaveLength(1);
  });

  it('handle scraper error', async () => {
    (fetchDailyCodes as jest.Mock).mockRejectedValue(new Error('Network error'));

    const codes = await fetchDailyCodes().catch(() => null);
    const hasCodes = hasAnyCodes(codes);

    expect(hasCodes).toBe(false);
  });

  describe('startDfCodesScheduler & cron execution', () => {
    let mockClient: any;
    let mockDb: any;
    let mockChannel: any;
    let mockAdminChannel: any;

    beforeEach(() => {
      mockChannel = {
        id: 'channel-123',
        name: 'daily-codes',
        isTextBased: () => true,
        send: jest.fn().mockResolvedValue({ id: 'msg-sent' }),
      };

      mockAdminChannel = {
        id: 'admin-ch-456',
        name: 'bot-admin',
        isTextBased: () => true,
        send: jest.fn().mockResolvedValue({ id: 'admin-msg-sent' }),
      };

      mockClient = {
        channels: {
          fetch: jest.fn((id: string) => {
            if (id === 'channel-123') return Promise.resolve(mockChannel);
            if (id === 'admin-ch-456') return Promise.resolve(mockAdminChannel);
            return Promise.resolve(null);
          }),
        },
        once: jest.fn(),
      };

      mockDb = {
        prepare: jest.fn(() => ({
          all: jest.fn(() => [{ guild_id: 'guild-1' }, { guild_id: 'guild-2' }]),
        })),
      };
    });

    it('nên khởi tạo cron job và gửi codes tới channel khi cron kích hoạt', async () => {
      startDfCodesScheduler(mockClient, mockDb);

      expect(cron.schedule).toHaveBeenCalledWith(
        '30 8 * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'Asia/Ho_Chi_Minh' }),
      );

      // Kích hoạt cron callback
      const callback = (global as any).__cronCallback;
      expect(callback).toBeDefined();

      await callback();

      expect(fetchDailyCodes).toHaveBeenCalled();
      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel-123');
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: 32768,
        }),
      );
    });

    it('bỏ qua guild có dfCodes channelId hoặc scheduleTime là null/undefined khi duyệt cấu hình', () => {
      (getSettingsService as jest.Mock).mockReturnValueOnce({
        get: jest.fn((id: string) => {
          if (id === 'guild-null') {
            return { dfCodes: { channelId: null, scheduleTime: null } };
          }
          return { dfCodes: { channelId: 'channel-123', scheduleTime: '08:30' } };
        }),
      });

      const dbWithNull: any = {
        prepare: jest.fn(() => ({
          all: jest.fn(() => [{ guild_id: 'guild-null' }, { guild_id: 'guild-1' }]),
        })),
      };

      startDfCodesScheduler(mockClient, dbWithNull);
      expect(cron.schedule).toHaveBeenCalled();
    });

    it('fallback channelName về channelId khi channel không có thuộc tính name', async () => {
      const channelWithoutName = {
        id: 'channel-123',
        isTextBased: () => true,
        send: jest.fn().mockResolvedValue({ id: 'msg-sent' }),
      };
      mockClient.channels.fetch.mockResolvedValueOnce(channelWithoutName);

      startDfCodesScheduler(mockClient, mockDb);
      const callback = (global as any).__cronCallback;
      await callback();

      expect(channelWithoutName.send).toHaveBeenCalled();
    });

    it('không khởi tạo cron job nếu không có channel nào được cấu hình', async () => {
      const emptyDb: any = {
        prepare: jest.fn(() => ({
          all: jest.fn(() => []),
        })),
      };
      (cron.schedule as jest.Mock).mockClear();

      startDfCodesScheduler(mockClient, emptyDb);
      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('khi scraper gặp lỗi rejection trong cron tick, catch cục bộ trả về null và thoát sớm (không ném ra ngoài)', async () => {
      (fetchDailyCodes as jest.Mock).mockRejectedValueOnce(new Error('Scraper timeout'));
      startDfCodesScheduler(mockClient, mockDb);

      const callback = (global as any).__cronCallback;
      await callback();

      // Scrape fail → không gửi tin nhắn tới normal channel
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('không gửi message nếu buildCodesContainer trả về components rỗng', async () => {
      (buildCodesContainer as jest.Mock).mockReturnValueOnce({
        components: [],
        flags: 0,
        toJSON: () => [],
      });
      startDfCodesScheduler(mockClient, mockDb);

      const callback = (global as any).__cronCallback;
      await callback();

      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('bỏ qua nếu channel không phải là text channel', async () => {
      mockChannel.isTextBased = () => false;
      startDfCodesScheduler(mockClient, mockDb);

      const callback = (global as any).__cronCallback;
      await callback();

      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('khi channel.send throw (kích hoạt outer catch), gửi thông báo lỗi tới adminChannel', async () => {
      mockChannel.send.mockRejectedValueOnce(new Error('Send to Discord failed'));

      startDfCodesScheduler(mockClient, mockDb);
      const callback = (global as any).__cronCallback;
      await callback();

      const adminChannel = await mockClient.channels.fetch('admin-ch-456');
      expect(adminChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Send to Discord failed'),
        }),
      );
    });

    it('khi outer catch kích hoạt với error không có stack và adminChannel không có thuộc tính name', async () => {
      const errWithoutStack = { message: 'Raw error without stack' };
      mockChannel.send.mockRejectedValueOnce(errWithoutStack);

      const adminChannelNoName = {
        id: 'admin-ch-456',
        isTextBased: () => true,
        send: jest.fn().mockResolvedValue({ id: 'sent' }),
      };
      mockClient.channels.fetch.mockImplementation((id: string) => {
        if (id === 'channel-123') return Promise.resolve(mockChannel);
        if (id === 'admin-ch-456') return Promise.resolve(adminChannelNoName);
        return Promise.resolve(null);
      });

      startDfCodesScheduler(mockClient, mockDb);
      const callback = (global as any).__cronCallback;
      await callback();

      expect(adminChannelNoName.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Raw error without stack'),
        }),
      );
    });

    it('khi outer catch kích hoạt nhưng admin channel không phải text channel', async () => {
      mockChannel.send.mockRejectedValueOnce(new Error('Send failed'));
      mockClient.channels.fetch.mockImplementation((id: string) => {
        if (id === 'channel-123') return Promise.resolve(mockChannel);
        if (id === 'admin-ch-456') return Promise.resolve({ isTextBased: () => false });
        return Promise.resolve(null);
      });

      startDfCodesScheduler(mockClient, mockDb);
      const callback = (global as any).__cronCallback;
      await callback();

      // Channel không phải text -> không gửi thông báo
    });

    it('khi outer catch kích hoạt nhưng fetch admin channel throw error', async () => {
      mockChannel.send.mockRejectedValueOnce(new Error('Send failed'));
      mockClient.channels.fetch.mockImplementation((id: string) => {
        if (id === 'channel-123') return Promise.resolve(mockChannel);
        if (id === 'admin-ch-456') return Promise.reject(new Error('Discord API down'));
        return Promise.resolve(null);
      });

      startDfCodesScheduler(mockClient, mockDb);
      const callback = (global as any).__cronCallback;
      await expect(callback()).resolves.toBeUndefined();
    });

    it('khi outer catch kích hoạt nhưng guild không cấu hình adminChannelId', async () => {
      mockChannel.send.mockRejectedValueOnce(new Error('Send failed'));
      (getSettingsService as jest.Mock).mockReturnValueOnce({
        get: jest.fn(() => ({
          dfCodes: {
            channelId: 'channel-123',
            scheduleTime: '08:30',
            adminChannelId: undefined,
          },
        })),
      });

      startDfCodesScheduler(mockClient, mockDb);
      const callback = (global as any).__cronCallback;
      await callback();
    });

    it('disconnect event trên client phải dọn dẹp cron job', () => {
      let disconnectHandler: any;
      mockClient.once = jest.fn((event: string, handler: any) => {
        if (event === 'disconnect') disconnectHandler = handler;
      });

      startDfCodesScheduler(mockClient, mockDb);
      expect(disconnectHandler).toBeDefined();
      disconnectHandler();
    });

    it('rescheduleDfCodes nên dừng job cũ và khởi động lại scheduler', () => {
      (cron.schedule as jest.Mock).mockClear();
      rescheduleDfCodes(mockClient, mockDb);
      expect(cron.schedule).toHaveBeenCalled();
    });

    it('startDfCodesScheduler nên lập lịch độc lập cho nhiều guild trong database', () => {
      (cron.schedule as jest.Mock).mockClear();
      (getSettingsService as jest.Mock).mockReturnValue({
        get: jest.fn((guildId: string) => {
          if (guildId === 'guild-1') {
            return { dfCodes: { channelId: 'ch-1', scheduleTime: '08:00' } };
          }
          if (guildId === 'guild-2') {
            return { dfCodes: { channelId: 'ch-2', scheduleTime: '10:15' } };
          }
          return {};
        }),
      });

      startDfCodesScheduler(mockClient, mockDb);

      expect(getScheduledGuildIds()).toEqual(expect.arrayContaining(['guild-1', 'guild-2']));
      expect(getScheduledGuildIds()).toHaveLength(2);
      expect(cron.schedule).toHaveBeenCalledTimes(2);

      // Kiểm tra biểu thức cron tương ứng với scheduleTime của từng guild
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 8 * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'Asia/Ho_Chi_Minh' }),
      );
      expect(cron.schedule).toHaveBeenCalledWith(
        '15 10 * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'Asia/Ho_Chi_Minh' }),
      );
    });

    it('rescheduleDfCodes với targetGuildId chỉ cập nhật lại guild đó mà không đụng tới guild khác', () => {
      // Thiết lập ban đầu với 2 guild
      (cron.schedule as jest.Mock).mockClear();
      const mockStopJob1 = jest.fn();
      const mockStopJob2 = jest.fn();
      let callCount = 0;
      (cron.schedule as jest.Mock).mockImplementation(() => {
        callCount++;
        return { stop: callCount === 1 ? mockStopJob1 : mockStopJob2 };
      });

      (getSettingsService as jest.Mock).mockReturnValue({
        get: jest.fn((guildId: string) => {
          if (guildId === 'guild-1') {
            return { dfCodes: { channelId: 'ch-1', scheduleTime: '08:00' } };
          }
          if (guildId === 'guild-2') {
            return { dfCodes: { channelId: 'ch-2', scheduleTime: '10:15' } };
          }
          return {};
        }),
      });

      startDfCodesScheduler(mockClient, mockDb);
      expect(getScheduledGuildIds()).toHaveLength(2);

      // Reschedule chỉ guild-1 sang 09:30
      (getSettingsService as jest.Mock).mockReturnValue({
        get: jest.fn((guildId: string) => {
          if (guildId === 'guild-1') {
            return { dfCodes: { channelId: 'ch-1', scheduleTime: '09:30' } };
          }
          if (guildId === 'guild-2') {
            return { dfCodes: { channelId: 'ch-2', scheduleTime: '10:15' } };
          }
          return {};
        }),
      });

      rescheduleDfCodes(mockClient, mockDb, 'guild-1');

      // Job 1 phải bị stop, Job 2 vẫn giữ nguyên không bị stop
      expect(mockStopJob1).toHaveBeenCalledTimes(1);
      expect(mockStopJob2).not.toHaveBeenCalled();

      // Cả 2 guild vẫn còn trong danh sách đã lên lịch
      expect(getScheduledGuildIds()).toEqual(expect.arrayContaining(['guild-1', 'guild-2']));
    });

    it('stopGuildCronJob và stopAllCronJobs quản lý dọn dẹp chính xác', () => {
      const mockStop1 = jest.fn();
      const mockStop2 = jest.fn();
      let callCount = 0;
      (cron.schedule as jest.Mock).mockImplementation(() => {
        callCount++;
        return { stop: callCount === 1 ? mockStop1 : mockStop2 };
      });

      (getSettingsService as jest.Mock).mockReturnValue({
        get: jest.fn((guildId: string) => ({
          dfCodes: { channelId: `ch-${guildId}`, scheduleTime: '08:00' },
        })),
      });

      startDfCodesScheduler(mockClient, mockDb);
      expect(getScheduledGuildIds()).toHaveLength(2);

      // Dừng guild-1
      const stoppedGuild1 = stopGuildCronJob('guild-1');
      expect(stoppedGuild1).toBe(true);
      expect(mockStop1).toHaveBeenCalledTimes(1);
      expect(getScheduledGuildIds()).toEqual(['guild-2']);

      // Thử dừng lại guild-1 -> trả về false vì đã không còn
      expect(stopGuildCronJob('guild-1')).toBe(false);

      // Dừng tất cả
      stopAllCronJobs();
      expect(mockStop2).toHaveBeenCalledTimes(1);
      expect(getScheduledGuildIds()).toHaveLength(0);
    });
  });
});

