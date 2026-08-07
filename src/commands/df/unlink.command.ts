import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer, buildSuccessContainer } from '../../utils/container.utils.js';
import { requireGuild } from '../../utils/df-guards.js';
import { deleteDfToken, getDfToken } from '../../database/df.token.db.js';
import { getActiveBinding, revokeBinding } from '../../database/df-binding.db.js';

export const data = new SlashCommandBuilder()
  .setName('df-unlink')
  .setDescription('Hủy liên kết tài khoản Delta Force.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const hasBinding = getActiveBinding(database, interaction.user.id) !== undefined;
  const hasToken = getDfToken(database, interaction.user.id) !== undefined;

  if (!hasBinding && !hasToken) {
    const err = buildErrorContainer('Bạn chưa liên kết tài khoản Delta Force nào.');
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  if (hasBinding) {
    revokeBinding(database, interaction.user.id);
  }
  if (hasToken) {
    deleteDfToken(database, interaction.user.id);
  }

  const result = buildSuccessContainer('Đã hủy liên kết tài khoản Delta Force.');
  await interaction.reply({
    components: result.toJSON(),
    flags: result.flags | MessageFlags.Ephemeral,
  });
}
