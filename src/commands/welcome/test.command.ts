import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  GuildMember,
} from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { buildErrorContainer } from '../../utils/container.utils.js';

/**
 * Command structure: phải export `data` (SlashCommandBuilder) và `execute`.
 *
 * /test-welcome — test hiển thị welcome Container V2 cho một thành viên.
 * Sử dụng buildWelcomeContainer thay vì EmbedBuilder.
 */
export const data = new SlashCommandBuilder()
  .setName('test-welcome')
  .setDescription('Test hiển thị tin nhắn welcome Container V2 cho một thành viên.')
  .addUserOption((option) =>
    option
      .setName('member')
      .setDescription('Thành viên để test welcome (mặc định là người gọi lệnh).')
      .setRequired(false),
  );

/** Resolve the target member from interaction options, falling back to commanding member. */
export function resolveTargetMember(
  interaction: ChatInputCommandInteraction,
  commandingMember: GuildMember,
): GuildMember | null {
  const resolvedMember = interaction.options.getMember('member');
  return (resolvedMember instanceof GuildMember ? resolvedMember : null) || commandingMember;
}

/**
 * Execute the /test-welcome command: hiển thị welcome Container V2 test.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  // Guard clause: chỉ dùng trong guild
  if (!interaction.guild) {
    await interaction.reply({
      content: 'Lệnh này chỉ có thể dùng trong server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Guard clause: check Administrator permission
  const commandingMember = interaction.member as GuildMember;
  if (!commandingMember || !commandingMember.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Bạn cần quyền Administrator để sử dụng lệnh này.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const settingsService = getSettingsService();
    const welcome = settingsService.getWelcome(interaction.guild.id);

    const targetMember = resolveTargetMember(interaction, commandingMember);
    if (!targetMember) {
      const errorContainer = buildErrorContainer('Không thể lấy thông tin thành viên.');
      await interaction.reply({
        components: errorContainer.toJSON(),
        // WHY: Combine IsComponentsV2 + Ephemeral flags thay vì dùng ephemeral: true (deprecated)
        flags: errorContainer.flags | MessageFlags.Ephemeral,
      });
      return;
    }

    // Build welcome Container V2 từ settings
    const welcomeContainer = settingsService.buildWelcomeContainer(interaction.guild.id, {
      member: targetMember,
      guild: interaction.guild,
    });

    // Nếu có config channel và channel tồn tại, gửi Container vào đó
    if (welcome.channelId) {
      const channel = interaction.guild.channels.cache.get(welcome.channelId);
      if (channel && channel.isTextBased()) {
        await channel.send({
          components: welcomeContainer.toJSON(),
          flags: welcomeContainer.flags,
          files: welcomeContainer.files,
        });
        await interaction.reply({
          content: `✅ Tin nhắn welcome Container V2 test đã được gửi vào ${channel}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // Fallback: reply trực tiếp cho người gọi dưới dạng Container V2
    await interaction.reply({
      components: welcomeContainer.toJSON(),
      // WHY: Combine IsComponentsV2 + Ephemeral flags
      flags: welcomeContainer.flags | MessageFlags.Ephemeral,
      files: welcomeContainer.files,
    });
  } catch (error) {
    console.error('Error in /test-welcome:', error);
    const errorContainer = buildErrorContainer('Xảy ra lỗi khi test welcome. Kiểm tra console logs.');
    await interaction.reply({
      components: errorContainer.toJSON(),
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
  }
}