import { ButtonInteraction, MessageFlags } from 'discord.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { ContainerEditSession, CONTAINER_COLOR_PRESETS } from './container-session.js';
import {
  buildLinesSubmenuRows,
  buildColorPickerRows,
  buildLinesInfoContainer,
  buildColorPickerInfoContainer,
  buildLongTextModal,
  buildTextModal,
  buildMediaModal,
  buildEditLineModal,
  updateEditorMessage,
} from './container-builders.js';

// ─── Lines Handlers ────────────────────────────────────────────

/**
 * Xử lý khi user nhấn button "Text Lines" (chuyển sang lines submenu).
 */
export async function handleLinesSubmenu(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const infoContainer = buildLinesInfoContainer(session.draft.contentLines);

  await interaction.update({
    components: [...(infoContainer.components as any), ...buildLinesSubmenuRows()],
    flags: infoContainer.flags,
  });
}

/**
 * Xử lý khi user nhấn button "Add Line".
 */
export async function handleAddLine(interaction: ButtonInteraction): Promise<void> {
  const modal = buildLongTextModal(
    'new_line',
    'Nhập dòng text mới',
    'Ví dụ: Chào mừng {user} đến với {guild}!',
    '',
  );
  await interaction.showModal(modal);
}

/**
 * Xử lý khi user nhấn button "Edit Line".
 */
export async function handleEditLine(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const lineCount = session.draft.contentLines.length;

  if (lineCount === 0) {
    const errorContainer = buildErrorContainer('Không có dòng nào để chỉnh sửa.');
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = buildEditLineModal(lineCount);
  await interaction.showModal(modal);
}

/**
 * Xử lý khi user nhấn button "Remove Line".
 */
export async function handleRemoveLine(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const lineCount = session.draft.contentLines.length;

  if (lineCount === 0) {
    const errorContainer = buildErrorContainer('Không có dòng nào để xóa.');
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = buildTextModal(
    'line_remove_index',
    `Nhập index dòng muốn xóa (0-${lineCount - 1})`,
    'Ví dụ: 0',
    '',
  );
  await interaction.showModal(modal);
}

/**
 * Xử lý khi user nhấn button "Clear All Lines".
 */
export async function handleClearLines(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  session.draft.contentLines = [];
  await updateEditorMessage(interaction, session);
}

// ─── Color Handlers ────────────────────────────────────────────

/**
 * Xử lý khi user nhấn button "Accent Color" (chuyển sang color picker).
 */
export async function handleColorPicker(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const infoContainer = buildColorPickerInfoContainer(session.draft.accentColor);

  await interaction.update({
    components: [...(infoContainer.components as any), ...buildColorPickerRows()],
    flags: infoContainer.flags,
  });
}

/**
 * Xử lý khi user chọn color preset.
 */
export async function handleColorPresetSelect(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
  presetIndex: number,
): Promise<void> {
  const preset = CONTAINER_COLOR_PRESETS[presetIndex];
  if (!preset) return;

  session.draft.accentColor = preset.value;
  await updateEditorMessage(interaction, session);
}

/**
 * Xử lý khi user nhấn custom color button.
 */
export async function handleCustomColorModal(interaction: ButtonInteraction): Promise<void> {
  const modal = buildTextModal(
    'custom_color',
    'Nhập mã màu Hex',
    'Ví dụ: #5865F2 hoặc 5865F2',
    '',
  );
  await interaction.showModal(modal);
}

// ─── Other Property Handlers ───────────────────────────────────

/**
 * Xử lý khi user nhấn button "Separator" (toggle).
 */
export async function handleSeparatorToggle(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  session.draft.showSeparator = !session.draft.showSeparator;
  await updateEditorMessage(interaction, session);
}

/**
 * Xử lý khi user nhấn button "Media/GIF" (mở modal).
 */
export async function handleMediaEdit(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const modal = buildMediaModal(session.draft.mediaUrl, session.draft.mediaDescription);
  await interaction.showModal(modal);
}