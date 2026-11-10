import { GuildMember, Guild } from 'discord.js';

/**
 * Container V2 settings - sử dụng Components V2 (Section, TextDisplay, MediaGallery, Separator).
 * - accentColor: màu sidebar container (hex number như 0x5865F2)
 * - headerTemplate: template cho header section (tùy chọn, null = không hiển thị header)
 * - contentLines: mảng string markdown cho TextDisplay (hỗ trợ mention, channel link...)
 * - mediaUrl: URL GIF/ảnh cho MediaGallery (hoặc attachment://filename)
 * - mediaDescription: alt text cho media (accessibility)
 * - showSeparator: hiện/ẩn đường ngăn cách giữa TextDisplay và Media
 * - files: mảng local paths hoặc attachment names để gửi kèm
 */
export interface ContainerSettings {
  accentColor: number;
  headerTemplate: string | null;
  contentLines: string[];
  mediaUrl: string | null;
  mediaDescription: string | null;
  showSeparator: boolean;
  files?: string[];
}

/**
 * Welcome feature settings - chỉ dùng Container V2.
 */
export interface WelcomeSettings {
  enabled: boolean;
  channelId: string | null;
  roleId: string | null;
  container: ContainerSettings;
}

/**
 * Leave feature settings - chỉ dùng Container V2.
 */
export interface LeaveSettings {
  enabled: boolean;
  channelId: string | null;
  container: ContainerSettings;
}

/**
 * Booster feature settings - cảm ơn khi member Server Boost.
 * Tương tự WelcomeSettings nhưng trigger khi member boost thay vì join.
 */
export interface BoosterSettings {
  enabled: boolean;
  channelId: string | null;
  roleId: string | null;
  container: ContainerSettings;
}

/**
 * DF Codes daily schedule settings.
 * Per-guild channel configuration for auto-posted daily codes.
 */
export interface DfCodesSettings {
  enabled: boolean;
  channelId: string | null;
  adminChannelId: string | null; // channel gửi thông báo lỗi (auth/token hết hạn)
  roleId: string | null;
  scheduleTime: string | null; // format "HH:mm" (24h), ví dụ "08:00"
}

/**
 * Cấu hình RBAC roles theo từng máy chủ (Guild).
 * - botAdminRoleId: Discord role ID cho BOT_ADMIN permissions (null = chưa gán)
 * - moderatorRoleId: Discord role ID cho MODERATOR permissions (null = chưa gán)
 * - memberRoleId: Discord role ID cho MEMBER permissions (null = mặc định mở cho Everyone)
 * - ownerRoleId: Legacy fallback tương đương botAdminRoleId (tương thích ngược)
 */
export interface RbacRoleSettings {
  botAdminRoleId: string | null;
  moderatorRoleId: string | null;
  memberRoleId: string | null;
  /** @deprecated Dùng botAdminRoleId thay thế. Hỗ trợ tương thích ngược với dữ liệu cũ */
  ownerRoleId?: string | null;
}

/**
 * Cấu hình kênh nhận thông báo cập nhật bot cho guild.
 */
export interface BotAnnounceSettings {
  channelId: string | null;
}

/**
 * Cấu hình cấp quyền tính năng QR trả phí theo từng máy chủ (chỉ Bot Owner quản lý).
 */
export interface QrServerSettings {
  enabled: boolean;
  updatedAt?: number | null;
  updatedBy?: string | null;
}

/**
 * Cấu hình thanh toán VietQR cho từng máy chủ.
 */
export interface VietQrSettings {
  enabled: boolean;
  mode?: 'server_wallet' | 'multi_seller'; // Chế độ: Quỹ máy chủ tập trung (server_wallet) hoặc Thợ kéo riêng lẻ (multi_seller)
  bankId: string | null; // Mã ngân hàng (VD: 'MB', 'VCB', 'TCB'...)
  accountNo: string | null; // Số tài khoản ngân hàng
  accountName: string | null; // Tên chủ tài khoản
  prefix: string; // Cú pháp tiền tố chuyển khoản (mặc định: 'NAP')
  template: 'compact' | 'compact2' | 'qr_only' | 'print';
  // ─── Tùy biến Workflow theo từng Guild ───
  staffRoleId?: string | null; // Role nhân viên/thợ được bấm nút Confirm/Cancel (ngoài Admin)
  feedbackChannelId?: string | null; // Kênh nhận tin nhắn review 5 sao
  enableRating?: boolean; // Bật/Tắt hiện 5 nút sao sau khi thanh toán thành công (mặc định: true)
  thanksMessage?: string | null; // Lời cảm ơn tùy chỉnh của từng Guild sau khi hoàn tất đơn
}

/**
 * Toàn bộ settings của 1 guild.
 * Thêm feature mới chỉ cần add key vào interface này + default.
 */
export interface GuildSettings {
  welcome: WelcomeSettings;
  leave: LeaveSettings;
  booster: BoosterSettings;
  dfCodes: DfCodesSettings;
  rbac: RbacRoleSettings;
  botAnnounce: BotAnnounceSettings;
  qrServer?: QrServerSettings;
  vietqr?: VietQrSettings;
}

/**
 * Context dùng để resolve template variables.
 */
export interface TemplateContext {
  member: GuildMember;
  guild: Guild;
}

/**
 * Shape trả về từ DB (raw row).
 */
export interface RawGuildSettingsRow {
  guild_id: string;
  settings_json: string;
  updated_at: string;
}
