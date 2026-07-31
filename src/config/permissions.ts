/**
 * RBAC (Role-Based Access Control) config.
 * Quản lý role IDs và command permissions.
 */

export interface RoleConfig {
  Owner: string;
  Moderator: string;
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
}

/**
 * Lấy tất cả role IDs (Owner + Moderator).
 * Dùng để check permissions chung.
 */
export function getAllRoleIds(): string[] {
  return Object.values(ROLE_IDS);
}

/**
 * Check xem user có ít nhất 1 role được yêu cầu không.
 */
export function hasRequiredRole(userRoleIds: string[], requiredRoleIds: string[]): boolean {
  return requiredRoleIds.some((roleId) => userRoleIds.includes(roleId));
}
