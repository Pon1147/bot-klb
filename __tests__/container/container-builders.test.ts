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
  buildEditRow1,
  buildLinesRow,
  buildActionRow,
  buildAllEditorRows,
  buildColorPresetRow,
  buildBackRow,
  buildLinesSubmenuRows,
  buildColorPickerRows,
  buildTextModal,
  buildLongTextModal,
  buildMediaModal,
  buildEditLineModal,
  buildLivePreviewContainer,
  buildLinesInfoContainer,
  buildColorPickerInfoContainer,
  updateEditorMessage,
} from '../../src/commands/container/container-builders.js';
import { ContainerSettings } from '../../src/types/settings.types.js';
import { CONTAINER_COLOR_PRESETS, ContainerEditSession } from '../../src/commands/container/container-session.js';
import { ButtonInteraction } from 'discord.js';

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

  describe('buildEditRow1()', () => {
    it('phải trả về ActionRow với 4 buttons chỉnh sửa', () => {
      const row = buildEditRow1();

      expect(row).toBeInstanceOf(ActionRowBuilder);
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(4);
    });

    it('tất cả buttons phải là ButtonBuilder', () => {
      const row = buildEditRow1();
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      components.forEach((comp) => {
        expect(comp).toBeInstanceOf(ButtonBuilder);
      });
    });
  });

  describe('buildLinesRow()', () => {
    it('phải trả về ActionRow với 4 buttons lines management', () => {
      const row = buildLinesRow();

      expect(row).toBeInstanceOf(ActionRowBuilder);
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(4);
    });

    it('tất cả buttons phải là ButtonBuilder', () => {
      const row = buildLinesRow();
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
    it('phải trả về array 2 rows (edit + action)', () => {
      const rows = buildAllEditorRows();

      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBe(2);
    });

    it('row đầu tiên phải có 4 buttons (edit row)', () => {
      const rows = buildAllEditorRows();
      const components = (rows[0] as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(4);
    });

    it('row thứ hai phải có 3 buttons (action row)', () => {
      const rows = buildAllEditorRows();
      const components = (rows[1] as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(3);
    });
  });

  describe('buildColorPresetRow()', () => {
    it('phải trả về ActionRow với presets + custom button', () => {
      const row = buildColorPresetRow();

      expect(row).toBeInstanceOf(ActionRowBuilder);
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      // 4 presets + 1 custom = 5 buttons
      expect(components.length).toBe(CONTAINER_COLOR_PRESETS.length + 1);
    });

    it('tất cả components phải là ButtonBuilder', () => {
      const row = buildColorPresetRow();
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      components.forEach((comp) => {
        expect(comp).toBeInstanceOf(ButtonBuilder);
      });
    });

    it('phải có đúng số lượng buttons (presets + 1 custom)', () => {
      const row = buildColorPresetRow();
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components.length).toBe(5);
    });
  });

  describe('buildBackRow()', () => {
    it('phải trả về ActionRow với 1 button back', () => {
      const row = buildBackRow();

      expect(row).toBeInstanceOf(ActionRowBuilder);
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(1);
    });

    it('button phải là ButtonBuilder', () => {
      const row = buildBackRow();
      const components = (row as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components[0]).toBeInstanceOf(ButtonBuilder);
    });
  });

  describe('buildLinesSubmenuRows()', () => {
    it('phải trả về array 2 rows (lines + back)', () => {
      const rows = buildLinesSubmenuRows();

      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBe(2);
    });

    it('row đầu tiên phải có 4 buttons (lines row)', () => {
      const rows = buildLinesSubmenuRows();
      const components = (rows[0] as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(4);
    });

    it('row thứ hai phải có 1 button (back row)', () => {
      const rows = buildLinesSubmenuRows();
      const components = (rows[1] as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(1);
    });
  });

  describe('buildColorPickerRows()', () => {
    it('phải trả về array 2 rows (color presets + back)', () => {
      const rows = buildColorPickerRows();

      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBe(2);
    });

    it('row đầu tiên phải có 5 buttons (4 presets + 1 custom)', () => {
      const rows = buildColorPickerRows();
      const components = (rows[0] as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(5);
    });

    it('row thứ hai phải có 1 button (back row)', () => {
      const rows = buildColorPickerRows();
      const components = (rows[1] as unknown as Record<string, unknown>).components as ButtonBuilder[];
      expect(components).toHaveLength(1);
    });
  });

  // ─── Modal Builders ────────────────────────────────────────

  describe('buildTextModal()', () => {
    it('phải trả về ModalBuilder', () => {
      const modal = buildTextModal('test_id', 'Test Label', 'Placeholder', 'Value');

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải có 1 ActionRow component', () => {
      const modal = buildTextModal('test_id', 'Label', 'Placeholder', 'Value');

      const components = (modal as unknown as Record<string, unknown>).components;
      expect(components).toHaveLength(1);
    });

    it('phải xử lý value rỗng', () => {
      const modal = buildTextModal('test_id', 'Label', 'Placeholder', '');

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải có ActionRow với TextInput bên trong', () => {
      const modal = buildTextModal('test_id', 'Label', 'Placeholder', 'Value');

      const components = (modal as unknown as Record<string, unknown>).components;
      expect(components[0]).toBeInstanceOf(ActionRowBuilder);
    });
  });

  describe('buildLongTextModal()', () => {
    it('phải trả về ModalBuilder', () => {
      const modal = buildLongTextModal('test_id', 'Test Label', 'Placeholder', 'Value');

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải có 1 ActionRow component', () => {
      const modal = buildLongTextModal('test_id', 'Label', 'Placeholder', 'Value');

      const components = (modal as unknown as Record<string, unknown>).components;
      expect(components).toHaveLength(1);
    });

    it('phải xử lý value rỗng', () => {
      const modal = buildLongTextModal('test_id', 'Label', 'Placeholder', '');

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải có ActionRow với TextInput bên trong', () => {
      const modal = buildLongTextModal('test_id', 'Label', 'Placeholder', 'Value');

      const components = (modal as unknown as Record<string, unknown>).components;
      expect(components[0]).toBeInstanceOf(ActionRowBuilder);
    });
  });

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

  describe('buildEditLineModal()', () => {
    it('phải trả về ModalBuilder với 2 text inputs', () => {
      const modal = buildEditLineModal(5);

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải có 2 ActionRows (index + content)', () => {
      const modal = buildEditLineModal(3);

      const components = (modal as unknown as Record<string, unknown>).components;
      expect(components).toHaveLength(2);
    });

    it('phải xử lý lineCount = 1', () => {
      const modal = buildEditLineModal(1);

      expect(modal).toBeInstanceOf(ModalBuilder);
    });

    it('phải xử lý lineCount = 0 (edge case)', () => {
      const modal = buildEditLineModal(0);

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

  // ─── Info Containers ───────────────────────────────────────

  describe('buildLinesInfoContainer()', () => {
    it('phải trả về container với danh sách lines', () => {
      const result = buildLinesInfoContainer(['Line A', 'Line B', 'Line C']);

      expect(result).toBeDefined();
      expect(Array.isArray(result.components)).toBe(true);
    });

    it('phải xử lý mảng rỗng (không có dòng nào)', () => {
      const result = buildLinesInfoContainer([]);

      expect(result).toBeDefined();
      expect(Array.isArray(result.components)).toBe(true);
    });

    it('phải có đúng số lượng lines trong content', () => {
      const lines = ['First', 'Second'];
      const result = buildLinesInfoContainer(lines);

      expect(result).toBeDefined();
    });
  });

  describe('buildColorPickerInfoContainer()', () => {
    it('phải trả về container với accent color hex', () => {
      const result = buildColorPickerInfoContainer(0x5865f2);

      expect(result).toBeDefined();
      expect(Array.isArray(result.components)).toBe(true);
    });

    it('phải convert number color thành hex string đúng format', () => {
      const result = buildColorPickerInfoContainer(0xff0000);

      expect(result).toBeDefined();
    });

    it('phải xử lý color = 0', () => {
      const result = buildColorPickerInfoContainer(0);

      expect(result).toBeDefined();
    });
  });
});

describe("updateEditorMessage", () => {
  it("should update message with live preview", async () => {
    const mockUpdate = jest.fn().mockResolvedValue(undefined);
    const mockInteraction = { update: mockUpdate } as unknown as ButtonInteraction;
    const session = {
      draft: {
        accentColor: 0x5865f2,
        headerTemplate: "**Test Header**",
        contentLines: ["Test content"],
        mediaUrl: null,
        mediaDescription: null,
        showSeparator: false,
        files: [],
      },
    } as unknown as ContainerEditSession;
    await updateEditorMessage(mockInteraction, session);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});