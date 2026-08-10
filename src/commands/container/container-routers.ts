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
import {
  buildLivePreviewContainer,
  buildAllEditorRows,
  updateEditorMessage,
} from './container-builders.js';
import {
  handleLinesSubmenu,
  handleAddLine,
  handleEditLine,
  handleRemoveLine,
  handleClearLines,
  handleColorPicker,
  handleColorPresetSelect,
  handleCustomColorModal,
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
  // Pencil button: start editor from a live container message
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

  // Navigation: quay lại từ submenu
  if (customId === ContainerIds.BACK) {
    await updateEditorMessage(interaction, session);
    return;
  }

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

  // Property Editors: Lines, Color, Separator, Media
  if (customId === ContainerIds.LINES) {
    await handleLinesSubmenu(interaction, session);
    return;
  }
  if (customId === ContainerIds.COLOR) {
    await handleColorPicker(interaction, session);
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

  // Lines Submenu: Add, Edit, Remove, Clear
  if (customId === ContainerIds.LINES_ADD) {
    await handleAddLine(interaction);
    return;
  }
  if (customId === ContainerIds.LINES_EDIT) {
    await handleEditLine(interaction, session);
    return;
  }
  if (customId === ContainerIds.LINES_REMOVE) {
    await handleRemoveLine(interaction, session);
    return;
  }
  if (customId === ContainerIds.LINES_CLEAR) {
    await handleClearLines(interaction, session);
    return;
  }

  // Color Picker
  if (customId.startsWith(ContainerIds.COLOR_PRESET)) {
    const index = parseInt(customId.replace(ContainerIds.COLOR_PRESET, ''), 10);
    await handleColorPresetSelect(interaction, session, index);
    return;
  }

  if (customId === ContainerIds.COLOR_CUSTOM) {
    await handleCustomColorModal(interaction);
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

  if (modalId === 'new_line') {
    const value = interaction.fields.getTextInputValue('new_line');
    if (value) {
      session.draft.contentLines.push(value);
    }
  } else if (modalId === 'edit_line') {
    const indexValue = interaction.fields.getTextInputValue('edit_line_index');
    const index = parseInt(indexValue, 10);
    if (isNaN(index) || index < 0 || index >= session.draft.contentLines.length) {
      await sendReply(interaction, {
        components: buildErrorContainer(`Index không hợp lệ: "${indexValue}".`).toJSON(),
      });
      return;
    }
    const newContent = interaction.fields.getTextInputValue('edit_line_content');
    session.draft.contentLines[index] = newContent;
  } else if (modalId === 'line_remove_index') {
    const value = interaction.fields.getTextInputValue('line_remove_index');
    const index = parseInt(value, 10);
    if (isNaN(index) || index < 0 || index >= session.draft.contentLines.length) {
      await sendReply(interaction, {
        components: buildErrorContainer(`Index không hợp lệ: "${value}".`).toJSON(),
      });
      return;
    }
    session.draft.contentLines.splice(index, 1);
  } else if (modalId === 'custom_color') {
    const value = interaction.fields.getTextInputValue('custom_color');
    const hex = value.replace('#', '');
    if (hex.length !== 6) {
      await sendReply(interaction, {
        components: buildErrorContainer(
          `Mã màu không hợp lệ: "${value}". Dùng định dạng #RRGGBB (6 ký tự hex).`,
        ).toJSON(),
      });
      return;
    }
    const parsed = parseInt(hex, 16);
    if (isNaN(parsed)) {
      await sendReply(interaction, {
        components: buildErrorContainer(
          `Mã màu không hợp lệ: "${value}". Dùng định dạng #RRGGBB.`,
        ).toJSON(),
      });
      return;
    }
    session.draft.accentColor = parsed;
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
 * Refresh editor preview after modal submission.
 *
 * WHY: ModalSubmitInteraction doesn't have .update(), so we fetch the
 * original message by channelId + messageId and edit it.
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
      components: [...preview.toJSON(), ...buildAllEditorRows()],
      files: preview.files,
    });
  } catch (error) {
    logger.error(
      'Error updating editor preview after modal: ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Handle pencil button click from a live container message.
 * Starts an interactive edit session without needing /container edit.
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
      components: [...preview.toJSON(), ...buildAllEditorRows()],
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
      'Error starting container editor from pencil button: ' +
        (error instanceof Error ? error.message : String(error)),
    );
    if (!interaction.replied) {
      await sendReply(interaction, {
        components: buildErrorContainer(`Lỗi khi mở editor: ${(error as Error).message}`).toJSON(),
      });
    }
  }
}
