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