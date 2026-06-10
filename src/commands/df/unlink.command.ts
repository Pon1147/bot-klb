import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import {
  buildSuccessContainer,
  buildInfoContainer,
} from '../../utils/container.utils.js';
import { getDfToken, deleteDfToken } from '../../database/df.token.db.js';

export const data = new SlashCommandBuilder()
  .setName('df-unlink')
  .setDescription('Hủy liên kết tài khoản Delta Force.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const existing = getDfToken(database, interaction.user.id);
  if (!existing) {
    const info = buildInfoContainer('Bạn chưa liên kết tài khoản Delta Force nào.');
    await interaction.reply({
      components: info.components as any,
      flags: info.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  deleteDfToken(database, interaction.user.id);
  const result = buildSuccessContainer('Đã hủy liên kết tài khoản Delta Force.');
  await interaction.reply({
    components: result.components as any,
    flags: result.flags | MessageFlags.Ephemeral,
  });
}
