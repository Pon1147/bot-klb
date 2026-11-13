import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { getMatchList } from '../../services/deltaforce.api.js';
import { resolveMapName } from '../../services/df-metadata.service.js';
import { resolveUserDfToken } from '../../utils/df-token.utils.js';
import { formatVietnamDateTime } from '../../utils/df-format.utils.js';
import type { DfMatchEntry } from '../../types/deltaforce.types.js';
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
} from '../../features/team-find/index.js';
import {
  handleDfStatsSelect,
  handleHelpButton,
  handleLinkButton,
  handleMatchSelect,
  MATCH_SELECT_PREFIX,
} from '../../features/delta-force/index.js';
import { handleMarketAutocomplete } from '../../features/delta-force/market.handler.js';
import { handleHelpSelect } from '../../features/delta-force/help.handler.js';
import {
  isPaymentButton,
  isPaymentModal,
  isFeedbackRateButton,
  isFeedbackModal,
  handlePaymentButton,
  handlePaymentModal,
  handleFeedbackRateButton,
  handleFeedbackModal,
} from '../../features/payment/payment-flow.js';
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

  // DF Link buttons (refresh / mobile / safety)
  if ((await handleLinkButton(interaction, interaction.client.database)).handled) return;

  // Payment VietQR Confirm / Cancel buttons
  if (isPaymentButton(interaction.customId)) {
    await handlePaymentButton(interaction);
    return;
  }

  // Payment Feedback Rating buttons (1-5 ⭐)
  if (isFeedbackRateButton(interaction.customId)) {
    await handleFeedbackRateButton(interaction);
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
  if (interaction.customId.startsWith('df_help:select:')) {
    await handleHelpSelect(interaction);
    return;
  }
  if (interaction.customId.startsWith(MATCH_SELECT_PREFIX)) {
    await handleMatchSelect(interaction, client.database);
    return;
  }
  if (interaction.customId.startsWith(TeamFindIds.RANK)) {
    await handleTeamFindSelect(interaction);
    return;
  }
  if ((await handleDfStatsSelect(interaction, client.database)).handled) return;
}

/**
 * Handle modal submit interactions.
 */
async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId.startsWith(ContainerModalPrefix)) {
    await handleContainerEditorModalSubmit(interaction);
    return;
  }

  // Payment Confirm / Cancel modal
  if (isPaymentModal(interaction.customId)) {
    await handlePaymentModal(interaction);
    return;
  }

  // Payment Feedback modal
  if (isFeedbackModal(interaction.customId)) {
    await handleFeedbackModal(interaction);
    return;
  }
}

/**
 * Handle slash commands (ChatInputCommandInteraction) with RBAC and error handling.
 */
/**
 * Phản hồi an toàn khi interaction gặp lỗi:
 * - Nếu interaction đã deferred nhưng chưa reply: dùng editReply()
 * - Nếu chưa reply và chưa deferred: dùng reply({ flags: MessageFlags.Ephemeral })
 * - Nếu đã replied: không gửi thêm để tránh lỗi "Interaction already replied"
 * - Bắt và bỏ qua các lỗi interaction token expired (10062) để không tạo unhandled rejection
 */
export async function sendInteractionErrorFallback(
  interaction:
    | ButtonInteraction
    | StringSelectMenuInteraction
    | ChatInputCommandInteraction
    | ModalSubmitInteraction,
  message = 'Đã xảy ra lỗi khi xử lý tương tác này.',
): Promise<void> {
  try {
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({
        content: message,
      });
    } else if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: message,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (err) {
    if (isIgnorableInteractionError(err)) {
      return;
    }
    logger.warn('Không thể gửi thông báo lỗi fallback cho interaction:', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleChatInputCommand(
  client: Client,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const startMs = Date.now();
  const transitLatency = Math.max(0, startMs - interaction.createdTimestamp);
  const commandPath = getCommandPath(interaction);
  const commandName = interaction.commandName;

  const commands = client.commands;
  if (!commands) {
    logger.warn(`[REQ:${interaction.id}] Commands collection not found on client.`);
    await sendInteractionErrorFallback(interaction, 'Hệ thống lệnh chưa sẵn sàng.');
    return;
  }

  const commandModule = commands.get(commandName);

  if (!commandModule) {
    logger.warn(`[REQ:${interaction.id}] Command not found: ${commandName} (path: ${commandPath})`);
    await sendInteractionErrorFallback(interaction, 'Lệnh này hiện không khả dụng.');
    return;
  }

  logger.info(
    `[REQ:${interaction.id}] START /${commandPath} (transit: ${transitLatency}ms, user=${interaction.user.id}, guild=${interaction.guildId ?? 'DM'})`,
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

    // Bot Owner tối cao có toàn quyền thực thi, bypass kiểm tra RBAC cấp máy chủ
    const isBotOwnerUser = Boolean(
      botConfig.botOwnerId && interaction.user.id === botConfig.botOwnerId,
    );
    if (!isBotOwnerUser) {
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
  }

  const database = client.database;
  if (!database) {
    logger.error('Database not attached to client. Cannot execute command.');
    await sendInteractionErrorFallback(
      interaction,
      'Cơ sở dữ liệu không khả dụng. Vui lòng liên hệ quản trị viên.',
    );
    return;
  }

  try {
    await commandModule.execute(interaction, database);
    logger.debug(`[REQ:${interaction.id}] DONE /${commandPath} trong ${Date.now() - startMs}ms`);
  } catch (error) {
    const elapsed = Date.now() - startMs;
    if (isIgnorableInteractionError(error)) {
      logger.warn(
        `[REQ:${interaction.id}] Interaction expired / acknowledged (10062) sau ${elapsed}ms tại /${commandPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    const errMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `[REQ:${interaction.id}] Error executing command ${commandPath} sau ${elapsed}ms: ${errMessage}`,
    );

    await sendInteractionErrorFallback(interaction, 'Đã xảy ra lỗi khi thực thi lệnh này.');
  }
}

/**
 * Centralized interaction routing.
 * Classifies interaction type and delegates to the appropriate handler.
 */

/**
 * Handle slash command autocomplete interactions (e.g. /df match match_id).
 */
async function handleAutocomplete(
  client: Client,
  interaction: AutocompleteInteraction,
): Promise<void> {
  const commandName = interaction.commandName;
  const subcommand = interaction.options.getSubcommand(false);

  if (commandName === 'df' && subcommand === 'match') {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'match_id') {
      try {
        const apiToken = resolveUserDfToken(client.database, interaction.user.id);
        if (!apiToken) {
          await interaction.respond([]);
          return;
        }

        const matchesRes = await getMatchList(apiToken, { limit: 10 }).catch(() => null);
        const list = matchesRes?.list || [];
        const query = focused.value.toLowerCase().trim();

        const choices = list.map((m: DfMatchEntry) => {
          const win = m.result === 1;
          const tag = win ? '🏆 [WIN]' : '💀 [DEFEAT]';
          const map = resolveMapName(m.map_id);
          const time = m.match_time ? formatVietnamDateTime(m.match_time) : '';
          const name = `${tag} ${map} (${time})`.slice(0, 100);
          return { name, value: String(m.room_id) };
        });

        const filtered = query
          ? choices.filter(
              (c: { name: string; value: string }) =>
                c.name.toLowerCase().includes(query) || c.value.includes(query),
            )
          : choices;

        await interaction.respond(filtered.slice(0, 25));
        return;
      } catch (err) {
        logger.debug('Autocomplete failed: ' + (err as Error).message);
        await interaction.respond([]).catch(() => {});
        return;
      }
    }
  }

  if (commandName === 'df' && subcommand === 'market') {
    try {
      await handleMarketAutocomplete(interaction);
      return;
    } catch (err) {
      logger.debug('Market autocomplete failed: ' + (err as Error).message);
      await interaction.respond([]).catch(() => {});
      return;
    }
  }

  await interaction.respond([]).catch(() => {});
}

export async function routeInteraction(
  client: Client,
  interaction:
    | ButtonInteraction
    | StringSelectMenuInteraction
    | ChatInputCommandInteraction
    | ModalSubmitInteraction,
): Promise<void> {
  try {
    // ── Runtime Environment Guard (Cách ly tuyệt đối Dev và Product) ──
    // 1. Khi bot chạy ở môi trường DEV (local VSCode):
    //    Bot CHỈ xử lý các tương tác trong Server DEV (1569650906390335549) hoặc DM của Bot Owner.
    //    Mọi tương tác trên các server Product khác được bỏ qua hoàn toàn để bot trên Railway độc quyền xử lý!
    if (botConfig.isDev && process.env.NODE_ENV !== 'test') {
      const isDev = interaction.guildId === botConfig.devGuildId;
      const isOwnerDm = !interaction.guildId && interaction.user.id === botConfig.botOwnerId;
      if (!isDev && !isOwnerDm) {
        logger.debug(
          `[REQ:${interaction.id}] Bỏ qua tương tác từ guild ${interaction.guildId} do bot đang chạy ở chế độ DEV (isDev=true).`,
        );
        return;
      }
    }

    // 2. Khi bot chạy ở môi trường PRODUCT (Railway):
    //    Bot BỎ QUA hoàn toàn Server DEV (1569650906390335549) để nhường quyền xử lý độc quyền cho phiên local VSCode!
    if (botConfig.isProduct && process.env.NODE_ENV !== 'test') {
      if (interaction.guildId === botConfig.devGuildId) {
        logger.debug(
          `[REQ:${interaction.id}] Bỏ qua tương tác từ Server DEV ${interaction.guildId} ở môi trường PRODUCT.`,
        );
        return;
      }
    }

    // ── 0. Autocomplete Interactions ──
    if (typeof interaction.isAutocomplete === 'function' && interaction.isAutocomplete()) {
      await handleAutocomplete(client, interaction);
      return;
    }

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
      logger.warn(
        `[REQ:${interaction.id}] Ignorable interaction error (10062/40060) tại routeInteraction: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    logger.error('Lỗi khi điều phối interaction:', {
      type: interaction.type,
      customId: 'customId' in interaction ? interaction.customId : undefined,
      error: error instanceof Error ? error.message : String(error),
    });

    if (typeof interaction.isAutocomplete !== 'function' || !interaction.isAutocomplete()) {
      await sendInteractionErrorFallback(interaction);
    }
  }
}
