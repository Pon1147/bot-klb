import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { buildSuccessContainer } from '../../utils/container.utils.js';
import { requireGuild, requireDfBinding } from '../../utils/df-guards.js';
import { revokeBinding } from '../../database/df-binding.db.js';
import { sendReply } from '../../utils/reply.utils.js';

export const data = new SlashCommandBuilder()
  .setName('df-unlink')
  .setDescription('Hủy liên kết tài khoản Delta Force.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  // Kiểm tra guild
  if (await requireGuild(interaction)) return;

  // Kiểm tra user đã link chưa (binding active hoặc legacy token)
  if (await requireDfBinding(interaction, database)) return;

  // Revoke binding (tự động xóa legacy token đồng bộ)
  revokeBinding(database, interaction.user.id);

  const result = buildSuccessContainer('Đã hủy liên kết tài khoản Delta Force.');
  await sendReply(interaction, { components: result.toJSON() });
}
