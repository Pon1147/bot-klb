import { AttachmentBuilder, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { generateCode } from '../../services/df-claim-store.js';

const WEBHOOK_SCRIPT = readFileSync(
  join(process.cwd(), 'dist', 'scraper', 'df-webhook.js'),
  'utf8',
).trim();

const WEBHOOK_URL = process.env.WEBHOOK_URL ?? 'http://localhost:3500';

export const data = new SlashCommandBuilder()
  .setName('df-link')
  .setDescription('Liên kết tài khoản Delta Force HQ.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const code = generateCode(interaction.user.id);

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
    console.error('Error in /df-link:', error);
    if (!interaction.replied && !interaction.deferred) {
      const err = buildErrorContainer('Không thể gửi DM. Hãy mở tin nhắn trong Server Settings.');
      await interaction.reply({
        components: err.components as any,
        flags: err.flags | MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({ content: 'Lỗi khi gửi script. Xem console log.' }).catch(() => {});
    }
  }
}
