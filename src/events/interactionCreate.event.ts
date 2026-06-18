import { Client, Events, MessageFlags } from 'discord.js';
import {
  handleEditorButtonInteraction as handleContainerEditorButtonInteraction,
  handleEditorModalSubmit as handleContainerEditorModalSubmit,
} from '../commands/container/container-routers.js';
import { handleTeamFindInteraction } from '../commands/df/team-find.interaction.js';

export async function execute(
  client: Client,
  interaction: any,
): Promise<void> {
  // ── 1. Button Interactions ──
  if (interaction.isButton()) {
    // Container editor buttons
    if (interaction.customId.startsWith('container_')) {
      try {
        await handleContainerEditorButtonInteraction(interaction);
      } catch (error) {
        console.error('Error in container editor button handler:', error);
      }
      return;
    }

    // Team find buttons (map/mode/done) — interaction handler returns true/false
    if (interaction.customId.startsWith('team-find-')) {
      try {
        if (await handleTeamFindInteraction(interaction)) return;
        // fallthrough to join button below
      } catch (error) {
        console.error('Error in team-find button handler:', error);
        return;
      }
    }

    // Team find join button
    if (interaction.customId.startsWith('team-find-join:')) {
      try {
        const channelId = interaction.customId.split(':')[1];
        const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);

        if (!channel || channel.type !== 2) {
          await interaction.reply({ content: 'Phòng thoại không còn tồn tại.', flags: MessageFlags.Ephemeral });
          return;
        }

        const memberVoice = (interaction.member as any).voice;
        if (memberVoice?.channel?.id === channelId) {
          await interaction.reply({ content: 'Bạn đã đang trong phòng này.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (channel.full) {
          await interaction.reply({ content: 'Phòng thoại đã đầy (99 người).', flags: MessageFlags.Ephemeral });
          return;
        }

        const botPerms = channel.permissionsFor(interaction.guild!.members.me);
        if (!botPerms?.has(32768)) {
          await interaction.reply({ content: 'Bot không có quyền tham gia phòng thoại này.', flags: MessageFlags.Ephemeral });
          return;
        }

        await channel.join();
        await interaction.reply({ content: 'Đã join phòng thành công!', flags: MessageFlags.Ephemeral });
      } catch (error) {
        console.error('Error in team-find join button handler:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Có lỗi xảy ra khi tham gia phòng thoại.', flags: MessageFlags.Ephemeral });
        }
      }
      return;
    }

    return;
  }

  // ── 1b. String Select Menu Interactions ──
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('team-find-rank:')) {
      try {
        await handleTeamFindInteraction(interaction);
      } catch (error) {
        console.error('Error in team-find select handler:', error);
      }
      return;
    }
    return;
  }

  // ── 2. Modal Submissions ──
  if (interaction.isModalSubmit()) {
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

  // ── 3. Slash Commands ──
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const commands = (client as any).commands;
  if (!commands) {
    console.warn('Commands collection not found on client.');
    return;
  }

  const commandName = interaction.commandName;
  const commandModule = commands.get(commandName);

  if (!commandModule) {
    console.warn(`Command not found: ${commandName}`);
    return;
  }

  const database = (client as any).database;
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
