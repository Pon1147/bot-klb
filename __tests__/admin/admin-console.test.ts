import {
  ButtonStyle,
  ComponentType,
  Guild,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import {
  buildAdminConsoleContainer,
  buildAdminConsoleFooterRow,
  buildAdminEditorColorModal,
  buildAdminEditorHeaderModal,
  buildAdminEditorLinesModal,
  buildAdminEditorMediaModal,
  buildChannelConfigView,
  buildContainerEditorView,
  buildNoticesHubView,
  buildRolesConfigView,
} from '../../src/features/admin/admin-console.builder.js';
import {
  getAdminEditorSession,
  setAdminEditorSession,
  deleteAdminEditorSession,
} from '../../src/features/admin/admin-console.session.js';
import {
  handleAdminConsoleButton,
  handleAdminConsoleSelect,
  handleAdminConsoleModal,
} from '../../src/features/admin/admin-console.handler.js';
import { execute as executeAdminCommand, data as adminData } from '../../src/features/admin/admin.command.js';
import { GuildSettings } from '../../src/types/settings.types.js';
import { SettingsService, setSettingsService } from '../../src/services/settings.service.js';

describe('Admin Console V2 (Dashboard)', () => {
  const mockDb: any = {
    prepare: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(null),
      run: jest.fn(),
    }),
  };

  beforeEach(() => {
    setSettingsService(new SettingsService(mockDb));
  });
  const mockGuild = {
    id: 'guild-123',
    ownerId: 'owner-456',
    channels: {
      cache: new Map<string, any>([
        ['123456789012345678', { id: '123456789012345678' }],
        ['876543210987654321', { id: '876543210987654321' }],
      ]),
    },
    roles: {
      cache: new Map<string, any>([
        ['111111111111111111', { id: '111111111111111111' }],
        ['222222222222222222', { id: '222222222222222222' }],
      ]),
    },
    members: {
      fetch: jest.fn(),
    },
  } as unknown as Guild;

  const mockSettings: GuildSettings = {
    welcome: {
      enabled: true,
      channelId: '123456789012345678',
      roleId: '333333333333333333',
      container: {
        accentColor: 0x5865f2,
        headerTemplate: 'Welcome {user}',
        contentLines: ['Hello'],
        mediaUrl: null,
        mediaDescription: null,
        showSeparator: false,
      },
    },
    leave: {
      enabled: false,
      channelId: null,
      container: {
        accentColor: 0xed4245,
        headerTemplate: null,
        contentLines: [],
        mediaUrl: null,
        mediaDescription: null,
        showSeparator: false,
      },
    },
    booster: {
      enabled: false,
      channelId: null,
      roleId: null,
      container: {
        accentColor: 0xfb663a,
        headerTemplate: null,
        contentLines: [],
        mediaUrl: null,
        mediaDescription: null,
        showSeparator: false,
      },
    },
    dfCodes: {
      enabled: true,
      channelId: '876543210987654321',
      adminChannelId: null,
    },
    rbac: {
      botAdminRoleId: '111111111111111111',
      moderatorRoleId: '222222222222222222',
      memberRoleId: null,
    },
    botAnnounce: {
      channelId: null,
    },
    vietqr: {
      enabled: true,
      bankId: 'MB',
      accountNo: '0987654321',
      accountName: 'NGUYEN VAN A',
      prefix: 'NAP',
      template: 'compact',
    },
  };

  describe('Builder: buildAdminConsoleContainer', () => {
    it('Render Container V2 với đầy đủ thông tin hiện trạng', () => {
      const result = buildAdminConsoleContainer(mockGuild, mockSettings, 'user-caller', 'vi');
      expect(result.flags).toBe(MessageFlags.IsComponentsV2);

      const json = result.toJSON() as any[];
      expect(json).toHaveLength(1);
      expect(json[0].type).toBe(ComponentType.Container);

      const inner = json[0].components;
      // Header section với nút Refresh
      expect(inner[0].type).toBe(ComponentType.Section);
      expect(inner[0].components[0].content).toContain('Bảng Điều Khiển Máy Chủ');
      expect(inner[0].accessory.custom_id).toBe('admin_console:refresh:user-caller');

      // Tóm tắt hiện trạng
      const statusText = inner[2].content;
      expect(statusText).toContain('<@owner-456>');
      expect(statusText).toContain('<@&111111111111111111>');
      expect(statusText).toContain('<#123456789012345678>');
      expect(statusText).toContain('🟢 Đang Bật');
      expect(statusText).toContain('MB • 0987654321');

      // Section Hub Thông Báo Tự Động (gộp welcome, leave, booster)
      const noticesSection = inner.find(
        (s: any) => s.accessory?.custom_id?.startsWith('admin_console:notices_hub'),
      );
      expect(noticesSection).toBeDefined();
      expect(noticesSection.accessory.label).toContain('Cấu Hình Hub');
      expect(noticesSection.accessory.style).toBe(ButtonStyle.Secondary);
    });

    it('Render chính xác khi tắt welcome và chưa cấu hình role/vietqr', () => {
      const emptySettings: GuildSettings = {
        ...mockSettings,
        welcome: { ...mockSettings.welcome, enabled: false, channelId: null },
        rbac: { botAdminRoleId: null, moderatorRoleId: null, memberRoleId: null },
        vietqr: undefined,
      };

      const result = buildAdminConsoleContainer(mockGuild, emptySettings, 'user-caller', 'vi');
      const json = result.toJSON() as any[];
      const inner = json[0].components;

      const statusText = inner[2].content;
      expect(statusText).toContain('Chưa gán');
      expect(statusText).toContain('Chưa đặt kênh');
      expect(statusText).toContain('Chưa cài đặt');

      const noticesSection = inner.find(
        (s: any) => s.accessory?.custom_id?.startsWith('admin_console:notices_hub'),
      );
      expect(noticesSection).toBeDefined();
      expect(noticesSection.accessory.style).toBe(ButtonStyle.Secondary);
    });

    it('Triệt tiêu lỗi @vai-trò-chưa-rõ khi role hoặc channel bị xóa khỏi máy chủ', () => {
      const deletedSettings: GuildSettings = {
        ...mockSettings,
        rbac: {
          botAdminRoleId: '999999999999999999', // Không có trong cache guild
          moderatorRoleId: 'invalid-string-id',  // Không phải snowflake
          memberRoleId: null,
        },
        welcome: { ...mockSettings.welcome, channelId: '888888888888888888' }, // Không có trong cache
      };

      const result = buildAdminConsoleContainer(mockGuild, deletedSettings, 'user-caller', 'vi');
      const json = result.toJSON() as any[];
      const statusText = json[0].components[2].content;

      // Không được chứa tag rác
      expect(statusText).not.toContain('<@&999999999999999999>');
      expect(statusText).not.toContain('<@&invalid-string-id>');
      expect(statusText).not.toContain('<#888888888888888888>');
      expect(statusText).toContain('Chưa gán');
      expect(statusText).toContain('Chưa đặt kênh');
    });

    it('Tất cả nút hành động cấu hình đều dùng ButtonStyle.Secondary (Dark Grey)', () => {
      const result = buildAdminConsoleContainer(mockGuild, mockSettings, 'user-caller', 'vi');
      const json = result.toJSON() as any[];
      const sections = json[0].components.filter((c: any) => c.type === ComponentType.Section && c.accessory);

      // Section 0 là Refresh (Secondary)
      expect(sections[0].accessory.style).toBe(ButtonStyle.Secondary);
      // Các Section cấu hình: Roles, DF Codes, Notices Hub, VietQR (đều Secondary)
      const configSections = sections.filter((s: any) =>
        s.accessory?.custom_id?.startsWith('admin_console:roles:') ||
        s.accessory?.custom_id?.startsWith('admin_console:code_channel:') ||
        s.accessory?.custom_id?.startsWith('admin_console:notices_hub:') ||
        s.accessory?.custom_id?.startsWith('admin_console:vietqr:'),
      );
      expect(configSections).toHaveLength(4);
      configSections.forEach((s: any) => {
        expect(s.accessory.style).toBe(ButtonStyle.Secondary);
      });
    });

    it('Hỗ trợ ngôn ngữ tiếng Anh (en)', () => {
      const result = buildAdminConsoleContainer(mockGuild, mockSettings, 'user-caller', 'en');
      const json = result.toJSON() as any[];
      const inner = json[0].components;

      expect(inner[0].components[0].content).toContain('Server Control Center');
      expect(inner[0].accessory.label).toBe('Refresh');
    });
  });

  describe('Builder: buildAdminConsoleFooterRow', () => {
    it('Tạo ActionRow footer với các nút chức năng (không trùng custom_id với Container)', () => {
      const row = buildAdminConsoleFooterRow('caller-1', 'vi');
      const components = row.components;
      expect(components).toHaveLength(2);
      expect(components[0].data.label).toContain('/df help');
      expect(components[1].data.style).toBe(ButtonStyle.Link);

      // Đảm bảo không trùng bất kỳ custom_id nào với Container chính
      const containerResult = buildAdminConsoleContainer(mockGuild, mockSettings, 'caller-1', 'vi');
      const containerJson = containerResult.toJSON() as any[];
      const containerCustomIds = containerJson[0].components
        .map((c: any) => c.accessory?.custom_id)
        .filter(Boolean);

      const footerCustomIds = components
        .map((c: any) => c.data?.custom_id)
        .filter(Boolean);

      for (const id of footerCustomIds) {
        expect(containerCustomIds).not.toContain(id);
      }
    });
  });

  describe('Builder: In-Place Config Views', () => {
    it('buildChannelConfigView: tạo giao diện chọn kênh văn bản kèm nút Reset và Quay lại', () => {
      const view = buildChannelConfigView('code_channel', mockGuild, mockSettings, 'user-caller', 'vi');
      expect(view.flags).toBe(MessageFlags.IsComponentsV2);
      expect(view.components).toHaveLength(3);

      // Component 0: Container header
      expect(view.components[0].type).toBe(ComponentType.Container);
      expect(view.components[0].components[0].content).toContain('Kênh Mật Mã Két Sắt');

      // Component 1: ActionRow chứa ChannelSelectMenu
      expect(view.components[1].components[0].type).toBe(ComponentType.ChannelSelect);
      expect(view.components[1].components[0].custom_id).toBe('admin_console_select:code_channel:user-caller');

      // Component 2: ActionRow chứa nút Quay lại và Gỡ kênh
      expect(view.components[2].components[0].custom_id).toBe('admin_console:back:user-caller');
      expect(view.components[2].components[1].custom_id).toBe('admin_console:reset_code_channel:user-caller');
      expect(view.components[2].components[1].disabled).toBe(false);
    });

    it('buildRolesConfigView: tạo giao diện phân quyền RBAC 2 Select Menu', () => {
      const view = buildRolesConfigView(mockGuild, mockSettings, 'user-caller', 'vi');
      expect(view.flags).toBe(MessageFlags.IsComponentsV2);
      expect(view.components).toHaveLength(4);

      // Component 1 & 2: RoleSelectMenu cho Admin và Mod
      expect(view.components[1].components[0].custom_id).toBe('admin_console_select:role_admin:user-caller');
      expect(view.components[2].components[0].custom_id).toBe('admin_console_select:role_mod:user-caller');

      // Component 3: Nút Quay lại và Gỡ vai trò
      expect(view.components[3].components[0].custom_id).toBe('admin_console:back:user-caller');
      expect(view.components[3].components[1].custom_id).toBe('admin_console:reset_role_admin:user-caller');
      expect(view.components[3].components[2].custom_id).toBe('admin_console:reset_role_mod:user-caller');
    });
  });

  describe('Slash Command: /admin', () => {
    it('Định nghĩa lệnh có tên và localization chính xác', () => {
      expect(adminData.name).toBe('admin');
      expect(adminData.name_localizations?.vi).toBe('quản-trị');
    });

    it('Từ chối khi thực thi ngoài guild (DM)', async () => {
      const interaction: any = {
        guild: null,
        reply: jest.fn().mockResolvedValue({}),
      };

      await executeAdminCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('chỉ dùng được trong máy chủ'),
        }),
      );
    });

    it('Thực thi thành công trong guild và trả về Components V2', async () => {
      const mockDb: any = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null),
          run: jest.fn(),
        }),
      };

      const interaction: any = {
        guild: mockGuild,
        user: { id: 'user-admin' },
        locale: 'vi',
        client: { database: mockDb },
        reply: jest.fn().mockResolvedValue({}),
      };

      await executeAdminCommand(interaction, mockDb);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: expect.any(Number),
          components: expect.any(Array),
        }),
      );
    });
  });

  describe('Handler: handleAdminConsoleButton', () => {
    it('Bỏ qua khi không phải prefix admin_console:', async () => {
      const interaction: any = { customId: 'other_btn:123' };
      const res = await handleAdminConsoleButton(interaction);
      expect(res.handled).toBe(false);
    });

    it('User Isolation: Từ chối người lạ không có quyền', async () => {
      const interaction: any = {
        customId: 'admin_console:refresh:original-caller',
        guild: mockGuild,
        user: { id: 'stranger-user' },
        memberPermissions: {
          has: jest.fn().mockReturnValue(false),
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleButton(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Chỉ người gọi lệnh hoặc quản trị viên'),
          flags: MessageFlags.Ephemeral,
        }),
      );
    });

    it('Xử lý nút refresh cho caller hợp lệ', async () => {
      const mockDb: any = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null),
          run: jest.fn(),
        }),
      };

      const interaction: any = {
        customId: 'admin_console:refresh:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        client: { database: mockDb },
        memberPermissions: {
          has: jest.fn().mockReturnValue(false),
        },
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleButton(interaction, mockDb);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
        }),
      );
    });

    it('Xử lý nút welcome_toggle: đổi trạng thái và update UI', async () => {
      const mockDb: any = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null),
          run: jest.fn(),
        }),
      };

      const interaction: any = {
        customId: 'admin_console:welcome_toggle:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        client: { database: mockDb },
        memberPermissions: {
          has: jest.fn().mockReturnValue(false),
        },
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleButton(interaction, mockDb);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('Xử lý các nút mở cấu hình tương tác In-Place (roles, code_channel, welcome_channel, back)', async () => {
      const inPlaceActions = ['roles', 'code_channel', 'welcome_channel', 'back'];

      for (const act of inPlaceActions) {
        const interaction: any = {
          customId: `admin_console:${act}:user-caller`,
          guild: mockGuild,
          user: { id: 'user-caller' },
          locale: 'vi',
          memberPermissions: { has: jest.fn().mockReturnValue(false) },
          update: jest.fn().mockResolvedValue({}),
        };

        const res = await handleAdminConsoleButton(interaction);
        expect(res.handled).toBe(true);
        expect(interaction.update).toHaveBeenCalled();
      }
    });

    it('Xử lý các nút reset cấu hình (reset_code_channel, reset_role_admin)', async () => {
      const resetActions = ['reset_code_channel', 'reset_role_admin'];

      for (const act of resetActions) {
        const interaction: any = {
          customId: `admin_console:${act}:user-caller`,
          guild: mockGuild,
          user: { id: 'user-caller' },
          locale: 'vi',
          memberPermissions: { has: jest.fn().mockReturnValue(false) },
          update: jest.fn().mockResolvedValue({}),
        };

        const res = await handleAdminConsoleButton(interaction);
        expect(res.handled).toBe(true);
        expect(interaction.update).toHaveBeenCalled();
      }
    });

    it('Xử lý nút help: trả lời hướng dẫn nhanh dạng Ephemeral', async () => {
      const interaction: any = {
        customId: 'admin_console:help:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        reply: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleButton(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: MessageFlags.Ephemeral,
        }),
      );
    });

    it('Xử lý nút vietqr: hiển thị Modal nhập thông tin ngân hàng', async () => {
      const interaction: any = {
        customId: 'admin_console:vietqr:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        showModal: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleButton(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            custom_id: 'admin_console_modal:vietqr:user-caller',
          }),
        }),
      );
    });
  });

  describe('Handler: handleAdminConsoleSelect', () => {
    it('Bỏ qua khi không phải prefix admin_console_select:', async () => {
      const interaction: any = { customId: 'other_select:123' };
      const res = await handleAdminConsoleSelect(interaction);
      expect(res.handled).toBe(false);
    });

    it('Từ chối người lạ không có quyền', async () => {
      const interaction: any = {
        customId: 'admin_console_select:code_channel:original-caller',
        guild: mockGuild,
        user: { id: 'stranger-user' },
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        reply: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleSelect(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Chỉ người gọi lệnh hoặc quản trị viên'),
          flags: MessageFlags.Ephemeral,
        }),
      );
    });

    it('Xử lý chọn kênh mật mã két sắt (code_channel): cập nhật DB và trở về Dashboard chính', async () => {
      const interaction: any = {
        customId: 'admin_console_select:code_channel:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        values: ['876543210987654321'],
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleSelect(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
        }),
      );
    });

    it('Xử lý chọn vai trò Bot Admin (role_admin): cập nhật DB và update màn hình Roles', async () => {
      const interaction: any = {
        customId: 'admin_console_select:role_admin:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        values: ['111111111111111111'],
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleSelect(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
        }),
      );
    });
  });

  describe('Handler: handleAdminConsoleModal', () => {
    it('Bỏ qua khi không phải prefix admin_console_modal:', async () => {
      const interaction: any = { customId: 'other_modal:123' };
      const res = await handleAdminConsoleModal(interaction);
      expect(res.handled).toBe(false);
    });

    it('Lưu cấu hình VietQR thành công từ Modal submit', async () => {
      const interaction: any = {
        customId: 'admin_console_modal:vietqr:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        fields: {
          getTextInputValue: jest.fn((fieldId: string) => {
            if (fieldId === 'bank_id') return 'MB';
            if (fieldId === 'account_no') return '0123456789';
            if (fieldId === 'account_name') return 'NGUYEN VAN A';
            return '';
          }),
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleModal(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('MB • 0123456789'),
          flags: MessageFlags.Ephemeral,
        }),
      );
    });

    it('Cập nhật thuộc tính lines từ Modal editor_lines và update live preview', async () => {
      const interaction: any = {
        customId: 'admin_console_modal:editor_lines:welcome:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('Dòng mới 1\nDòng mới 2'),
        },
        isFromMessage: jest.fn().mockReturnValue(true),
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleModal(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
      const session = getAdminEditorSession('user-caller');
      expect(session?.draft.contentLines).toEqual(['Dòng mới 1', 'Dòng mới 2']);
    });

    it('Cập nhật header template từ Modal editor_header', async () => {
      const interaction: any = {
        customId: 'admin_console_modal:editor_header:welcome:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('Header Mới {user}'),
        },
        isFromMessage: jest.fn().mockReturnValue(true),
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleModal(interaction);
      expect(res.handled).toBe(true);
      const session = getAdminEditorSession('user-caller');
      expect(session?.draft.headerTemplate).toBe('Header Mới {user}');
    });

    it('Cập nhật màu viền từ Modal editor_color', async () => {
      const interaction: any = {
        customId: 'admin_console_modal:editor_color:welcome:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('#FF00AA'),
        },
        isFromMessage: jest.fn().mockReturnValue(true),
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleModal(interaction);
      expect(res.handled).toBe(true);
      const session = getAdminEditorSession('user-caller');
      expect(session?.draft.accentColor).toBe(0xff00aa);
    });

    it('Cập nhật media URL và mô tả từ Modal editor_media', async () => {
      const interaction: any = {
        customId: 'admin_console_modal:editor_media:welcome:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        fields: {
          getTextInputValue: jest.fn((id: string) => {
            if (id === 'media_url') return 'https://example.com/image.png';
            if (id === 'media_description') return 'Ảnh đại diện máy chủ';
            return '';
          }),
        },
        isFromMessage: jest.fn().mockReturnValue(true),
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleModal(interaction);
      expect(res.handled).toBe(true);
      const session = getAdminEditorSession('user-caller');
      expect(session?.draft.mediaUrl).toBe('https://example.com/image.png');
      expect(session?.draft.mediaDescription).toBe('Ảnh đại diện máy chủ');
    });
  });

  describe('Builder & Handlers: Automated Notices Hub & Live Preview Editor', () => {
    it('buildNoticesHubView: tạo giao diện quản lý thông báo Tab welcome đầy đủ', () => {
      const view = buildNoticesHubView(mockGuild, mockSettings, 'welcome', 'user-caller', 'vi');
      expect(view.flags).toBe(MessageFlags.IsComponentsV2);
      expect(view.components).toHaveLength(5); // Container + Tabs + ChannelSelect + RoleSelect + ActionRow

      const tabsRow = view.components[1];
      expect(tabsRow.components).toHaveLength(3);
      expect(tabsRow.components[0].style).toBe(ButtonStyle.Primary); // Tab active
      expect(tabsRow.components[1].style).toBe(ButtonStyle.Secondary);
      expect(tabsRow.components[2].style).toBe(ButtonStyle.Secondary);

      // RoleSelectMenu có mặt cho tab welcome
      const roleSelectRow = view.components[3];
      expect(roleSelectRow.components[0].custom_id).toBe('admin_console_select:notice_role_welcome:user-caller');

      // ActionRow chứa 5 nút
      const actionRow = view.components[4];
      expect(actionRow.components).toHaveLength(5);
    });

    it('buildNoticesHubView: tạo giao diện Tab leave (không có RoleSelectMenu)', () => {
      const view = buildNoticesHubView(mockGuild, mockSettings, 'leave', 'user-caller', 'vi');
      expect(view.components).toHaveLength(4); // Container + Tabs + ChannelSelect + ActionRow (không có RoleSelect)
      const actionRow = view.components[3];
      expect(actionRow.components).toHaveLength(5);
    });

    it('buildContainerEditorView: tạo giao diện Live Preview kèm các nút công cụ', () => {
      const draft = mockSettings.welcome.container;
      const editorView = buildContainerEditorView(draft, 'welcome', 'user-caller', 'vi');
      expect(editorView.flags).toBe(MessageFlags.IsComponentsV2);
      expect(editorView.components.length).toBeGreaterThanOrEqual(3); // Preview Container + PropsRow + ActionsRow
    });

    it('Xây dựng các Modal builder cho Container editor', () => {
      const linesModal = buildAdminEditorLinesModal('welcome', 'user-caller', ['Line 1', 'Line 2']);
      expect(linesModal.data.title).toContain('welcome');

      const headerModal = buildAdminEditorHeaderModal('welcome', 'user-caller', 'Header text');
      expect(headerModal.data.title).toContain('welcome');

      const colorModal = buildAdminEditorColorModal('welcome', 'user-caller', 0x5865f2);
      expect(colorModal.data.title).toContain('welcome');

      const mediaModal = buildAdminEditorMediaModal('welcome', 'user-caller', 'https://example.com/pic.png', 'Alt text');
      expect(mediaModal.data.title).toContain('welcome');
    });

    it('Handler Button: Mở Hub thông báo (notices_hub) và chuyển tab', async () => {
      const interaction: any = {
        customId: 'admin_console:notices_hub:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleButton(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: MessageFlags.IsComponentsV2,
        }),
      );

      // Chuyển sang tab leave
      interaction.customId = 'admin_console:tab_leave:user-caller';
      const resLeave = await handleAdminConsoleButton(interaction);
      expect(resLeave.handled).toBe(true);
    });

    it('Handler Button: Toggle trạng thái thông báo và gỡ kênh', async () => {
      const interaction: any = {
        customId: 'admin_console:toggle_notice_welcome:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        update: jest.fn().mockResolvedValue({}),
      };

      const resToggle = await handleAdminConsoleButton(interaction);
      expect(resToggle.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();

      // Gỡ kênh
      interaction.customId = 'admin_console:reset_notice_chan_welcome:user-caller';
      const resReset = await handleAdminConsoleButton(interaction);
      expect(resReset.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
    });

    it('Handler Button: Khởi tạo Live Preview Editor (edit_container_welcome)', async () => {
      const interaction: any = {
        customId: 'admin_console:edit_container_welcome:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        update: jest.fn().mockResolvedValue({}),
      };

      const res = await handleAdminConsoleButton(interaction);
      expect(res.handled).toBe(true);
      expect(interaction.update).toHaveBeenCalled();
      const session = getAdminEditorSession('user-caller');
      expect(session).toBeDefined();
      expect(session?.type).toBe('welcome');
    });

    it('Handler Button: Thao tác Editor (bật tắt separator, reset default, save, cancel)', async () => {
      setAdminEditorSession('user-caller', {
        guildId: 'guild-123',
        type: 'welcome',
        draft: { ...mockSettings.welcome.container, showSeparator: false },
        lastInteractionAt: Date.now(),
      });

      const interaction: any = {
        customId: 'admin_console:editor_sep:welcome:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        update: jest.fn().mockResolvedValue({}),
      };

      // Toggle separator
      await handleAdminConsoleButton(interaction);
      expect(getAdminEditorSession('user-caller')?.draft.showSeparator).toBe(true);

      // Reset default
      interaction.customId = 'admin_console:editor_reset:welcome:user-caller';
      await handleAdminConsoleButton(interaction);
      expect(interaction.update).toHaveBeenCalled();

      // Save
      interaction.customId = 'admin_console:editor_save:welcome:user-caller';
      await handleAdminConsoleButton(interaction);
      expect(getAdminEditorSession('user-caller')).toBeUndefined(); // Session đã xóa sau save

      // Cancel
      setAdminEditorSession('user-caller', {
        guildId: 'guild-123',
        type: 'welcome',
        draft: { ...mockSettings.welcome.container },
        lastInteractionAt: Date.now(),
      });
      interaction.customId = 'admin_console:editor_cancel:welcome:user-caller';
      await handleAdminConsoleButton(interaction);
      expect(getAdminEditorSession('user-caller')).toBeUndefined();
    });

    it('Handler Select: Chọn kênh thông báo và chọn vai trò tự động gán', async () => {
      const chanInteraction: any = {
        customId: 'admin_console_select:notice_chan_welcome:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        values: ['123456789012345678'],
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        update: jest.fn().mockResolvedValue({}),
      };

      const resChan = await handleAdminConsoleSelect(chanInteraction);
      expect(resChan.handled).toBe(true);
      expect(chanInteraction.update).toHaveBeenCalled();

      const roleInteraction: any = {
        customId: 'admin_console_select:notice_role_welcome:user-caller',
        guild: mockGuild,
        user: { id: 'user-caller' },
        values: ['111111111111111111'],
        locale: 'vi',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
        update: jest.fn().mockResolvedValue({}),
      };

      const resRole = await handleAdminConsoleSelect(roleInteraction);
      expect(resRole.handled).toBe(true);
      expect(roleInteraction.update).toHaveBeenCalled();
    });
  });
});
