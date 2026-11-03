import { ChatInputCommandInteraction } from 'discord.js';
import Database from 'better-sqlite3';
import { buildSuccessContainer, buildErrorContainer } from '../../utils/container.utils.js';
import { requireGuild, requireDfBinding } from '../../utils/df-guards.js';
import { revokeBindingAsync } from '../../database/df-binding.db.js';
import { sendReply } from '../../utils/reply.utils.js';

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  // Kiểm tra guild
  if (await requireGuild(interaction)) return;

  // Kiểm tra user đã link chưa (binding active hoặc legacy token)
  if (await requireDfBinding(interaction, database)) return;

  // Revoke binding: Persistent Store (MongoDB) trước -> SQLite cache
  const revokeResult = await revokeBindingAsync(database, interaction.user.id);
  if (!revokeResult.success) {
    if (revokeResult.error === 'database_unavailable') {
      const errorContainer = buildErrorContainer(
        'Cơ sở dữ liệu tạm thời không khả dụng. Vui lòng thử lại sau.',
      );
      await sendReply(interaction, { components: errorContainer.toJSON() });
      return;
    }
    if (revokeResult.error === 'generation_mismatch') {
      const errorContainer = buildErrorContainer(
        'Phiên liên kết đã thay đổi hoặc đã được cập nhật mới. Vui lòng kiểm tra lại.',
      );
      await sendReply(interaction, { components: errorContainer.toJSON() });
      return;
    }
    const errorContainer = buildErrorContainer(
      'Không thể hủy liên kết vào lúc này. Vui lòng thử lại sau.',
    );
    await sendReply(interaction, { components: errorContainer.toJSON() });
    return;
  }

  const result = buildSuccessContainer('Đã hủy liên kết tài khoản Delta Force.');
  await sendReply(interaction, { components: result.toJSON() });
}
