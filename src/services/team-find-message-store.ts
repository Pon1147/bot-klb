/**
 * In-memory store cho /team-find messages.
 * Mỗi user chỉ có 1 embed trong 1 guild. Khi dùng lại lệnh → xóa message cũ, gửi mới.
 */

const store = new Map<string, { messageId: string; channelId: string }>();

/** Key duy nhất cho mỗi message (guild + user) */
function key(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

/** Lưu reference đến message */
export function storeMessage(
  guildId: string,
  userId: string,
  messageId: string,
  channelId: string,
): void {
  store.set(key(guildId, userId), { messageId, channelId });
}

/** Lấy reference message */
export function getMessageRef(
  guildId: string,
  userId: string,
): { messageId: string; channelId: string } | null {
  return store.get(key(guildId, userId)) ?? null;
}

/** Xóa reference message */
export function deleteMessageRef(guildId: string, userId: string): void {
  store.delete(key(guildId, userId));
}
