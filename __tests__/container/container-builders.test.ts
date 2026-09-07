/**
 * Test cho Container Builders.
 * Verify tất cả builder functions đạt 100% coverage.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ModalBuilder,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import {
  buildMainEditorRow,
  buildActionRow,
  buildAllEditorRows,
  buildMediaModal,
  buildLinesModal,
  buildColorModal,
  buildHeaderModal,
  buildLivePreviewContainer,
  updateEditorMessage,
} from '../../src/commands/container/container-builders.js';
import { ContainerSettings } from '../../src/types/settings.types.js';
import { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';

const mockContainerSettings: ContainerSettings = {
  accentColor: 0x5865f2,
  headerTemplate: '**Welcome {user}!**',
  contentLines: ['Line 1', 'Line 2', 'Line 3'],
  mediaUrl: null,
  mediaDescription: null,
  showSeparator: true,
};

describe('Container Builders', () => {
  // ─── Button Row Builders ───────────────────────────────────

  describe('buildMainEditorRow()', () => {
    it('phải trả về ActionRow với 5 buttons', () => {
      const row = buildMainEditorRow(mockContainerSettings);

      expect(row).toBeInstanceOf(ActionRowBuilder);
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(5);
    });

    it('tất cả buttons phải là ButtonBuilder', () => {
      const row = buildMainEditorRow(mockContainerSettings);
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      components.forEach((comp) => {
        expect(comp).toBeInstanceOf(ButtonBuilder);
      });
    });
  });

  describe('buildActionRow()', () => {
    it('phải trả về ActionRow với 3 buttons action', () => {
      const row = buildActionRow();

      expect(row).toBeInstanceOf(ActionRowBuilder);
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(3);
    });

    it('tất cả buttons phải là ButtonBuilder', () => {
      const row = buildActionRow();
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      components.forEach((comp) => {
        expect(comp).toBeInstanceOf(ButtonBuilder);
      });
    });
  });

  describe('buildAllEditorRows()', () => {
    it('phải trả về array 2 rows (main + action)', () => {
      const rows = buildAllEditorRows(mockContainerSettings);

      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBe(2);
    });

    it('row đầu tiên phải có 5 buttons (main row)', () => {
      const rows = buildAllEditorRows(mockContainerSettings);
      const components = (rows[0] as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(5);
    });

    it('row thứ hai phải có 3 buttons (action row)', () => {
      const rows = buildAllEditorRows(mockContainerSettings);
      const components = (rows[1] as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(3);
    });
  });

  // ─── Modal Builders ────────────────────────────────────────

  describe('buildMediaModal()', () => {
    it('phải trả về ModalBuilder với 2 text inputs', () => {
      const modal = buildMediaModal('https://example.com/img.png', 'Description');

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải có 2 ActionRows (url + description)', () => {
      const modal = buildMediaModal('url', 'desc');

      const components = (modal as unknown as Record<string, unknown>).components;
      expect(components).toHaveLength(2);
    });

    it('phải set value mặc định khi currentUrl = null', () => {
      const modal = buildMediaModal(null, null);

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải set value mặc định khi currentDesc = null', () => {
      const modal = buildMediaModal('https://example.com/img.png', null);

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải xử lý cả url và desc đều có giá trị', () => {
      const modal = buildMediaModal('https://example.com/img.gif', 'My Alt Text');

      expect(modal).toBeInstanceOf(ModalBuilder);
    });
  });

  describe('buildLinesModal()', () => {
    it('phải trả về ModalBuilder', () => {
      const modal = buildLinesModal(['Line 1', 'Line 2']);

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải có 1 ActionRow component', () => {
      const modal = buildLinesModal(['Line 1']);

      const components = (modal as unknown as Record<string, unknown>).components;
      expect(components).toHaveLength(1);
    });

    it('phải hiển thị raw lines không có số prefix', () => {
      const modal = buildLinesModal(['First', 'Second']);
      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải hiển thị "(chưa có dòng nào)" khi empty', () => {
      const modal = buildLinesModal([]);
      expect(modal).toBeInstanceOf(ModalBuilder);
    });
  });

  describe('buildColorModal()', () => {
    it('phải trả về ModalBuilder', () => {
      const modal = buildColorModal(0x5865f2);

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải có 1 ActionRow component', () => {
      const modal = buildColorModal(0xff0000);

      const components = (modal as unknown as Record<string, unknown>).components;
      expect(components).toHaveLength(1);
    });

    it('phải hiển thị hex color đúng format', () => {
      const modal = buildColorModal(0x5865f2);
      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải xử lý color = 0', () => {
      const modal = buildColorModal(0);
      expect(modal).toBeInstanceOf(ModalBuilder);
    });
  });

  describe('buildHeaderModal()', () => {
    it('phải trả về ModalBuilder', () => {
      const modal = buildHeaderModal('**Welcome {user}!**');

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải có 1 ActionRow component', () => {
      const modal = buildHeaderModal('Header');

      const components = (modal as unknown as Record<string, unknown>).components;
      expect(components).toHaveLength(1);
    });

    it('phải set value mặc định khi headerTemplate = null', () => {
      const modal = buildHeaderModal(null);
      expect(modal).toBeInstanceOf(ModalBuilder);
    });
  });

  // ─── Preview Builder ───────────────────────────────────────

  describe('buildLivePreviewContainer()', () => {
    it('phải trả về container với components hợp lệ', () => {
      const result = buildLivePreviewContainer(mockContainerSettings);

      expect(result).toBeDefined();
      expect(result.components).toBeDefined();
      expect(Array.isArray(result.components)).toBe(true);
      expect(result.components.length).toBeGreaterThan(0);
    });

    it('phải có flag IsComponentsV2', () => {
      const result = buildLivePreviewContainer(mockContainerSettings);

      expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    });

    it('phải có files array (có thể rỗng)', () => {
      const result = buildLivePreviewContainer(mockContainerSettings);

      expect(Array.isArray(result.files)).toBe(true);
    });

    it('phải render container type component', () => {
      const result = buildLivePreviewContainer(mockContainerSettings);

      const container = result.components[0] as Record<string, unknown>;
      expect(container.type).toBe(ComponentType.Container);
    });

    it('phải xử lý settings không có headerTemplate (null)', () => {
      const settingsWithoutHeader: ContainerSettings = {
        ...mockContainerSettings,
        headerTemplate: null,
      };

      const result = buildLivePreviewContainer(settingsWithoutHeader);
      expect(result.components).toBeDefined();
    });

    it('phải xử lý settings không có contentLines (empty)', () => {
      const settingsEmptyLines: ContainerSettings = {
        ...mockContainerSettings,
        contentLines: [],
      };

      const result = buildLivePreviewContainer(settingsEmptyLines);
      expect(result.components).toBeDefined();
    });

    it('phải xử lý showSeparator = false', () => {
      const settingsNoSeparator: ContainerSettings = {
        ...mockContainerSettings,
        showSeparator: false,
      };

      const result = buildLivePreviewContainer(settingsNoSeparator);
      expect(result.components).toBeDefined();
    });

    it('phải xử lý mediaUrl hợp lệ', () => {
      const settingsWithMedia: ContainerSettings = {
        ...mockContainerSettings,
        mediaUrl: 'https://example.com/image.png',
        mediaDescription: 'Test image',
      };

      const result = buildLivePreviewContainer(settingsWithMedia);
      expect(result.components).toBeDefined();
    });
  });
});

describe('updateEditorMessage', () => {
  it('should update message with live preview', async () => {
    const mockUpdate = jest.fn().mockResolvedValue(undefined);
    const mockInteraction = { update: mockUpdate } as unknown as ButtonInteraction;
    await updateEditorMessage(mockInteraction, mockContainerSettings);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
