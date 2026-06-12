import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { buildSuccessContainer } from '../../utils/container.utils.js';
import { requireGuild, requireDfTokenOrInfo } from '../../utils/df-guards.js';
import { deleteDfToken } from '../../database/df.token.db.js';

export const data = new SlashCommandBuilder()
  .setName('df-unlink')
  .setDescription('Hủy liên kết tài khoản Delta Force.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;
  if (await requireDfTokenOrInfo(interaction, database)) return;

  deleteDfToken(database, interaction.user.id);
  const result = buildSuccessContainer('Đã hủy liên kết tài khoản Delta Force.');
  await interaction.reply({
    components: result.toJSON(),
    flags: result.flags | MessageFlags.Ephemeral,
  });
}
