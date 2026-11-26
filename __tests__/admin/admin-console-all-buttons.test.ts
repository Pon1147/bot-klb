import Database from 'better-sqlite3';
import { ButtonStyle, ComponentType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { handleAdminConsoleButton } from '../../src/features/admin/admin-console.handler.js';
import { SettingsService, setSettingsService } from '../../src/services/settings.service.js';
import { initializeSettingsTable } from '../../src/database/guild.settings.db.js';
import { initializeSubscriptionTables } from '../../src/database/subscription.db.js';
import { getAdminEditorSession } from '../../src/features/admin/admin-console.session.js';

describe('Admin Console — Toàn bộ Buttons & Workflows Audit Test', () => {
  let db: Database.Database;
  let settingsService: SettingsService;

  const mockGuild: any = {
    id: 'guild-audit-test',
    ownerId: 'owner-123',
    channels: {
      cache: new Map<string, any>([
        [
          '111222333444555666',
          {
            id: '111222333444555666',
            name: 'general',
            isTextBased: () => true,
            send: jest.fn().mockResolvedValue({ id: 'msg-123' }),
          },
        ],
      ]),
    },
    roles: {
      cache: new Map<string, any>([
        ['999888777666555444', { id: '999888777666555444', name: 'AdminRole' }],
      ]),
    },
    members: {
      fetch: jest.fn().mockResolvedValue({ id: 'caller-123', displayName: 'Caller' }),
    },
  };

  const createButtonInteraction = (customId: string, userId = 'caller-123'): any => ({
    customId,
    guild: mockGuild,
    user: { id: userId, displayAvatarURL: () => 'https://example.com/avatar.png' },
    member: {
      user: { id: userId, username: 'Caller', displayAvatarURL: () => 'https://example.com/avatar.png' },
      joinedAt: new Date(),
      permissions: { has: () => true },
    },
    memberPermissions: { has: () => true },
    locale: 'vi',
    update: jest.fn().mockResolvedValue({}),
    reply: jest.fn().mockResolvedValue({}),
    followUp: jest.fn().mockResolvedValue({}),
    showModal: jest.fn().mockResolvedValue({}),
    deferUpdate: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    client: { database: db },
  });

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    initializeSettingsTable(db);
    initializeSubscriptionTables(db);

    settingsService = new SettingsService(db);
    setSettingsService(settingsService);
  });

  afterEach(() => {
    db.close();
  });

  describe('1. Màn hình chính Dashboard (Main Console)', () => {
    it('admin_console:refresh — gọi update() với Dashboard container', async () => {
      const interaction = createButtonInteraction('admin_console:refresh:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('admin_console:back — gọi update() trở về Dashboard chính', async () => {
      const interaction = createButtonInteraction('admin_console:back:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('admin_console:roles — gọi update() với giao diện phân quyền RBAC', async () => {
      const interaction = createButtonInteraction('admin_console:roles:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('admin_console:code_channel — gọi update() với giao diện kênh két sắt', async () => {
      const interaction = createButtonInteraction('admin_console:code_channel:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('admin_console:notices_hub — gọi update() với Hub thông báo tự động', async () => {
      const interaction = createButtonInteraction('admin_console:notices_hub:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('admin_console:vietqr — chỉ Server Owner mới được mở, chặn nếu chưa có bản quyền', async () => {
      const nonOwner = createButtonInteraction('admin_console:vietqr:caller-123', 'caller-123');
      const nonOwnerRes = await handleAdminConsoleButton(nonOwner, db);
      expect(nonOwnerRes.handled).toBe(true);
      expect(nonOwner.showModal).not.toHaveBeenCalled();
      expect(nonOwner.reply).toHaveBeenCalled();

      const blocked = createButtonInteraction('admin_console:vietqr:owner-123', 'owner-123');
      const blockedRes = await handleAdminConsoleButton(blocked, db);
      expect(blockedRes.handled).toBe(true);
      expect(blocked.showModal).not.toHaveBeenCalled();
      expect(blocked.reply).toHaveBeenCalled();

      db.prepare(
        'INSERT OR REPLACE INTO guild_subscriptions (guild_id, license_expires_at, trial_used, created_at, updated_at) VALUES (?, ?, 1, ?, ?)',
      ).run(mockGuild.id, Date.now() + 86400_000, Date.now(), Date.now());

      const interaction = createButtonInteraction('admin_console:vietqr:owner-123', 'owner-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.showModal).toHaveBeenCalled();
    });

    it('admin_console:keo — gọi update() với giao diện dịch vụ Kéo Lão Bản', async () => {
      const interaction = createButtonInteraction('admin_console:keo:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('admin_console:help — gọi reply() dạng ephemeral hướng dẫn', async () => {
      const interaction = createButtonInteraction('admin_console:help:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: MessageFlags.Ephemeral }),
      );
    });
  });

  describe('2. Màn hình Hub Thông Báo Tự Động (Notices Hub)', () => {
    it('Chuyển tab: tab_welcome, tab_leave, tab_booster', async () => {
      for (const tab of ['welcome', 'leave', 'booster']) {
        const interaction = createButtonInteraction(`admin_console:tab_${tab}:caller-123`);
        const res = await handleAdminConsoleButton(interaction, db);
        expect(res.handled).toBe(true);
        expect(interaction.update).toHaveBeenCalled();
      }
    });

    it('toggle_notice_<tab> — bật/tắt trạng thái thông báo và lưu DB', async () => {
      const initialStatus = settingsService.get(mockGuild.id).welcome.enabled;

      const interaction1 = createButtonInteraction(
        'admin_console:toggle_notice_welcome:caller-123',
      );
      await handleAdminConsoleButton(interaction1, db);
      expect(settingsService.get(mockGuild.id).welcome.enabled).toBe(!initialStatus);

      const interaction2 = createButtonInteraction(
        'admin_console:toggle_notice_welcome:caller-123',
      );
      await handleAdminConsoleButton(interaction2, db);
      expect(settingsService.get(mockGuild.id).welcome.enabled).toBe(initialStatus);
    });

    it('reset_notice_chan_<tab> — gỡ kênh thông báo đã cài đặt', async () => {
      settingsService.update(mockGuild.id, { welcome: { channelId: '111222333444555666' } });
      expect(settingsService.get(mockGuild.id).welcome.channelId).toBe('111222333444555666');

      const interaction = createButtonInteraction(
        'admin_console:reset_notice_chan_welcome:caller-123',
      );
      await handleAdminConsoleButton(interaction, db);
      expect(settingsService.get(mockGuild.id).welcome.channelId).toBeNull();
      expect(interaction.update).toHaveBeenCalled();
    });

    it('test_notice_<tab> — báo lỗi nếu chưa đặt kênh, gửi test nếu đã đặt kênh', async () => {
      // 1. Chưa đặt kênh -> reply ephemeral cảnh báo
      const interactionNoChan = createButtonInteraction(
        'admin_console:test_notice_welcome:caller-123',
      );
      await handleAdminConsoleButton(interactionNoChan, db);
      expect(interactionNoChan.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Chưa cài đặt kênh'),
          flags: MessageFlags.Ephemeral,
        }),
      );

      // 2. Đã đặt kênh -> gửi test message vào kênh và reply thành công
      settingsService.update(mockGuild.id, { welcome: { channelId: '111222333444555666' } });
      const interactionWithChan = createButtonInteraction(
        'admin_console:test_notice_welcome:caller-123',
      );
      await handleAdminConsoleButton(interactionWithChan, db);
      expect(interactionWithChan.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('thành công vào kênh'),
          flags: MessageFlags.Ephemeral,
        }),
      );
    });
  });

  describe('3. Trình Soạn Thảo Live Preview Editor', () => {
    it('edit_container_<tab> — khởi tạo session và mở màn hình editor', async () => {
      const interaction = createButtonInteraction(
        'admin_console:edit_container_welcome:caller-123',
      );
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
      expect(getAdminEditorSession('caller-123')).toBeDefined();
    });

    it('editor modals: lines, header, color, media — mở đúng Modal tương ứng', async () => {
      for (const modalType of ['lines', 'header', 'color', 'media']) {
        const interaction = createButtonInteraction(
          `admin_console:editor_${modalType}:welcome:caller-123`,
        );
        const res = await handleAdminConsoleButton(interaction, db);
        expect(res.handled).toBe(true);
        expect(interaction.showModal).toHaveBeenCalled();
      }
    });

    it('editor_sep — toggle đường kẻ separator trên draft', async () => {
      const interaction = createButtonInteraction('admin_console:editor_sep:welcome:caller-123');
      await handleAdminConsoleButton(interaction, db);
      const session = getAdminEditorSession('caller-123');
      expect(session).toBeDefined();
      expect(interaction.update).toHaveBeenCalled();
    });

    it('editor_reset — khôi phục draft về cấu hình mặc định', async () => {
      const interaction = createButtonInteraction('admin_console:editor_reset:welcome:caller-123');
      await handleAdminConsoleButton(interaction, db);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('editor_save & editor_cancel — lưu vào DB hoặc hủy bỏ session', async () => {
      // 1. Save
      const interactionSave = createButtonInteraction(
        'admin_console:editor_save:welcome:caller-123',
      );
      await handleAdminConsoleButton(interactionSave, db);
      expect(interactionSave.update).toHaveBeenCalled();
      expect(getAdminEditorSession('caller-123')).toBeUndefined();

      // 2. Cancel
      const interactionInit = createButtonInteraction(
        'admin_console:edit_container_welcome:caller-123',
      );
      await handleAdminConsoleButton(interactionInit, db);
      expect(getAdminEditorSession('caller-123')).toBeDefined();

      const interactionCancel = createButtonInteraction(
        'admin_console:editor_cancel:welcome:caller-123',
      );
      await handleAdminConsoleButton(interactionCancel, db);
      expect(getAdminEditorSession('caller-123')).toBeUndefined();
    });
  });

  describe('4. Màn hình Cấu Hình Kéo Lão Bản & Bản Quyền', () => {
    it('sub_buy — mở màn hình chọn 3 gói bản quyền', async () => {
      const interaction = createButtonInteraction('admin_console:sub_buy:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('sub_trial — kích hoạt dùng thử 3 ngày, update() realtime và followUp()', async () => {
      const interaction = createButtonInteraction('admin_console:sub_trial:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đã kích hoạt 3 ngày dùng thử'),
        }),
      );
    });

    it('sub_key — mở modal nhập mã bản quyền', async () => {
      const interaction = createButtonInteraction('admin_console:sub_key:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.showModal).toHaveBeenCalled();
    });

    it('keo_vip — mở màn hình cấu hình 3 cấp độ VIP', async () => {
      const interaction = createButtonInteraction('admin_console:keo_vip:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('vietqr_workflow — mở màn hình cấu hình VietQR & Feedback khi đã kích hoạt bản quyền', async () => {
      db.prepare(
        'INSERT OR REPLACE INTO guild_subscriptions (guild_id, license_expires_at, trial_used, created_at, updated_at) VALUES (?, ?, 1, ?, ?)',
      ).run(mockGuild.id, Date.now() + 86400_000, Date.now(), Date.now());
      const interaction = createButtonInteraction('admin_console:vietqr_workflow:caller-123');
      const res = await handleAdminConsoleButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('vietqr_toggle_rating — bật/tắt tính năng đánh giá 5 sao', async () => {
      const interaction = createButtonInteraction('admin_console:vietqr_toggle_rating:caller-123');
      await handleAdminConsoleButton(interaction, db);
      expect(settingsService.get(mockGuild.id).vietqr?.enableRating).toBe(false);

      await handleAdminConsoleButton(interaction, db);
      expect(settingsService.get(mockGuild.id).vietqr?.enableRating).toBe(true);
    });

    it('reset_keo & reset_keo_vip & reset_vietqr_workflow — gỡ bỏ cấu hình tương ứng', async () => {
      // 1. Reset Keo
      settingsService.update(mockGuild.id, { keo: { dispatchChannelId: 'chan-1' } });
      const interactionKeo = createButtonInteraction('admin_console:reset_keo:caller-123');
      await handleAdminConsoleButton(interactionKeo, db);
      expect(settingsService.get(mockGuild.id).keo?.dispatchChannelId).toBeNull();

      // 2. Reset Keo VIP
      settingsService.update(mockGuild.id, { keo: { tier1RoleId: 'role-1' } });
      const interactionVip = createButtonInteraction('admin_console:reset_keo_vip:caller-123');
      await handleAdminConsoleButton(interactionVip, db);
      expect(settingsService.get(mockGuild.id).keo?.tier1RoleId).toBeNull();

      // 3. Reset VietQR Workflow
      settingsService.update(mockGuild.id, {
        vietqr: { feedbackChannelId: 'fb-chan', staffRoleId: 'staff-role' },
      });
      const interactionVqr = createButtonInteraction('admin_console:reset_vietqr_workflow:caller-123');
      await handleAdminConsoleButton(interactionVqr, db);
      expect(settingsService.get(mockGuild.id).vietqr?.feedbackChannelId).toBeNull();
      expect(settingsService.get(mockGuild.id).vietqr?.staffRoleId).toBeNull();
    });
  });

  describe('5. Màn hình Phân Quyền RBAC & Kênh Két Sắt', () => {
    it('reset_role_admin & reset_role_mod — gỡ vai trò phân quyền', async () => {
      settingsService.update(mockGuild.id, {
        rbac: { botAdminRoleId: 'admin-1', moderatorRoleId: 'mod-1' },
      });

      const interactionAdmin = createButtonInteraction('admin_console:reset_role_admin:caller-123');
      await handleAdminConsoleButton(interactionAdmin, db);
      expect(settingsService.get(mockGuild.id).rbac?.botAdminRoleId).toBeNull();

      const interactionMod = createButtonInteraction('admin_console:reset_role_mod:caller-123');
      await handleAdminConsoleButton(interactionMod, db);
      expect(settingsService.get(mockGuild.id).rbac?.moderatorRoleId).toBeNull();
    });

    it('reset_code_channel — gỡ kênh két sắt', async () => {
      settingsService.update(mockGuild.id, { dfCodes: { channelId: 'code-chan' } });

      const interaction = createButtonInteraction('admin_console:reset_code_channel:caller-123');
      await handleAdminConsoleButton(interaction, db);
      expect(settingsService.get(mockGuild.id).dfCodes?.channelId).toBeNull();
    });
  });

  describe('6. User Isolation & Security Guard', () => {
    it('Từ chối người dùng lạ (không phải callerUserId, không phải owner, không có quyền Admin)', async () => {
      const strangerInteraction = createButtonInteraction(
        'admin_console:refresh:caller-123',
        'stranger-999',
      );
      // Stranger không có quyền Administrator
      strangerInteraction.memberPermissions.has = jest.fn().mockReturnValue(false);

      const res = await handleAdminConsoleButton(strangerInteraction, db);
      expect(res.handled).toBe(true);
      expect(strangerInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Chỉ người gọi lệnh hoặc quản trị viên'),
          flags: MessageFlags.Ephemeral,
        }),
      );
      expect(strangerInteraction.update).not.toHaveBeenCalled();
    });
  });
});
