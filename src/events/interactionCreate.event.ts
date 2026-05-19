import { Client, Events } from 'discord.js';
import {
  handleEditorButtonInteraction,
  handleEditorModalSubmit,
} from '../commands/embed/embed.interactive.edit.js';

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
  // ── 1. Xử lý Button Interactions (embed editor) ──
  if (interaction.isButton()) {
    // Chỉ xử lý buttons thuộc embed editor (customId bắt đầu bằng 'embed_')
    if (interaction.customId.startsWith('embed_')) {
      try {
        await handleEditorButtonInteraction(interaction);
      } catch (error) {
        console.error('Error in embed editor button handler:', error);
      }
    }
    return;
  }

  // ── 2. Xử lý Modal Submissions (embed editor) ──
  if (interaction.isModalSubmit()) {
    // Chỉ xử lý modals thuộc embed editor (customId bắt đầu bằng 'modal_')
    if (interaction.customId.startsWith('modal_')) {
      try {
        await handleEditorModalSubmit(interaction);
      } catch (error) {
        console.error('Error in embed editor modal handler:', error);
      }
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
        ephemeral: true,
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
        ephemeral: true,
      });
    }
  }
}

export default {
  name: Events.InteractionCreate,
  once: false,
  execute,
};