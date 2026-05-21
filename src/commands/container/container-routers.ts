import { ButtonInteraction, MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { editSessions, isSessionValid } from './container-session.js';
import { buildLivePreviewContainer, buildAllEditorRows } from './container-builders.js';
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
} from './container-property.handlers.js';
import { handleSave, handleReset, handleCancel } from './container-action.handlers.js';

/**
 * Update editor message (re-exported for use in routers).
 */
async function updateEditorMessage(
  interaction: ButtonInteraction,
  session: { draft: any },
): Promise<void> {
  const preview = buildLivePreviewContainer(session.draft);
  await interaction.update({
    components: [...(preview.components as any), ...buildAllEditorRows()],
    flags: preview.flags,
    files: preview.files,
  });
}

/**
 * Main handler cho tất cả button interactions trong container editor.
 */
export async function handleEditorButtonInteraction(
  interaction: ButtonInteraction,
): Promise<void> {
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

  const modalId = interaction.customId.replace('container_modal_', '');

  try {
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
      session.draft.mediaUrl = urlValue || null;
      session.draft.mediaDescription = descValue || null;
    } else {
      console.warn(`Unknown container modal submission: ${modalId}`);
      const errorContainer = buildErrorContainer('Modal không hợp lệ.');
      await interaction.reply({
        components: errorContainer.components as any,
        flags: errorContainer.flags | MessageFlags.Ephemeral,
      });
      return;
    }

    // Sau khi submit modal, dùng deferUpdate để không gửi reply
    await interaction.deferUpdate();
  } catch (error) {
    console.error('Error handling container modal submission:', error);
    const errorContainer = buildErrorContainer(`Lỗi khi xử lý: ${(error as Error).message}`);
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
  }
}