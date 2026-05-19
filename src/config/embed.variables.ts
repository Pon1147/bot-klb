/**
 * Embed color palette - tập trung tất cả màu sắc embed ở 1 nơi.
 * Thay đổi màu → chỉ cần chỉnh file này.
 */
export const EMBED_COLORS = {
  /** Xanh lá - welcome messages */
  WELCOME: 0x00FF00,
  /** Đỏ - leave messages */
  LEAVE: 0xFF0000,
  /** Đỏ - error messages */
  ERROR: 0xFF0000,
  /** Xanh lá - success messages */
  SUCCESS: 0x00FF00,
  /** Xanh dương - info messages */
  INFO: 0x0099FF,
} as const;

/**
 * Alias cho backward compatibility (embedColors cũ).
 */
export const embedColors = {
  welcome: EMBED_COLORS.WELCOME,
  leave: EMBED_COLORS.LEAVE,
  error: EMBED_COLORS.ERROR,
  success: EMBED_COLORS.SUCCESS,
  info: EMBED_COLORS.INFO,
};

/**
 * Default welcome embed settings.
 * Thay đổi default welcome → chỉ cần chỉnh file này.
 */
export const WELCOME_EMBED_DEFAULTS = {
  /** Title template - hỗ trợ {member}, {guild}, ... */
  TITLE: 'Welcome {member}!',
  /** Description template */
  DESCRIPTION: 'Chào mừng đến với {guild}!\n\nVui lòng đọc quy tắc và tận hưởng!',
  /** Color (sử dụng EMBED_COLORS.WELCOME) */
  COLOR: EMBED_COLORS.WELCOME,
  /** Hiển thị avatar member làm thumbnail */
  THUMBNAIL: true,
  /** URL ảnh lớn hiển thị trong embed (banner welcome) */
  IMAGE: null,
  /** Footer text */
  FOOTER: 'Welcome Bot',
  /** Footer icon URL */
  FOOTER_ICON: null,
  /** Embed title URL */
  URL: null,
  /** Hiện timestamp */
  TIMESTAMP: true,
  /** Embed fields */
  FIELDS: [
    { name: 'Tài khoản tạo', value: '{accountCreationDate}', inline: true },
    { name: 'Ngày tham gia', value: '{serverJoiningDate}', inline: true },
    { name: 'So member', value: '{memberCount}', inline: true },
  ] as const,
} as const;

/**
 * Default leave embed settings.
 * Thay đổi default leave → chỉ cần chỉnh file này.
 */
export const LEAVE_EMBED_DEFAULTS = {
  /** Title template */
  TITLE: '{member} đã rời server.',
  /** Description template */
  DESCRIPTION: 'Chúc {member} tốt lành!',
  /** Color (sử dụng EMBED_COLORS.LEAVE) */
  COLOR: EMBED_COLORS.LEAVE,
  /** Hiển thị avatar member làm thumbnail */
  THUMBNAIL: true,
  /** URL ảnh lớn */
  IMAGE: null,
  /** Footer text */
  FOOTER: 'Leave Bot',
  /** Footer icon URL */
  FOOTER_ICON: null,
  /** Embed title URL */
  URL: null,
  /** Hiện timestamp */
  TIMESTAMP: true,
  /** Embed fields (mặc định không có field) */
  FIELDS: [] as const,
} as const;
