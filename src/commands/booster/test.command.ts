import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  GuildMember,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService } from '../../services/settings.service.js';
import { buildErrorContainer } from '../../utils/container.utils.js';

/**
 * Command structure: export `data` (SlashCommandBuilder) và `execute`.
 *
 * /test-booster — test hiển thị booster Container V2.
 * Gửi container vào channel đã cấu hình, hoặc reply ephemeral nếu chưa set channel.
 */
export const data = new SlashCommandBuilder()
  .setName('test-booster')
  .setDescription('Test hiển thị tin nhắn booster Container V2.');

/**
 * Execute the /test-booster command: hiển thị booster Container V2 test.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
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
    const booster = settingsService.getBooster(interaction.guild.id);

    // Build booster Container V2 từ settings
    const boosterContainer = settingsService.buildBoosterContainer(interaction.guild.id, {
      member: commandingMember,
      guild: interaction.guild,
    });

    // Nếu có config channel và channel tồn tại, gửi Container vào đó
    if (booster.channelId) {
      const channel = interaction.guild.channels.cache.get(booster.channelId);
      if (channel && channel.isTextBased()) {
        await channel.send({
          components: boosterContainer.toJSON(),
          flags: boosterContainer.flags,
          files: boosterContainer.files,
        });
        await interaction.reply({
          content: `✅ Tin nhắn booster Container V2 test đã được gửi vào ${channel}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // Fallback: reply trực tiếp cho người gọi dưới dạng Container V2
    await interaction.reply({
      components: boosterContainer.toJSON(),
      // WHY: Combine IsComponentsV2 + Ephemeral flags
      flags: boosterContainer.flags | MessageFlags.Ephemeral,
      files: boosterContainer.files,
    });
  } catch (error) {
    console.error('Error in /test-booster:', error);
    const errorContainer = buildErrorContainer(
      'Xảy ra lỗi khi test booster. Kiểm tra console logs.',
    );
    await interaction.reply({
      components: errorContainer.toJSON(),
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
  }
}
