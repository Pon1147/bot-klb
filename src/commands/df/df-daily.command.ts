import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer, buildTextOnlyContainer } from '../../utils/container.utils.js';
import { getDfToken, touchDfToken } from '../../database/df.token.db.js';
import { getDailyReport } from '../../services/deltaforce.api.js';
import { fetchDailyCodes, DailyCodes } from '../../services/deltaforce.scraper.js';
import type { DfBattlefieldBattle } from '../../types/deltaforce.types.js';

export const data = new SlashCommandBuilder()
  .setName('df-daily')
  .setDescription('Lấy mật khẩu và trạng thái chiến đấu hàng ngày.');

function formatCodes(codes: DailyCodes): string {
  const lines: string[] = [];
  for (const [map, code] of Object.entries(codes)) {
    const value = code || 'Chưa có';
    lines.push(`- **${map}**: \`${value}\``);
  }
  return lines.join('\n');
}

function formatOperations(battle: DfBattlefieldBattle | null): string {
  if (!battle) return '  _Chưa có dữ liệu (chưa chơi trận nào hôm nay)_';

  const lines: string[] = [];
  lines.push(`- **Thưởng**: ${Number(battle.revenue).toLocaleString('vi-VN')}`);
  lines.push(`- **Đặc vụ hạ gục**: ${battle.kill_count}`);
  lines.push(`- **Trận đấu**: ${battle.match_count}`);
  lines.push(`- **KD**: ${battle.kd_ratio}`);
  lines.push(`- **Rút quân**: ${battle.retreat_rate}%`);
  return lines.join('\n');
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get linked account first (fast, sync)
    const linkedToken = getDfToken(database, interaction.user.id);

    // Fetch in parallel — API fast, scraper slow (puppeteer launch)
    const [battleReport, codes] = await Promise.all([
      linkedToken
        ? getDailyReport({ openid: linkedToken.openid, token: linkedToken.token }).catch((e) => {
            console.warn('[df-daily] API fail:', (e as Error).message);
            return null;
          })
        : Promise.resolve(null),
      fetchDailyCodes().catch(() => null),
    ]);

    const battle: DfBattlefieldBattle | null = battleReport?.battlefield_battle ?? battleReport?.beacon_battle ?? null;

    if (linkedToken) {
      touchDfToken(database, interaction.user.id);
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // ── Build content ──
    const sections: string[] = [];

    if (codes) {
      const hasCodes = Object.values(codes).some((v) => v !== null);
      if (hasCodes) {
        sections.push('## Mật Khẩu Hàng Ngày');
        sections.push(formatCodes(codes));
      }
    }

    sections.push('');
    sections.push('## Trạng Thái Chiến Đấu Hiện Tại');

    if (linkedToken) {
      sections.push(formatOperations(battle));
    } else {
      sections.push('_Dùng `/df-link link` để xem dữ liệu của bạn_');
    }

    sections.push('');
    sections.push('_' + dateStr + '_');

    const container = buildTextOnlyContainer(sections.join('\n'), 0x5865F2);
    await interaction.editReply({
      components: container.components as any,
      flags: container.flags | MessageFlags.Ephemeral,
    });
  } catch (error) {
    const err = buildErrorContainer(`Lỗi khi lấy dữ liệu: ${(error as Error).message}`);
    await interaction.editReply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
