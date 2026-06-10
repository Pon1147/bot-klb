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
import type { DfBattlefieldBattle } from '../../types/deltaforce.types.js';

export const data = new SlashCommandBuilder()
  .setName('df-daily')
  .setDescription('Trang thai chien dau hang ngay Delta Force.');

function formatOperations(battle: DfBattlefieldBattle | null): string {
  if (!battle) return '  _Chua co du lieu (chua choi tran nao hom nay)_';

  const lines: string[] = [];
  lines.push(`- **Thuong**: ${Number(battle.revenue).toLocaleString('vi-VN')}`);
  lines.push(`- **Dach su ha goc**: ${battle.kill_count}`);
  lines.push(`- **Tran dau**: ${battle.match_count}`);
  lines.push(`- **KD**: ${battle.kd_ratio}`);
  lines.push(`- **Rut quan**: ${battle.retreat_rate}%`);
  return lines.join('\n');
}

function buildBattleContainer(battleText: string, dateStr: string): {
  components: unknown[];
  flags: number;
} {
  const content =
    `## Trang Thai Chien Dau Hien Tai\n\n${battleText}\n\n_${dateStr}_`;

  const inner: unknown[] = [
    { type: ComponentType.TextDisplay, content },
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
    await interaction.reply({ content: 'Chi dung trong server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const linkedToken = getDfToken(database, interaction.user.id);
  if (!linkedToken) {
    const err = buildErrorContainer('Ban chua lien ket tai khoan. Dung `/df-link` de bat dau.');
    await interaction.reply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const battleReport = await getDailyReport({
      openid: linkedToken.openid,
      token: linkedToken.token,
      ts: linkedToken.ts ?? undefined,
      s: linkedToken.s ?? undefined,
      u: linkedToken.u ?? undefined,
    }).catch((e) => {
      console.warn('[df-daily] API fail:', (e as Error).message);
      return null;
    });

    const battle: DfBattlefieldBattle | null =
      battleReport?.battlefield_battle ?? battleReport?.beacon_battle ?? null;

    touchDfToken(database, interaction.user.id);

    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const battleText = formatOperations(battle);
    const container = buildBattleContainer(battleText, dateStr);

    await interaction.editReply({
      components: container.components as any,
      flags: container.flags | MessageFlags.Ephemeral,
    });
  } catch (error) {
    const err = buildErrorContainer(`Loi khi lay du lieu: ${(error as Error).message}`);
    await interaction.editReply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
