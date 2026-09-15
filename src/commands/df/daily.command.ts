import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { makeResult } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { getDailyReport } from '../../services/deltaforce.api.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import { createLogger } from '../../utils/logger.js';
import type { DfBattlefieldBattle } from '../../types/deltaforce.types.js';

const logger = createLogger('DfDaily');

export const data = new SlashCommandBuilder()
  .setName('df-daily')
  .setDescription('Trạng thái chiến đấu hàng ngày Delta Force.');

function formatOperations(battle: DfBattlefieldBattle | null): string {
  if (!battle) return '  _Chưa có dữ liệu (chưa chơi trận nào hôm nay)_';

  const lines: string[] = [];
  lines.push(`- **Thưởng**: ${Number(battle.revenue).toLocaleString('vi-VN')}`);
  lines.push(`- **Số Đặc Vụ Hạ Gục**: ${battle.kill_count}`);
  lines.push(`- **Số Trận Đấu**: ${battle.match_count}`);
  lines.push(`- **K/D**: ${battle.kd_ratio}`);
  lines.push(`- **Tỷ Lệ Rút Quân**: ${battle.retreat_rate}%`);
  return lines.join('\n');
}

function buildBattleContainer(battleText: string, dateStr: string) {
  const content = `## Trạng Thái Chiến Đấu Hiện Tại\n\n${battleText}\n\n_${dateStr}_`;

  const inner: unknown[] = [
    { type: ComponentType.TextDisplay, content },
    { type: ComponentType.Separator, accentColor: COLORS.WELCOME },
  ];

  return makeResult(
    [{ type: ComponentType.Container, components: inner }],
    MessageFlags.IsComponentsV2,
    [],
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await runDfCommand({ userId: interaction.user.id, database, interaction }, async (rawToken) => {
    const apiToken = buildDfApiToken(rawToken);
    const battleReport = await getDailyReport(apiToken).catch((e) => {
      logger.warn('API fail: ' + (e instanceof Error ? e.message : String(e)));
      return null;
    });

    const battle: DfBattlefieldBattle | null =
      battleReport?.battlefield_battle ?? battleReport?.beacon_battle ?? null;

    const now = new Date();
    const dateStr =
      now.toLocaleDateString('vi-VN') +
      ' ' +
      now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const battleText = formatOperations(battle);
    const container = buildBattleContainer(battleText, dateStr);

    return {
      components: container.toJSON(),
      flags: container.flags,
    };
  });
}
