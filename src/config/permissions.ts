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
