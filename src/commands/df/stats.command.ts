import {
  ActionRowBuilder,
  AttachmentBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getOverviewData } from '../../services/deltaforce.api.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import { buildSeasonOptions, getSeasonLabel } from '../../config/season.config.js';
import { buildViewModel } from '../../renderers/df-stats/view-model.js';
import { renderDashboard } from '../../renderers/df-stats/svg-renderer.js';

export const data = new SlashCommandBuilder()
  .setName('df-stats')
  .setDescription('Xem thong ke tai khoan Delta Force.');

/** Custom ID prefix for df-stats select menu */
export const DF_STATS_SELECT_ID = 'df_stats_season_select';

/** Build season select menu */
export function buildSeasonSelectMenu(
  selectedValue: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = buildSeasonOptions().map((opt) =>
    new StringSelectMenuOptionBuilder().setLabel(opt.label).setValue(opt.value),
  );

  const label = getSeasonLabel(selectedValue);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(DF_STATS_SELECT_ID)
      .setPlaceholder(`Đang chọn: ${label}`)
      .addOptions(options),
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await runDfCommand({ userId: interaction.user.id, database, interaction }, async (tokenRow) => {
    const apiToken = buildDfApiToken(tokenRow);
    const rawData = await getOverviewData(apiToken);
    const viewModel = buildViewModel(rawData, 'overview');
    const imageBuffer = await renderDashboard(viewModel);

    const selectMenu = buildSeasonSelectMenu('overview');

    return {
      files: [new AttachmentBuilder(imageBuffer, { name: 'df-stats.png' })],
      components: [selectMenu.toJSON()],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    };
  });
}
