/**
 * Template variables cho welcome/leave/booster embed & container messages.
 *
 * Mọi template variable dùng trong {variable} syntax được định nghĩa ở đây.
 * Thêm variable mới → chỉ cần add vào object này + resolver trong template.utils.ts.
 */

export const TEMPLATE_VARIABLES = {
  // ─── Member ───
  /** Member mention (@user) - dùng cho cả Embed và Container */
  MEMBER: 'member',
  /** User mention (@user) - alias của member, dùng cho Container V2 */
  USER: 'user',
  /** Member username (không mention) */
  MEMBER_NAME: 'memberName',
  /** Alias snake_case cho username */
  MEMBER_NAME_SNAKE: 'member_name',
  /** Member tag (username#discriminator) */
  MEMBER_TAG: 'memberTag',
  /** Alias snake_case cho tag */
  MEMBER_TAG_SNAKE: 'member_tag',

  // ─── Guild / Server ───
  /** Guild/server name */
  GUILD: 'guild',
  /** Alias thân thiện cho server name */
  SERVER: 'server',
  /** Số lượng member hiện tại của server */
  MEMBER_COUNT: 'memberCount',
  /** Alias snake_case cho member count */
  MEMBER_COUNT_SNAKE: 'member_count',

  // ─── Server Boost ───
  /** Tổng số lượt boost của server */
  BOOST_COUNT: 'boostCount',
  /** Alias snake_case cho tổng số lượt boost */
  BOOST_COUNT_SNAKE: 'boost_count',
  /** Cấp độ boost hiện tại của server (0, 1, 2, 3) */
  BOOST_LEVEL: 'boostLevel',
  /** Alias snake_case cho cấp độ boost */
  BOOST_LEVEL_SNAKE: 'boost_level',

  // ─── Dates & Timestamps ───
  /** Discord dynamic full timestamp: <t:UNIX:f> */
  TIMESTAMP: 'timestamp',
  /** Discord dynamic relative timestamp: <t:UNIX:R> */
  TIMESTAMP_RELATIVE: 'timestamp_r',
  /** Ngày hiện tại định dạng tiếng Việt */
  DATE: 'date',
  /** Ngày tạo tài khoản (format tiếng Việt) */
  ACCOUNT_CREATION_DATE: 'accountCreationDate',
  /** Alias snake_case cho ngày tạo tài khoản */
  ACCOUNT_CREATION_DATE_SNAKE: 'account_creation_date',
  /** Tuổi tài khoản (x ngày trước / x tháng trước) */
  ACCOUNT_AGE: 'accountAge',
  /** Alias snake_case cho tuổi tài khoản */
  ACCOUNT_AGE_SNAKE: 'account_age',
  /** Ngày tham gia server (format tiếng Việt) */
  SERVER_JOINING_DATE: 'serverJoiningDate',
  /** Alias snake_case cho ngày tham gia server */
  SERVER_JOINING_DATE_SNAKE: 'server_joining_date',
} as const;

/**
 * Label mô tả cho từng template variable (dùng cho docs/help commands).
 */
export const TEMPLATE_VARIABLE_DESCRIPTIONS: Record<string, string> = {
  member: 'Mention thành viên (@user)',
  user: 'Mention thành viên (@user) - alias của member',
  memberName: 'Tên thành viên (username)',
  member_name: 'Tên thành viên (username) - alias',
  memberTag: 'Tag thành viên (username#tag)',
  member_tag: 'Tag thành viên (username#tag) - alias',
  guild: 'Tên server',
  server: 'Tên server - alias của guild',
  memberCount: 'Số lượng member trong server',
  member_count: 'Số lượng member trong server - alias',
  boostCount: 'Tổng số lượt boost của server',
  boost_count: 'Tổng số lượt boost của server - alias',
  boostLevel: 'Cấp độ boost của server (0, 1, 2, 3)',
  boost_level: 'Cấp độ boost của server - alias',
  timestamp: 'Mốc thời gian Discord dynamic (<t:timestamp:f>)',
  timestamp_r: 'Mốc thời gian tương đối Discord (<t:timestamp:R>)',
  date: 'Ngày hiện tại (định dạng tiếng Việt)',
  accountCreationDate: 'Ngày tạo tài khoản',
  account_creation_date: 'Ngày tạo tài khoản - alias',
  accountAge: 'Tuổi tài khoản',
  account_age: 'Tuổi tài khoản - alias',
  serverJoiningDate: 'Ngày tham gia server',
  server_joining_date: 'Ngày tham gia server - alias',
};
