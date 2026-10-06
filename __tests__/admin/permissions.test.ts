/**
 * Unit tests cho RBAC permissions system.
 * Verify loadPermissions(), hasRequiredRole(), và runtime cache.
 */

import {
  ROLE_IDS,
  COMMAND_PERMISSIONS,
  loadPermissions,
  hasRequiredRole,
  DEFAULT_PERMISSIONS,
  getPermissionsFilePath,
  checkGuildRbacPermission,
} from '../../src/config/permissions.js';

describe('RBAC — loadPermissions()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset runtime cache
    Object.keys(ROLE_IDS).forEach((k) => delete ROLE_IDS[k]);
    Object.keys(COMMAND_PERMISSIONS).forEach((k) => delete COMMAND_PERMISSIONS[k]);
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

describe('RBAC — DEFAULT_PERMISSIONS & getPermissionsFilePath()', () => {
  it('phải có default permissions hợp lệ', () => {
    expect(DEFAULT_PERMISSIONS).toBeDefined();
    expect(DEFAULT_PERMISSIONS.roles.Owner).toBeDefined();
    expect(DEFAULT_PERMISSIONS.roles.Moderator).toBeDefined();
    expect(DEFAULT_PERMISSIONS.roles.Member).toBeDefined();
    expect(DEFAULT_PERMISSIONS.commands['container']).toBeDefined();
  });

  it('phải trả về permissions file path', () => {
    const filePath = getPermissionsFilePath();
    expect(typeof filePath).toBe('string');
    expect(filePath.endsWith('permissions.json')).toBe(true);
  });

  it('phải tôn trọng env variable PERMISSIONS_PATH nếu có', () => {
    process.env.PERMISSIONS_PATH = '/custom/path/permissions.json';
    try {
      expect(getPermissionsFilePath()).toBe('/custom/path/permissions.json');
    } finally {
      delete process.env.PERMISSIONS_PATH;
    }
  });
});

describe('RBAC — checkGuildRbacPermission()', () => {
  const emptyRbac = {
    ownerRoleId: null,
    moderatorRoleId: null,
    memberRoleId: null,
  };

  const configuredRbac = {
    ownerRoleId: 'role-owner',
    moderatorRoleId: 'role-mod',
    memberRoleId: 'role-member',
  };

  it('phải cho phép Guild Owner bypass mọi lệnh', () => {
    const res = checkGuildRbacPermission({
      userRoleIds: [],
      isGuildOwner: true,
      isAdmin: false,
      requiredRoles: ['Owner', 'Moderator'],
      guildRbac: configuredRbac,
    });
    expect(res.allowed).toBe(true);
  });

  it('phải cho phép Discord Administrator bypass mọi lệnh', () => {
    const res = checkGuildRbacPermission({
      userRoleIds: [],
      isGuildOwner: false,
      isAdmin: true,
      requiredRoles: ['Owner'],
      guildRbac: configuredRbac,
    });
    expect(res.allowed).toBe(true);
  });

  it('phải cho phép user có Owner role bypass mọi lệnh', () => {
    const res = checkGuildRbacPermission({
      userRoleIds: ['role-owner'],
      isGuildOwner: false,
      isAdmin: false,
      requiredRoles: ['Member'],
      guildRbac: configuredRbac,
    });
    expect(res.allowed).toBe(true);
  });

  it('phải cho phép user có Moderator role bypass mọi lệnh', () => {
    const res = checkGuildRbacPermission({
      userRoleIds: ['role-mod'],
      isGuildOwner: false,
      isAdmin: false,
      requiredRoles: ['Member'],
      guildRbac: configuredRbac,
    });
    expect(res.allowed).toBe(true);
  });

  describe('Member command logic', () => {
    it('mặc định cho phép Everyone khi guild chưa cấu hình memberRoleId', () => {
      const res = checkGuildRbacPermission({
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: false,
        requiredRoles: ['Member'],
        guildRbac: emptyRbac,
      });
      expect(res.allowed).toBe(true);
    });

    it('cho phép user khi guild đã cấu hình memberRoleId và user có role đó', () => {
      const res = checkGuildRbacPermission({
        userRoleIds: ['role-member', 'random-role'],
        isGuildOwner: false,
        isAdmin: false,
        requiredRoles: ['Member'],
        guildRbac: configuredRbac,
      });
      expect(res.allowed).toBe(true);
    });

    it('từ chối user khi guild đã cấu hình memberRoleId nhưng user không có role', () => {
      const res = checkGuildRbacPermission({
        userRoleIds: ['random-role'],
        isGuildOwner: false,
        isAdmin: false,
        requiredRoles: ['Member'],
        guildRbac: configuredRbac,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('role-member');
    });
  });

  describe('Owner / Moderator command logic', () => {
    it('cho phép user có role Moderator khi lệnh yêu cầu [Owner, Moderator]', () => {
      const res = checkGuildRbacPermission({
        userRoleIds: ['role-mod'],
        isGuildOwner: false,
        isAdmin: false,
        requiredRoles: ['Owner', 'Moderator'],
        guildRbac: configuredRbac,
      });
      expect(res.allowed).toBe(true);
    });

    it('từ chối user khi chỉ có role Member mà lệnh yêu cầu [Owner, Moderator]', () => {
      const res = checkGuildRbacPermission({
        userRoleIds: ['role-member'],
        isGuildOwner: false,
        isAdmin: false,
        requiredRoles: ['Owner', 'Moderator'],
        guildRbac: configuredRbac,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Quản trị viên');
    });

    it('từ chối khi guild chưa cấu hình role nào và user không phải Admin/Owner', () => {
      const res = checkGuildRbacPermission({
        userRoleIds: ['some-role'],
        isGuildOwner: false,
        isAdmin: false,
        requiredRoles: ['Owner', 'Moderator'],
        guildRbac: emptyRbac,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Quản trị viên');
    });
  });
});

