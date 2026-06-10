import { ButtonInteraction, GuildMember, MessageFlags, ModalSubmitInteraction, PermissionFlagsBits } from 'discord.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { getSettingsService } from '../../services/settings.service.js';
import { editSessions, isSessionValid, touchSession, cloneContainerSettings, createSession } from './container-session.js';
import { buildLivePreviewContainer, buildAllEditorRows, updateEditorMessage } from './container-builders.js';
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

/**
 * Main handler cho tất cả button interactions trong container editor.
 */
export async function handleEditorButtonInteraction(
  interaction: ButtonInteraction,
): Promise<void> {
  // Pencil button: start editor from a live container message
  if (interaction.customId.startsWith('container_edit_pencil_')) {
    await handlePencilButtonClick(interaction);
    return;
  }

  const session = editSessions.get(interaction.user.id);

  if (!isSessionValid(session)) {
    const errorContainer = buildErrorContainer(
      'Session edit đã hết hạn. Vui lòng bắt đầu lại với /container edit.',
    );
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  touchSession(interaction.user.id);

  const customId = interaction.customId;

  // Navigation: quay lại từ submenu
  if (customId === 'container_back') {
    await updateEditorMessage(interaction, session);
    return;
  }

  // Actions: Save, Reset, Cancel
  if (customId === 'container_edit_save') {
    await handleSave(interaction, session);
    return;
  }
  if (customId === 'container_edit_reset') {
    await handleReset(interaction, session);
    return;
  }
  if (customId === 'container_edit_cancel') {
    await handleCancel(interaction);
    return;
  }

  // Property Editors: Lines, Color, Separator, Media
  if (customId === 'container_edit_lines') {
    await handleLinesSubmenu(interaction, session);
    return;
  }
  if (customId === 'container_edit_color') {
    await handleColorPicker(interaction, session);
    return;
  }
  if (customId === 'container_edit_separator') {
    await handleSeparatorToggle(interaction, session);
    return;
  }
  if (customId === 'container_edit_media') {
    await handleMediaEdit(interaction, session);
    return;
  }

  // Lines Submenu: Add, Edit, Remove, Clear
  if (customId === 'container_lines_add') {
    await handleAddLine(interaction);
    return;
  }
  if (customId === 'container_lines_edit') {
    await handleEditLine(interaction, session);
    return;
  }
  if (customId === 'container_lines_remove') {
    await handleRemoveLine(interaction, session);
    return;
  }
  if (customId === 'container_lines_clear') {
    await handleClearLines(interaction, session);
    return;
  }

  // Color Picker
  if (customId.startsWith('container_color_preset_')) {
    const index = parseInt(customId.replace('container_color_preset_', ''), 10);
    await handleColorPresetSelect(interaction, session, index);
    return;
  }

  if (customId === 'container_color_custom') {
    await handleCustomColorModal(interaction);
    return;
  }

  console.warn(`Unknown container editor button: ${customId}`);
}

/**
 * Handler cho modal submissions trong container editor.
 */
export async function handleEditorModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const session = editSessions.get(interaction.user.id);

  if (!isSessionValid(session)) {
    const errorContainer = buildErrorContainer('Session edit đã hết hạn.');
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  touchSession(interaction.user.id);
  const modalId = interaction.customId.replace('container_modal_', '');

  if (modalId === 'new_line') {
    const value = interaction.fields.getTextInputValue('new_line');
    if (value) {
      session.draft.contentLines.push(value);
    }
  } else if (modalId === 'edit_line') {
    const indexValue = interaction.fields.getTextInputValue('edit_line_index');
    const index = parseInt(indexValue, 10);
    if (isNaN(index) || index < 0 || index >= session.draft.contentLines.length) {
      const errorContainer = buildErrorContainer(`Index không hợp lệ: "${indexValue}".`);
      await interaction.reply({
        components: errorContainer.components as any,
        flags: errorContainer.flags | MessageFlags.Ephemeral,
      });
      return;
    }
    const newContent = interaction.fields.getTextInputValue('edit_line_content');
    session.draft.contentLines[index] = newContent;
  } else if (modalId === 'line_remove_index') {
    const value = interaction.fields.getTextInputValue('line_remove_index');
    const index = parseInt(value, 10);
    if (isNaN(index) || index < 0 || index >= session.draft.contentLines.length) {
      const errorContainer = buildErrorContainer(`Index không hợp lệ: "${value}".`);
      await interaction.reply({
        components: errorContainer.components as any,
        flags: errorContainer.flags | MessageFlags.Ephemeral,
      });
      return;
    }
    session.draft.contentLines.splice(index, 1);
  } else if (modalId === 'custom_color') {
    const value = interaction.fields.getTextInputValue('custom_color');
    const hex = value.replace('#', '');
    if (hex.length !== 6) {
      const errorContainer = buildErrorContainer(
        `Mã màu không hợp lệ: "${value}". Dùng định dạng #RRGGBB (6 ký tự hex).`,
      );
      await interaction.reply({
        components: errorContainer.components as any,
        flags: errorContainer.flags | MessageFlags.Ephemeral,
      });
      return;
    }
    const parsed = parseInt(hex, 16);
    if (isNaN(parsed)) {
      const errorContainer = buildErrorContainer(
        `Mã màu không hợp lệ: "${value}". Dùng định dạng #RRGGBB.`,
      );
      await interaction.reply({
        components: errorContainer.components as any,
        flags: errorContainer.flags | MessageFlags.Ephemeral,
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
    console.warn(`Unknown container modal submission: ${modalId}`);
    const errorContainer = buildErrorContainer('Modal không hợp lệ.');
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
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
  session: { channelId: string; messageId: string; draft: any },
): Promise<void> {
  try {
    await interaction.deferUpdate();

    const channel = await interaction.client.channels.fetch(session.channelId);
    if (!channel?.isTextBased()) return;

    const message = await channel.messages.fetch(session.messageId).catch(() => null);
    if (!message) return;

    const preview = buildLivePreviewContainer(session.draft);
    await message.edit({
      components: [...(preview.components as any), ...buildAllEditorRows()],
      files: preview.files,
    });
  } catch (error) {
    console.error('Error updating editor preview after modal:', error);
  }
}

/**
 * Handle pencil button click from a live container message.
 * Starts an interactive edit session without needing /container edit.
 */
async function handlePencilButtonClick(
  interaction: ButtonInteraction,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const guild = interaction.guild;

  if (!guild) {
    await interaction.reply({
      content: 'Lệnh này chỉ dùng được trong server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Bạn cần quyền Administrator để chỉnh sửa container.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const parts = interaction.customId.replace('container_edit_pencil_', '').split('_');
  const editType = parts[parts.length - 1] as 'welcome' | 'leave' | 'booster';

  if (!editType || !['welcome', 'leave', 'booster'].includes(editType)) {
    console.warn(`Invalid pencil button customId: ${interaction.customId}`);
    return;
  }

  try {
    const settingsService = getSettingsService();
    const currentSettings = settingsService.get(guild.id);
    const containerSettings = currentSettings[editType].container;

    const draft = cloneContainerSettings(containerSettings);
    const preview = buildLivePreviewContainer(draft);

    await interaction.update({
      components: [...(preview.components as any), ...buildAllEditorRows()],
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
    console.error('Error starting container editor from pencil button:', error);
    if (!interaction.replied) {
      const errorContainer = buildErrorContainer(`Lỗi khi mở editor: ${(error as Error).message}`);
      await interaction.reply({
        components: errorContainer.components as any,
        flags: errorContainer.flags | MessageFlags.Ephemeral,
      });
    }
  }
}