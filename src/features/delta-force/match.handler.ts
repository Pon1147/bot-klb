/**
 * Handler cho lệnh /df match [match_id] — Xem chi tiết hồ sơ trận đấu.
 * Nếu không truyền match_id, tự động lấy trận đấu gần nhất qua GetMatchList.
 * Cung cấp Dropdown Select Menu chọn trận đấu gần đây cho người dùng non-tech.
 * Render chi tiết thành tích cá nhân và đồng đội qua Discord Components V2.
 */

import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getMatchList, getMatchDetail } from '../../services/deltaforce.api.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import { resolveUserDfToken } from '../../utils/df-token.utils.js';
import { makeResult, buildErrorContainer } from '../../utils/container.utils.js';
import { resolveOperator } from '../../utils/df-operator.utils.js';
import {
  EMOJI_WIN,
  EMOJI_DEFEAT,
  EMOJI_MONEY,
  EMOJI_KILL,
  MAP_NAMES,
} from '../../config/deltaforce.config.js';
import {
  formatVietnamDateTime,
  formatCoin,
  formatMatchDuration,
} from '../../utils/df-format.utils.js';
import type { DfMatchEntry, DfMatchDetailResponse } from '../../types/deltaforce.types.js';

export { formatMatchDuration } from '../../utils/df-format.utils.js';

export const MATCH_SELECT_PREFIX = 'df_match_select';

/**
 * Xây dựng Container V2 và ActionRow Select Menu cho một trận đấu cụ thể.
 */
export function buildMatchContainerWithSelect(
  detail: DfMatchDetailResponse,
  recentMatches: DfMatchEntry[],
  currentRoomId: string,
  userId: string,
) {
  const isWin = detail.result === 1;
  const resultEmoji = isWin ? EMOJI_WIN : EMOJI_DEFEAT;
  const resultText = isWin ? 'RÚT QUÂN THÀNH CÔNG (WIN)' : 'TỬ TRẬN (DEFEAT)';
  const mapName = MAP_NAMES[Number(detail.map_id)] ?? `Bản đồ #${detail.map_id}`;

  // Trích xuất thành tích của chính người chơi từ mảng members
  const selfMember = detail.members?.find((m) => m.is_self);
  const operatorId = selfMember?.operator_id ?? detail.operator_id;
  const operator = resolveOperator(String(operatorId ?? ''));

  const matchTime = detail.match_time ? formatVietnamDateTime(detail.match_time) : 'Không xác định';

  // Thời lượng trận đấu: ưu tiên detail.match_duration, fallback survival_duration
  const rawDuration = detail.match_duration ?? selfMember?.survival_duration;
  const durationStr = formatMatchDuration(rawDuration);

  // Tiền loot mang ra
  const carryOutRaw = selfMember?.carry_out_value ?? detail.carry_out_value;
  const carryOutStr = formatCoin(carryOutRaw);

  // Thu nhập ròng
  const netIncomeRaw = detail.net_income ?? carryOutRaw;
  const netIncomeStr = formatCoin(netIncomeRaw);

  // Số mạng hạ gục
  const killPvP = selfMember?.kill_operator ?? detail.kill_count ?? 0;
  const killBot = selfMember?.kill_other ?? 0;
  const killStr = killBot > 0 ? `${killPvP} PvP (${killBot} Bot)` : `${killPvP} Mạng`;

  // Xử lý danh sách thành viên trong phòng
  let teamSection = '';
  if (detail.members && detail.members.length > 0) {
    const memberLines = detail.members.map((m) => {
      const op = resolveOperator(String(m.operator_id ?? ''));
      const name = m.nickname || 'Chiến binh';
      const tagSelf = m.is_self ? ' *(Bạn)*' : '';
      const loot = formatCoin(m.carry_out_value || 0, false);
      const botPart = m.kill_other ? ` (${m.kill_other} Bot)` : '';
      return `• **${name}** (${op.name})${tagSelf}  ·  ${EMOJI_MONEY} ${loot}  ·  ${EMOJI_KILL} ${m.kill_operator || 0} PvP${botPart}`;
    });
    teamSection = ['### 👥 Thành Tích Tiểu Đội:', ...memberLines].join('\n');
  }

  const content = [
    `# ${resultEmoji} Kết Quả Trận Đấu: ${resultText}`,
    '',
    `> 🗺️ **Bản đồ:** \`${mapName}\`  ·  ⏱️ **Thời lượng:** \`${durationStr}\``,
    `> 🕒 **Thời gian thi đấu:** \`${matchTime}\``,
    `> 🎖️ **Đặc vụ sử dụng:** \`${operator.name}\``,
    `> ${EMOJI_MONEY} **Chiến lợi phẩm mang ra:** \`${carryOutStr}\``,
    `> 📈 **Thu nhập ròng:** \`${netIncomeStr}\``,
    `> ${EMOJI_KILL} **Số mạng hạ gục:** \`${killStr}\``,
    ...(teamSection ? ['', teamSection] : []),
    '',
    `*Mã trận: \`${currentRoomId}\`*`,
  ].join('\n');

  const containerResult = makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content },
          {
            type: ComponentType.Separator,
            accentColor: isWin ? 0x57f287 : 0xed4245,
          },
        ],
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );

  // Xây dựng Dropdown Select Menu chọn trận gần đây (dành cho non-tech user)
  const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [];
  if (recentMatches && recentMatches.length > 1) {
    const options = recentMatches.slice(0, 10).map((m) => {
      const win = m.result === 1;
      const tag = win ? '🏆 [WIN]' : '💀 [DEFEAT]';
      const map = MAP_NAMES[Number(m.map_id)] ?? `Map #${m.map_id}`;
      const time = m.match_time ? formatVietnamDateTime(m.match_time) : '';

      return {
        label: `${tag} ${map} (${time})`.slice(0, 100),
        value: String(m.room_id),
        description: `Mã trận: ${m.room_id}`.slice(0, 100),
        default: String(m.room_id) === String(currentRoomId),
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`${MATCH_SELECT_PREFIX}:${userId}`)
      .setPlaceholder('🎮 Chọn trận đấu gần đây khác để xem chi tiết...')
      .addOptions(options);

    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  }

  return {
    containerResult,
    actionRows: rows,
  };
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await runDfCommand({ userId: interaction.user.id, database, interaction }, async (apiToken) => {
    let roomId = interaction.options.getString('match_id')?.trim();

    // Luôn fetch 10 trận gần nhất để phục vụ cả việc chọn trận mặc định & dropdown list
    const recentMatchesRes = await getMatchList(apiToken, { limit: 10 }).catch(() => null);
    const recentList = recentMatchesRes?.list || [];

    // Nếu không truyền match_id, tự động lấy trận gần nhất
    if (!roomId) {
      const first = recentList[0];
      if (!first || !first.room_id) {
        const errResult = buildErrorContainer('Không tìm thấy dữ liệu trận đấu nào gần đây.');
        return {
          components: errResult.toJSON(),
          flags: MessageFlags.IsComponentsV2,
        };
      }
      roomId = String(first.room_id);
    }

    const detail = await getMatchDetail(apiToken, roomId);
    if (!detail) {
      const errResult = buildErrorContainer(
        `Không thể tải thông tin chi tiết cho trận đấu ID \`${roomId}\`.`,
      );
      return {
        components: errResult.toJSON(),
        flags: MessageFlags.IsComponentsV2,
      };
    }

    const built = buildMatchContainerWithSelect(detail, recentList, roomId, interaction.user.id);

    const components = [
      ...built.containerResult.toJSON(),
      ...built.actionRows.map((r) => r.toJSON()),
    ];

    return {
      components,
      flags: MessageFlags.IsComponentsV2,
    };
  });
}

/**
 * Xử lý khi người dùng tương tác với StringSelectMenu chọn trận đấu.
 */
export async function handleMatchSelect(
  interaction: StringSelectMenuInteraction,
  database: Database.Database,
): Promise<void> {
  // ACK ngay lập tức để chống timeout 3s của Discord
  await interaction.deferUpdate().catch(() => {});

  const customId = interaction.customId;
  const parts = customId.split(':');
  const ownerId = parts[1];

  // Bảo vệ: Chỉ người gọi lệnh mới được đổi trận trong menu này
  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.followUp({
      content:
        '❌ Bạn không thể thao tác trên danh sách trận đấu của người khác! Hãy dùng `/df match` để xem của riêng bạn.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedRoomId = interaction.values[0];
  if (!selectedRoomId) return;

  // Lấy token của user để gọi API
  const apiToken = resolveUserDfToken(database, interaction.user.id);

  if (!apiToken) {
    await interaction.followUp({
      content: 'Không thể xác thực tài khoản Delta Force để tải lại trận đấu.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [recentMatchesRes, detail] = await Promise.all([
    getMatchList(apiToken, { limit: 10 }).catch(() => null),
    getMatchDetail(apiToken, selectedRoomId).catch(() => null),
  ]);

  if (!detail) {
    await interaction.followUp({
      content: `Không thể tải thông tin chi tiết cho trận đấu ID \`${selectedRoomId}\`.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const recentList = recentMatchesRes?.list || [];
  const built = buildMatchContainerWithSelect(
    detail,
    recentList,
    selectedRoomId,
    interaction.user.id,
  );

  const components = [
    ...built.containerResult.toJSON(),
    ...built.actionRows.map((r) => r.toJSON()),
  ];

  await interaction.editReply({
    components: components as any,
    flags: MessageFlags.IsComponentsV2,
  });
}
