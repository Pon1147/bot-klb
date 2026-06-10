import { ButtonInteraction, MessageFlags } from 'discord.js';
import { getSettingsService } from '../../../services/settings.service.js';
import { buildErrorContainer, buildSuccessContainer } from '../../../utils/container.utils.js';
import { cloneDefaultSettings } from '../../../config/default.settings.js';
import {
  ContainerEditSession,
  cloneContainerSettings,
  deleteSession,
} from '../container-session.js';
import { buildLivePreviewContainer, buildAllEditorRows } from '../container-builders.js';

/**
 * Xử lý khi user nhấn button Save.
 */
export async function handleSave(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  try {
    const settingsService = getSettingsService();

    settingsService.update(session.guildId, {
      [session.type]: {
        container: session.draft,
      },
    });

    deleteSession(interaction.user.id);

    const successContainer = buildSuccessContainer(
      `Đã lưu container "${session.type}" thành công!`,
    );
    await interaction.update({
      components: successContainer.components as any,
      flags: successContainer.flags,
    });
  } catch (error) {
    console.error('Error saving container settings:', error);
    const errorContainer = buildErrorContainer(`Lỗi khi lưu: ${(error as Error).message}`);
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
  }
}

/**
 * Xử lý khi user nhấn button Reset (trong editor).
 */
export async function handleReset(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const defaults = cloneDefaultSettings();
  session.draft = cloneContainerSettings(defaults[session.type].container);

  const preview = buildLivePreviewContainer(session.draft);

  await interaction.update({
    components: [...(preview.components as any), ...buildAllEditorRows()],
    flags: preview.flags,
    files: preview.files,
  });
}

/**
 * Xử lý khi user nhấn button Cancel.
 */
export async function handleCancel(interaction: ButtonInteraction): Promise<void> {
  deleteSession(interaction.user.id);

  const cancelContainer = buildErrorContainer('Đã hủy bỏ chỉnh sửa.');
  await interaction.update({
    components: cancelContainer.components as any,
    flags: cancelContainer.flags,
  });
}
