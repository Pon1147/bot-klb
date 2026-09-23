/**
 * Handler cho select menu của /df-stats — chuyển season stats.
 * Sử dụng TTLStore cho cache và deferReply để tránh interaction timeout.
 */

import Database from 'better-sqlite3';
import { AttachmentBuilder, StringSelectMenuInteraction } from 'discord.js';
import { getSeasonData, getOverviewData } from '../services/deltaforce.api.js';
import { buildDfApiToken } from '../utils/df-token.utils.js';
import { DF_STATS_SELECT_ID } from '../commands/df/stats.command.js';
import { buildViewModel } from '../renderers/df-stats/view-model.js';
import { renderDashboard } from '../renderers/df-stats/svg-renderer.js';
import { buildSeasonSelectMenu } from '../commands/df/stats.command.js';
import { createLogger } from '../utils/logger.js';
import { getActiveBinding } from '../database/df-binding.db.js';
import { decryptCredential } from '../services/df-crypto.js';
import { getDfToken } from '../database/df.token.db.js';
import { sendReply } from '../utils/reply.utils.js';
import { TTLStore } from '../utils/ttl-store.js';

const logger = createLogger('DfStatsSelect');

// Cache kết quả API theo userId + season, TTL 5 phút
// KHÔNG gọi startCleanup() — cache chỉ dùng khi có interaction, không cần cleanup định kỳ
const statsCache = new TTLStore<
  string,
  { data: import('../types/deltaforce.types.js').DfMyDataResponse; expiresAt: number }
>({
  ttlMs: 5 * 60 * 1000,
  cleanupIntervalMs: 60 * 1000,
  name: 'DfStatsCache',
});

export async function handleDfStatsSelect(
  interaction: StringSelectMenuInteraction,
  database: Database.Database,
): Promise<{ handled: boolean }> {
  if (interaction.customId !== DF_STATS_SELECT_ID) {
    return { handled: false };
  }

  const selectedSeason = interaction.values[0];
  const userId = interaction.user.id;

  // Lấy token từ binding hoặc legacy token
  let token: ReturnType<typeof getDfToken> | null = null;
  try {
    const binding = getActiveBinding(database, userId);
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
        discord_id: userId,
        openid: binding.openid,
        token: cred.token,
        ts: cred.ts || null,
        s: cred.s || null,
        u: cred.u || null,
        linked_at: binding.captured_at || new Date().toISOString(),
        last_used_at: null,
      };
    } else {
      token = getDfToken(database, userId) ?? null;
    }
  } catch {
    token = getDfToken(database, userId) ?? null;
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

  // deferReply trước API call để tránh interaction timeout (>3s)
  try {
    await interaction.deferReply({ flags: 64 }); // Ephemeral
  } catch {
    // deferReply fail — interaction đã expire, không làm gì thêm
    logger.warn('deferReply failed for user ' + userId + ', interaction may have expired');
    return { handled: true };
  }

  try {
    const apiToken = buildDfApiToken(token);

    // Kiểm tra cache trước khi gọi API
    const cached = statsCache.get(userId + ':' + selectedSeason);
    if (cached) {
      const viewModel = buildViewModel(cached.data, selectedSeason);
      const imageBuffer = await renderDashboard(viewModel);
      const selectMenu = buildSeasonSelectMenu(selectedSeason);
      await interaction.editReply({
        files: [new AttachmentBuilder(imageBuffer, { name: 'df-stats.png' })],
        components: [selectMenu.toJSON()],
      } as Parameters<typeof interaction.editReply>[0]);
      return { handled: true };
    }

    const data =
      selectedSeason === 'overview'
        ? await getOverviewData(apiToken)
        : await getSeasonData(apiToken, selectedSeason);

    // Lưu vào cache với TTL 5 phút
    statsCache.set(userId + ':' + selectedSeason, {
      data,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const viewModel = buildViewModel(data, selectedSeason);
    const imageBuffer = await renderDashboard(viewModel);
    const selectMenu = buildSeasonSelectMenu(selectedSeason);

    await interaction.editReply({
      files: [new AttachmentBuilder(imageBuffer, { name: 'df-stats.png' })],
      components: [selectMenu.toJSON()],
    } as Parameters<typeof interaction.editReply>[0]);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('df-stats select failed for user ' + userId + ': ' + errMsg);
    // Hiển thị lỗi cho user + giữ menu disabled
    await interaction.editReply({
      content: 'Lỗi khi tải dữ liệu: ' + errMsg,
      components: [disabledMenu.toJSON()],
    } as Parameters<typeof interaction.editReply>[0]);
  }

  return { handled: true };
}
