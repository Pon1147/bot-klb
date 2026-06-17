import { Client, Events, MessageFlags } from 'discord.js';
import {
  handleEditorButtonInteraction as handleContainerEditorButtonInteraction,
  handleEditorModalSubmit as handleContainerEditorModalSubmit,
} from '../commands/container/container-routers.js';

/**
 * Handle interactionCreate event: xử lý slash commands, button interactions, modal submissions.
 *
 * WHY: Tập trung tất cả interaction routing ở 1 nơi để dễ bảo trì.
 * Mỗi loại interaction được phân phối đến handler tương ứng.
 */
export async function execute(
  client: Client,
  interaction: any,
): Promise<void> {
  // ── 1. Xử lý Button Interactions ──
  if (interaction.isButton()) {
    // Container editor buttons (customId bắt đầu bằng 'container_')
    if (interaction.customId.startsWith('container_')) {
      try {
        await handleContainerEditorButtonInteraction(interaction);
      } catch (error) {
        console.error('Error in container editor button handler:', error);
      }
      return;
    }

    // Team find join button (customId: team-find-join:{channelId})
    if (interaction.customId.startsWith('team-find-join:')) {
      try {
        const channelId = interaction.customId.split(':')[1];
        const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);

        if (!channel || channel.type !== 2) {
          await interaction.reply({
            content: 'Phòng thoại không còn tồn tại.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Check if user is already in the channel
        const memberVoice = (interaction.member as any).voice;
        if (memberVoice?.channel?.id === channelId) {
          await interaction.reply({
            content: 'Bạn đã đang trong phòng này.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Check if channel is full
        if (channel.full) {
          await interaction.reply({
            content: 'Phòng thoại đã đầy (99 người).',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Check bot permissions
        const botPerms = channel.permissionsFor(interaction.guild!.members.me);
        if (!botPerms?.has(32768)) { // VoiceConnect = 1 << 15
          await interaction.reply({
            content: 'Bot không có quyền tham gia phòng thoại này.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Join the voice channel
        await channel.join();
        await interaction.reply({
          content: 'Đã join phòng thành công!',
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error('Error in team-find join button handler:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Có lỗi xảy ra khi tham gia phòng thoại.',
            flags: MessageFlags.Ephemeral,
          });
        }
      }
      return;
    }

    return;
  }

  // ── 2. Xử lý Modal Submissions ──
  if (interaction.isModalSubmit()) {
    // Container editor modals (customId bắt đầu bằng 'container_modal_')
    if (interaction.customId.startsWith('container_modal_')) {
      try {
        await handleContainerEditorModalSubmit(interaction);
      } catch (error) {
        console.error('Error in container editor modal handler:', error);
      }
      return;
    }
    return;
  }

  // ── 3. Xử lý Slash Commands ──
  if (!interaction.isChatInputCommand()) {
    return;
  }

  // Lấy collection commands từ client
  const commands = (client as any).commands;

  // Guard clause: commands chưa được load
  if (!commands) {
    console.warn('Commands collection not found on client.');
    return;
  }

  const commandName = interaction.commandName;
  const commandModule = commands.get(commandName);

  // Guard clause: command không tồn tại
  if (!commandModule) {
    console.warn(`Command not found: ${commandName}`);
    return;
  }

  // Retrieve database from client (attached during bootstrap in index.ts)
  const database = (client as any).database;

  // Guard clause: database chưa được khởi tạo
  if (!database) {
    console.error('Database not attached to client. Cannot execute command.');
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Database is not available. Please contact an administrator.',
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  try {
    await commandModule.execute(interaction, database);
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);

    // Reply lỗi nếu interaction chưa được phản hồi
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while executing this command.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

export default {
  name: Events.InteractionCreate,
  once: false,
  execute,
};