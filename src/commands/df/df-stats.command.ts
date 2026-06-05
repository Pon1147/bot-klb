import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer, buildTextOnlyContainer } from '../../utils/container.utils.js';
import { getDfToken, touchDfToken } from '../../database/df.token.db.js';
import { getMyData } from '../../services/deltaforce.api.js';

export const data = new SlashCommandBuilder()
  .setName('df-stats')
  .setDescription('Xem thống kê tài khoản Delta Force.');

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
    const data = await getMyData(apiToken);
    touchDfToken(database, interaction.user.id);

    const playHours = Math.floor(Number(data.player_info.play_duration));
    const playMinutes = Math.round((Number(data.player_info.play_duration) - playHours) * 60);
    const regDate = new Date(Number(data.player_info.register_time) * 1000).toLocaleDateString('vi-VN');

    const combat = data.summary_data.combat;
    const economy = data.summary_data.economy;
    const team = data.summary_data.team;

    const lines = [
      `## ​`,
      `**${data.player_info.nickname}** • Lv.${data.player_info.level}`,
      `Tham gia: ${regDate} • Chơi: ${playHours}h ${playMinutes}m`,
      ``,
      `### 🏆 Rank`,
      `Hiện tại: **${data.rank_data.current_rank || 'N/A'}** (${data.rank_data.current_rank_score} pts)`,
      `Cao nhất: **${data.rank_data.highest_rank}** (S${data.rank_data.highest_rank_season_id})`,
      ``,
      `### ⚔️ Combat`,
      combat
        ? [
            `Tổng kill: **${combat.kill_operator_count}**`,
            `Hit rate: **${combat.hit_rate}**`,
            `Headshot: **${combat.headshot_kill_rate}**`,
            `KD cao: ${combat.high_kill_death_ratio} • TB: ${combat.med_kill_death_ratio} • Thấp: ${combat.low_kill_death_ratio}`,
          ].join('\n')
        : 'Chưa có dữ liệu combat',
      ``,
      `### 💰 Economy`,
      economy
        ? [
            `Tổng reward: **${Number(economy.total_reward).toLocaleString('vi-VN')}** 💎`,
            `Extract value: **${Number(economy.extract_value).toLocaleString('vi-VN')}**`,
            `Profit/Loss ratio: **${economy.profit_loss_ratio}**`,
            `Mandel Brick: **${economy.total_mandel_brick}** 🧱`,
          ].join('\n')
        : 'Chưa có dữ liệu economy',
      ``,
      `### 👥 Team`,
      team
        ? [
            `Revive đồng đội: **${team.revive_teammate_count}**`,
            `Rescue: **${team.rescue_teammate_count}**`,
            `Retreat rate: **${team.retreat_rate}**`,
            `Team extract: **${Number(team.teammate_extract_value).toLocaleString('vi-VN')}** 💎`,
          ].join('\n')
        : 'Chưa có dữ liệu team',
      ``,
      `Tổng trận: **${data.summary_data.total_match_count}**`,
    ];

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
