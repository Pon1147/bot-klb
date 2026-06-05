import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer, buildTextOnlyContainer } from '../../utils/container.utils.js';
import { getDfToken, touchDfToken } from '../../database/df.token.db.js';
import { getMatchList } from '../../services/deltaforce.api.js';

const MAP_NAMES: Record<number, string> = {
  2201: 'Haven',
  2202: 'Border',
  2203: 'Bank',
  2204: 'Fortress',
  2205: 'Tomb',
  2206: 'Substation',
  2207: 'Goldshore',
  2208: 'Ridge',
};

const MAX_MATCHES = 10;

export const data = new SlashCommandBuilder()
  .setName('df-matches')
  .setDescription('Xem lịch sử trận đấu Delta Force.')
  .addIntegerOption((opt) =>
    opt.setName('limit').setDescription('Số trận hiển thị (1-20)').setMinValue(1).setMaxValue(20),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const token = getDfToken(database, interaction.user.id);
  if (!token) {
    const err = buildErrorContainer('Bạn chưa liên kết tài khoản. Dùng `/df-link link` để bắt đầu.');
    await interaction.reply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const apiToken = { openid: token.openid, token: token.token };
    const matchData = await getMatchList(apiToken);
    touchDfToken(database, interaction.user.id);

    const limit = Math.min(interaction.options.getInteger('limit') || MAX_MATCHES, 20);
    const matches = matchData.list.slice(0, limit);

    if (!matches.length) {
      const err = buildErrorContainer('Không có trận đấu nào trong lịch sử.');
      await interaction.editReply({
        components: err.components as any,
        flags: err.flags | MessageFlags.Ephemeral,
      });
      return;
    }

    const lines = [`## ​`, `### 🎮 Lịch sử trận đấu (${matches.length}/${matchData.list.length})`, ``];

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const time = new Date(Number(m.match_time) * 1000).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const map = MAP_NAMES[m.map_id] || `Map ${m.map_id}`;
      const result = m.result === 1 ? '✅ Win' : '❌ Defeat';
      const extract = Number(m.carry_out_value).toLocaleString('vi-VN');

      lines.push(
        `**#${matches.length - i}** ${result} • ${map}`,
        `⏱ ${time} • 🔫 ${m.kill_count} kills • 💎 ${extract}`,
        ``,
      );
    }

    const container = buildTextOnlyContainer(lines.join('\n'), 0x5865F2);
    await interaction.editReply({
      components: container.components as any,
      flags: container.flags | MessageFlags.Ephemeral,
    });
  } catch (error) {
    const err = buildErrorContainer(
      `Lỗi khi lấy dữ liệu: ${(error as Error).message}\nNếu lỗi tiếp tục, hãy unlink và link lại tài khoản.`,
    );
    await interaction.editReply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
