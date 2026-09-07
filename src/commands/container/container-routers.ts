import { ButtonInteraction, ModalSubmitInteraction, PermissionFlagsBits } from 'discord.js';
import { ContainerSettings } from '../../types/settings.types.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { getSettingsService } from '../../services/settings.service.js';
import {
  editSessions,
  isSessionValid,
  touchSession,
  cloneContainerSettings,
  createSession,
} from './container-session.js';
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
 */
export async function handleEditorButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  // Pencil button: start editor từ live container message
  if (interaction.customId.startsWith(ContainerIds.EDIT_PENCIL)) {
    await handlePencilButtonClick(interaction);
    return;
  }

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
    // Giữ lại empty lines cho spacing, trim whitespace
    const rawValue = interaction.fields.getTextInputValue('lines_content');
    const lines = rawValue.split('\n').map((l) => l.trim());
    session.draft.contentLines = lines;
  } else if (modalId === 'color') {
    // Parse màu từ input — chấp nhận #RRGGBB hoặc RRGGBB
    // Xóa TẤT CẢ # (chỉ first) để xử lý ##FF0000
    const rawValue = interaction.fields.getTextInputValue('color_value');
    const hex = rawValue.replaceAll('#', '').trim();
    if (hex.length !== 6) {
      await sendReply(interaction, {
        components: buildErrorContainer(
          `Mã màu không hợp lệ: "${rawValue}". Dùng định dạng #RRGGBB (6 ký tự hex).`,
        ).toJSON(),
      });
      return;
    }
    const parsed = parseInt(hex, 16);
    if (isNaN(parsed) || parsed < 0) {
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

    const channel = await interaction.client.channels.fetch(session.channelId);
    if (!channel?.isTextBased()) return;

    const message = await channel.messages.fetch(session.messageId).catch(() => null);
    if (!message) return;

    const preview = buildLivePreviewContainer(session.draft);
    await message.edit({
      components: [...preview.toJSON(), ...buildAllEditorRows(session.draft)],
      files: preview.files,
    });
  } catch (error) {
    logger.error(
      'Lỗi khi cập nhật preview sau modal: ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Handle pencil button click từ live container message.
 * Bắt đầu edit session mà không cần /container edit.
 */
async function handlePencilButtonClick(interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild;

  if (!guild) {
    await sendReply(interaction, { content: 'Lệnh này chỉ dùng được trong server.' });
    return;
  }

  // Guard: yêu cầu Administrator permission
  const member = interaction.member;
  if (
    !member ||
    !('permissions' in (member as object)) ||
    !(member as { permissions: { has: (p: unknown) => boolean } }).permissions.has(
      PermissionFlagsBits.Administrator,
    )
  ) {
    await sendReply(interaction, {
      content: 'Bạn cần quyền Administrator để chỉnh sửa container.',
    });
    return;
  }

  const parts = interaction.customId.replace(ContainerIds.EDIT_PENCIL, '').split('_');
  const editType = parts[parts.length - 1] as 'welcome' | 'leave' | 'booster';

  if (!editType || !['welcome', 'leave', 'booster'].includes(editType)) {
    logger.warn('Invalid pencil button customId: ' + interaction.customId);
    return;
  }

  try {
    const settingsService = getSettingsService();
    const currentSettings = settingsService.get(guild.id);
    const containerSettings = currentSettings[editType].container;

    const draft = cloneContainerSettings(containerSettings);
    const preview = buildLivePreviewContainer(draft);

    await interaction.update({
      components: [...preview.toJSON(), ...buildAllEditorRows(draft)],
      flags: preview.flags,
      files: preview.files,
    });

    createSession(
      interaction.user.id,
      guild.id,
      editType,
      draft,
      interaction.message.id,
      interaction.channel!.id,
    );
  } catch (error) {
    logger.error(
      'Lỗi khi mở editor từ pencil button: ' +
        (error instanceof Error ? error.message : String(error)),
    );
    if (!interaction.replied) {
      await sendReply(interaction, {
        components: buildErrorContainer(`Lỗi khi mở editor: ${(error as Error).message}`).toJSON(),
      });
    }
  }
}
