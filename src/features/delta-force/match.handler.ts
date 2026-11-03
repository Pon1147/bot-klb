/**
 * Handler cho lệnh /df match [match_id] — Xem chi tiết hồ sơ trận đấu.
 * Nếu không truyền match_id, tự động lấy trận đấu gần nhất qua GetMatchList.
 * Render chi tiết thành tích cá nhân và đồng đội qua Discord Components V2.
 */

import { ChatInputCommandInteraction, ComponentType, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { getMatchList, getMatchDetail } from '../../services/deltaforce.api.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { makeResult, buildErrorContainer } from '../../utils/container.utils.js';
import { resolveOperator } from '../../utils/df-operator.utils.js';
import {
  EMOJI_WIN,
  EMOJI_DEFEAT,
  EMOJI_MONEY,
  EMOJI_KILL,
  MAP_NAMES,
} from '../../config/team-find.config.js';

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await runDfCommand({ userId: interaction.user.id, database, interaction }, async (rawToken) => {
    const apiToken = buildDfApiToken(rawToken);
    let roomId = interaction.options.getString('match_id')?.trim();

    // Nếu không truyền match_id, tự động lấy trận gần nhất
    if (!roomId) {
      const recentMatches = await getMatchList(apiToken, { limit: 1 });
      const first = recentMatches.list?.[0];
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

    const isWin = detail.result === 1;
    const resultEmoji = isWin ? EMOJI_WIN : EMOJI_DEFEAT;
    const resultText = isWin ? 'RÚT QUÂN THÀNH CÔNG (WIN)' : 'TỬ TRẬN (DEFEAT)';
    const mapName = MAP_NAMES[Number(detail.map_id)] ?? `Bản đồ #${detail.map_id}`;
    const operator = resolveOperator(String(detail.operator_id ?? ''));

    const matchTime = detail.match_time
      ? new Date(Number(detail.match_time) * 1000).toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Không xác định';

    const durationMin = detail.match_duration
      ? `${Math.round(Number(detail.match_duration) / 60)} phút`
      : 'N/A';

    const netIncomeStr =
      detail.net_income !== undefined
        ? Number(detail.net_income).toLocaleString('vi-VN') + ' Coin'
        : 'N/A';

    const carryOutStr =
      detail.carry_out_value !== undefined
        ? Number(detail.carry_out_value).toLocaleString('vi-VN') + ' Coin'
        : 'N/A';

    // Xử lý danh sách thành viên trong phòng (nếu API trả về)
    let teamSection = '';
    if (detail.members && detail.members.length > 0) {
      const memberLines = detail.members.map((m) => {
        const op = resolveOperator(String(m.operator_id ?? ''));
        const name = m.nickname || 'Chiến binh';
        const tagSelf = m.is_self ? ' *(Bạn)*' : '';
        const loot = Number(m.carry_out_value || 0).toLocaleString('vi-VN');
        return `• **${name}** (${op.name})${tagSelf}  ·  ${EMOJI_MONEY} ${loot}  ·  ${EMOJI_KILL} ${m.kill_operator || 0} PvP (${m.kill_other || 0} Bot)`;
      });
      teamSection = ['### 👥 Thành Tích Tiểu Đội:', ...memberLines].join('\n');
    }

    const content = [
      `# ${resultEmoji} Kết Quả Trận Đấu: ${resultText}`,
      '',
      `> 🗺️ **Bản đồ:** \`${mapName}\`  ·  ⏱️ **Thời lượng:** \`${durationMin}\``,
      `> 🕒 **Thời gian thi đấu:** \`${matchTime}\``,
      `> 🎖️ **Đặc vụ sử dụng:** \`${operator.name}\``,
      `> ${EMOJI_MONEY} **Chiến lợi phẩm mang ra:** \`${carryOutStr}\``,
      `> 📈 **Thu nhập ròng:** \`${netIncomeStr}\``,
      `> ${EMOJI_KILL} **Số mạng hạ gục:** \`${detail.kill_count ?? 0}\``,
      ...(teamSection ? ['', teamSection] : []),
      '',
      `*Mã trận: \`${roomId}\`*`,
    ].join('\n');

    const result = makeResult(
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

    return {
      components: result.toJSON(),
      flags: result.flags,
    };
  });
}
