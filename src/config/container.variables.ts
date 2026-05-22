/**
 * Container V2 color palette - tập trung tất cả màu sắc accent cho Container.
 * Thay đổi màu → chỉ cần chỉnh file này.
 */
export const CONTAINER_COLORS = {
  /** Xanh tím Discord Blurple - default welcome container */
  WELCOME: 0x5865f2,
  /** Đỏ - leave container */
  LEAVE: 0xed4245,
  /** Xanh lá - success container */
  SUCCESS: 0x57f287,
  /** Vàng - warning container */
  WARNING: 0xfee75c,
  /** Cam - màu Server Boost của Discord */
  BOOSTER: 0xfb663a,
} as const;

/**
 * Embed color palette - dùng cho buildSuccessContainer, buildErrorContainer.
 * Giữ lại để tái sử dụng màu sắc cho container success/error.
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
 * Default welcome container settings.
 * Dựa trên ảnh welcome message: Tập Hoá Nhà Lew.
 *
 * contentLines sử dụng template variables:
 * - {user}: mention user mới join (@user)
 * - {guild}: tên server
 * - {channel_id}: mention channel bằng ID (<#ID>)
 * - {role_id}: mention role bằng ID (<@&ID>)
 */
export const WELCOME_CONTAINER_DEFAULTS = {
  /** Accent color cho sidebar container */
  ACCENT_COLOR: CONTAINER_COLORS.WELCOME,

  /**
   * Mảng content lines cho TextDisplay.
   * Mỗi phần tử = 1 dòng text (hỗ trợ markdown full).
   * Template variables sẽ được resolve khi build.
   */
  CONTENT_LINES: [
    `Chào mừng {user} đến với {guild}`,
    `• Mọi vật phẩm được niêm giá tại <#${process.env.MENU_CHANNEL_ID}>`,
    `• Theo dõi những đợt giảm giá tại <#${process.env.STOCK_CHANNEL_ID}> hoặc <#${process.env.THONG_BAO_CHANNEL_ID}>`,
    `• Những điều cần lưu ý khi mua hàng/đạo chơi tại <#${process.env.RULES_CHANNEL_ID}> <#${process.env.DIEU_KHOAN_CHANNEL_ID}>`,
    `• Những đợt tặng quà miễn phí tại <#${process.env.GIVEAWAY_CHANNEL_ID}>`,
    `• Nếu bạn cần hỗ trợ có thể tag <@&${process.env.CHU_SOP_ROLE_ID}>, <@&${process.env.STAFF_ROLE_ID}> tại <#${process.env.CHAT_CHANNEL_ID}> hoặc mở ticket hỗ trợ/mua hàng tại <#${process.env.MUA_HANG_CHANNEL_ID}>`,
    `Cảm ơn bạn đã ghé qua {guild}, chúc bạn dạo chơi/mua sắm tại {guild} một cách vui vẻ`,
  ],

  /** URL ảnh GIF Cherry Blossom (default welcome image) */
  MEDIA_URL: 'https://cdn.discordapp.com/attachments/cherry-blossom-welcome.gif',

  /** Alt text cho media (accessibility) */
  MEDIA_DESCRIPTION: 'Welcome cherry blossom animation',

  /** Hiển thị separator giữa TextDisplay và Media */
  SHOW_SEPARATOR: true,

  /** Mảng files attachment (mặc định không có) */
  FILES: [] as string[],
} as const;

/**
 * Default leave container settings.
 */
export const LEAVE_CONTAINER_DEFAULTS = {
  /** Accent color cho sidebar container */
  ACCENT_COLOR: CONTAINER_COLORS.LEAVE,

  /** Content lines cho leave message */
  CONTENT_LINES: [`{user} đã rời khỏi {guild}.`, `Chúc {user} tốt lành!`],

  /** Media URL (mặc định không có) */
  MEDIA_URL: null,

  /** Media description */
  MEDIA_DESCRIPTION: null,

  /** Separator */
  SHOW_SEPARATOR: false,

  /** Files */
  FILES: [] as string[],
} as const;

/**
 * Default booster container settings - cảm ơn khi member Server Boost.
 * Màu cam (0xfb663a) là màu Server Boost chính thức của Discord.
 */
export const BOOSTER_CONTAINER_DEFAULTS = {
  /** Accent color cam - màu Server Boost */
  ACCENT_COLOR: CONTAINER_COLORS.BOOSTER,

  /** Content lines cho booster thank-you message */
  CONTENT_LINES: [
    `Cảm ơn {user} đã Server Boost {guild}! 🚀`,
    `Server của chúng ta đang được hỗ trợ bởi bạn!`,
  ],

  /** Media URL (mặc định không có) */
  MEDIA_URL: null,

  /** Media description */
  MEDIA_DESCRIPTION: null,

  /** Separator */
  SHOW_SEPARATOR: false,

  /** Files */
  FILES: [] as string[],
} as const;
