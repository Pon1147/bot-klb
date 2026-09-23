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

  const joinedAtTimestamp = member.joinedAt ? member.joinedAt.getTime() : Date.now();

  const variables: Record<string, string> = {
    // Member
    [TEMPLATE_VARIABLES.MEMBER]: member.user.toString(),
    [TEMPLATE_VARIABLES.USER]: member.user.toString(), // alias cho Container V2
    [TEMPLATE_VARIABLES.MEMBER_NAME]: member.user.username,
    [TEMPLATE_VARIABLES.MEMBER_TAG]: member.user.tag,

    // Guild
    [TEMPLATE_VARIABLES.GUILD]: guild.name,

    // Dates
    [TEMPLATE_VARIABLES.ACCOUNT_CREATION_DATE]: formatDate(member.user.createdTimestamp),
    [TEMPLATE_VARIABLES.ACCOUNT_AGE]: formatAccountAge(member.user.createdTimestamp),
    [TEMPLATE_VARIABLES.SERVER_JOINING_DATE]: formatDate(joinedAtTimestamp),

    // Counts
    [TEMPLATE_VARIABLES.MEMBER_COUNT]: String(guild.memberCount),
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Thay thế tất cả occurrences của {key}
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}
