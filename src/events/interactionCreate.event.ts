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
import { botConfig } from '../config/bot.config.js';
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
    // DF Link: reveal webhook URL (ephemeral, auto-delete 5s)
    if (interaction.customId === 'df-link:reveal-webhook') {
      if (!botConfig.dfWebhookUrl) {
        await interaction.reply({
          content: 'Webhook URL chưa được cấu hình.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const msg = await interaction.reply({
        content: `Webhook URL (copy nhanh — tự xóa sau 5s):\n\`${botConfig.dfWebhookUrl}\``,
        flags: MessageFlags.Ephemeral,
      });
      setTimeout(() => {
        void msg.delete().catch(() => {});
      }, 5000);

      // Gửi DM hướng dẫn paste URL vào extension
      const user = await interaction.client.users.fetch(interaction.user.id);
      const dm = await user.createDM().catch(() => null);
      if (dm) {
        void dm.send({
          content:
            `**Hướng dẫn setup extension:**\n\n` +
            `1. Click icon extension (trên thanh trình duyệt)\n` +
            `2. Paste Webhook URL vào ô **"🔗 Webhook URL"**\n` +
            `3. Click **"💾 Lưu Webhook URL"**\n` +
            `4. Quay lại tab Link → paste mã claim → Liên kết`,
        });
      }
      return;
    }

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
    if (!interaction.replied && !interaction.deferred) {
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
    const errMessage = error instanceof Error ? error.message : String(error);
    // Suppress 40060 (already acknowledged) — không log noise
    if (
      errMessage.includes('40060') ||
      errMessage.includes('Interaction has already been acknowledged')
    ) {
      return;
    }
    logger.error('Error executing command ' + commandName + ': ' + errMessage);

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: 'An error occurred while executing this command.',
          flags: MessageFlags.Ephemeral,
        });
      } catch {
        // reply có thể fail nếu interaction đã expire
      }
    }
  }
}

export default {
  name: Events.InteractionCreate,
  once: false,
  execute,
};
