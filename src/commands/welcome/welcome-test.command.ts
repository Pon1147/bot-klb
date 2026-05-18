import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { buildErrorEmbed } from '../../utils/embed.utils.js';

/**
 * Command structure: phải export `data` (SlashCommandBuilder) và `execute`.
 */
export const data = new SlashCommandBuilder()
  .setName('test-welcome')
  .setDescription('Test hiển thị tin nhắn welcome cho một thành viên.')
  .addUserOption((option) =>
    option
      .setName('member')
      .setDescription('Thành viên để test welcome (mặc định là người gọi lệnh).')
      .setRequired(false),
  );

/**
 * Execute the /test-welcome command: hiển thị welcome embed test.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  // Guard clause: chỉ dùng trong guild
  if (!interaction.guild) {
    await interaction.reply({
      content: 'Lệnh này chỉ có thể dùng trong server.',
      ephemeral: true,
    });
    return;
  }

  // Guard clause: check Administrator permission
  const commandingMember = interaction.member as GuildMember;
  if (!commandingMember || !commandingMember.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Bạn cần quyền Administrator để sử dụng lệnh này.',
      ephemeral: true,
    });
    return;
  }

  try {
    const settingsService = getSettingsService();
    const welcome = settingsService.getWelcome(interaction.guild.id);

    // Lấy member được chỉ định, hoặc dùng người gọi lệnh
    const resolvedMember = interaction.options.getMember('member');
    const targetMember =
      (resolvedMember instanceof GuildMember ? resolvedMember : null) || commandingMember;
    if (!targetMember) {
      await interaction.reply({
        embeds: [buildErrorEmbed('Không thể lấy thông tin thành viên.')],
        ephemeral: true,
      });
      return;
    }

    // Build welcome embed từ settings
    const welcomeEmbed = settingsService.buildWelcomeEmbed(interaction.guild.id, {
      member: targetMember,
      guild: interaction.guild,
    });

    // Nếu có config channel và channel tồn tại, gửi tin nhắn vào đó
    if (welcome.channelId) {
      const channel = interaction.guild.channels.cache.get(welcome.channelId);
      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [welcomeEmbed] });
        await interaction.reply({
          content: `✅ Tin nhắn welcome test đã được gửi vào ${channel}.`,
          ephemeral: true,
        });
        return;
      }
    }

    // Fallback: reply trực tiếp cho người gọi
    await interaction.reply({
      content: '⚠️ Không tìm thấy channel welcome. Hiển thị trực tiếp:',
      embeds: [welcomeEmbed],
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error in /test-welcome:', error);
    await interaction.reply({
      embeds: [buildErrorEmbed('Xảy ra lỗi khi test welcome. Kiểm tra console logs.')],
      ephemeral: true,
    });
  }
}
