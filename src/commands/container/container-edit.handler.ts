import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
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
 *
 * WORKFLOW CHUẨN:
 * 1. interaction.reply() (ephemeral) — tạo editor message duy nhất
 * 2. fetchReply() — lấy messageId thật
 * 3. createSession() — lưu session với messageId hợp lệ
 *
 * WHY: Không dùng deferReply() vì reply() đã đủ giữ interaction alive.
 * deferReply() + reply() tạo 2 messages → lãng phí + phức tạp không cần thiết.
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
 * Gửi editor message với preview + buttons.
 *
 * WHY: Dùng interaction.reply() trực tiếp — không cần deferReply().
 * Reply() giữ interaction alive cho đến khi hết 15 phút.
 */
async function sendEditorMessage(
  interaction: ChatInputCommandInteraction,
  type: 'welcome' | 'leave' | 'booster',
  settings: ContainerSettings,
): Promise<void> {
  const draft = cloneContainerSettings(settings);
  const preview = buildLivePreviewContainer(draft);

  // Gửi editor message (ephemeral — chỉ user mới thấy)
  await interaction.reply({
    components: [...preview.toJSON(), ...buildAllEditorRows(draft)],
    flags: preview.flags | MessageFlags.Ephemeral,
    files: preview.files,
  });

  // Lấy messageId thật từ reply
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
