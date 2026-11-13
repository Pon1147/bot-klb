/**
 * Handler cho select menu của /df-stats — chuyển season stats.
 * Sử dụng TTLStore cho cache và deferReply để tránh interaction timeout.
 */

import Database from 'better-sqlite3';
import { StringSelectMenuInteraction } from 'discord.js';
import { getSeasonData, getOverviewData } from '../../services/deltaforce.api.js';
import { DF_STATS_SELECT_ID, buildSeasonSelectMenu, buildStatsContainer } from './stats.handler.js';
import { getSeasonLabel } from '../../config/season.config.js';
import { createLogger } from '../../utils/logger.js';
import { getActiveBinding } from '../../database/df-binding.db.js';
import { decryptCredential } from '../../services/df-crypto.js';
import { getDfToken } from '../../database/df.token.db.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { sendReply } from '../../utils/reply.utils.js';
import { hasPolicy, Policy } from '../../config/permissions.js';
import { getSettingsService } from '../../services/settings.service.js';
import { TTLStore } from '../../utils/ttl-store.js';

const logger = createLogger('DfStatsSelect');

// Cache kết quả API theo userId + season, TTL 5 phút
// KHÔNG gọi startCleanup() — cache chỉ dùng khi có interaction, không cần cleanup định kỳ
const statsCache = new TTLStore<
  string,
  { data: import('../../types/deltaforce.types.js').DfMyDataResponse; expiresAt: number }
>({
  ttlMs: 5 * 60 * 1000,
  cleanupIntervalMs: 60 * 1000,
  name: 'DfStatsCache',
});

export async function handleDfStatsSelect(
  interaction: StringSelectMenuInteraction,
  database: Database.Database,
): Promise<{ handled: boolean }> {
  if (!interaction.customId.startsWith(DF_STATS_SELECT_ID)) {
    return { handled: false };
  }

  const selectedSeason = interaction.values[0];
  // 1. Phân giải Owner ID từ customId (format: df_stats_season_select:userId) hoặc message interaction metadata
  const parts = interaction.customId.split(':');
  const customIdOwnerId = parts[1] || null;
  const messageOwnerId =
    (
      interaction.message as unknown as {
        interactionMetadata?: { user?: { id?: string } };
        interaction?: { user?: { id?: string } };
      }
    )?.interactionMetadata?.user?.id ??
    (interaction.message as unknown as { interaction?: { user?: { id?: string } } })?.interaction
      ?.user?.id ??
    null;
  const ownerUserId = customIdOwnerId ?? messageOwnerId;

  // 2. Kiểm tra phân quyền RBAC (Policy.DF_ACCESS) cho người dùng đang click tương tác
  if (interaction.guildId) {
    let guildRbac = undefined;
    try {
      const settingsService = getSettingsService();
      guildRbac = settingsService.get(interaction.guildId).rbac;
    } catch {
      // fallback nếu settingsService chưa khả dụng
    }
    const policyResult = hasPolicy(interaction, Policy.DF_ACCESS, guildRbac);
    if (!policyResult.allowed) {
      await sendReply(interaction, {
        content:
          policyResult.reason ??
          '🔒 Bạn không có quyền truy cập tính năng Delta Force của máy chủ này.',
        flags: 64,
      });
      return { handled: true };
    }
  }

  // 3. Kiểm tra quyền sở hữu (Ownership Check): Chỉ người dùng gọi lệnh mới được thao tác trên bảng stats của họ
  if (ownerUserId && interaction.user.id !== ownerUserId) {
    await sendReply(interaction, {
      content:
        '❌ Bạn không thể thao tác trên bảng thống kê của người khác! Hãy dùng lệnh `/df stats` để xem thống kê của riêng bạn.',
      flags: 64,
    });
    return { handled: true };
  }

  const targetUserId = ownerUserId ?? interaction.user.id;

  // Lấy token từ binding hoặc legacy token (hỗ trợ key rotation qua key_version)
  let apiToken: ReturnType<typeof buildDfApiToken> | null = null;
  const binding = getActiveBinding(database, targetUserId);

  if (binding) {
    try {
      const decrypted = decryptCredential(
        binding.cred_nonce,
        binding.cred_ciphertext,
        binding.cred_tag,
        binding.discord_user_id,
        binding.openid,
        binding.key_version,
      );
      const cred = JSON.parse(decrypted);
      apiToken = {
        openid: binding.openid,
        token: cred.token,
        ts: cred.ts || undefined,
        s: cred.s || undefined,
        u: cred.u || undefined,
      };
    } catch (decryptError: unknown) {
      // Binding tồn tại nhưng giải mã thất bại (sai key, hỏng auth tag, corrupt payload)
      // Tuyệt đối không fallback âm thầm sang token legacy cũ chưa mã hóa để tránh stale token leak
      logger.error(
        `[DfStatsSelect] Giải mã binding thất bại cho user ${targetUserId}: ${(decryptError as Error).message}`,
      );
      await sendReply(interaction, {
        content:
          'Binding tài khoản bị lỗi hoặc khóa không hợp lệ. Vui lòng unlink và liên kết lại bằng `/df link`.',
        flags: 64,
      });
      return { handled: true };
    }
  } else {
    // Không có binding mới -> fallback token legacy
    const legacyToken = getDfToken(database, targetUserId);
    if (legacyToken) {
      apiToken = buildDfApiToken(legacyToken);
    }
  }

  if (!apiToken) {
    await sendReply(interaction, {
      content: 'Chưa liên kết tài khoản. Dùng `/df link`.',
      flags: 64,
    });
    return { handled: true };
  }

  // Disable select menu ngay để tránh user click nhiều lần
  const disabledMenu = buildSeasonSelectMenu(selectedSeason, targetUserId);
  disabledMenu.components[0].setDisabled(true);

  // deferUpdate trước API call để cập nhật message hiện tại và tránh interaction timeout (>3s)
  try {
    await interaction.deferUpdate();
  } catch {
    // deferUpdate fail — interaction đã expire, không làm gì thêm
    logger.warn('deferUpdate failed for user ' + targetUserId + ', interaction may have expired');
    return { handled: true };
  }

  try {
    // Kiểm tra cache trước khi gọi API
    const cached = statsCache.get(targetUserId + ':' + selectedSeason);
    if (cached) {
      const seasonLabel = getSeasonLabel(selectedSeason);
      const result = buildStatsContainer(cached.data, seasonLabel);
      const selectMenu = buildSeasonSelectMenu(selectedSeason, targetUserId);
      await interaction.editReply({
        components: [...result.components, selectMenu.toJSON()],
      } as Parameters<typeof interaction.editReply>[0]);
      return { handled: true };
    }

    const data =
      selectedSeason === 'overview'
        ? await getOverviewData(apiToken)
        : await getSeasonData(apiToken, selectedSeason);

    // Lưu vào cache với TTL 5 phút
    statsCache.set(targetUserId + ':' + selectedSeason, {
      data,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const seasonLabel = getSeasonLabel(selectedSeason);
    const result = buildStatsContainer(data, seasonLabel);
    const selectMenu = buildSeasonSelectMenu(selectedSeason, targetUserId);

    await interaction.editReply({
      components: [...result.components, selectMenu.toJSON()],
    } as Parameters<typeof interaction.editReply>[0]);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('df-stats select failed for user ' + targetUserId + ': ' + errMsg);
    // Hiển thị lỗi cho user + giữ menu disabled
    await interaction.editReply({
      content: 'Lỗi khi tải dữ liệu: ' + errMsg,
      components: [disabledMenu.toJSON()],
    } as Parameters<typeof interaction.editReply>[0]);
  }

  return { handled: true };
}
