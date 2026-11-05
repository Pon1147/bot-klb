/// <reference types="jest" />
/**
 * Unit tests cho help.handler.ts (/df help) và extension.utils.ts.
 * Kiểm tra 5 trang trợ giúp, Select Menu 5 options, Action Row 5 buttons,
 * User Isolation Guard, và cơ chế tải extension ZIP.
 */

import {
  buildHelpPageContainer,
  buildHelpSelectRow,
  buildHelpButtonsRow,
  execute,
  handleHelpButton,
  handleHelpSelect,
  TOTAL_HELP_PAGES,
  HELP_OPTIONS,
} from '../../src/features/delta-force/help.handler.js';
import { getExtensionZipPath } from '../../src/features/delta-force/extension.utils.js';
import * as dfGuards from '../../src/utils/df-guards.js';
import { ComponentType, MessageFlags } from 'discord.js';

describe('DF Help Handler & Extension Utils', () => {
  describe('getExtensionZipPath', () => {
    it('định vị thành công file DF-Extension.zip đã đóng gói', () => {
      const zipPath = getExtensionZipPath();
      expect(zipPath).toBeTruthy();
      expect(typeof zipPath).toBe('string');
      expect(zipPath).toContain('DF-Extension.zip');
    });
  });

  describe('buildHelpPageContainer', () => {
    it('Trang 1: Chứa Tổng quan, 3 bước bắt đầu và < 4000 ký tự', () => {
      const container = buildHelpPageContainer(1);
      const json = container.toJSON();
      expect(json).toHaveLength(1);
      const root = json[0] as any;
      expect(root.type).toBe(ComponentType.Container);

      const text = root.components.find((c: any) => c.type === ComponentType.TextDisplay);
      expect(text).toBeDefined();
      expect(text.content).toContain('Trung Tâm Trợ Giúp — Bot Delta');
      expect(text.content).toContain('Pon1147');
      expect(text.content).toContain('/df link start');
      expect(text.content).toContain('/df stats');
      expect(text.content).toContain('/df code show');
      expect(text.content.length).toBeLessThan(4000);
    });

    it('Trang 2: Chứa Hồ sơ chiến đấu & Stats', () => {
      const container = buildHelpPageContainer(2);
      const root = container.toJSON()[0] as any;
      const text = root.components.find((c: any) => c.type === ComponentType.TextDisplay);
      expect(text.content).toContain('Hồ Sơ Chiến Đấu');
      expect(text.content).toContain('/df stats');
      expect(text.content).toContain('/df daily');
      expect(text.content).toContain('/df history');
      expect(text.content).toContain('/df match');
      expect(text.content).toContain('/df vault');
    });

    it('Trang 3: Chứa Tác chiến, Bản đồ & Vũ khí Meta', () => {
      const container = buildHelpPageContainer(3);
      const root = container.toJSON()[0] as any;
      const text = root.components.find((c: any) => c.type === ComponentType.TextDisplay);
      expect(text.content).toContain('Tác Chiến, Bản Đồ & Vũ Khí Meta');
      expect(text.content).toContain('/df map');
      expect(text.content).toContain('/df build');
      expect(text.content).toContain('/df code show');
      expect(text.content).toContain('/df market');
      expect(text.content).toContain('/df workshop');
      expect(text.content).toContain('/team find');
    });

    it('Trang 4: Chứa Tiện ích & Liên kết tài khoản HQ', () => {
      const container = buildHelpPageContainer(4);
      const root = container.toJSON()[0] as any;
      const text = root.components.find((c: any) => c.type === ComponentType.TextDisplay);
      expect(text.content).toContain('Tiện Ích DF Toolbox & Liên Kết Tài Khoản');
      expect(text.content).toContain('277+ Giftcode Garena');
      expect(text.content).toContain('Developer mode');
      expect(text.content).toContain('Load unpacked');
      expect(text.content).toContain('/df link status');
      expect(text.content).toContain('/df unlink');
    });

    it('Trang 5: Chứa Quản trị máy chủ & Cấu hình tự động', () => {
      const container = buildHelpPageContainer(5);
      const root = container.toJSON()[0] as any;
      const text = root.components.find((c: any) => c.type === ComponentType.TextDisplay);
      expect(text.content).toContain('Quản Trị Máy Chủ & Điều Hành Bot');
      expect(text.content).toContain('/config roles set');
      expect(text.content).toContain('/df code setchannel');
      expect(text.content).toContain('/df autopost');
      expect(text.content).toContain('/config welcome');
      expect(text.content).toContain('/config bot setannouncechannel');
    });

    it('Clamp an toàn: page < 1 ra trang 1, page > 5 ra trang 5', () => {
      const cUnder = buildHelpPageContainer(0);
      const cOver = buildHelpPageContainer(99);
      expect((cUnder.toJSON()[0] as any).components[0].content).toContain('Trung Tâm Trợ Giúp');
      expect((cOver.toJSON()[0] as any).components[0].content).toContain('Quản Trị Máy Chủ');
    });
  });

  describe('buildHelpSelectRow', () => {
    it('tạo Select Menu với đủ 5 options và customId gắn callerUserId', () => {
      const row = buildHelpSelectRow(2, 'user-123');
      const json = row.toJSON() as any;

      expect(json.components).toHaveLength(1);
      const select = json.components[0];
      expect(select.custom_id).toBe('df_help:select:user-123');
      expect(select.options).toHaveLength(TOTAL_HELP_PAGES);

      expect(HELP_OPTIONS.map((o) => o.value)).toEqual([
        'overview',
        'stats',
        'tactics',
        'link',
        'admin',
      ]);

      // Option trang 2 phải có default === true
      const optionPage2 = select.options.find((o: any) => o.value === 'stats');
      expect(optionPage2.default).toBe(true);

      const optionPage1 = select.options.find((o: any) => o.value === 'overview');
      expect(optionPage1.default).toBe(false);
    });
  });

  describe('buildHelpButtonsRow', () => {
    it('Trang 1: Nút Trước bị disable, Nút Sau enabled, Nút Indicator hiển thị Trang 1/5', () => {
      const row = buildHelpButtonsRow(1, 'user-123');
      const json = row.toJSON() as any;

      expect(json.components).toHaveLength(5);
      const [prevBtn, indicatorBtn, nextBtn, dlBtn, supportBtn] = json.components;

      expect(prevBtn.disabled).toBe(true);
      expect(prevBtn.custom_id).toBe('df_help:page:0:user-123');

      expect(indicatorBtn.disabled).toBe(true);
      expect(indicatorBtn.label).toBe('Trang 1/5');

      expect(nextBtn.disabled).toBe(false);
      expect(nextBtn.custom_id).toBe('df_help:page:2:user-123');

      expect(dlBtn.custom_id).toBe('df_help:dl:user-123');
      expect(supportBtn.url).toContain('discord.gg');
    });

    it('Trang 5: Nút Trước enabled, Nút Sau bị disable', () => {
      const row = buildHelpButtonsRow(5, 'user-123');
      const json = row.toJSON() as any;

      const [prevBtn, , nextBtn] = json.components;
      expect(prevBtn.disabled).toBe(false);
      expect(prevBtn.custom_id).toBe('df_help:page:4:user-123');
      expect(nextBtn.disabled).toBe(true);
    });
  });

  describe('execute (/df help)', () => {
    it('bị chặn và trả về sớm nếu ngoài guild', async () => {
      const requireGuildSpy = jest
        .spyOn(dfGuards, 'requireGuild')
        .mockResolvedValueOnce(true as never);

      const interaction: any = {
        guildId: null,
        user: { id: 'user-123' },
        reply: jest.fn(),
      };

      await execute(interaction);

      expect(requireGuildSpy).toHaveBeenCalledWith(interaction);
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('trả lời Ephemeral kèm Components V2 trong guild', async () => {
      jest.spyOn(dfGuards, 'requireGuild').mockResolvedValueOnce(false as never);

      const interaction: any = {
        guildId: 'guild-123',
        user: { id: 'user-123' },
        reply: jest.fn().mockResolvedValue({}),
      };

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const replyCall = interaction.reply.mock.calls[0][0];

      expect(replyCall.flags).toBe(MessageFlags.Ephemeral | MessageFlags.IsComponentsV2);
      expect(replyCall.components).toBeDefined();
      expect(replyCall.components).toHaveLength(3); // Container + Select Row + Buttons Row
    });
  });

  describe('handleHelpSelect', () => {
    it('bỏ qua nếu customId không bắt đầu bằng df_help:select:', async () => {
      const interaction: any = {
        customId: 'other_select',
        reply: jest.fn(),
        update: jest.fn(),
      };
      const res = await handleHelpSelect(interaction);
      expect(res.handled).toBe(false);
    });

    it('User Isolation Guard: chặn user khác tương tác', async () => {
      const interaction: any = {
        customId: 'df_help:select:user-owner',
        user: { id: 'user-intruder' },
        reply: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      };

      const res = await handleHelpSelect(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('không thể điều khiển'),
        flags: MessageFlags.Ephemeral,
      });
      expect(interaction.update).not.toHaveBeenCalled();
    });

    it('chuyển sang đúng trang theo option đã chọn cho chủ sở hữu', async () => {
      const interaction: any = {
        customId: 'df_help:select:user-owner',
        user: { id: 'user-owner' },
        values: ['tactics'], // trang 3
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleHelpSelect(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalledTimes(1);

      const updateCall = interaction.update.mock.calls[0][0];
      expect(updateCall.components).toBeDefined();
    });
  });

  describe('handleHelpButton', () => {
    it('bỏ qua nếu customId không liên quan', async () => {
      const interaction: any = {
        customId: 'other_button',
        update: jest.fn(),
      };
      const res = await handleHelpButton(interaction);
      expect(res.handled).toBe(false);
    });

    it('User Isolation Guard khi chuyển trang: từ chối người dùng lạ', async () => {
      const interaction: any = {
        customId: 'df_help:page:2:user-owner',
        user: { id: 'user-stranger' },
        reply: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      };

      const res = await handleHelpButton(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('không thể điều khiển'),
        flags: MessageFlags.Ephemeral,
      });
      expect(interaction.update).not.toHaveBeenCalled();
    });

    it('chuyển trang thành công cho chính chủ', async () => {
      const interaction: any = {
        customId: 'df_help:page:3:user-owner',
        user: { id: 'user-owner' },
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleHelpButton(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalledTimes(1);
    });

    it('Nút indicator: handled mà không làm gì', async () => {
      const interaction: any = {
        customId: 'df_help:indicator',
      };
      const res = await handleHelpButton(interaction);
      expect(res.handled).toBe(true);
    });

    it('Nút tải tiện ích: gửi file đính kèm ZIP qua interaction.reply', async () => {
      const interaction: any = {
        customId: 'df_help:dl:user-owner',
        user: { id: 'user-owner' },
        reply: jest.fn().mockResolvedValue({}),
      };

      const res = await handleHelpButton(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledTimes(1);

      const callArg = interaction.reply.mock.calls[0][0];
      expect(callArg.flags).toBe(MessageFlags.Ephemeral);
      expect(callArg.files).toHaveLength(1);
      expect(callArg.files[0].name).toBe('DF-Extension.zip');
    });

    it('Nút tải tiện ích: User Isolation từ chối người dùng lạ', async () => {
      const interaction: any = {
        customId: 'df_help:dl:user-owner',
        user: { id: 'user-stranger' },
        reply: jest.fn().mockResolvedValue({}),
      };

      const res = await handleHelpButton(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('không thể thao tác'),
        flags: MessageFlags.Ephemeral,
      });
    });
  });
});
