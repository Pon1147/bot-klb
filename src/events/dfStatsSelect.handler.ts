import Database from 'better-sqlite3';
import { StringSelectMenuInteraction } from 'discord.js';
import { getSeasonData, getOverviewData } from '../services/deltaforce.api.js';
import { buildDfApiToken } from '../utils/df-token.utils.js';
import { buildStatsContainer, DF_STATS_SELECT_ID } from '../commands/df/stats.command.js';
import { getSeasonLabel } from '../config/season.config.js';
import { buildSeasonSelectMenu } from '../commands/df/stats.command.js';
import { createLogger } from '../utils/logger.js';
import { getActiveBinding } from '../database/df-binding.db.js';
import { decryptCredential } from '../services/df-crypto.js';
import { getDfToken } from '../database/df.token.db.js';
import { sendReply } from '../utils/reply.utils.js';

const logger = createLogger('DfStatsSelect');

export async function handleDfStatsSelect(
  interaction: StringSelectMenuInteraction,
  database: Database.Database,
): Promise<{ handled: boolean }> {
  if (interaction.customId !== DF_STATS_SELECT_ID) {
    return { handled: false };
  }

  const selectedSeason = interaction.values[0];

  // Lấy token từ binding hoặc legacy token
  let token: ReturnType<typeof getDfToken> | null = null;
  try {
    const binding = getActiveBinding(database, interaction.user.id);
    if (binding) {
      const decrypted = decryptCredential(
        binding.cred_nonce,
        binding.cred_ciphertext,
        binding.cred_tag,
        binding.discord_user_id,
        binding.openid,
      );
      const cred = JSON.parse(decrypted);
      token = {
        discord_id: interaction.user.id,
        openid: binding.openid,
        token: cred.token,
        ts: cred.ts || null,
        s: cred.s || null,
        u: cred.u || null,
        linked_at: binding.captured_at || new Date().toISOString(),
        last_used_at: null,
      };
    } else {
      token = getDfToken(database, interaction.user.id) ?? null;
    }
  } catch {
    token = getDfToken(database, interaction.user.id) ?? null;
  }

  if (!token) {
    await sendReply(interaction, {
      content: 'Chưa liên kết tài khoản. Dùng `/df-link start`.',
      flags: 64,
    });
    return { handled: true };
  }

  try {
    // Rate limit: delay 500ms giữa các requests
    await new Promise((resolve) => setTimeout(resolve, 500));

    const apiToken = buildDfApiToken(token);
    const data =
      selectedSeason === 'overview'
        ? await getOverviewData(apiToken)
        : await getSeasonData(apiToken, selectedSeason);
    const seasonLabel = getSeasonLabel(selectedSeason);

    const result = buildStatsContainer(data, seasonLabel);
    const selectMenu = buildSeasonSelectMenu(selectedSeason);

    await interaction.update({
      components: [...result.components, selectMenu.toJSON()],
    } as Parameters<typeof interaction.update>[0]);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('df-stats select failed for user ' + interaction.user.id + ': ' + errMsg);
  }

  return { handled: true };
}
