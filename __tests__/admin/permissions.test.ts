/**
 * Unit tests cho RBAC permissions system.
 * Verify loadPermissions(), hasRequiredRole(), và runtime cache.
 */

import { ROLE_IDS, COMMAND_PERMISSIONS, loadPermissions, hasRequiredRole } from '../../src/config/permissions.js';

describe('RBAC — loadPermissions()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset runtime cache
    Object.keys(ROLE_IDS).forEach(k => delete ROLE_IDS[k]);
    Object.keys(COMMAND_PERMISSIONS).forEach(k => delete COMMAND_PERMISSIONS[k]);
  });

  it('phải load role IDs vào cache', () => {
    loadPermissions({
      roles: { Owner: '111', Moderator: '222' },
      commands: { container: { requiredRoles: ['111', '222'] } },
    });

    expect(ROLE_IDS.Owner).toBe('111');
    expect(ROLE_IDS.Moderator).toBe('222');
  });

  it('phải load command permissions vào cache', () => {
    loadPermissions({
      roles: { Owner: '111', Moderator: '222' },
      commands: {
        'df-daily': { requiredRoles: ['1513800432214872145'] },
        container: { requiredRoles: ['111', '222'] },
      },
    });

    expect(COMMAND_PERMISSIONS['df-daily'].requiredRoles).toEqual(['1513800432214872145']);
    expect(COMMAND_PERMISSIONS.container.requiredRoles).toEqual(['111', '222']);
  });

  it('phải ghi đè cache khi load lại với config khác', () => {
    loadPermissions({
      roles: { Owner: '111', Moderator: '222' },
      commands: { container: { requiredRoles: ['111'] } },
    });

    expect(ROLE_IDS.Owner).toBe('111');

    loadPermissions({
      roles: { Owner: '999', Moderator: '888' },
      commands: { container: { requiredRoles: ['999', '888'] } },
    });

    expect(ROLE_IDS.Owner).toBe('999');
    expect(ROLE_IDS.Moderator).toBe('888');
    expect(COMMAND_PERMISSIONS.container.requiredRoles).toEqual(['999', '888']);
  });
});

describe('RBAC — hasRequiredRole()', () => {
  it('trả về true khi user có ít nhất 1 role yêu cầu', () => {
    expect(hasRequiredRole(['111', '333'], ['111', '222'])).toBe(true);
    expect(hasRequiredRole(['333', '222'], ['111', '222'])).toBe(true);
  });

  it('trả về false khi user không có role nào yêu cầu', () => {
    expect(hasRequiredRole(['333', '444'], ['111', '222'])).toBe(false);
  });

  it('trả về false khi requiredRoles rỗng (.some trên empty array)', () => {
    expect(hasRequiredRole(['333'], [])).toBe(false);
  });

  it('trả về true khi cả 2 array rỗng', () => {
    expect(hasRequiredRole([], [])).toBe(false);
  });

  it('trả về false khi userRoleIds rỗng', () => {
    expect(hasRequiredRole([], ['111'])).toBe(false);
  });

  it('so sánh chính xác theo ID (không substring)', () => {
    expect(hasRequiredRole(['111'], ['1111'])).toBe(false);
    expect(hasRequiredRole(['111'], ['0111'])).toBe(false);
    expect(hasRequiredRole(['111'], ['111'])).toBe(true);
  });
});
