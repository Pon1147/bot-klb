import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer, buildInfoContainer } from './container.utils.js';
import { getDfToken } from '../database/df.token.db.js';

export async function requireGuild(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    return true;
  }
  return false;
}

export async function requireDfToken(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<boolean> {
  const token = getDfToken(database, interaction.user.id);
  if (!token) {
    const err = buildErrorContainer(
      'Bạn chưa liên kết tài khoản. Dùng `/df-link start` hoặc `/df-link manual` để bắt đầu.',
    );
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return true;
  }
  return false;
}

export async function requireDfTokenOrInfo(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<boolean> {
  const existing = getDfToken(database, interaction.user.id);
  if (!existing) {
    const info = buildInfoContainer('Bạn chưa liên kết tài khoản Delta Force nào.');
    await interaction.reply({
      components: info.toJSON(),
      flags: info.flags | MessageFlags.Ephemeral,
    });
    return true;
  }
  return false;
}
