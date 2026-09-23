import { ButtonInteraction } from 'discord.js';
import { ContainerEditSession } from '../container-session.js';
import {
  buildLinesModal,
  buildColorModal,
  buildHeaderModal,
  buildMediaModal,
  updateEditorMessage,
} from '../container-builders.js';

// ─── Lines Handlers ────────────────────────────────────────────

/**
 * Mở modal quản lý tất cả lines trong 1 modal duy nhất.
 */
export async function handleLinesModal(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const modal = buildLinesModal(session.draft.contentLines);
  await interaction.showModal(modal);
}

/**
 * Xử lý clear tất cả lines.
 */
export async function handleClearLines(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  session.draft.contentLines = [];
  await updateEditorMessage(interaction, session.draft);
}

// ─── Color Handlers ────────────────────────────────────────────

/**
 * Mở modal chọn accent color.
 */
export async function handleColorModal(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const modal = buildColorModal(session.draft.accentColor);
  await interaction.showModal(modal);
}

// ─── Header Handler ────────────────────────────────────────────

/**
 * Mở modal chỉnh sửa header template.
 */
export async function handleHeaderModal(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const modal = buildHeaderModal(session.draft.headerTemplate);
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
  await updateEditorMessage(interaction, session.draft);
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
