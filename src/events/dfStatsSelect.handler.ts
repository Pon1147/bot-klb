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

// Cache kết quả API theo userId + season, TTL 30s
const statsCache = new Map<
  string,
  { data: import('../types/deltaforce.types.js').DfMyDataResponse; timestamp: number }
>();
const CACHE_TTL_MS = 30_000;

function getCacheKey(userId: string, season: string): string {
  return userId + ':' + season;
}

function getCached(
  userId: string,
  season: string,
): import('../types/deltaforce.types.js').DfMyDataResponse | null {
  const key = getCacheKey(userId, season);
  const entry = statsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    statsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(
  userId: string,
  season: string,
  data: import('../types/deltaforce.types.js').DfMyDataResponse,
): void {
  statsCache.set(getCacheKey(userId, season), { data, timestamp: Date.now() });
}

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

  // Disable select menu ngay để tránh user click nhiều lần
  const disabledMenu = buildSeasonSelectMenu(selectedSeason);
  disabledMenu.components[0].setDisabled(true);

  // Update message sau khi API call xong (select menu không cần deferReply)
  try {
    const apiToken = buildDfApiToken(token);

    // Kiểm tra cache trước khi gọi API
    const cached = getCached(interaction.user.id, selectedSeason);
    if (cached) {
      const seasonLabel = getSeasonLabel(selectedSeason);
      const result = buildStatsContainer(cached, seasonLabel);
      const selectMenu = buildSeasonSelectMenu(selectedSeason);
      await interaction.update({
        components: [...result.components, selectMenu.toJSON()],
      } as Parameters<typeof interaction.update>[0]);
      return { handled: true };
    }

    const data =
      selectedSeason === 'overview'
        ? await getOverviewData(apiToken)
        : await getSeasonData(apiToken, selectedSeason);

    // Lưu vào cache
    setCache(interaction.user.id, selectedSeason, data);

    const seasonLabel = getSeasonLabel(selectedSeason);
    const result = buildStatsContainer(data, seasonLabel);
    const selectMenu = buildSeasonSelectMenu(selectedSeason);

    await interaction.update({
      components: [...result.components, selectMenu.toJSON()],
    } as Parameters<typeof interaction.update>[0]);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('df-stats select failed for user ' + interaction.user.id + ': ' + errMsg);
    // Giữ menu disabled khi API fail — user không spam click thêm nữa
    await interaction.update({
      components: [disabledMenu.toJSON()],
    } as Parameters<typeof interaction.update>[0]);
  }

  return { handled: true };
}
