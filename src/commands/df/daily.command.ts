import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer, makeResult } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { getDailyReport } from '../../services/deltaforce.api.js';
import { requireGuild } from '../../utils/df-guards.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { getDfToken, touchDfToken } from '../../database/df.token.db.js';
import type { DfBattlefieldBattle } from '../../types/deltaforce.types.js';

export const data = new SlashCommandBuilder()
  .setName('df-daily')
  .setDescription('Trang thai chien dau hang ngay Delta Force.');

function formatOperations(battle: DfBattlefieldBattle | null): string {
  if (!battle) return '  _Chua co du lieu (chua choi tran nao hom nay)_';

  const lines: string[] = [];
  lines.push(`- **Thưởng**: ${Number(battle.revenue).toLocaleString('vi-VN')}`);
  lines.push(`- **Số Đặc Vụ Hạ Gục**: ${battle.kill_count}`);
  lines.push(`- **Số Trận Đấu**: ${battle.match_count}`);
  lines.push(`- **K/D**: ${battle.kd_ratio}`);
  lines.push(`- **Tỉ Lệ Rút Quân**: ${battle.retreat_rate}%`);
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
  if (await requireGuild(interaction)) return;

  const linkedToken = getDfToken(database, interaction.user.id);
  if (!linkedToken) {
    const err = buildErrorContainer('Bạn chưa liên kết tài khoản. Dùng `/df-link start` hoặc `/df-link manual` để bắt đầu.');
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const apiToken = buildDfApiToken(linkedToken);
    const battleReport = await getDailyReport(apiToken).catch((e) => {
      console.warn('[df-daily] API fail:', (e as Error).message);
      return null;
    });

    const battle: DfBattlefieldBattle | null =
      battleReport?.battlefield_battle ?? battleReport?.beacon_battle ?? null;

    touchDfToken(database, interaction.user.id);

    const now = new Date();
    const dateStr =
      now.toLocaleDateString('vi-VN') +
      ' ' +
      now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const battleText = formatOperations(battle);
    const container = buildBattleContainer(battleText, dateStr);

    await interaction.editReply({
      components: container.toJSON(),
      flags: container.flags | MessageFlags.Ephemeral,
    });
  } catch (error) {
    const err = buildErrorContainer(`Loi khi lay du lieu: ${(error as Error).message}`);
    await interaction.editReply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
