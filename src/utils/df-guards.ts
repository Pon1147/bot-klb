import { ChatInputCommandInteraction, GuildMember, PermissionFlagsBits } from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer, buildInfoContainer } from './container.utils.js';
import { getDfToken } from '../database/df.token.db.js';
import { getActiveBinding } from '../database/df-binding.db.js';
import { sendReply } from './reply.utils.js';

export async function requireGuild(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild) {
    await sendReply(interaction, { content: 'Chỉ dùng trong server.' });
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
    await sendReply(interaction, { components: err.toJSON() });
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
    await sendReply(interaction, { components: info.toJSON() });
    return true;
  }
  return false;
}

/**
 * Guard: yêu cầu user đã có account binding active.
 * Kiểm tra df_account_bindings trước, fallback df_tokens.
 */
export async function requireDfBinding(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<boolean> {
  const binding = getActiveBinding(database, interaction.user.id);
  const legacyToken = getDfToken(database, interaction.user.id);

  if (!binding && !legacyToken) {
    const err = buildErrorContainer(
      'Bạn chưa liên kết tài khoản. Dùng `/df-link start` hoặc `/df-link manual` để bắt đầu.',
    );
    await sendReply(interaction, { components: err.toJSON() });
    return true;
  }
  return false;
}

/**
 * Guard: yêu cầu quyền Administrator.
 * Trả về true nếu bị block (không có quyền).
 */
export async function requireAdministrator(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.guild) return true;
  const member = interaction.member as GuildMember;
  if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
    await sendReply(interaction, { content: 'Bạn cần quyền Administrator để sử dụng lệnh này.' });
    return true;
  }
  return false;
}
