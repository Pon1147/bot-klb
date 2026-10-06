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

/** Runtime cache cho command permissions */
export const COMMAND_PERMISSIONS: Record<string, CommandPermission> = {};

/**
 * Load permissions từ JSON file vào runtime cache.
 * Gọi 1 lần khi bootstrap bot.
 */
export function loadPermissions(config: PermissionsConfig): void {
  // Cache role IDs
  Object.entries(config.roles).forEach(([name, id]) => {
    ROLE_IDS[name] = id;
  });

  // Cache command permissions
  Object.entries(config.commands).forEach(([cmd, perm]) => {
    COMMAND_PERMISSIONS[cmd] = perm;
  });

  // Kiểm tra: warn nếu command yêu cầu role chưa có ID
  const unresolved: string[] = [];
  for (const [cmd, perm] of Object.entries(COMMAND_PERMISSIONS)) {
    for (const roleName of perm.requiredRoles) {
      if (!ROLE_IDS[roleName]) {
        unresolved.push(`${cmd} → ${roleName}`);
      }
    }
  }
  if (unresolved.length > 0) {
    console.warn(`[RBAC] Unresolved roles: ${unresolved.join(', ')}. Commands may deny all users.`);
  }
}

import { existsSync } from 'fs';
import { join } from 'path';

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

export interface CheckRbacOptions {
  userRoleIds: string[];
  isGuildOwner: boolean;
  isAdmin: boolean;
  requiredRoles: string[];
  guildRbac: {
    ownerRoleId: string | null;
    moderatorRoleId: string | null;
    memberRoleId: string | null;
  };
}

export interface CheckRbacResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Kiểm tra quyền thực thi lệnh theo RBAC per-guild.
 *
 * Quy tắc:
 * 1. Server Owner hoặc Discord Administrator luôn có toàn quyền (Bypass).
 * 2. Thành viên có Owner hoặc Moderator role đã cấu hình cho server này luôn có toàn quyền (Bypass).
 * 3. Lệnh yêu cầu Member:
 *    - Nếu guild chưa cấu hình memberRoleId (null/rỗng) -> cho phép tất cả thành viên trong guild (mặc định mở).
 *    - Nếu guild đã cấu hình memberRoleId -> yêu cầu user có role đó.
 * 4. Lệnh yêu cầu Owner/Moderator:
 *    - Yêu cầu user có ít nhất 1 role tương ứng đã cấu hình trong guild.
 */
export function checkGuildRbacPermission(options: CheckRbacOptions): CheckRbacResult {
  const { userRoleIds, isGuildOwner, isAdmin, requiredRoles, guildRbac } = options;

  // 1. Server Owner hoặc Discord Administrator luôn có toàn quyền
  if (isGuildOwner || isAdmin) {
    return { allowed: true };
  }

  // 2. Thành viên có Owner hoặc Moderator role của guild luôn có quyền
  if (
    (guildRbac.ownerRoleId && userRoleIds.includes(guildRbac.ownerRoleId)) ||
    (guildRbac.moderatorRoleId && userRoleIds.includes(guildRbac.moderatorRoleId))
  ) {
    return { allowed: true };
  }

  // 3. Nếu command yêu cầu Member
  if (requiredRoles.includes('Member')) {
    // Nếu guild chưa cấu hình memberRoleId -> cho phép tất cả thành viên
    if (!guildRbac.memberRoleId) {
      return { allowed: true };
    }
    // Nếu đã cấu hình -> yêu cầu member phải có role đó
    if (userRoleIds.includes(guildRbac.memberRoleId)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `🔒 Lệnh này yêu cầu role <@&${guildRbac.memberRoleId}> hoặc quyền Quản trị viên.`,
    };
  }

  // 4. Nếu command yêu cầu Owner hoặc Moderator
  const requiredConfiguredRoleIds: string[] = [];
  if (requiredRoles.includes('Owner') && guildRbac.ownerRoleId) {
    requiredConfiguredRoleIds.push(guildRbac.ownerRoleId);
  }
  if (requiredRoles.includes('Moderator') && guildRbac.moderatorRoleId) {
    requiredConfiguredRoleIds.push(guildRbac.moderatorRoleId);
  }

  if (
    requiredConfiguredRoleIds.length > 0 &&
    hasRequiredRole(userRoleIds, requiredConfiguredRoleIds)
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      '🔒 Lệnh này yêu cầu quyền Quản trị viên (Administrator) hoặc role Quản trị của máy chủ.',
  };
}
