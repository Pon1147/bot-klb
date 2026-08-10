import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

/** Tất cả interaction types có thể dùng sendReply */
type AnyInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ModalSubmitInteraction;

/**
 * Gửi reply cho interaction — tự động chọn reply() hoặc editReply().
 * Chỉ thêm IsComponentsV2 khi payload có components.
 */
export async function sendReply(
  interaction: AnyInteraction,
  payload: InteractionReplyOptions,
): Promise<void> {
  const isReplied = interaction.replied || interaction.deferred;

  // editReply không nhận flags từ container — kế thừa flags từ deferReply
  if (isReplied) {
    const { flags: _ignore, ...editPayload } = payload;
    await interaction.editReply(editPayload as Parameters<typeof interaction.editReply>[0]);
    return;
  }

  // reply() cần flags hợp nhất: flags từ container | Ephemeral (+ IsComponentsV2 nếu có components)
  const baseFlags = (payload.flags as number) || 0;
  const hasComponents = 'components' in payload && payload.components;
  const extraFlags = hasComponents ? MessageFlags.IsComponentsV2 : 0;
  await interaction.reply({
    ...payload,
    flags: baseFlags | MessageFlags.Ephemeral | extraFlags,
  } as Parameters<typeof interaction.reply>[0]);
}
