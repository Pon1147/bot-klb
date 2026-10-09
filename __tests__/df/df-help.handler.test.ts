/// <reference types="jest" />
/**
 * Unit tests cho help.handler.ts (/df help) và extension.utils.ts.
 * Kiểm tra cấu trúc Container V2, hành vi chuyển tab, đính kèm file zip và guard guild.
 */

import {
  buildHelpContainer,
  buildHelpActionRow,
  execute,
  handleHelpButton,
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

  describe('buildHelpContainer', () => {
    it('xây dựng container V2 cho tab commands với đầy đủ các nhóm lệnh', () => {
      const container = buildHelpContainer('commands');
      const json = container.toJSON();

      expect(json).toHaveLength(1);
      const root = json[0] as any;
      expect(root.type).toBe(ComponentType.Container);
      expect(root.components).toBeDefined();

      const textDisplay = root.components.find((c: any) => c.type === ComponentType.TextDisplay);
      expect(textDisplay).toBeDefined();
      expect(textDisplay.content).toContain('Trung Tâm Lệnh');
      expect(textDisplay.content).toContain('/df stats');
      expect(textDisplay.content).toContain('/df link start');
      expect(textDisplay.content).toContain('/team find');
      expect(textDisplay.content).toContain('/config bot guilds');
    });

    it('xây dựng container V2 cho tab guide với hướng dẫn 5 bước cài tiện ích', () => {
      const container = buildHelpContainer('guide');
      const json = container.toJSON();

      expect(json).toHaveLength(1);
      const root = json[0] as any;
      expect(root.type).toBe(ComponentType.Container);

      const textDisplay = root.components.find((c: any) => c.type === ComponentType.TextDisplay);
      expect(textDisplay).toBeDefined();
      expect(textDisplay.content).toContain('Hướng Dẫn Cài Đặt Tiện Ích');
      expect(textDisplay.content).toContain('Developer mode');
      expect(textDisplay.content).toContain('Load unpacked');
      expect(textDisplay.content).toContain('Delta Force HQ');
    });
  });

  describe('buildHelpActionRow', () => {
    it('active button Primary cho tab commands', () => {
      const row = buildHelpActionRow('commands');
      const json = row.toJSON() as any;

      expect(json.components).toHaveLength(2);
      expect(json.components[0].custom_id).toBe('df_help_tab_commands');
      expect(json.components[0].style).toBe(1); // Primary
      expect(json.components[1].custom_id).toBe('df_help_tab_guide');
      expect(json.components[1].style).toBe(2); // Secondary
    });

    it('active button Primary cho tab guide', () => {
      const row = buildHelpActionRow('guide');
      const json = row.toJSON() as any;

      expect(json.components).toHaveLength(2);
      expect(json.components[0].style).toBe(2); // Secondary
      expect(json.components[1].style).toBe(1); // Primary
    });
  });

  describe('execute (/df help)', () => {
    it('bị chặn và trả về sớm nếu ngoài guild', async () => {
      const requireGuildSpy = jest
        .spyOn(dfGuards, 'requireGuild')
        .mockResolvedValueOnce(true as never);

      const interaction: any = {
        guildId: null,
        reply: jest.fn(),
      };

      await execute(interaction);

      expect(requireGuildSpy).toHaveBeenCalledWith(interaction);
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('trả lời ephemeral kèm Components V2 và followUp file zip khi trong guild', async () => {
      jest.spyOn(dfGuards, 'requireGuild').mockResolvedValueOnce(false as never);

      const interaction: any = {
        guildId: 'guild-123',
        reply: jest.fn().mockResolvedValue({}),
        followUp: jest.fn().mockResolvedValue({}),
      };

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const replyCall = interaction.reply.mock.calls[0][0];

      expect(replyCall.flags).toBe(MessageFlags.Ephemeral | MessageFlags.IsComponentsV2);
      expect(replyCall.components).toBeDefined();

      expect(interaction.followUp).toHaveBeenCalledTimes(1);
      const followUpCall = interaction.followUp.mock.calls[0][0];
      expect(followUpCall.flags).toBe(MessageFlags.Ephemeral);
      expect(followUpCall.files).toHaveLength(1);
      expect(followUpCall.files[0].name).toBe('DF-Extension.zip');
    });
  });

  describe('handleHelpButton', () => {
    it('bỏ qua nếu customId không liên quan', async () => {
      const interaction: any = {
        customId: 'other_custom_id',
        update: jest.fn(),
      };

      const result = await handleHelpButton(interaction);
      expect(result.handled).toBe(false);
      expect(interaction.update).not.toHaveBeenCalled();
    });

    it('xử lý chuyển sang tab commands khi click button df_help_tab_commands', async () => {
      const interaction: any = {
        customId: 'df_help_tab_commands',
        update: jest.fn().mockResolvedValue({}),
      };

      const result = await handleHelpButton(interaction);
      expect(result.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalledTimes(1);

      const updateCall = interaction.update.mock.calls[0][0];
      expect(updateCall.components).toBeDefined();
    });

    it('xử lý chuyển sang tab guide khi click button df_help_tab_guide', async () => {
      const interaction: any = {
        customId: 'df_help_tab_guide',
        update: jest.fn().mockResolvedValue({}),
      };

      const result = await handleHelpButton(interaction);
      expect(result.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalledTimes(1);
    });
  });
});

