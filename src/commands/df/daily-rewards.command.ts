import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { getDfToken, touchDfToken } from '../../database/df.token.db.js';
import { getDailyReport } from '../../services/deltaforce.api.js';
import { fetchDailyCodes, DailyCodes } from '../../services/deltaforce.scraper.js';
import type { DfBattlefieldBattle } from '../../types/deltaforce.types.js';

export const data = new SlashCommandBuilder()
  .setName('df-daily-rewards')
  .setDescription('Mật khẩu và thưởng chiến đấu hàng ngày.');

const MAP_DISPLAY: Record<keyof DailyCodes, string> = {
  'Đập Nước Zero': 'Zero Dam',
  'Thung lũng Layali': 'Layali',
  'Phố Cổ Brakkesh': 'Brakkesh',
  'Trạm Không Gian': 'Space City',
  'Ngục Giam Thủy Triều': 'Tide Prison',
};

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

/** Build a clean text-only container for daily codes + battle stats */
function buildDailyContainer(codes: DailyCodes | null, hasCodes: boolean, battleText: string, dateStr: string): {
  components: unknown[];
  flags: number;
} {
  const parts: string[] = [];

  if (hasCodes && codes) {
    parts.push('## Mật Khẩu Hàng Ngày');
    parts.push('');
    const maps = Object.entries(MAP_DISPLAY) as [keyof DailyCodes, string][];
    for (let i = 0; i < maps.length; i++) {
      const [fullName, shortName] = maps[i];
      const code = codes[fullName] || 'Chưa có';
      if (i > 0) parts.push('');
      parts.push(`**${shortName}**`);
      parts.push('```diff');
      parts.push(`+ ${code}`);
      parts.push('```');
    }
  }

  parts.push('');
  parts.push('## Trạng Thái Chiến Đấu Hiện Tại');
  parts.push('');
  parts.push(battleText);
  parts.push('');
  parts.push(`_${dateStr}_`);

  const inner: unknown[] = [
    { type: ComponentType.TextDisplay, content: parts.join('\n') },
    { type: ComponentType.Separator, accentColor: 0x5865F2 },
  ];

  return {
    components: [{ type: ComponentType.Container, components: inner }],
    flags: MessageFlags.IsComponentsV2,
  };
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
        ? getDailyReport({
            openid: linkedToken.openid,
            token: linkedToken.token,
            ts: linkedToken.ts ?? undefined,
            s: linkedToken.s ?? undefined,
            u: linkedToken.u ?? undefined,
          }).catch((e) => {
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
    let hasCodes = false;
    if (codes) {
      hasCodes = Object.values(codes).some((v) => v !== null);
    }

    const battleText = linkedToken ? formatOperations(battle) : '_Dùng `/df-link link` để xem dữ liệu của bạn_';

    const container = buildDailyContainer(codes, hasCodes, battleText, dateStr);
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
