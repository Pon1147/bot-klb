import { Client, Events } from 'discord.js';

/**
 * Handle interactionCreate event: xử lý slash commands.
 * Chỉ xử lý ChatInputCommand, các loại interaction khác bị bỏ qua.
 *
 * Arg đầu tiên luôn là `client` (được bind từ event handler).
 */
export async function execute(
  client: Client,
  interaction: any,
): Promise<void> {
  // Guard clause: chỉ xử lý slash commands
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