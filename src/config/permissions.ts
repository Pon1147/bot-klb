/**
 * RBAC (Role-Based Access Control) config.
 * Quản lý role IDs và command permissions.
 */

export interface RoleConfig {
  Owner: string;
  Moderator: string;
  Member: string;
}

export interface CommandPermission {
  /** Danh sách role IDs được phép dùng command này */
  requiredRoles: string[];
}

export interface PermissionsConfig {
  roles: RoleConfig;
  commands: Record<string, CommandPermission>;
}

/** Runtime cache cho role IDs */
export const ROLE_IDS: Record<string, string> = {};

/**
 * Load permissions từ JSON file vào runtime cache.
 * Gọi 1 lần khi bootstrap bot.
 */
export function loadPermissions(config: PermissionsConfig): void {
  // Cache role IDs
  Object.entries(config.roles).forEach(([name, id]) => {
    ROLE_IDS[name] = id;
  });
}

import { existsSync } from 'fs';
import { join } from 'path';
import { PermissionFlagsBits } from 'discord.js';
import type { RbacRoleSettings } from '../types/settings.types.js';

/**
 * Default fallback permissions config.
 * Dùng khi permissions.json bị thiếu hoặc không đọc được trên production.
 */
export const DEFAULT_PERMISSIONS: PermissionsConfig = {
  roles: {
    Owner: '1536596880157446144',
    Moderator: '1504374050779303936',
    Member: '1513800432214872145',
  },
  commands: {
    container: {
      requiredRoles: ['Owner', 'Moderator'],
    },
    'df-link': {
      requiredRoles: ['Member'],
    },
    'df-unlink': {
      requiredRoles: ['Member'],
    },
    'df-daily': {
      requiredRoles: ['Member'],
    },
    'df-stats': {
      requiredRoles: ['Member'],
    },
    'df-history': {
      requiredRoles: ['Member'],
    },
    'df-code': {
      requiredRoles: ['Member'],
    },
    'team-find': {
      requiredRoles: ['Member'],
    },
    booster: {
      requiredRoles: ['Owner', 'Moderator'],
    },
    welcome: {
      requiredRoles: ['Owner', 'Moderator'],
    },
  },
};

/**
 * Tìm đường dẫn file permissions.json qua nhiều ứng viên (environment, cwd, dist, src).
 */
export function getPermissionsFilePath(): string {
  if (process.env.PERMISSIONS_PATH) {
    return process.env.PERMISSIONS_PATH;
  }

  const candidatePaths = [
    join(process.cwd(), 'data', 'permissions.json'),
    join(process.cwd(), 'src', 'config', 'permissions.json'),
    join(process.cwd(), 'dist', 'config', 'permissions.json'),
    join(process.cwd(), 'config', 'permissions.json'),
    join(__dirname, '..', 'src', 'config', 'permissions.json'),
    join(__dirname, '..', 'config', 'permissions.json'),
    join(__dirname, 'permissions.json'),
  ];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return join(process.cwd(), 'src', 'config', 'permissions.json');
}

/**
 * Check xem user có ít nhất 1 role được yêu cầu không.
 */
export function hasRequiredRole(userRoleIds: string[], requiredRoleIds: string[]): boolean {
  return requiredRoleIds.some((roleId) => userRoleIds.includes(roleId));
}

// ─── Target Terminology & Roles (PHASE 1) ──────────────────────────

/**
 * Các vai trò Bot RBAC có thể cấu hình được:
 * - BOT_ADMIN: Role quản trị cao nhất của bot trong guild
 * - MODERATOR: Role điều hành bot trong guild
 * - MEMBER: Role thành viên bot trong guild (tùy chọn)
 */
export type BotRole = 'BOT_ADMIN' | 'MODERATOR' | 'MEMBER';

export const BOT_ROLES = {
  BOT_ADMIN: 'BOT_ADMIN',
  MODERATOR: 'MODERATOR',
  MEMBER: 'MEMBER',
} as const;

/**
 * Cấp bậc thẩm quyền theo thứ tự ưu tiên (Precedence):
 * GUILD_OWNER -> ADMINISTRATOR -> BOT_ADMIN -> MODERATOR -> MEMBER -> EVERYONE
 */
export type AuthorityLevel =
  'GUILD_OWNER' | 'ADMINISTRATOR' | 'BOT_ADMIN' | 'MODERATOR' | 'MEMBER' | 'EVERYONE';

/**
 * Danh sách các Action Policy trong hệ thống:
 * - MANAGE_RBAC: Quyền quản lý phân quyền bot (Guild Owner, Admin, BOT_ADMIN)
 * - MANAGE_CONFIG: Quyền cấu hình tính năng bot (Guild Owner, Admin, BOT_ADMIN, MODERATOR)
 * - MANAGE_DF_CODE: Quyền cấu hình mã tự động DF (Guild Owner, Admin, BOT_ADMIN, MODERATOR)
 * - DF_ACCESS: Quyền truy cập tính năng game DF (Mặc định Everyone, hoặc Member role nếu cấu hình)
 * - TEAM_ACCESS: Quyền tìm đồng đội (Mặc định Everyone, hoặc Member role nếu cấu hình)
 */
export type Policy =
  'MANAGE_RBAC' | 'MANAGE_CONFIG' | 'MANAGE_DF_CODE' | 'DF_ACCESS' | 'TEAM_ACCESS';

export const Policy = {
  MANAGE_RBAC: 'MANAGE_RBAC',
  MANAGE_CONFIG: 'MANAGE_CONFIG',
  MANAGE_DF_CODE: 'MANAGE_DF_CODE',
  DF_ACCESS: 'DF_ACCESS',
  TEAM_ACCESS: 'TEAM_ACCESS',
} as const;

// ─── Command Path → Policy Mapping (PHASE 4) ──────────────────────

export const COMMAND_PATH_POLICIES: Record<string, Policy> = {
  'config.roles.set': Policy.MANAGE_RBAC,
  'config.roles.view': Policy.MANAGE_RBAC,

  'config.welcome.setchannel': Policy.MANAGE_CONFIG,
  'config.welcome.setrole': Policy.MANAGE_CONFIG,
  'config.welcome.toggle': Policy.MANAGE_CONFIG,
  'config.welcome.status': Policy.MANAGE_CONFIG,

  'config.booster.setchannel': Policy.MANAGE_CONFIG,
  'config.booster.setrole': Policy.MANAGE_CONFIG,
  'config.booster.toggle': Policy.MANAGE_CONFIG,
  'config.booster.status': Policy.MANAGE_CONFIG,

  'config.container.edit': Policy.MANAGE_CONFIG,
  'config.container.reset': Policy.MANAGE_CONFIG,

  'df.stats': Policy.DF_ACCESS,
  'df.daily': Policy.DF_ACCESS,
  'df.history': Policy.DF_ACCESS,
  'df.workshop': Policy.DF_ACCESS,
  'df.unlink': Policy.DF_ACCESS,

  'df.code.show': Policy.DF_ACCESS,
  'df.code.status': Policy.DF_ACCESS,
  'df.code.setchannel': Policy.MANAGE_DF_CODE,
  'df.code.settime': Policy.MANAGE_DF_CODE,
  'df.code.setadminchannel': Policy.MANAGE_DF_CODE,

  'df.link.start': Policy.DF_ACCESS,
  'df.link.status': Policy.DF_ACCESS,
  'df.link.manual': Policy.DF_ACCESS,

  'team.find': Policy.TEAM_ACCESS,
};

/**
 * Phân giải Policy tương ứng cho một canonical command path.
 * Trả về Policy hoặc null nếu path chưa được định nghĩa (ví dụ legacy command).
 */
export function resolveCommandPolicy(commandPath: string): Policy | null {
  return COMMAND_PATH_POLICIES[commandPath] ?? null;
}

/**
 * Lấy botAdminRoleId với fallback về ownerRoleId cũ (tương thích ngược)
 */
export function getBotAdminRoleId(
  rbac?: { botAdminRoleId?: string | null; ownerRoleId?: string | null } | null,
): string | null {
  return rbac?.botAdminRoleId ?? rbac?.ownerRoleId ?? null;
}

// ─── Resolver Primitives ──────────────────────────────────────────

export interface ResolvePolicyOptions {
  userRoleIds: string[];
  isGuildOwner: boolean;
  isAdmin: boolean;
  guildRbac?:
    | RbacRoleSettings
    | {
        botAdminRoleId?: string | null;
        ownerRoleId?: string | null;
        moderatorRoleId?: string | null;
        memberRoleId?: string | null;
      }
    | null;
  isGuild: boolean;
}

export interface ResolvePolicyResult {
  allowed: boolean;
  reason?: string;
  matchedAuthority?: AuthorityLevel;
}

/**
 * Hàm phân giải quyền hạn theo Policy (Policy Resolver Primitive).
 *
 * Thứ tự ưu tiên (Precedence):
 * 1. GUILD_OWNER (Discord native: guild.ownerId === user.id)
 * 2. ADMINISTRATOR (Discord native permission: Administrator)
 * 3. BOT_ADMIN (configured bot role: botAdminRoleId hoặc ownerRoleId cũ)
 * 4. MODERATOR (configured bot role: moderatorRoleId)
 * 5. MEMBER (configured bot role: memberRoleId)
 * 6. EVERYONE (khi policy mở cho Everyone)
 */
export function resolvePolicy(policy: Policy, options: ResolvePolicyOptions): ResolvePolicyResult {
  const { userRoleIds, isGuildOwner, isAdmin, guildRbac, isGuild } = options;

  // Xử lý Guild-less Interaction (DM context)
  if (!isGuild) {
    return {
      allowed: false,
      reason: 'Chỉ có thể sử dụng lệnh này trong máy chủ (server).',
    };
  }

  // 1. Guild Owner (Discord native)
  if (isGuildOwner) {
    return { allowed: true, matchedAuthority: 'GUILD_OWNER' };
  }

  // 2. Administrator (Discord native permission)
  if (isAdmin) {
    return { allowed: true, matchedAuthority: 'ADMINISTRATOR' };
  }

  // Lấy role IDs đã cấu hình của guild (backward compatible với ownerRoleId)
  const botAdminRoleId = getBotAdminRoleId(guildRbac);
  const moderatorRoleId = guildRbac?.moderatorRoleId ?? null;
  const memberRoleId = guildRbac?.memberRoleId ?? null;

  // 3. BOT_ADMIN (configured bot role)
  const hasBotAdmin = Boolean(botAdminRoleId && userRoleIds.includes(botAdminRoleId));
  if (hasBotAdmin) {
    return { allowed: true, matchedAuthority: 'BOT_ADMIN' };
  }

  // 4. MODERATOR (configured bot role)
  const hasModerator = Boolean(moderatorRoleId && userRoleIds.includes(moderatorRoleId));

  // Đánh giá quyền theo từng Policy cụ thể
  switch (policy) {
    case 'MANAGE_RBAC': {
      // Allowed: Guild Owner OR Administrator OR BOT_ADMIN
      return {
        allowed: false,
        reason:
          '🔒 Lệnh này yêu cầu quyền Quản trị viên (Administrator) hoặc Bot Admin của máy chủ.',
      };
    }

    case 'MANAGE_CONFIG':
    case 'MANAGE_DF_CODE': {
      // Allowed: Guild Owner OR Administrator OR BOT_ADMIN OR MODERATOR
      if (hasModerator) {
        return { allowed: true, matchedAuthority: 'MODERATOR' };
      }
      return {
        allowed: false,
        reason: '🔒 Lệnh này yêu cầu quyền Quản trị viên hoặc role Moderator của máy chủ.',
      };
    }

    case 'DF_ACCESS':
    case 'TEAM_ACCESS': {
      // Moderator cũng có toàn quyền truy cập game
      if (hasModerator) {
        return { allowed: true, matchedAuthority: 'MODERATOR' };
      }

      // Nếu guild chưa cấu hình memberRoleId -> Mặc định EVERYONE được phép
      if (!memberRoleId) {
        return { allowed: true, matchedAuthority: 'EVERYONE' };
      }

      // 5. MEMBER (configured bot role)
      if (userRoleIds.includes(memberRoleId)) {
        return { allowed: true, matchedAuthority: 'MEMBER' };
      }

      return {
        allowed: false,
        reason: `🔒 Lệnh này yêu cầu role <@&${memberRoleId}> hoặc quyền Quản trị viên.`,
      };
    }

    default: {
      return {
        allowed: false,
        reason: '🔒 Không có quyền thực thi.',
      };
    }
  }
}

// ─── High-Level Resolver API ──────────────────────────────────────

export interface PolicyInteractionContext {
  guild?: { ownerId?: string | null; id?: string } | null;
  guildId?: string | null;
  user?: { id: string };
  member?: unknown;
  memberPermissions?: { has(permission: bigint): boolean } | null;
}

/**
 * Trích xuất danh sách role IDs từ interaction.member
 */
export function extractMemberRoleIds(member: unknown): string[] {
  if (!member || typeof member !== 'object') return [];
  const m = member as Record<string, unknown>;
  if (m.roles && typeof m.roles === 'object') {
    const rolesObj = m.roles as Record<string, unknown>;
    if (rolesObj.cache && typeof rolesObj.cache === 'object') {
      const cache = rolesObj.cache as {
        map?: (fn: (r: { id: string }) => string) => string[];
        values?: () => Iterable<{ id: string }>;
      };
      if (typeof cache.map === 'function') {
        return cache.map((r) => r.id);
      }
      if (typeof cache.values === 'function') {
        return Array.from(cache.values()).map((r) => r.id);
      }
    }
    if (Array.isArray(m.roles)) {
      return m.roles as string[];
    }
  }
  return [];
}

/**
 * Resolver API chính: kiểm tra interaction có thỏa mãn policy hay không.
 */
export function hasPolicy(
  interaction: PolicyInteractionContext,
  policy: Policy,
  customRbac?:
    | RbacRoleSettings
    | {
        botAdminRoleId?: string | null;
        ownerRoleId?: string | null;
        moderatorRoleId?: string | null;
        memberRoleId?: string | null;
      }
    | null,
): ResolvePolicyResult {
  const isGuild = Boolean(interaction.guild && interaction.guildId);
  if (!isGuild) {
    return {
      allowed: false,
      reason: 'Chỉ có thể sử dụng lệnh này trong máy chủ (server).',
    };
  }

  const isGuildOwner = Boolean(
    interaction.guild?.ownerId &&
    interaction.user?.id &&
    interaction.guild.ownerId === interaction.user.id,
  );
  const isAdmin = Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
  const userRoleIds = extractMemberRoleIds(interaction.member);

  return resolvePolicy(policy, {
    userRoleIds,
    isGuildOwner,
    isAdmin,
    guildRbac: customRbac ?? null,
    isGuild: true,
  });
}
