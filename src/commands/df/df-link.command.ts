import { AttachmentBuilder, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
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

const CONSOLE_SCRIPT = readFileSync(
  join(process.cwd(), 'dist', 'scraper', 'dfStable.js'),
  'utf8',
).trim();

export const data = new SlashCommandBuilder()
  .setName('df-link')
  .setDescription('Liên kết tài khoản Delta Force HQ.')
  .addSubcommand((sub) =>
    sub
      .setName('link')
      .setDescription('Liên kết tài khoản với token + openid')
      .addStringOption((opt) =>
        opt.setName('openid').setDescription('OpenID của tài khoản HQ').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('token')
          .setDescription('Token authentication (64 ký tự hex)')
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('unlink').setDescription('Hủy liên kết tài khoản Delta Force.'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('paste')
      .setDescription('Dán credentials đã copy từ trang HQ')
      .addStringOption((opt) =>
        opt
          .setName('json')
          .setDescription('Dán JSON: {"openid":"...","token":"..."}')
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('get-script').setDescription('Lấy script để copy token tự động.'),
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
      case 'link': {
        const openid = interaction.options.getString('openid')!;
        const token = interaction.options.getString('token')!;

        if (!/^[0-9a-f]{40,64}$/i.test(token)) {
          const err = buildErrorContainer(
            'Format token không hợp lệ. Token phải là chuỗi hex (40-64 ký tự).',
          );
          await interaction.reply({
            components: err.components as any,
            flags: err.flags | MessageFlags.Ephemeral,
          });
          return;
        }

        if (!/^\d{15,20}$/.test(openid)) {
          const err = buildErrorContainer(
            'Format OpenID không hợp lệ. OpenID phải là chuỗi số (15-20 ký tự).',
          );
          await interaction.reply({
            components: err.components as any,
            flags: err.flags | MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const data = await getMyData({ openid, token });
          saveDfToken(database, userId, openid, token);

          const result = buildSuccessContainer(
            `Đã liên kết tài khoản thành công!\nNickname: ${data.player_info.nickname}\nLevel: ${data.player_info.level}`,
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
        break;
      }

      case 'unlink': {
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
        break;
      }

      case 'status': {
        const existing = getDfToken(database, userId);
        if (!existing) {
          const info = buildInfoContainer(
            'Bạn chưa liên kết tài khoản Delta Force.\nDùng `/df-link link` để bắt đầu.',
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
        break;
      }

      case 'paste': {
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

        await interaction.deferReply({ ephemeral: true });

        try {
          const data = await getMyData({ openid: parsed.openid, token: parsed.token });
          saveDfToken(database, userId, parsed.openid, parsed.token);

          const result = buildSuccessContainer(
            `Đã liên kết tài khoản thành công!\nNickname: ${data.player_info.nickname}\nLevel: ${data.player_info.level}`,
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
        break;
      }

      case 'get-script': {
        const dmChannel = await interaction.user.createDM();
        await dmChannel.send({
          content:
            '**Script Copy Token Tự Động**\n\n' +
            '1. Truy cập [Delta Force HQ](https://www.playdeltaforce.com/events/hq/vi/index.html)\n' +
            '2. Đăng nhập tài khoản\n' +
            '3. Copy nội dung file `df-hq-script.js` bên dưới\n' +
            '4. Bấm **F12** hoặc **Ctrl + Shift + I** (mở DevTools)\n' +
            '5. Vào tab **Console**, paste và Enter\n' +
            '6. Tương tác trên trang để script capture token → Mở Discord → `/df-link paste` → dán JSON',
          files: [
            new AttachmentBuilder(Buffer.from(CONSOLE_SCRIPT, 'utf8'), {
              name: 'df-hq-script.js',
            }),
          ],
        });
        await interaction.reply({
          content: 'Script đã được gửi qua DM.',
          flags: MessageFlags.Ephemeral,
        });

        break;
      }
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
