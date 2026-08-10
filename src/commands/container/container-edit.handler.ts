import { ChatInputCommandInteraction } from 'discord.js';
import { ContainerSettings } from '../../types/settings.types.js';
import { getSettingsService } from '../../services/settings.service.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { cloneContainerSettings, createSession } from './container-session.js';
import { buildLivePreviewContainer, buildAllEditorRows } from './container-builders.js';
import { createLogger } from '../../utils/logger.js';
import { sendReply } from '../../utils/reply.utils.js';

const logger = createLogger('ContainerEdit');

/**
 * Entry point: bắt đầu session edit container mới.
 */
export async function startInteractiveEdit(
  interaction: ChatInputCommandInteraction,
  type: 'welcome' | 'leave' | 'booster',
): Promise<void> {
  try {
    const settingsService = getSettingsService();
    const currentSettings = settingsService.get(interaction.guild!.id);
    const containerSettings = currentSettings[type].container;

    await sendEditorMessage(interaction, type, containerSettings);
  } catch (error) {
    logger.error(
      'Error starting container interactive edit: ' +
        (error instanceof Error ? error.message : String(error)),
    );
    if (!interaction.replied) {
      await sendReply(interaction, {
        components: buildErrorContainer(
          `Lỗi khi khởi tạo editor: ${(error as Error).message}`,
        ).toJSON(),
      });
    }
  }
}

/**
 * Gửi message editor ban đầu với preview + buttons.
 */
async function sendEditorMessage(
  interaction: ChatInputCommandInteraction,
  type: 'welcome' | 'leave' | 'booster',
  settings: ContainerSettings,
): Promise<void> {
  const draft = cloneContainerSettings(settings);
  const preview = buildLivePreviewContainer(draft);

  // Gửi message editor với container preview + buttons
  // WHY: Không dùng ephemeral, dùng flags thuần túy (ephemeral param đã deprecated)
  await interaction.reply({
    components: [...preview.toJSON(), ...buildAllEditorRows()],
    flags: preview.flags,
    files: preview.files,
  });

  // WHY: interaction.reply() trả về ChatInputCommandInteraction, không phải Message
  // Cần dùng fetchReply() để lấy message ID thật
  // WHY: Wrap try-catch vì fetchReply() có thể fail nếu Discord rate-limit hoặc network error
  let messageId: string;
  try {
    const message = await interaction.fetchReply();
    messageId = message.id;
  } catch (error) {
    logger.error(
      'Error fetching reply message: ' + (error instanceof Error ? error.message : String(error)),
    );
    // Fallback: dùng placeholder ID nếu fetchReply fail
    // Session vẫn hoạt động nhưng live preview update có thể không chính xác
    messageId = 'fetch_failed';
  }

  createSession(
    interaction.user.id,
    interaction.guild!.id,
    type,
    draft,
    messageId,
    interaction.channel!.id,
  );
}
