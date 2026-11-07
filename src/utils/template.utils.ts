import { TemplateContext } from '../types/settings.types.js';
import { TEMPLATE_VARIABLES } from '../config/variables.js';

/**
 * Định dạng ngày tháng tiếng Việt.
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Tính tuổi tài khoản (số ngày/tháng).
 */
function formatAccountAge(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) {
    return 'Hôm nay';
  }
  if (diffDays < 30) {
    return `${diffDays} ngày trước`;
  }
  const months = Math.floor(diffDays / 30);
  return `${months} tháng trước`;
}

/**
 * Resolve template variables trong 1 string.
 * Thay thế {variable} bằng giá trị thực từ context.
 * Nếu variable không tìm thấy → giữ nguyên string gốc.
 */
export function resolveTemplate(template: string, context: TemplateContext): string {
  const { member, guild } = context;

  const now = Date.now();
  const unixNow = Math.floor(now / 1000);
  const joinedAtTimestamp = member.joinedAt ? member.joinedAt.getTime() : now;
  const boostCount = String(guild.premiumSubscriptionCount ?? 0);
  const boostLevel = String(guild.premiumTier ?? 0);

  const variables: Record<string, string> = {
    // Member
    [TEMPLATE_VARIABLES.MEMBER]: member.user.toString(),
    [TEMPLATE_VARIABLES.USER]: member.user.toString(), // alias cho Container V2
    [TEMPLATE_VARIABLES.MEMBER_NAME]: member.user.username,
    [TEMPLATE_VARIABLES.MEMBER_NAME_SNAKE]: member.user.username,
    [TEMPLATE_VARIABLES.MEMBER_TAG]: member.user.tag,
    [TEMPLATE_VARIABLES.MEMBER_TAG_SNAKE]: member.user.tag,

    // Guild / Server
    [TEMPLATE_VARIABLES.GUILD]: guild.name,
    [TEMPLATE_VARIABLES.SERVER]: guild.name,
    [TEMPLATE_VARIABLES.MEMBER_COUNT]: String(guild.memberCount),
    [TEMPLATE_VARIABLES.MEMBER_COUNT_SNAKE]: String(guild.memberCount),

    // Boost
    [TEMPLATE_VARIABLES.BOOST_COUNT]: boostCount,
    [TEMPLATE_VARIABLES.BOOST_COUNT_SNAKE]: boostCount,
    [TEMPLATE_VARIABLES.BOOST_LEVEL]: boostLevel,
    [TEMPLATE_VARIABLES.BOOST_LEVEL_SNAKE]: boostLevel,

    // Dates & Timestamps
    [TEMPLATE_VARIABLES.TIMESTAMP]: `<t:${unixNow}:f>`,
    [TEMPLATE_VARIABLES.TIMESTAMP_RELATIVE]: `<t:${unixNow}:R>`,
    [TEMPLATE_VARIABLES.DATE]: formatDate(now),
    [TEMPLATE_VARIABLES.ACCOUNT_CREATION_DATE]: formatDate(member.user.createdTimestamp),
    [TEMPLATE_VARIABLES.ACCOUNT_CREATION_DATE_SNAKE]: formatDate(member.user.createdTimestamp),
    [TEMPLATE_VARIABLES.ACCOUNT_AGE]: formatAccountAge(member.user.createdTimestamp),
    [TEMPLATE_VARIABLES.ACCOUNT_AGE_SNAKE]: formatAccountAge(member.user.createdTimestamp),
    [TEMPLATE_VARIABLES.SERVER_JOINING_DATE]: formatDate(joinedAtTimestamp),
    [TEMPLATE_VARIABLES.SERVER_JOINING_DATE_SNAKE]: formatDate(joinedAtTimestamp),
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Thay thế tất cả occurrences của {key}
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}
