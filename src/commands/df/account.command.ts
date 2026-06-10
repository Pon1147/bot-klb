import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import {
  buildSuccessContainer,
  buildErrorContainer,
  buildInfoContainer,
} from '../../utils/container.utils.js';
import { getDfToken, saveDfToken, deleteDfToken } from '../../database/df.token.db.js';
import { getMyData } from '../../services/deltaforce.api.js';
import { generateCode } from '../../services/df-claim-store.js';

const WEBHOOK_SCRIPT = readFileSync(
  join(process.cwd(), 'dist', 'scraper', 'df-webhook.js'),
  'utf8',
).trim();

const WEBHOOK_URL = process.env.WEBHOOK_URL ?? 'http://localhost:3500';

export const data = new SlashCommandBuilder()
  .setName('df-account')
  .setDescription('Quản lý tài khoản Delta Force HQ.')
  .addSubcommand((sub) =>
    sub.setName('unlink').setDescription('Hủy liên kết tài khoản.'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('paste')
      .setDescription('(fallback) Dán credentials từ trang HQ')
      .addStringOption((opt) =>
        opt.setName('json').setDescription('{"openid":"...","token":"..."}').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('start').setDescription('Liên kết tài khoản qua webhook.'),
  )
  .addSubcommand((sub) => sub.setName('status').setDescription('Xem trạng thái liên kết.'));

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  try {
    switch (subcommand) {
      case 'unlink':
        await handleUnlink(interaction, database, userId);
        break;
      case 'status':
        await handleStatus(interaction, database, userId);
        break;
      case 'paste':
        await handlePaste(interaction, database, userId);
        break;
      case 'start':
        await handleStart(interaction, userId);
        break;
    }
  } catch (error) {
    console.error('Error in /df-link:', error);
    if (!interaction.replied && !interaction.deferred) {
      const err = buildErrorContainer('Đã xảy ra lỗi. Xem console logs.');
      await interaction.reply({
        components: err.components as any,
        flags: err.flags | MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleUnlink(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
  userId: string,
): Promise<void> {
  const existing = getDfToken(database, userId);
  if (!existing) {
    const info = buildInfoContainer('Bạn chưa liên kết tài khoản Delta Force nào.');
    await interaction.reply({
      components: info.components as any,
      flags: info.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  deleteDfToken(database, userId);
  const result = buildSuccessContainer('Đã hủy liên kết tài khoản Delta Force.');
  await interaction.reply({
    components: result.components as any,
    flags: result.flags | MessageFlags.Ephemeral,
  });
}

async function handleStatus(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
  userId: string,
): Promise<void> {
  const existing = getDfToken(database, userId);
  if (!existing) {
    const info = buildInfoContainer(
      'Bạn chưa liên kết tài khoản Delta Force.\nDùng `/df-link start` để bắt đầu.',
    );
    await interaction.reply({
      components: info.components as any,
      flags: info.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const info = buildInfoContainer(
    `Đã liên kết tài khoản\nOpenID: ${existing.openid}\nLiên kết lúc: ${existing.linked_at}\nLần dùng cuối: ${existing.last_used_at || 'Chưa'}`,
  );
  await interaction.reply({
    components: info.components as any,
    flags: info.flags | MessageFlags.Ephemeral,
  });
}

async function handlePaste(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
  userId: string,
): Promise<void> {
  const jsonInput = interaction.options.getString('json')!;

  let parsed: { openid?: string; token?: string };
  try {
    parsed = JSON.parse(jsonInput);
  } catch {
    const err = buildErrorContainer(
      'Format JSON không hợp lệ. Dùng định dạng: {"openid":"...","token":"..."}',
    );
    await interaction.reply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  if (!parsed.openid || !parsed.token) {
    const err = buildErrorContainer('JSON phải có cả `openid` và `token`.');
    await interaction.reply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const apiData = await getMyData({ openid: parsed.openid, token: parsed.token });
    saveDfToken(database, userId, parsed.openid, parsed.token);

    const result = buildSuccessContainer(
      `Đã liên kết tài khoản thành công!\nNickname: ${apiData.player_info.nickname}\nLevel: ${apiData.player_info.level}`,
    );
    await interaction.editReply({
      components: result.components as any,
      flags: result.flags | MessageFlags.Ephemeral,
    });
  } catch (error) {
    const err = buildErrorContainer(
      `Token không hợp lệ hoặc đã hết hạn: ${(error as Error).message}`,
    );
    await interaction.editReply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}

async function handleStart(
  interaction: ChatInputCommandInteraction,
  userId: string,
): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const code = generateCode(userId);

    const scriptContent = WEBHOOK_SCRIPT
      .replace(/@@WEBHOOK_URL@@/g, WEBHOOK_URL)
      .replace(/@@CLAIM_CODE@@/g, code);

    const dmChannel = await interaction.user.createDM();
    await dmChannel.send({
      content:
        '**Liên kết tài khoản Delta Force**\n\n' +
        `**Mã claim: \`${code}\`** (hết hạn sau 10 phút)\n\n` +
        '1. Truy cập [Delta Force HQ](https://www.playdeltaforce.com/events/hq/vi/index.html)\n' +
        '2. Đăng nhập tài khoản → chờ trang load xong\n' +
        '3. Copy toàn bộ nội dung file `df-link-script.js` bên dưới\n' +
        '4. Bấm **F12** → tab **Console** → paste → Enter\n' +
        '5. Script tự tìm token & gửi về bot — chờ DM xác nhận!\n' +
        '6. Nếu Console hiện "chưa tìm thấy" → nhấn vài nút trên trang → script sẽ capture khi có API call',
      files: [
        new AttachmentBuilder(Buffer.from(scriptContent, 'utf8'), {
          name: 'df-link-script.js',
        }),
      ],
    });

    await interaction.editReply({
      content: `Script đã gửi qua DM. Mã claim: \`${code}\` — hết hạn sau 10 phút.`,
    });
  } catch (error) {
    console.error('Error in /df-link start:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Lỗi: không thể gửi DM. Hãy mở tin nhắn trong Server Settings.',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({
        content: 'Lỗi khi gửi script. Xem console log.',
      }).catch(() => {});
    }
  }
}
