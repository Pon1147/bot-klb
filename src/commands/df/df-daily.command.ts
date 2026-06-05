import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { buildErrorContainer, buildTextOnlyContainer } from '../../utils/container.utils.js';
import { fetchDailyCodes } from '../../services/deltaforce.scraper.js';

export const data = new SlashCommandBuilder()
  .setName('df-daily')
  .setDescription('Lấy mật khẩu hàng ngày từ Delta Force HQ.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const codes = await fetchDailyCodes();

    const hasCodes = Object.values(codes).some((v) => v !== null);
    if (!hasCodes) {
      const err = buildErrorContainer(
        'Không tìm thấy daily codes. Trang HQ có thể đang bảo trì hoặc structure đã thay đổi.',
      );
      await interaction.editReply({
        components: err.components as any,
        flags: err.flags | MessageFlags.Ephemeral,
      });
      return;
    }

    const lines = [`## ​`, `### 🔑 Mật khẩu hàng ngày`, ``];

    for (const [map, code] of Object.entries(codes)) {
      const icon = code ? '✅' : '❓';
      const value = code || 'Chưa có';
      lines.push(`${icon} **${map}:** \`${value}\``);
    }

    const now = new Date();
    lines.push('');
    lines.push(`_Cập nhật: ${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}_`);

    const container = buildTextOnlyContainer(lines.join('\n'), 0xFFD700);
    await interaction.editReply({
      components: container.components as any,
      flags: container.flags | MessageFlags.Ephemeral,
    });
  } catch (error) {
    const err = buildErrorContainer(`Lỗi khi lấy daily codes: ${(error as Error).message}`);
    await interaction.editReply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
