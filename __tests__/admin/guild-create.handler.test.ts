/// <reference types="jest" />
import { Client, Guild, MessageFlags, PermissionFlagsBits, TextChannel } from 'discord.js';
import {
  buildGuildWelcomeContainer,
  findInitialAnnouncementChannel,
  handleGuildCreate,
} from '../../src/features/admin/guild-create.handler.js';

describe('features/admin/guild-create.handler', () => {
  describe('buildGuildWelcomeContainer', () => {
    it('phải tạo Container V2 chứa tên guild và danh sách lệnh setup cơ bản', () => {
      const result = buildGuildWelcomeContainer('Test Server');
      expect(result.flags).toBe(MessageFlags.IsComponentsV2);
      const jsonStr = JSON.stringify(result.toJSON());

      expect(jsonStr).toContain('Test Server');
      expect(jsonStr).toContain('/config roles set');
      expect(jsonStr).toContain('/config bot setannouncechannel');
      expect(jsonStr).toContain('/config welcome');
      expect(jsonStr).toContain('/df help');
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
          has: jest.fn().mockImplementation((perms) => {
            if (Array.isArray(perms)) {
              return canSend;
            }
            return canSend;
          }),
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

  describe('handleGuildCreate', () => {
    it('gửi thông báo chào mừng tới kênh tìm được', async () => {
      const sendMock = jest.fn().mockResolvedValue({});
      const targetChan = {
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
          cache: new Map([['1', targetChan]]),
        },
        members: {
          me: { id: 'bot-123' },
        },
      } as unknown as Guild;

      const mockClient = {} as Client;

      await handleGuildCreate(mockClient, mockGuild);

      expect(sendMock).toHaveBeenCalledTimes(1);
      const callArg = sendMock.mock.calls[0][0];
      expect(callArg.flags).toBe(MessageFlags.IsComponentsV2);
      expect(callArg.components).toBeDefined();
    });

    it('không crash khi không tìm thấy kênh nào có quyền', async () => {
      const mockGuild = {
        id: 'guild-empty',
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

      await expect(handleGuildCreate({} as Client, mockGuild)).resolves.not.toThrow();
    });

    it('bắt lỗi êm dịu khi targetChannel.send bị lỗi', async () => {
      const targetChan = {
        name: 'chung',
        isTextBased: () => true,
        isDMBased: () => false,
        isVoiceBased: () => false,
        permissionsFor: jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(true),
        }),
        send: jest.fn().mockRejectedValue(new Error('Discord API Error')),
      } as unknown as TextChannel;

      const mockGuild = {
        id: 'guild-error',
        name: 'Error Guild',
        memberCount: 10,
        systemChannel: targetChan,
        channels: {
          cache: new Map([['1', targetChan]]),
        },
        members: {
          me: { id: 'bot-123' },
        },
      } as unknown as Guild;

      await expect(handleGuildCreate({} as Client, mockGuild)).resolves.not.toThrow();
    });
  });
});

