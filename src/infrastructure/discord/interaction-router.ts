import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { createLogger } from '../../utils/logger.js';
import { botConfig } from '../../config/bot.config.js';
import { getSettingsService } from '../../services/settings.service.js';
import {
  ContainerIds,
  ContainerModalPrefix,
  handleEditorButtonInteraction as handleContainerEditorButtonInteraction,
  handleEditorModalSubmit as handleContainerEditorModalSubmit,
} from '../../features/container/index.js';
import {
  TeamFindIds,
  handleTeamFindButton,
  handleTeamFindSelect,
  handleDfStatsSelect,
  handleHelpButton,
} from '../../features/delta-force/index.js';
import {
  SELLER_QR_IDS,
  SELLER_PAY_IDS,
  handleSelectBankButton,
  handleEditInfoButton,
  handleDeleteQrButton,
  handleBankSelectMenu,
  handleSellerInfoModalSubmit,
  handlePaymentConfirmButton,
  handlePaymentConfirmModalSubmit,
  handlePaymentCancelButton,
  handlePaymentCancelModalSubmit,
  handleRateStarButton,
  handleRateModalSubmit,
} from '../../features/seller/index.js';
import { hasPolicy, resolveCommandPolicy } from '../../config/permissions.js';
import { getCommandPath } from '../../utils/command-path.utils.js';
import { TTLStore, ExpiryEntry } from '../../utils/ttl-store.js';
import { isIgnorableInteractionError } from '../../utils/discord-error.utils.js';

const logger = createLogger('InteractionRouter');

export interface WebhookRevealEntry extends ExpiryEntry {
  revealed: true;
}

// Track users đã click button reveal webhook URL — chống spam (TTL 60s)
export const webhookRevealedUsers = new TTLStore<string, WebhookRevealEntry>({
  ttlMs: 60_000,
  cleanupIntervalMs: 300_000,
  name: 'WebhookRevealDebounce',
});

/**
 * Handle button interactions by delegating to specific button handlers.
 */
async function handleButton(interaction: ButtonInteraction): Promise<void> {
  // DF Link: reveal webhook URL (ephemeral, chỉ 1 lần/user trong 60s)
  if (interaction.customId === 'df_link_show_webhook') {
    // Guard: chống spam — debounce 60s mỗi user
    if (webhookRevealedUsers.get(interaction.user.id)) {
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

    // Đánh dấu ngay với TTL 60s — trước khi reply để chống race condition
    webhookRevealedUsers.set(interaction.user.id, {
      expiresAt: Date.now() + 60_000,
      revealed: true,
    });

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

  // DF Help tab switch buttons
  if ((await handleHelpButton(interaction)).handled) return;

  // Seller buttons
  if (interaction.customId.startsWith(`${SELLER_QR_IDS.SELECT_BANK}:`)) {
    const targetUserId = interaction.customId.slice(`${SELLER_QR_IDS.SELECT_BANK}:`.length);
    await handleSelectBankButton(interaction, targetUserId);
    return;
  }
  if (interaction.customId.startsWith(`${SELLER_QR_IDS.EDIT_INFO}:`)) {
    const targetUserId = interaction.customId.slice(`${SELLER_QR_IDS.EDIT_INFO}:`.length);
    await handleEditInfoButton(interaction, targetUserId);
    return;
  }
  if (interaction.customId.startsWith(`${SELLER_QR_IDS.DELETE}:`)) {
    const targetUserId = interaction.customId.slice(`${SELLER_QR_IDS.DELETE}:`.length);
    await handleDeleteQrButton(interaction, targetUserId);
    return;
  }
  if (interaction.customId.startsWith(`${SELLER_PAY_IDS.CONFIRM}:`)) {
    const txId = interaction.customId.slice(`${SELLER_PAY_IDS.CONFIRM}:`.length);
    await handlePaymentConfirmButton(interaction, txId);
    return;
  }
  if (interaction.customId.startsWith(`${SELLER_PAY_IDS.CANCEL}:`)) {
    const txId = interaction.customId.slice(`${SELLER_PAY_IDS.CANCEL}:`.length);
    await handlePaymentCancelButton(interaction, txId);
    return;
  }
  if (interaction.customId.startsWith(`${SELLER_PAY_IDS.RATE_STAR}:`)) {
    const parts = interaction.customId.split(':');
    const rating = Number(parts[1]);
    const txId = parts[2];
    await handleRateStarButton(interaction, rating, txId);
    return;
  }
}

/**
 * Handle string select menu interactions.
 */
async function handleStringSelectMenu(
  client: Client,
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (interaction.customId.startsWith(`${SELLER_QR_IDS.SELECT_BANK}_menu:`)) {
    const targetUserId = interaction.customId.slice(`${SELLER_QR_IDS.SELECT_BANK}_menu:`.length);
    await handleBankSelectMenu(interaction, targetUserId);
    return;
  }
  if (interaction.customId.startsWith(TeamFindIds.RANK)) {
    await handleTeamFindSelect(interaction);
  }
  if ((await handleDfStatsSelect(interaction, client.database)).handled) return;
}

/**
 * Handle modal submit interactions.
 */
async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId.startsWith(`${SELLER_QR_IDS.MODAL_INFO}:`)) {
    const parts = interaction.customId.split(':');
    const targetUserId = parts[1];
    const bankCode = parts[2];
    const bankName = parts.slice(3).join(':');
    await handleSellerInfoModalSubmit(interaction, targetUserId, bankCode, bankName);
    return;
  }
  if (interaction.customId.startsWith(`${SELLER_PAY_IDS.CONFIRM_MODAL}:`)) {
    const txId = interaction.customId.slice(`${SELLER_PAY_IDS.CONFIRM_MODAL}:`.length);
    await handlePaymentConfirmModalSubmit(interaction, txId);
    return;
  }
  if (interaction.customId.startsWith(`${SELLER_PAY_IDS.CANCEL_MODAL}:`)) {
    const txId = interaction.customId.slice(`${SELLER_PAY_IDS.CANCEL_MODAL}:`.length);
    await handlePaymentCancelModalSubmit(interaction, txId);
    return;
  }
  if (interaction.customId.startsWith(`${SELLER_PAY_IDS.RATE_MODAL}:`)) {
    const parts = interaction.customId.split(':');
    const rating = Number(parts[1]);
    const txId = parts[2];
    await handleRateModalSubmit(interaction, rating, txId);
    return;
  }

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

  const commandPath = getCommandPath(interaction);
  const commandName = interaction.commandName;
  const commandModule = commands.get(commandName);

  if (!commandModule) {
    logger.warn(`Command not found: ${commandName} (path: ${commandPath})`);
    return;
  }

  logger.info(
    `Dispatching command /${commandPath} (user=${interaction.user.id}, guild=${interaction.guildId ?? 'DM'})`,
  );

  // ── Authorization Guard ──
  const commandPolicy = resolveCommandPolicy(commandPath);

  if (!commandPolicy) {
    logger.error(`Security check failed: unmapped command path "${commandPath}" denied.`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '🔒 Lệnh này chưa được cấu hình phân quyền bảo mật.',
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (!interaction.replied && !interaction.deferred) {
    let guildRbac: {
      botAdminRoleId: string | null;
      ownerRoleId?: string | null;
      moderatorRoleId: string | null;
      memberRoleId: string | null;
    } = {
      botAdminRoleId: null,
      ownerRoleId: null,
      moderatorRoleId: null,
      memberRoleId: null,
    };

    if (interaction.guildId) {
      try {
        const settingsService = getSettingsService();
        const settings = settingsService.get(interaction.guildId);
        if (settings.rbac) {
          guildRbac = settings.rbac;
        }
      } catch {
        // SettingsService chưa khởi tạo (e.g. unit test) -> dùng default rbac
      }
    }

    const policyResult = hasPolicy(interaction, commandPolicy, guildRbac);
    if (!policyResult.allowed) {
      logger.warn(
        `RBAC denied: user=${interaction.user.id} guild=${interaction.guildId} cmd=${commandPath} policy=${commandPolicy} reason=${policyResult.reason ?? 'N/A'}`,
      );
      await interaction.reply({
        content: policyResult.reason ?? '🔒 Bạn không có quyền thực thi lệnh này.',
        flags: MessageFlags.Ephemeral,
      });
      return;
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
    if (isIgnorableInteractionError(error)) {
      return;
    }
    const errMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error executing command ${commandPath}: ${errMessage}`);

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
  try {
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
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      return;
    }
    logger.error('Lỗi khi điều phối interaction:', {
      type: interaction.type,
      customId: 'customId' in interaction ? interaction.customId : undefined,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
