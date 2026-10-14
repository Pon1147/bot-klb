/**
 * Service tìm kiếm kênh phát Auto-Post thông minh (Smart Channel Matcher).
 * Tự động phân tích tên kênh, loại trừ kênh thông báo/quản trị, và chọn đúng kênh game thủ hoạt động.
 */

import { Guild, TextChannel, PermissionFlagsBits, GuildMember } from 'discord.js';
import { AutoPostContentType } from '../database/df-autopost.db.js';

export type AutoPostMatchTier =
  'configured' | 'content' | 'game' | 'feature' | 'community' | 'fallback' | 'none';

export interface AutoPostChannelMatchResult {
  channel: TextChannel | null;
  matchTier: AutoPostMatchTier;
  matchReason?: string;
  reason?: string;
}

/**
 * Danh sách từ khóa trong tên kênh cần LOẠI TRỪ TUYỆT ĐỐI (Blacklist).
 * Không bao giờ tự động gửi cẩm nang game vào các kênh thông báo chính thức,
 * kênh điều hành, kênh log hoặc kênh nhạy cảm của Admin.
 */
export const AUTOPOST_BLACKLIST_KEYWORDS = [
  'thông-báo',
  'thong-bao',
  'thongbao',
  'announcement',
  'announcements',
  'news',
  'tin-tuc',
  'rules',
  'rule',
  'luật',
  'luat',
  'welcome',
  'chào-mừng',
  'chao-mung',
  'booster',
  'boost',
  'ticket',
  'tickets',
  'mod',
  'admin',
  'log',
  'logs',
  'audit',
  'staff',
  'setup',
  'báo-cáo',
  'bao-cao',
  'quản-trị',
  'quan-tri',
];

/**
 * Danh sách từ khóa ưu tiên theo loại nội dung (Tier A: Khớp chính xác chuyên mục).
 */
export const AUTOPOST_CONTENT_KEYWORDS: Record<AutoPostContentType, string[]> = {
  gun: ['súng', 'sung', 'gun', 'build', 'vũ-khí', 'vu-khi', 'weapon', 'loadout'],
  map: ['map', 'bản-đồ', 'ban-do', 'bando', 'chiến-địa', 'chien-dia'],
};

/**
 * Danh sách từ khóa nhận diện kênh game Delta Force (Tier B: Khớp game).
 */
export const AUTOPOST_GAME_KEYWORDS = ['delta-force', 'deltaforce', 'delta', 'df'];

/**
 * Danh sách từ khóa kênh tiện ích / hướng dẫn game (Tier C: Tiện ích).
 * Không chứa 'code' vì kênh 'code' thường dành riêng cho mật mã hòm đồ (/df code).
 */
export const AUTOPOST_FEATURE_KEYWORDS = [
  'useful',
  'mẹo',
  'meo',
  'hướng-dẫn',
  'huong-dan',
  'guide',
  'chiến-tích',
  'chien-tich',
];

/**
 * Danh sách từ khóa kênh chat cộng đồng chung (Tier D: Chat chung).
 */
export const AUTOPOST_COMMUNITY_KEYWORDS = [
  'chat-chung',
  'chatchung',
  'thảo-luận',
  'thao-luan',
  'giao-lưu',
  'giao-luu',
  'all-in-one',
  'general',
  'chung',
  'chat',
];

/**
 * Chuẩn hóa tên kênh Discord:
 * - Phân rã Unicode NFKD để hỗ trợ các font chữ nghệ thuật (ví dụ: Mathematical Bold 𝐆 -> G, 𝐂 -> C).
 * - Trả về bản gốc giữ dấu tiếng Việt và bản ASCII không dấu để so sánh linh hoạt.
 */
export function cleanChannelName(rawName: string): { original: string; ascii: string } {
  const nfkd = rawName.normalize('NFKD').toLowerCase();
  const original = nfkd.replace(
    /[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g,
    '-',
  );
  const ascii = nfkd
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '-');
  return { original, ascii };
}

/**
 * Kiểm tra xem tên kênh đã chuẩn hóa có chứa bất kỳ từ khóa nào trong danh sách không.
 */
export function matchesKeywords(
  cleaned: { original: string; ascii: string },
  keywords: string[],
): boolean {
  return keywords.some((kw) => {
    const kwAscii = kw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase();
    return cleaned.original.includes(kw.toLowerCase()) || cleaned.ascii.includes(kwAscii);
  });
}

/**
 * Kiểm tra bot có đủ quyền xem kênh và gửi tin nhắn trong text channel hay không.
 */
export function hasSendPermissions(channel: TextChannel, botMember: GuildMember | null): boolean {
  if (!botMember) return false;
  const perms = channel.permissionsFor(botMember);
  return Boolean(perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]));
}

/**
 * Tìm kênh văn bản tối ưu nhất để phát Auto-Post (map hoặc gun).
 *
 * Thứ tự ưu tiên:
 * 1. Kênh cấu hình riêng cho Auto-Post (nếu có).
 * 2. Kênh khớp chính xác loại nội dung (Tier A: gun / map).
 * 3. Kênh chuyên về Delta Force (Tier B: delta, df).
 * 4. Kênh tiện ích / hướng dẫn game (Tier C: useful, guide...).
 * 5. Kênh chat cộng đồng chung (Tier D: chat-chung, general, chung...).
 * 6. Kênh văn bản an toàn đầu tiên (không thuộc blacklist).
 *
 * BẢO VỆ TUYỆT ĐỐI (Loại trừ):
 * - Kênh thông báo cập nhật bot (botAnnounceChannelId)
 * - Kênh hiển thị mật mã hòm đồ hàng ngày (dfCodesChannelId)
 * - Các kênh thông báo/quản trị thuộc AUTOPOST_BLACKLIST_KEYWORDS
 */
export function findAutoPostTargetChannel(
  guild: Guild,
  type: AutoPostContentType,
  options: {
    configuredChannelId?: string | null;
    dfCodesChannelId?: string | null;
    botAnnounceChannelId?: string | null;
  } = {},
): AutoPostChannelMatchResult {
  const botMember = guild.members.me;
  if (!botMember) {
    return {
      channel: null,
      matchTier: 'none',
      reason: 'Bot không tồn tại trong cache thành viên của máy chủ',
    };
  }

  // 1. Kênh cấu hình riêng cho Auto-Post (nếu có)
  if (options.configuredChannelId) {
    const configured = guild.channels.cache.get(options.configuredChannelId);
    if (
      configured &&
      configured.isTextBased() &&
      !configured.isDMBased() &&
      !configured.isVoiceBased() &&
      hasSendPermissions(configured as TextChannel, botMember)
    ) {
      return {
        channel: configured as TextChannel,
        matchTier: 'configured',
        matchReason: 'Kênh cấu hình thủ công cho Auto-Post',
      };
    }
  }

  // Lọc toàn bộ text channels mà bot có quyền gửi tin
  const availableTextChannels = Array.from(guild.channels.cache.values()).filter(
    (c): c is TextChannel =>
      c.isTextBased() &&
      !c.isDMBased() &&
      !c.isVoiceBased() &&
      'permissionsFor' in c &&
      hasSendPermissions(c as TextChannel, botMember),
  );

  if (availableTextChannels.length === 0) {
    return {
      channel: null,
      matchTier: 'none',
      reason: 'Không tìm thấy kênh văn bản khả dụng có quyền gửi tin nhắn',
    };
  }

  // Loại trừ kênh botAnnounce, kênh dfCodes (mật mã hòm đồ) và các kênh thuộc Blacklist
  const safeChannels = availableTextChannels.filter((c) => {
    // Không gửi vào kênh thông báo update bot
    if (options.botAnnounceChannelId && c.id === options.botAnnounceChannelId) {
      return false;
    }
    // Không làm loãng kênh nhận mật mã hòm đồ hàng ngày của server (/df code)
    if (options.dfCodesChannelId && c.id === options.dfCodesChannelId) {
      return false;
    }
    const cleaned = cleanChannelName(c.name);
    return !matchesKeywords(cleaned, AUTOPOST_BLACKLIST_KEYWORDS);
  });

  if (safeChannels.length === 0) {
    return {
      channel: null,
      matchTier: 'none',
      reason:
        'Toàn bộ kênh khả dụng đều là kênh thông báo hoặc kênh quản trị (đã loại trừ an toàn)',
    };
  }

  // 3. Tier A: Khớp chính xác nội dung ('gun' hoặc 'map')
  const contentKeywords = AUTOPOST_CONTENT_KEYWORDS[type] ?? [];
  const contentMatch = safeChannels.find((c) =>
    matchesKeywords(cleanChannelName(c.name), contentKeywords),
  );
  if (contentMatch) {
    const label = type === 'gun' ? 'Build Súng' : 'Bản Đồ 3D';
    return {
      channel: contentMatch,
      matchTier: 'content',
      matchReason: `Khớp chuyên mục ${label}`,
    };
  }

  // 4. Tier B: Khớp kênh game Delta Force
  const gameMatch = safeChannels.find((c) =>
    matchesKeywords(cleanChannelName(c.name), AUTOPOST_GAME_KEYWORDS),
  );
  if (gameMatch) {
    return {
      channel: gameMatch,
      matchTier: 'game',
      matchReason: 'Khớp kênh game Delta Force',
    };
  }

  // 5. Tier C: Khớp kênh tiện ích / mã game
  const featureMatch = safeChannels.find((c) =>
    matchesKeywords(cleanChannelName(c.name), AUTOPOST_FEATURE_KEYWORDS),
  );
  if (featureMatch) {
    return {
      channel: featureMatch,
      matchTier: 'feature',
      matchReason: 'Khớp kênh tiện ích / mã game',
    };
  }

  // 6. Tier D: Khớp kênh chat cộng đồng chung
  const communityMatch = safeChannels.find((c) =>
    matchesKeywords(cleanChannelName(c.name), AUTOPOST_COMMUNITY_KEYWORDS),
  );
  if (communityMatch) {
    return {
      channel: communityMatch,
      matchTier: 'community',
      matchReason: 'Khớp kênh chat cộng đồng',
    };
  }

  // 7. Fallback: Lấy kênh văn bản an toàn đầu tiên
  const fallback = safeChannels[0];
  return {
    channel: fallback,
    matchTier: 'fallback',
    matchReason: 'Kênh văn bản an toàn khả dụng',
  };
}
