/// <reference types="jest" />
/**
 * Unit tests cho Permission / Policy Model (PHASE 1).
 * Kiểm tra đầy đủ Policy semantics, Precedence, Resolver API, Guild-less interactions,
 * và tính tương thích ngược với ownerRoleId.
 */

import {
  Policy,
  resolvePolicy,
  hasPolicy,
  extractMemberRoleIds,
  getBotAdminRoleId,
  COMMAND_PATH_POLICIES,
  resolveCommandPolicy,
} from '../../src/config/permissions.js';
import { PermissionFlagsBits } from 'discord.js';

describe('PHASE 1 — Permission / Policy Model', () => {
  const baseRbac = {
    botAdminRoleId: 'role-bot-admin',
    moderatorRoleId: 'role-moderator',
    memberRoleId: 'role-member',
  };

  const emptyRbac = {
    botAdminRoleId: null,
    ownerRoleId: null,
    moderatorRoleId: null,
    memberRoleId: null,
  };

  // ─── 1. Policy: MANAGE_RBAC ───────────────────────────────────────
  describe('Policy: MANAGE_RBAC', () => {
    it('Guild Owner → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_RBAC, {
        userRoleIds: [],
        isGuildOwner: true,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('GUILD_OWNER');
    });

    it('Administrator → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_RBAC, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: true,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('ADMINISTRATOR');
    });

    it('BOT_ADMIN → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_RBAC, {
        userRoleIds: ['role-bot-admin'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('BOT_ADMIN');
    });

    it('Moderator only → deny', () => {
      const res = resolvePolicy(Policy.MANAGE_RBAC, {
        userRoleIds: ['role-moderator'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Quản trị viên');
    });

    it('Member only → deny', () => {
      const res = resolvePolicy(Policy.MANAGE_RBAC, {
        userRoleIds: ['role-member'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
    });

    it('Everyone / không có role → deny', () => {
      const res = resolvePolicy(Policy.MANAGE_RBAC, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
    });
  });

  // ─── 2. Policy: MANAGE_CONFIG ─────────────────────────────────────
  describe('Policy: MANAGE_CONFIG', () => {
    it('Guild Owner → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_CONFIG, {
        userRoleIds: [],
        isGuildOwner: true,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('GUILD_OWNER');
    });

    it('Administrator → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_CONFIG, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: true,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('ADMINISTRATOR');
    });

    it('BOT_ADMIN → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_CONFIG, {
        userRoleIds: ['role-bot-admin'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('BOT_ADMIN');
    });

    it('Moderator → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_CONFIG, {
        userRoleIds: ['role-moderator'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('MODERATOR');
    });

    it('Member only → deny', () => {
      const res = resolvePolicy(Policy.MANAGE_CONFIG, {
        userRoleIds: ['role-member'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Quản trị viên');
    });

    it('Everyone (không có role) → deny', () => {
      const res = resolvePolicy(Policy.MANAGE_CONFIG, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Quản trị viên');
    });
  });

  // ─── 3. Policy: MANAGE_DF_CODE ────────────────────────────────────
  describe('Policy: MANAGE_DF_CODE', () => {
    it('Guild Owner → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_DF_CODE, {
        userRoleIds: [],
        isGuildOwner: true,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('GUILD_OWNER');
    });

    it('Administrator → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_DF_CODE, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: true,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('ADMINISTRATOR');
    });

    it('BOT_ADMIN → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_DF_CODE, {
        userRoleIds: ['role-bot-admin'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('BOT_ADMIN');
    });

    it('Moderator → allow', () => {
      const res = resolvePolicy(Policy.MANAGE_DF_CODE, {
        userRoleIds: ['role-moderator'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('MODERATOR');
    });

    it('Member only → deny', () => {
      const res = resolvePolicy(Policy.MANAGE_DF_CODE, {
        userRoleIds: ['role-member'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Quản trị viên');
    });

    it('Everyone (không có role) → deny', () => {
      const res = resolvePolicy(Policy.MANAGE_DF_CODE, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Quản trị viên');
    });
  });

  // ─── 4. Policy: DF_ACCESS ─────────────────────────────────────────
  describe('Policy: DF_ACCESS', () => {
    it('no memberRoleId → allow everyone', () => {
      const res = resolvePolicy(Policy.DF_ACCESS, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: emptyRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('EVERYONE');
    });

    it('memberRoleId configured + user has role → allow', () => {
      const res = resolvePolicy(Policy.DF_ACCESS, {
        userRoleIds: ['role-member'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('MEMBER');
    });

    it('memberRoleId configured + user lacks role → deny', () => {
      const res = resolvePolicy(Policy.DF_ACCESS, {
        userRoleIds: ['some-other-role'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('role-member');
    });

    it('BOT_ADMIN / Moderator luôn có quyền DF_ACCESS ngay cả khi memberRoleId cấu hình', () => {
      const resAdmin = resolvePolicy(Policy.DF_ACCESS, {
        userRoleIds: ['role-bot-admin'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(resAdmin.allowed).toBe(true);
      expect(resAdmin.matchedAuthority).toBe('BOT_ADMIN');

      const resMod = resolvePolicy(Policy.DF_ACCESS, {
        userRoleIds: ['role-moderator'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(resMod.allowed).toBe(true);
      expect(resMod.matchedAuthority).toBe('MODERATOR');
    });

    it('Guild Owner bypass DF_ACCESS ngay cả khi memberRoleId cấu hình và user không có role', () => {
      const res = resolvePolicy(Policy.DF_ACCESS, {
        userRoleIds: [],
        isGuildOwner: true,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('GUILD_OWNER');
    });

    it('Administrator bypass DF_ACCESS ngay cả khi memberRoleId cấu hình và user không có role', () => {
      const res = resolvePolicy(Policy.DF_ACCESS, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: true,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('ADMINISTRATOR');
    });
  });

  // ─── 5. Policy: TEAM_ACCESS ───────────────────────────────────────
  describe('Policy: TEAM_ACCESS', () => {
    it('no memberRoleId → allow everyone', () => {
      const res = resolvePolicy(Policy.TEAM_ACCESS, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: emptyRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('EVERYONE');
    });

    it('memberRoleId configured + user has role → allow', () => {
      const res = resolvePolicy(Policy.TEAM_ACCESS, {
        userRoleIds: ['role-member'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('MEMBER');
    });

    it('memberRoleId configured + user lacks role → deny', () => {
      const res = resolvePolicy(Policy.TEAM_ACCESS, {
        userRoleIds: ['random-role'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('role-member');
    });

    it('Guild Owner bypass TEAM_ACCESS khi memberRoleId cấu hình và user không có role', () => {
      const res = resolvePolicy(Policy.TEAM_ACCESS, {
        userRoleIds: [],
        isGuildOwner: true,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('GUILD_OWNER');
    });

    it('Administrator bypass TEAM_ACCESS khi memberRoleId cấu hình và user không có role', () => {
      const res = resolvePolicy(Policy.TEAM_ACCESS, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: true,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('ADMINISTRATOR');
    });

    it('BOT_ADMIN và MODERATOR bypass TEAM_ACCESS khi memberRoleId cấu hình', () => {
      const resAdmin = resolvePolicy(Policy.TEAM_ACCESS, {
        userRoleIds: ['role-bot-admin'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(resAdmin.allowed).toBe(true);
      expect(resAdmin.matchedAuthority).toBe('BOT_ADMIN');

      const resMod = resolvePolicy(Policy.TEAM_ACCESS, {
        userRoleIds: ['role-moderator'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: baseRbac,
        isGuild: true,
      });
      expect(resMod.allowed).toBe(true);
      expect(resMod.matchedAuthority).toBe('MODERATOR');
    });
  });

  // ─── 6. Backward Compatibility với ownerRoleId ────────────────────
  describe('Backward Compatibility với legacy ownerRoleId', () => {
    it('khi botAdminRoleId là null, legacy ownerRoleId hoạt động như BOT_ADMIN', () => {
      const legacyRbac = {
        botAdminRoleId: null,
        ownerRoleId: 'legacy-owner-id',
        moderatorRoleId: null,
        memberRoleId: null,
      };

      expect(getBotAdminRoleId(legacyRbac)).toBe('legacy-owner-id');

      const res = resolvePolicy(Policy.MANAGE_RBAC, {
        userRoleIds: ['legacy-owner-id'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: legacyRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('BOT_ADMIN');
    });

    it('ưu tiên botAdminRoleId mới hơn ownerRoleId cũ nếu cả 2 cùng tồn tại', () => {
      const dualRbac = {
        botAdminRoleId: 'new-bot-admin',
        ownerRoleId: 'old-owner',
        moderatorRoleId: null,
        memberRoleId: null,
      };

      expect(getBotAdminRoleId(dualRbac)).toBe('new-bot-admin');

      const res = resolvePolicy(Policy.MANAGE_RBAC, {
        userRoleIds: ['new-bot-admin'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: dualRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('BOT_ADMIN');
    });
  });

  // ─── 7. Edge Cases & Guild-less Interactions ──────────────────────
  describe('Edge Cases & Guild-less Interactions', () => {
    it('isGuild = false (DM interaction) → luôn deny', () => {
      const res = resolvePolicy(Policy.DF_ACCESS, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: emptyRbac,
        isGuild: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('máy chủ');
    });

    it('hasPolicy() từ chối khi interaction không có guild', () => {
      const interaction = {
        guild: null,
        guildId: null,
        user: { id: 'u1' },
      };
      const res = hasPolicy(interaction, Policy.DF_ACCESS, emptyRbac);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('máy chủ');
    });

    it('hasPolicy() trích xuất và kiểm tra đúng quyền với interaction hợp lệ', () => {
      const interaction = {
        guild: { id: 'g1', ownerId: 'guild-owner-user' },
        guildId: 'g1',
        user: { id: 'u1' },
        member: {
          roles: {
            cache: new Map([['role-moderator', { id: 'role-moderator' }]]),
          },
        },
        memberPermissions: {
          has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
        },
      };

      // User có quyền Administrator
      const res = hasPolicy(interaction, Policy.MANAGE_RBAC, baseRbac);
      expect(res.allowed).toBe(true);
      expect(res.matchedAuthority).toBe('ADMINISTRATOR');
    });

    it('extractMemberRoleIds trích xuất an toàn từ nhiều loại data structure', () => {
      expect(extractMemberRoleIds(null)).toEqual([]);
      expect(extractMemberRoleIds({})).toEqual([]);
      expect(extractMemberRoleIds({ roles: ['r1', 'r2'] })).toEqual(['r1', 'r2']);
      expect(
        extractMemberRoleIds({
          roles: { cache: new Map([['r1', { id: 'r1' }]]) },
        }),
      ).toEqual(['r1']);
    });
  });

  // ─── 7. PHASE 4: Command Path Policy Mapping ──────────────────────
  describe('PHASE 4 — Command Path Policy Mapping', () => {
    it('COMMAND_PATH_POLICIES chứa đúng 28 canonical command paths', () => {
      expect(Object.keys(COMMAND_PATH_POLICIES)).toHaveLength(28);
    });

    it('MANAGE_RBAC policy mapping cho config.roles.* và config.bot.guilds', () => {
      expect(resolveCommandPolicy('config.roles.set')).toBe(Policy.MANAGE_RBAC);
      expect(resolveCommandPolicy('config.roles.view')).toBe(Policy.MANAGE_RBAC);
      expect(resolveCommandPolicy('config.bot.guilds')).toBe(Policy.MANAGE_RBAC);
    });

    it('MANAGE_CONFIG policy mapping cho config.welcome.*, booster.*, container.*', () => {
      expect(resolveCommandPolicy('config.welcome.setchannel')).toBe(Policy.MANAGE_CONFIG);
      expect(resolveCommandPolicy('config.welcome.setrole')).toBe(Policy.MANAGE_CONFIG);
      expect(resolveCommandPolicy('config.welcome.toggle')).toBe(Policy.MANAGE_CONFIG);
      expect(resolveCommandPolicy('config.welcome.status')).toBe(Policy.MANAGE_CONFIG);

      expect(resolveCommandPolicy('config.booster.setchannel')).toBe(Policy.MANAGE_CONFIG);
      expect(resolveCommandPolicy('config.booster.setrole')).toBe(Policy.MANAGE_CONFIG);
      expect(resolveCommandPolicy('config.booster.toggle')).toBe(Policy.MANAGE_CONFIG);
      expect(resolveCommandPolicy('config.booster.status')).toBe(Policy.MANAGE_CONFIG);

      expect(resolveCommandPolicy('config.container.edit')).toBe(Policy.MANAGE_CONFIG);
      expect(resolveCommandPolicy('config.container.reset')).toBe(Policy.MANAGE_CONFIG);
    });

    it('MANAGE_DF_CODE policy mapping cho df.code admin commands', () => {
      expect(resolveCommandPolicy('df.code.setchannel')).toBe(Policy.MANAGE_DF_CODE);
      expect(resolveCommandPolicy('df.code.settime')).toBe(Policy.MANAGE_DF_CODE);
      expect(resolveCommandPolicy('df.code.setadminchannel')).toBe(Policy.MANAGE_DF_CODE);
    });

    it('DF_ACCESS policy mapping cho df public subcommands & groups', () => {
      expect(resolveCommandPolicy('df.code.show')).toBe(Policy.DF_ACCESS);
      expect(resolveCommandPolicy('df.code.status')).toBe(Policy.DF_ACCESS);
      expect(resolveCommandPolicy('df.stats')).toBe(Policy.DF_ACCESS);
      expect(resolveCommandPolicy('df.daily')).toBe(Policy.DF_ACCESS);
      expect(resolveCommandPolicy('df.history')).toBe(Policy.DF_ACCESS);
      expect(resolveCommandPolicy('df.workshop')).toBe(Policy.DF_ACCESS);
      expect(resolveCommandPolicy('df.unlink')).toBe(Policy.DF_ACCESS);
      expect(resolveCommandPolicy('df.help')).toBe(Policy.DF_ACCESS);
      expect(resolveCommandPolicy('df.link.start')).toBe(Policy.DF_ACCESS);
      expect(resolveCommandPolicy('df.link.status')).toBe(Policy.DF_ACCESS);
      expect(resolveCommandPolicy('df.link.manual')).toBe(Policy.DF_ACCESS);
    });

    it('TEAM_ACCESS policy mapping cho team.find', () => {
      expect(resolveCommandPolicy('team.find')).toBe(Policy.TEAM_ACCESS);
    });

    it('trả về null đối với commandPath không xác định hoặc legacy commands', () => {
      expect(resolveCommandPolicy('unknown.command')).toBeNull();
      expect(resolveCommandPolicy('welcome')).toBeNull();
      expect(resolveCommandPolicy('booster')).toBeNull();
      expect(resolveCommandPolicy('df-stats')).toBeNull();
      expect(resolveCommandPolicy('')).toBeNull();
    });
  });

  // ─── 8. PHASE 5: Hardening & Fail-Closed Stale Roles ──────────────
  describe('PHASE 5 — Hardening & Fail-Closed Stale Roles', () => {
    const staleRbac = {
      botAdminRoleId: 'deleted-bot-admin',
      moderatorRoleId: 'deleted-moderator',
      memberRoleId: 'deleted-member',
    };

    it('DF_ACCESS fail-closed (deny) khi memberRoleId trỏ tới role bị xóa và user không có role', () => {
      const res = resolvePolicy(Policy.DF_ACCESS, {
        userRoleIds: ['active-different-role'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: staleRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('deleted-member');
    });

    it('TEAM_ACCESS fail-closed (deny) khi memberRoleId trỏ tới role bị xóa', () => {
      const res = resolvePolicy(Policy.TEAM_ACCESS, {
        userRoleIds: ['active-different-role'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: staleRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('deleted-member');
    });

    it('MANAGE_RBAC fail-closed (deny) khi botAdminRoleId trỏ tới role bị xóa', () => {
      const res = resolvePolicy(Policy.MANAGE_RBAC, {
        userRoleIds: ['some-active-role'],
        isGuildOwner: false,
        isAdmin: false,
        guildRbac: staleRbac,
        isGuild: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Quản trị viên');
    });

    it('Guild Owner và Administrator vẫn bypass an toàn ngay cả khi tất cả roles bị stale', () => {
      const resOwner = resolvePolicy(Policy.MANAGE_RBAC, {
        userRoleIds: [],
        isGuildOwner: true,
        isAdmin: false,
        guildRbac: staleRbac,
        isGuild: true,
      });
      expect(resOwner.allowed).toBe(true);
      expect(resOwner.matchedAuthority).toBe('GUILD_OWNER');

      const resAdmin = resolvePolicy(Policy.DF_ACCESS, {
        userRoleIds: [],
        isGuildOwner: false,
        isAdmin: true,
        guildRbac: staleRbac,
        isGuild: true,
      });
      expect(resAdmin.allowed).toBe(true);
      expect(resAdmin.matchedAuthority).toBe('ADMINISTRATOR');
    });
  });
});


