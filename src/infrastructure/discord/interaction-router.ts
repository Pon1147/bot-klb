import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { createLogger } from '../../utils/logger.js';
import { botConfig } from '../../config/bot.config.js';
import {
  ContainerIds,
  ContainerModalPrefix,
  handleEditorButtonInteraction as handleContainerEditorButtonInteraction,
  handleEditorModalSubmit as handleContainerEditorModalSubmit,
} from '../../features/container/index.js';
import { TeamFindIds } from '../../commands/df/team-find-ids.js';
import {
  handleTeamFindButton,
  handleTeamFindSelect,
} from '../../commands/df/team-find.handlers.js';
import { handleDfStatsSelect } from '../../events/dfStatsSelect.handler.js';
import { COMMAND_PERMISSIONS, hasRequiredRole, ROLE_IDS } from '../../config/permissions.js';

const logger = createLogger('InteractionRouter');

// Track users đã click button reveal webhook URL — chống spam
const webhookRevealedUsers = new Set<string>();

/**
 * Handle button interactions by delegating to specific button handlers.
 */
async function handleButton(interaction: ButtonInteraction): Promise<void> {
  // DF Link: reveal webhook URL (ephemeral, chỉ 1 lần/user)
  if (interaction.customId === 'df_link_show_webhook') {
    // Guard: chống spam — user chỉ reveal 1 lần
    if (webhookRevealedUsers.has(interaction.user.id)) {
      await interaction
        .reply({
          content: 'Bạn đã hiện Webhook URL rồi.',
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
      return;
    }

    if (!botConfig.dfWebhookUrl) {
      await interaction
        .reply({
          content: 'Webhook URL chưa được cấu hình.',
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
      return;
    }

    // Đánh dấu ngay — trước khi reply để chống race condition
    webhookRevealedUsers.add(interaction.user.id);

    try {
      await interaction.reply({
        content: [
          '**Webhook URL** (copy ngay — tự xóa sau 5 giây):',
          '```',
          botConfig.dfWebhookUrl,
          '```',
        ].join('\n'),
        flags: MessageFlags.Ephemeral,
      });

      // Disable button trên message gốc (backup)
      const disabledBtn = new ButtonBuilder()
        .setCustomId('df_link_show_webhook')
        .setLabel('Đã hiện URL')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
      const row = new ActionRowBuilder().addComponents(disabledBtn);
      try {
        await interaction.update({
          content: interaction.message.content,
          components: [row.toJSON()],
        });
      } catch {
        // button đã expire hoặc đã disable
      }

      // Tự xóa ephemeral sau 5 giây
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch {
          // message đã bị xóa hoặc hết hạn
        }
      }, 5000);
    } catch {
      // interaction đã expire (10062) — bỏ qua
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
}

/**
 * Handle string select menu interactions.
 */
async function handleStringSelectMenu(
  client: Client,
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (interaction.customId.startsWith(TeamFindIds.RANK)) {
    await handleTeamFindSelect(interaction);
  }
  if ((await handleDfStatsSelect(interaction, client.database)).handled) return;
}

/**
 * Handle modal submit interactions.
 */
async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
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
}

/**
 * Handle slash commands (ChatInputCommandInteraction) with RBAC and error handling.
 */
async function handleChatInputCommand(
  client: Client,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
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
        // Owner/Moderator bypass — toàn quyền mọi command
        const adminRoleIds = ['Owner', 'Moderator'].map((r) => ROLE_IDS[r]).filter(Boolean);
        if (userRoleIds.some((id) => adminRoleIds.includes(id))) {
          // admin bypass — cho chạy luôn
        } else {
          // requiredRoles trong JSON là tên role → resolve thành role IDs
          const requiredRoleIds = commandPerm.requiredRoles
            .map((roleName) => ROLE_IDS[roleName] ?? null)
            .filter((v): v is string => v !== null);
          const hasPermission = hasRequiredRole(userRoleIds, requiredRoleIds);
          if (!hasPermission) {
            logger.warn(
              `RBAC denied: user=${interaction.user.id} cmd=${commandName} required=${commandPerm.requiredRoles.join(',')}`,
            );
            await interaction.reply({
              content: '🔒 Lệnh này yêu cầu role: ' + commandPerm.requiredRoles.join(', '),
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }
      }
    }
  }

  const database = client.database;
  if (!database) {
    logger.error('Database not attached to client. Cannot execute command.');
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Cơ sở dữ liệu không khả dụng. Vui lòng liên hệ quản trị viên.',
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  try {
    await commandModule.execute(interaction, database);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    // Suppress interaction errors — không log noise
    if (
      errMessage.includes('40060') ||
      errMessage.includes('Interaction has already been acknowledged') ||
      errMessage.includes('10062') ||
      errMessage.includes('Unknown interaction')
    ) {
      return;
    }
    logger.error('Error executing command ' + commandName + ': ' + errMessage);

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: 'Đã xảy ra lỗi khi thực thi lệnh này.',
          flags: MessageFlags.Ephemeral,
        });
      } catch {
        // reply có thể fail nếu interaction đã expire
      }
    }
  }
}

/**
 * Centralized interaction routing.
 * Classifies interaction type and delegates to the appropriate handler.
 */
export async function routeInteraction(
  client: Client,
  interaction:
    | ButtonInteraction
    | StringSelectMenuInteraction
    | ChatInputCommandInteraction
    | ModalSubmitInteraction,
): Promise<void> {
  // ── 1. Button Interactions ──
  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }

  // ── 1b. String Select Menu Interactions ──
  if (interaction.isStringSelectMenu()) {
    await handleStringSelectMenu(client, interaction);
    return;
  }

  // ── 2. Modal Submissions ──
  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
    return;
  }

  // ── 3. Slash Commands ──
  if (interaction.isChatInputCommand()) {
    await handleChatInputCommand(client, interaction);
    return;
  }
}
