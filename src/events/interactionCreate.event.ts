import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Events,
  GuildMember,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { ContainerIds, ContainerModalPrefix } from '../commands/container/container-ids.js';
import { TeamFindIds } from '../commands/df/team-find-ids.js';
import { handleTeamFindButton, handleTeamFindSelect } from '../commands/df/team-find.handlers.js';

const logger = createLogger('InteractionCreate');
import { COMMAND_PERMISSIONS, hasRequiredRole } from '../config/permissions.js';
import {
  handleEditorButtonInteraction as handleContainerEditorButtonInteraction,
  handleEditorModalSubmit as handleContainerEditorModalSubmit,
} from '../commands/container/container-routers.js';

export async function execute(
  client: Client,
  interaction:
    | ButtonInteraction
    | StringSelectMenuInteraction
    | ChatInputCommandInteraction
    | ModalSubmitInteraction,
): Promise<void> {
  // ── 1. Button Interactions ──
  if (interaction.isButton()) {
    // Container editor buttons
    if (interaction.customId.startsWith(ContainerIds.PREFIX)) {
      try {
        await handleContainerEditorButtonInteraction(interaction);
      } catch (error) {
        logger.error(
          'Error in container editor button handler: ' +
            (error instanceof Error ? error.message : String(error)),
        );
      }
      return;
    }

    // Team-find buttons (map/mode/done/join)
    if ((await handleTeamFindButton(interaction)).handled) return;

    return;
  }

  // ── 1b. String Select Menu Interactions ──
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith(TeamFindIds.RANK)) {
      await handleTeamFindSelect(interaction);
    }
    return;
  }

  // ── 2. Modal Submissions ──
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith(ContainerModalPrefix)) {
      try {
        await handleContainerEditorModalSubmit(interaction);
      } catch (error) {
        logger.error(
          'Error in container editor modal handler: ' +
            (error instanceof Error ? error.message : String(error)),
        );
      }
      return;
    }
    return;
  }

  // ── 3. Slash Commands ──
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const commands = client.commands;
  if (!commands) {
    logger.warn('Commands collection not found on client.');
    return;
  }

  const commandName = interaction.commandName;
  const commandModule = commands.get(commandName);

  if (!commandModule) {
    logger.warn('Command not found: ' + commandName);
    return;
  }

  // ── RBAC Guard: kiểm tra quyền trước khi execute ──
  const commandPerm = COMMAND_PERMISSIONS[commandName];
  if (commandPerm && commandPerm.requiredRoles.length > 0) {
    const member = interaction.member;
    if (member instanceof GuildMember) {
      const userRoleIds = member.roles.cache.map((r) => r.id);
      const hasPermission = hasRequiredRole(userRoleIds, commandPerm.requiredRoles);
      if (!hasPermission) {
        await interaction.reply({
          content: '🔒 Lệnh này yêu cầu role: ' + commandPerm.requiredRoles.join(', '),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }
  }

  const database = client.database;
  if (!database) {
    logger.error('Database not attached to client. Cannot execute command.');
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
    logger.error(
      'Error executing command ' +
        commandName +
        ': ' +
        (error instanceof Error ? error.message : String(error)),
    );

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
