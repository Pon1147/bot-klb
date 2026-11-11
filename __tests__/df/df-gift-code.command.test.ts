/**
 * Unit tests cho /df gift-code subcommand
 */

import Database from 'better-sqlite3';
import { execute as executeGiftCode } from '../../src/features/delta-force/gift-code.handler.js';
import { dispatchProfileSubcommand } from '../../src/features/delta-force/subcommands/df-profiles.subcommand.js';
import { STARTER_GIFT_CODES } from '../../src/features/delta-force/giftcodes.data.js';

jest.mock('../../src/utils/df-guards.js', () => ({
  requireGuild: jest.fn(async (interaction: any) => {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng được trong server.', ephemeral: true });
      return true;
    }
    return false;
  }),
}));

describe('/df gift-code command', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    jest.clearAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  test('STARTER_GIFT_CODES chứa đúng 280 mã', () => {
    expect(STARTER_GIFT_CODES.length).toBe(280);
    expect(STARTER_GIFT_CODES).toContain('DFAMMO4284');
    expect(STARTER_GIFT_CODES).toContain('WELCOMEDFMY');
  });

  test('chặn thực thi khi không ở trong guild (requireGuild)', async () => {
    const interaction: any = {
      guild: null,
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await executeGiftCode(interaction, db);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('chỉ dùng được trong server') }),
    );
  });

  test('gửi tin nhắn ephemeral kèm file đính kèm 280 codes và 3 buttons trực quan (tiếng Việt)', async () => {
    const interaction: any = {
      guild: { id: 'test-guild-123' },
      user: { id: 'test-user-456' },
      locale: 'vi',
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await executeGiftCode(interaction, db);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const replyCall = interaction.reply.mock.calls[0][0];

    // Kiểm tra cờ Ephemeral
    expect(replyCall.flags).toBeDefined();

    // Kiểm tra có file đính kèm DF-Giftcodes-${count}.txt
    expect(replyCall.files).toBeDefined();
    expect(replyCall.files.length).toBeGreaterThanOrEqual(1);
    const expectedFileName = `DF-Giftcodes-${STARTER_GIFT_CODES.length}.txt`;
    const textAttachment = replyCall.files.find((f: any) => f.name === expectedFileName);
    expect(textAttachment).toBeDefined();
    const fileContent = textAttachment.attachment.toString('utf-8');
    const lines = fileContent.split('\n');
    expect(lines.length).toBe(STARTER_GIFT_CODES.length);

    // Kiểm tra có ActionRow chứa button link Garena và button tải extension
    expect(replyCall.components).toBeDefined();
    const actionRow = replyCall.components[replyCall.components.length - 1];
    expect(actionRow).toBeDefined();
    expect(actionRow.components.length).toBe(3);

    // Button 1: URL Redeem Garena
    expect(actionRow.components[0].data.url).toBe('https://redeem.df.garena.sg/en/cdkgarena.html');

    // Button 2: On-demand download DF Toolbox
    expect(actionRow.components[1].data.custom_id).toBe('df_help:dl:test-user-456:vi');
  });

  test('hỗ trợ song ngữ English khi interaction có locale en-US', async () => {
    const interaction: any = {
      guild: { id: 'test-guild-123' },
      user: { id: 'test-user-456' },
      locale: 'en-US',
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await executeGiftCode(interaction, db);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const replyCall = interaction.reply.mock.calls[0][0];

    const actionRow = replyCall.components[replyCall.components.length - 1];
    expect(actionRow.components[1].data.custom_id).toBe('df_help:dl:test-user-456:en');
    expect(actionRow.components[0].data.label).toBe('1. Open Redeem Page');
  });

  test('dispatchProfileSubcommand phân phối chính xác subcommand gift-code', async () => {
    const interaction: any = {
      options: {
        getSubcommand: jest.fn().mockReturnValue('gift-code'),
      },
      guild: { id: 'test-guild-123' },
      user: { id: 'test-user-456' },
      locale: 'vi',
      reply: jest.fn().mockResolvedValue(undefined),
    };

    const handled = await dispatchProfileSubcommand(interaction, db);
    expect(handled).toBe(true);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });
});
