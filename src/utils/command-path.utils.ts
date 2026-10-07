import type { ChatInputCommandInteraction } from 'discord.js';

/**
 * Trích xuất định danh đường dẫn lệnh chuẩn hóa (Command Path) từ ChatInputCommandInteraction.
 *
 * Định dạng:
 * - 3 cấp: root.group.sub (ví dụ: config.roles.set, df.code.show)
 * - 2 cấp: root.sub (ví dụ: df.stats, team.find, welcome.status)
 * - 1 cấp: root (ví dụ: df-stats, df-daily, team-find)
 *
 * @param interaction ChatInputCommandInteraction từ Discord
 * @returns Chuỗi canonical command path
 */
export function getCommandPath(interaction: ChatInputCommandInteraction): string {
  const root = interaction.commandName;
  let group: string | null = null;
  let sub: string | null = null;

  try {
    group = interaction.options?.getSubcommandGroup?.(false) ?? null;
  } catch {
    group = null;
  }

  try {
    sub = interaction.options?.getSubcommand?.(false) ?? null;
  } catch {
    sub = null;
  }

  if (group && sub) {
    return `${root}.${group}.${sub}`;
  }
  if (sub) {
    return `${root}.${sub}`;
  }
  return root;
}
