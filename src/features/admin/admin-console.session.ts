import { ContainerSettings } from '../../types/settings.types.js';
import { TTLStore, type TouchEntry } from '../../utils/ttl-store.js';
import { NoticeType } from './admin-console.builder.js';

export interface AdminEditorSession extends TouchEntry {
  guildId: string;
  type: NoticeType;
  draft: ContainerSettings;
  lastInteractionAt: number;
}

const adminEditorStore = new TTLStore<string, AdminEditorSession>({
  ttlMs: 15 * 60 * 1000, // 15 phút không tương tác sẽ tự hết hạn
  cleanupIntervalMs: 60 * 1000,
  name: 'AdminEditorSessions',
});

/**
 * Lấy session chỉnh sửa container đang hoạt động của user.
 */
export function getAdminEditorSession(userId: string): AdminEditorSession | undefined {
  return adminEditorStore.get(userId);
}

/**
 * Lưu hoặc cập nhật session chỉnh sửa container.
 */
export function setAdminEditorSession(userId: string, session: AdminEditorSession): void {
  adminEditorStore.set(userId, session);
}

/**
 * Xóa session chỉnh sửa container khi hoàn tất hoặc hủy.
 */
export function deleteAdminEditorSession(userId: string): void {
  adminEditorStore.delete(userId);
}

/**
 * Làm mới thời gian hết hạn của session.
 */
export function touchAdminEditorSession(userId: string): void {
  adminEditorStore.touch(userId);
}
