/**
 * Template variables cho welcome/leave embed messages.
 *
 * Mọi template variable dùng trong {variable} syntax được định nghĩa ở đây.
 * Thêm variable mới → chỉ cần add vào object này + resolver trong template.utils.ts.
 */

export const TEMPLATE_VARIABLES = {
  /** Member mention (@user) - dùng cho cả Embed và Container */
  MEMBER: 'member',
  /** User mention (@user) - alias của member, dùng cho Container V2 */
  USER: 'user',
  /** Member username (không mention) */
  MEMBER_NAME: 'memberName',
  /** Member tag (username#discriminator) */
  MEMBER_TAG: 'memberTag',
  /** Guild/server name */
  GUILD: 'guild',
  /** Ngày tạo tài khoản (format tiếng Việt) */
  ACCOUNT_CREATION_DATE: 'accountCreationDate',
  /** Tuổi tài khoản (x ngày trước / x tháng trước) */
  ACCOUNT_AGE: 'accountAge',
  /** Ngày tham gia server (format tiếng Việt) */
  SERVER_JOINING_DATE: 'serverJoiningDate',
  /** Số lượng member hiện tại của server */
  MEMBER_COUNT: 'memberCount',
} as const;

/**
 * Label mô tả cho từng template variable (dùng cho docs/help commands).
 */
export const TEMPLATE_VARIABLE_DESCRIPTIONS: Record<string, string> = {
  member: 'Mention thành viên (@user)',
  user: 'Mention thành viên (@user) - alias của member',
  memberName: 'Tên thành viên (username)',
  memberTag: 'Tag thành viên (username#tag)',
  guild: 'Tên server',
  accountCreationDate: 'Ngày tạo tài khoản',
  accountAge: 'Tuổi tài khoản',
  serverJoiningDate: 'Ngày tham gia server',
  memberCount: 'Số lượng member trong server',
};
