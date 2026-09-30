import { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { ContainerSettings } from '../../types/settings.types.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { editSessions, isSessionValid, touchSession } from './container-session.js';
import { buildLivePreviewContainer, buildAllEditorRows } from './container-builders.js';
import {
  handleLinesModal,
  handleColorModal,
  handleHeaderModal,
  handleSeparatorToggle,
  handleMediaEdit,
} from './handlers/property.handler.js';
import { handleSave, handleReset, handleCancel } from './handlers/action.handler.js';
import { CONTAINER_SESSION_EXPIRED_MESSAGE } from '../../config/app.constants.js';
import { createLogger } from '../../utils/logger.js';
import { ContainerIds, ContainerModalPrefix } from './container-ids.js';
import { sendReply } from '../../utils/reply.utils.js';

const logger = createLogger('ContainerRouters');

/**
 * Main handler cho tất cả button interactions trong container editor.
 *
 * NOTE: Pencil button đã bị loại bỏ — workflow chuẩn: /container edit command.
 */
export async function handleEditorButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const session = editSessions.get(interaction.user.id);

  if (!isSessionValid(session)) {
    await sendReply(interaction, {
      components: buildErrorContainer(CONTAINER_SESSION_EXPIRED_MESSAGE).toJSON(),
    });
    return;
  }

  touchSession(interaction.user.id);

  const customId = interaction.customId;

  // Actions: Save, Reset, Cancel
  if (customId === ContainerIds.SAVE) {
    await handleSave(interaction, session);
    return;
  }
  if (customId === ContainerIds.RESET) {
    await handleReset(interaction, session);
    return;
  }
  if (customId === ContainerIds.CANCEL) {
    await handleCancel(interaction);
    return;
  }

  // Property Editors — mở modal trực tiếp, không cần submenu
  if (customId === ContainerIds.LINES) {
    await handleLinesModal(interaction, session);
    return;
  }
  if (customId === ContainerIds.COLOR) {
    await handleColorModal(interaction, session);
    return;
  }
  if (customId === ContainerIds.HEADER) {
    await handleHeaderModal(interaction, session);
    return;
  }
  if (customId === ContainerIds.SEPARATOR) {
    await handleSeparatorToggle(interaction, session);
    return;
  }
  if (customId === ContainerIds.MEDIA) {
    await handleMediaEdit(interaction, session);
    return;
  }

  logger.warn('Unknown container editor button: ' + customId);
}

/**
 * Handler cho modal submissions trong container editor.
 */
export async function handleEditorModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const session = editSessions.get(interaction.user.id);

  if (!isSessionValid(session)) {
    await sendReply(interaction, {
      components: buildErrorContainer('Session edit đã hết hạn.').toJSON(),
    });
    return;
  }

  touchSession(interaction.user.id);
  const modalId = interaction.customId.replace(ContainerModalPrefix, '');

  if (modalId === 'lines') {
    // Parse lines từ textarea — mỗi dòng là 1 content line
    // GIỮ LẠI blank lines — user có thể cố ý dùng cho spacing
    const rawValue = interaction.fields.getTextInputValue('lines_content');
    const lines = rawValue.split('\n').map((l) => l.trim());
    session.draft.contentLines = lines;
  } else if (modalId === 'color') {
    // Parse màu từ input — chấp nhận #RRGGBB hoặc RRGGBB
    const rawValue = interaction.fields.getTextInputValue('color_value');
    const hex = rawValue.replace('#', '').trim();
    if (hex.length !== 6) {
      await sendReply(interaction, {
        components: buildErrorContainer(
          `Mã màu không hợp lệ: "${rawValue}". Dùng định dạng #RRGGBB (6 ký tự hex).`,
        ).toJSON(),
      });
      return;
    }
    const parsed = parseInt(hex, 16);
    if (isNaN(parsed)) {
      await sendReply(interaction, {
        components: buildErrorContainer(
          `Mã màu không hợp lệ: "${rawValue}". Dùng định dạng #RRGGBB.`,
        ).toJSON(),
      });
      return;
    }
    session.draft.accentColor = parsed;
  } else if (modalId === 'header') {
    // Cập nhật header template
    const rawValue = interaction.fields.getTextInputValue('header_value');
    session.draft.headerTemplate = rawValue.trim() || null;
  } else if (modalId === 'media') {
    const urlValue = interaction.fields.getTextInputValue('media_url');
    const descValue = interaction.fields.getTextInputValue('media_description');
    session.draft.mediaUrl = urlValue.trim() || null;
    session.draft.mediaDescription = descValue.trim() || null;
  } else {
    logger.warn('Unknown container modal submission: ' + modalId);
    await sendReply(interaction, {
      components: buildErrorContainer('Modal không hợp lệ.').toJSON(),
    });
    return;
  }

  await updateModalEditorPreview(interaction, session);
}

/**
 * Refresh editor preview sau modal submission.
 *
 * WHY: ModalSubmitInteraction không có .update(), nên fetch message gốc
 * bằng channelId + messageId và edit lại.
 */
async function updateModalEditorPreview(
  interaction: ModalSubmitInteraction,
  session: { channelId: string; messageId: string; draft: ContainerSettings },
): Promise<void> {
  try {
    await interaction.deferUpdate();

    // Check session validity BEFORE doing expensive operations
    // If session was deleted (e.g., by Save button), skip update to avoid race condition
    const currentSession = editSessions.get(interaction.user.id);
    if (!isSessionValid(currentSession)) {
      logger.info(
        `Session expired during modal processing — skipping preview update for user ${interaction.user.id}`,
      );
      return;
    }

    const channel = await interaction.client.channels.fetch(session.channelId);
    if (!channel?.isTextBased()) return;

    const message = await channel.messages.fetch(session.messageId).catch(() => null);
    if (!message) {
      // Message gốc đã bị delete/expired → cleanup session để tránh lỗi lặp
      logger.info(
        `Preview message expired (channel=${session.channelId}, msg=${session.messageId}) — cleanup session`,
      );
      editSessions.delete(interaction.user.id);
      try {
        await sendReply(interaction, {
          components: buildErrorContainer(
            'Message preview đã hết hạn. Vui lòng bắt đầu lại editor bằng `/container edit`.',
          ).toJSON(),
        });
      } catch {
        // sendReply có thể fail nếu interaction đã expired → ignore
      }
      return;
    }

    const preview = buildLivePreviewContainer(session.draft);
    await message.edit({
      components: [...preview.toJSON(), ...buildAllEditorRows(session.draft)],
      files: preview.files,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // Unknown Message (404) hoặc Unknown Interaction (403/429) → cleanup session
    if (errMsg.includes('Unknown Message') || errMsg.includes('Unknown Interaction')) {
      logger.info(`Preview message expired — cleanup session for user ${interaction.user.id}`);
      editSessions.delete(interaction.user.id);
      try {
        await sendReply(interaction, {
          components: buildErrorContainer(
            'Session đã hết hạn do message không còn tồn tại. Vui lòng `/container edit` lại.',
          ).toJSON(),
        });
      } catch {
        // sendReply có thể fail nếu interaction đã expired → ignore
      }
      return;
    }
    logger.error('Lỗi khi cập nhật preview sau modal: ' + errMsg);
  }
}

// Pencil button handler đã bị loại bỏ — workflow chuẩn: /container edit command
