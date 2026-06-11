/**
 * Unit tests cho container.utils.ts (UI mới - Section + Thumbnail).
 * Test đầy đủ buildContainer, buildEmptyContainer, buildTextOnlyContainer,
 * buildSuccessContainer, buildErrorContainer.
 *
 * Cấu trúc UI mới:
 * 1. Section + Thumbnail (header với avatar top-right)
 * 2. TextDisplay (content lines) - optional
 * 3. Separator - optional
 * 4. MediaGallery (chỉ custom media) - optional
 *
 * Mục tiêu: 99%+ coverage cho container-related code.
 */

import { ComponentType, MessageFlags } from 'discord.js';
import { ContainerSettings, TemplateContext } from '../src/types/settings.types.js';

// Mock discord.js — ComponentType values đúng theo discord-api-types v10
jest.mock('discord.js', () => {
  const mockAttachmentBuilder = jest.fn().mockImplementation((path: string) => ({ path }));
  const mockMessageFlags = {
    IsComponentsV2: 65536,
  };
  const mockComponentType = {
    ActionRow: 1,
    Button: 2,
    StringSelect: 3,
    Container: 17,  // Container
    TextDisplay: 10, // TextDisplay
    MediaGallery: 12, // MediaGallery
    Separator: 14,   // Separator
    Section: 9,      // Section — NEW
    Thumbnail: 11,   // Thumbnail — NEW
  };
  return {
    AttachmentBuilder: mockAttachmentBuilder,
    MessageFlags: mockMessageFlags,
    ComponentType: mockComponentType,
  };
});

// Mock template.utils
jest.mock('../src/utils/template.utils.js', () => ({
  resolveTemplate: jest.fn((template: string, context: TemplateContext) => {
    if (typeof template !== 'string') return template;
    return template
      .replace('{user}', '@MockUser')
      .replace('{member}', '@MockUser')
      .replace('{guild}', 'TestServer')
      .replace('{memberName}', 'MockUser')
      .replace('{memberTag}', 'MockUser#0000')
      .replace('{memberCount}', '100')
      .replace('{accountCreationDate}', '1 tháng 1, 2024')
      .replace('{accountAge}', '30 ngày trước')
      .replace('{serverJoiningDate}', '20 tháng 5, 2026');
  }),
}));

// Import sau khi mock
import { EMBED_COLORS } from '../src/config/container.variables.js';
import {
  buildContainer,
  buildEmptyContainer,
  buildTextOnlyContainer,
  buildSuccessContainer,
  buildErrorContainer,
  buildInfoContainer,
  BuildContainerResult,
} from '../src/utils/container.utils.js';

/**
 * Tạo mock TemplateContext cho test.
 */
function createMockContext(): TemplateContext {
  return {
    member: {
      toString: () => '@MockUser',
      user: {
        toString: () => '@MockUser',
        username: 'MockUser',
        tag: 'MockUser#0000',
        createdTimestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
        displayAvatarURL: jest.fn(() => 'https://cdn.discordapp.com/avatars/123/avatar.png'),
      },
    } as unknown as TemplateContext['member'],
    guild: {
      name: 'TestServer',
      memberCount: 100,
    } as unknown as TemplateContext['guild'],
  };
}

/**
 * Tạo ContainerSettings mặc định cho test.
 */
function createDefaultSettings(overrides: Partial<ContainerSettings> = {}): ContainerSettings {
  return {
    accentColor: 0x5865f2,
    headerTemplate: '**Chào mừng {user} đến với {guild}**',
    contentLines: ['Chào mừng {user} đến với {guild}!'],
    mediaUrl: null,
    mediaDescription: null,
    showSeparator: false,
    files: [],
    ...overrides,
  };
}

// ─── Tests: buildContainer() ──────────────────────────────────

describe('buildContainer', () => {
  const mockContext = createMockContext();

  describe('Section + Thumbnail (header mới)', () => {
    it('nên LUÔN có Section + Thumbnail ở vị trí đầu tiên', () => {
      const settings = createDefaultSettings();
      const result = buildContainer(settings, mockContext);

      const container = result.components[0] as Record<string, unknown>;
      expect(container.type).toBe(ComponentType.Container);

      const innerComponents = container.components as unknown[];
      expect(innerComponents[0]).toHaveProperty('type', ComponentType.Section);

      // Section có accessory là Thumbnail
      const section = innerComponents[0] as Record<string, unknown>;
      expect(section.accessory).toBeDefined();
      expect((section.accessory as Record<string, unknown>).type).toBe(ComponentType.Thumbnail);
    });

    it('nên có Thumbnail với avatar URL của member', () => {
      const settings = createDefaultSettings();
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const section = innerComponents[0] as Record<string, unknown>;
      const thumbnail = section.accessory as Record<string, unknown>;

      expect(thumbnail.type).toBe(ComponentType.Thumbnail);
      expect((thumbnail.media as Record<string, unknown>).url).toBe('https://cdn.discordapp.com/avatars/123/avatar.png');
      expect(thumbnail.description).toBe('MockUser (mới tham gia)');
    });

    it('nên có TextDisplay trong Section với header chào mừng', () => {
      const settings = createDefaultSettings();
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const section = innerComponents[0] as Record<string, unknown>;
      const sectionComponents = section.components as Record<string, unknown>[];

      expect(sectionComponents.length).toBe(1);
      expect(sectionComponents[0].type).toBe(ComponentType.TextDisplay);
      expect(sectionComponents[0].content).toBe('**Chào mừng @MockUser đến với TestServer**');
    });
  });

  describe('TextDisplay chính (content lines)', () => {
    it('nên tạo TextDisplay với content đã resolve template', () => {
      const settings = createDefaultSettings();
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      // Component[0] = Section, Component[1] = TextDisplay chính
      expect(innerComponents[1]).toHaveProperty('type', ComponentType.TextDisplay);

      const textDisplay = innerComponents[1] as Record<string, unknown>;
      expect(textDisplay.content).toBe('Chào mừng @MockUser đến với TestServer!');
    });

    it('nên xử lý nhiều content lines bằng newline separator', () => {
      const settings = createDefaultSettings({
        contentLines: [
          'Dòng 1: {user}',
          'Dòng 2: {guild}',
          'Dòng 3: static text',
        ],
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const textDisplay = innerComponents[1] as Record<string, unknown>;

      expect(textDisplay.content).toBe(
        'Dòng 1: @MockUser\nDòng 2: TestServer\nDòng 3: static text',
      );
    });

    it('nên BỎ QUA TextDisplay chính khi contentLines rỗng', () => {
      const settings = createDefaultSettings({
        contentLines: [],
        showSeparator: false,
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      // Chỉ có Section (header) — không có TextDisplay chính, Separator, MediaGallery
      expect(innerComponents.length).toBe(1);
      expect(innerComponents[0]).toHaveProperty('type', ComponentType.Section);
    });
  });

  describe('Separator component', () => {
    it('nên thêm Separator khi showSeparator = true', () => {
      const settings = createDefaultSettings({
        showSeparator: true,
        accentColor: 0x5865f2,
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      // Section + TextDisplay + Separator = 3 components
      expect(innerComponents.length).toBe(3);
      const separator = innerComponents[2] as Record<string, unknown>;
      expect(separator.type).toBe(ComponentType.Separator);
      expect(separator.accentColor).toBe(0x5865f2);
    });

    it('nên KHÔNG thêm Separator khi showSeparator = false', () => {
      const settings = createDefaultSettings({
        showSeparator: false,
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      // Section + TextDisplay = 2 components
      expect(innerComponents.length).toBe(2);
      expect(innerComponents[0]).toHaveProperty('type', ComponentType.Section);
      expect(innerComponents[1]).toHaveProperty('type', ComponentType.TextDisplay);
    });

    it('nên thêm Separator có accentColor = undefined khi accentColor = 0', () => {
      const settings = createDefaultSettings({
        showSeparator: true,
        accentColor: 0,
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      // Section + TextDisplay + Separator = 3
      expect(innerComponents.length).toBe(3);
      const separator = innerComponents[2] as Record<string, unknown>;
      expect(separator.type).toBe(ComponentType.Separator);
      expect(separator.accentColor).toBeUndefined();
    });
  });

  describe('MediaGallery component (chỉ custom media)', () => {
    it('nên KHÔNG có MediaGallery khi mediaUrl = null', () => {
      const settings = createDefaultSettings({
        mediaUrl: null,
        showSeparator: false,
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      // Section + TextDisplay = 2 (không có MediaGallery)
      expect(innerComponents.length).toBe(2);

      const hasMediaGallery = innerComponents.some(
        (c) => (c as Record<string, unknown>).type === ComponentType.MediaGallery,
      );
      expect(hasMediaGallery).toBe(false);
    });

    it('nên thêm MediaGallery với http URL hợp lệ', () => {
      const settings = createDefaultSettings({
        mediaUrl: 'http://example.com/image.gif',
        mediaDescription: 'Test GIF',
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const mediaGallery = innerComponents[innerComponents.length - 1] as Record<string, unknown>;
      expect(mediaGallery.type).toBe(ComponentType.MediaGallery);

      const mediaItems = mediaGallery.items as Record<string, unknown>[];
      expect(mediaItems.length).toBe(1);
      expect((mediaItems[0].media as Record<string, unknown>).url).toBe('http://example.com/image.gif');
      expect(mediaItems[0].description).toBe('Test GIF');
    });

    it('nên thêm MediaGallery với https URL hợp lệ', () => {
      const settings = createDefaultSettings({
        mediaUrl: 'https://cdn.discordapp.com/test.gif',
        mediaDescription: null,
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const mediaGallery = innerComponents[innerComponents.length - 1] as Record<string, unknown>;
      const mediaItems = mediaGallery.items as Record<string, unknown>[];

      expect((mediaItems[0].media as Record<string, unknown>).url).toBe('https://cdn.discordapp.com/test.gif');
      expect(mediaItems[0].description).toBeUndefined();
    });

    it('nên thêm MediaGallery với attachment:// protocol', () => {
      const settings = createDefaultSettings({
        mediaUrl: 'attachment://cherry-blossom.gif',
        mediaDescription: 'Local GIF',
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const mediaGallery = innerComponents[innerComponents.length - 1] as Record<string, unknown>;
      const mediaItems = mediaGallery.items as Record<string, unknown>[];

      expect((mediaItems[0].media as Record<string, unknown>).url).toBe('attachment://cherry-blossom.gif');
    });

    it('nên BỎ QUA MediaGallery khi URL không hợp lệ', () => {
      const settings = createDefaultSettings({
        mediaUrl: 'ftp://invalid.protocol/image.gif',
        showSeparator: false,
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const hasMediaGallery = innerComponents.some(
        (c) => (c as Record<string, unknown>).type === ComponentType.MediaGallery,
      );
      expect(hasMediaGallery).toBe(false);
    });

    it('nên BỎ QUA MediaGallery khi URL không parse được', () => {
      const settings = createDefaultSettings({
        mediaUrl: 'not-a-valid-url-at-all',
        showSeparator: false,
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const hasMediaGallery = innerComponents.some(
        (c) => (c as Record<string, unknown>).type === ComponentType.MediaGallery,
      );
      expect(hasMediaGallery).toBe(false);
    });

    it('nên BỎ QUA MediaGallery khi URL rỗng', () => {
      const settings = createDefaultSettings({
        mediaUrl: '',
        showSeparator: false,
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const hasMediaGallery = innerComponents.some(
        (c) => (c as Record<string, unknown>).type === ComponentType.MediaGallery,
      );
      expect(hasMediaGallery).toBe(false);
    });
  });

  describe('Attachment files', () => {
    it('nên tạo AttachmentBuilder cho local file paths', () => {
      const settings = createDefaultSettings({
        files: ['./assets/image.png', './assets/gif.gif'],
      });
      const result = buildContainer(settings, mockContext);

      expect(result.files.length).toBe(2);
      expect(result.files[0]).toEqual({ path: './assets/image.png' });
      expect(result.files[1]).toEqual({ path: './assets/gif.gif' });
    });

    it('nên BỎ QUA HTTP URLs trong files array', () => {
      const settings = createDefaultSettings({
        files: ['./local.png', 'http://remote.com/image.png'],
      });
      const result = buildContainer(settings, mockContext);

      expect(result.files.length).toBe(1);
      expect(result.files[0]).toEqual({ path: './local.png' });
    });

    it('nên trả về files rỗng khi không có files', () => {
      const settings = createDefaultSettings({
        files: [],
      });
      const result = buildContainer(settings, mockContext);

      expect(result.files).toEqual([]);
    });

    it('nên trả về files rỗng khi files = undefined', () => {
      const settings: ContainerSettings = {
        accentColor: 0x5865f2,
        headerTemplate: null,
        contentLines: ['test'],
        mediaUrl: null,
        mediaDescription: null,
        showSeparator: false,
      };
      const result = buildContainer(settings, mockContext);

      expect(result.files).toEqual([]);
    });
  });

  describe('MessageFlags', () => {
    it('nên trả về flags = MessageFlags.IsComponentsV2', () => {
      const settings = createDefaultSettings();
      const result = buildContainer(settings, mockContext);

      expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    });
  });

  describe('Text length limit (4000 chars)', () => {
    it('nên cắt content lines khi vượt quá 4000 ký tự', () => {
      const longLine = 'a'.repeat(2000);
      const settings = createDefaultSettings({
        contentLines: [longLine, longLine, longLine],
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const textDisplay = innerComponents[1] as Record<string, unknown>;

      const content = textDisplay.content as string;
      expect(content.length).toBeLessThanOrEqual(4000);
    });

    it('nên giữ nguyên khi content ≤ 4000 ký tự', () => {
      const shortLine = 'a'.repeat(1000);
      const settings = createDefaultSettings({
        contentLines: [shortLine, shortLine],
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const textDisplay = innerComponents[1] as Record<string, unknown>;

      expect(textDisplay.content).toBe(`${shortLine}\n${shortLine}`);
    });

    it('nên cắt dần từ dòng cuối khi vượt limit', () => {
      const line1 = 'a'.repeat(1500);
      const line2 = 'b'.repeat(1500);
      const line3 = 'c'.repeat(1500);
      const settings = createDefaultSettings({
        contentLines: [line1, line2, line3],
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      const textDisplay = innerComponents[1] as Record<string, unknown>;

      const content = textDisplay.content as string;
      expect(content).toContain('a'.repeat(1500));
      expect(content).toContain('b'.repeat(1500));
      expect(content).not.toContain('c'.repeat(1500));
      expect(content.length).toBeLessThanOrEqual(4000);
    });

    it('nên BỎ QUA TextDisplay chính khi 1 dòng duy nhất > 4000 ký tự', () => {
      const hugeLine = 'x'.repeat(5000);
      const settings = createDefaultSettings({
        contentLines: [hugeLine],
        showSeparator: false,
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];
      // Chỉ có Section (header) — TextDisplay chính bị skip
      expect(innerComponents.length).toBe(1);
      expect(innerComponents[0]).toHaveProperty('type', ComponentType.Section);
    });
  });

  describe('Full combination tests', () => {
    it('nên tạo container hoàn chỉnh với Section + TextDisplay + Separator + MediaGallery', () => {
      const settings = createDefaultSettings({
        accentColor: 0xed4245,
        contentLines: ['Line 1', 'Line 2'],
        mediaUrl: 'https://example.com/media.gif',
        mediaDescription: 'Media desc',
        showSeparator: true,
        files: ['./local.png'],
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];

      // Section + TextDisplay + Separator + MediaGallery = 4 components
      expect(innerComponents.length).toBe(4);
      expect(innerComponents[0]).toHaveProperty('type', ComponentType.Section);
      expect(innerComponents[1]).toHaveProperty('type', ComponentType.TextDisplay);
      expect(innerComponents[2]).toHaveProperty('type', ComponentType.Separator);
      expect(innerComponents[3]).toHaveProperty('type', ComponentType.MediaGallery);

      expect(result.flags).toBe(MessageFlags.IsComponentsV2);
      expect(result.files.length).toBe(1);
    });

    it('nên tạo container tối thiểu: Section + TextDisplay', () => {
      const settings = createDefaultSettings({
        mediaUrl: null,
        showSeparator: false,
        files: [],
      });
      const result = buildContainer(settings, mockContext);

      const innerComponents = (result.components[0] as Record<string, unknown>).components as unknown[];

      // Section + TextDisplay = 2 components
      expect(innerComponents.length).toBe(2);
      expect(innerComponents[0]).toHaveProperty('type', ComponentType.Section);
      expect(innerComponents[1]).toHaveProperty('type', ComponentType.TextDisplay);
    });
  });
});

// ─── Tests: buildEmptyContainer() ─────────────────────────────

describe('buildEmptyContainer', () => {
  it('nên trả về container rỗng với components = []', () => {
    const result = buildEmptyContainer(0x5865f2);

    const container = result.components[0] as Record<string, unknown>;
    expect(container.type).toBe(ComponentType.Container);
    expect(container.components).toEqual([]);
    expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    expect(result.files).toEqual([]);
  });

  it('nên bỏ qua accentColor parameter (chưa hỗ trợ trên container level)', () => {
    const result = buildEmptyContainer(0xed4245);

    const container = result.components[0] as Record<string, unknown>;
    expect(container.type).toBe(ComponentType.Container);
    expect(result.flags).toBe(MessageFlags.IsComponentsV2);
  });
});

// ─── Tests: buildTextOnlyContainer() ──────────────────────────

describe('buildTextOnlyContainer', () => {
  it('nên tạo container chỉ có TextDisplay khi không có accentColor', () => {
    const result = buildTextOnlyContainer('Hello World');

    const container = result.components[0] as Record<string, unknown>;
    const innerComponents = container.components as unknown[];

    expect(innerComponents.length).toBe(1);
    const textDisplay = innerComponents[0] as Record<string, unknown>;
    expect(textDisplay.type).toBe(ComponentType.TextDisplay);
    expect(textDisplay.content).toBe('Hello World');
  });

  it('nên thêm Separator với accentColor khi có accentColor', () => {
    const result = buildTextOnlyContainer('Hello World', 0x5865f2);

    const container = result.components[0] as Record<string, unknown>;
    const innerComponents = container.components as unknown[];

    expect(innerComponents.length).toBe(2);
    expect(innerComponents[0]).toHaveProperty('type', ComponentType.TextDisplay);
    const separator = innerComponents[1] as Record<string, unknown>;
    expect(separator.type).toBe(ComponentType.Separator);
    expect(separator.accentColor).toBe(0x5865f2);
  });

  it('nên cắt content khi > 4000 ký tự', () => {
    const longContent = 'x'.repeat(5000);
    const result = buildTextOnlyContainer(longContent);

    const container = result.components[0] as Record<string, unknown>;
    const innerComponents = container.components as unknown[];
    const textDisplay = innerComponents[0] as Record<string, unknown>;

    expect((textDisplay.content as string).length).toBe(4000);
  });

  it('nên giữ nguyên content khi ≤ 4000 ký tự', () => {
    const shortContent = 'x'.repeat(3999);
    const result = buildTextOnlyContainer(shortContent);

    const container = result.components[0] as Record<string, unknown>;
    const innerComponents = container.components as unknown[];
    const textDisplay = innerComponents[0] as Record<string, unknown>;

    expect(textDisplay.content).toBe(shortContent);
  });

  it('nên trả về flags và files đúng', () => {
    const result = buildTextOnlyContainer('test');

    expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    expect(result.files).toEqual([]);
  });
});

// ─── Tests: BuildContainerResult type ─────────────────────────

describe('BuildContainerResult', () => {
  it('nên có đúng shape: { components, flags, files }', () => {
    const settings = createDefaultSettings();
    const result = buildContainer(settings, createMockContext());

    expect(result).toHaveProperty('components');
    expect(result).toHaveProperty('flags');
    expect(result).toHaveProperty('files');

    expect(Array.isArray(result.components)).toBe(true);
    expect(Array.isArray(result.files)).toBe(true);
    expect(typeof result.flags).toBe('number');
  });
});

// ─── Tests: buildSuccessContainer() ───────────────────────────

describe('buildSuccessContainer', () => {
  it('nên tạo container với TextDisplay + Separator (màu xanh SUCCESS)', () => {
    const result = buildSuccessContainer('Operation completed.');

    const container = result.components[0] as Record<string, unknown>;
    expect(container.type).toBe(ComponentType.Container);

    const innerComponents = container.components as unknown[];
    expect(innerComponents.length).toBe(2);

    const textDisplay = innerComponents[0] as Record<string, unknown>;
    expect(textDisplay.type).toBe(ComponentType.TextDisplay);
    expect(textDisplay.content).toBe('**✅ Success**\nOperation completed.');

    const separator = innerComponents[1] as Record<string, unknown>;
    expect(separator.type).toBe(ComponentType.Separator);
    expect(separator.accentColor).toBe(0x00FF00);

    expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    expect(result.files).toEqual([]);
  });
});

// ─── Tests: buildErrorContainer() ─────────────────────────────

describe('buildErrorContainer', () => {
  it('nên tạo container với TextDisplay + Separator (màu đỏ ERROR)', () => {
    const result = buildErrorContainer('Something went wrong.');

    const container = result.components[0] as Record<string, unknown>;
    expect(container.type).toBe(ComponentType.Container);

    const innerComponents = container.components as unknown[];
    expect(innerComponents.length).toBe(2);

    const textDisplay = innerComponents[0] as Record<string, unknown>;
    expect(textDisplay.type).toBe(ComponentType.TextDisplay);
    expect(textDisplay.content).toBe('**❌ Error**\nSomething went wrong.');

    const separator = innerComponents[1] as Record<string, unknown>;
    expect(separator.type).toBe(ComponentType.Separator);
    expect(separator.accentColor).toBe(0xFF0000);

    expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    expect(result.files).toEqual([]);
  });
});

// ─── Tests: buildInfoContainer() ──────────────────────────────

describe("buildInfoContainer", () => {
  it("should create container with TextDisplay + Separator (INFO color)", () => {
    const result = buildInfoContainer("This is info.");
    const container = result.components[0] as Record<string, unknown>;
    expect(container.type).toBe(ComponentType.Container);
    const inner = container.components as unknown[];
    expect(inner.length).toBe(2);
    const td = inner[0] as Record<string, unknown>;
    expect(td.type).toBe(ComponentType.TextDisplay);
    expect(td.content).toBe("**ℹ️ Info**\nThis is info.");
    const sep = inner[1] as Record<string, unknown>;
    expect(sep.type).toBe(ComponentType.Separator);
    expect(sep.accentColor).toBe(EMBED_COLORS.INFO);
    expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    expect(result.files).toEqual([]);
  });
});