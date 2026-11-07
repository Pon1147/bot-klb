import { ChatInputCommandInteraction, ComponentType, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { makeResult } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { getDailyReport } from '../../services/deltaforce.api.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import { formatVietnamDateTime, formatCoin } from '../../utils/df-format.utils.js';
import { createLogger } from '../../utils/logger.js';
import type { DfBattlefieldBattle } from '../../types/deltaforce.types.js';

const logger = createLogger('DfDaily');

function formatOperations(battle: DfBattlefieldBattle | null): string {
  if (!battle) return '  _Chưa có dữ liệu (chưa chơi trận nào hôm nay)_';

  const lines: string[] = [];
  lines.push(`- **Thưởng**: ${formatCoin(battle.revenue, false)}`);
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
  await runDfCommand({ userId: interaction.user.id, database, interaction }, async (apiToken) => {
    const battleReport = await getDailyReport(apiToken).catch((e) => {
      logger.warn('API fail: ' + (e instanceof Error ? e.message : String(e)));
      return null;
    });

    const battle: DfBattlefieldBattle | null =
      battleReport?.battlefield_battle ?? battleReport?.beacon_battle ?? null;

    const dateStr = formatVietnamDateTime(new Date());

    const battleText = formatOperations(battle);
    const container = buildBattleContainer(battleText, dateStr);

    return {
      components: container.toJSON(),
      flags: container.flags,
    };
  });
}
