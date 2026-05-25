import { AttachmentBuilder, ComponentType, MessageFlags } from 'discord.js';
import { ContainerSettings, TemplateContext } from '../types/settings.types.js';
import { resolveTemplate } from './template.utils.js';
import { EMBED_COLORS } from '../config/container.variables.js';

/**
 * Giới hạn ký tự tối đa cho TextDisplay.
 */
const MAX_TEXT_DISPLAY_LENGTH = 4000;

/**
 * Kết quả trả về.
 */
export interface BuildContainerResult {
  components: unknown[];
  flags: typeof MessageFlags.IsComponentsV2;
  files: AttachmentBuilder[];
}

/** Validate URL */
function isValidUrl(url: string): boolean {
  if (url.startsWith('attachment://')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Kiểm tra độ dài text */
function exceedsTextLimit(lines: string[]): boolean {
  const totalLength = lines.reduce((sum, line) => sum + line.length, 0);
  return totalLength > MAX_TEXT_DISPLAY_LENGTH;
}

/** Cắt text nếu vượt limit */
function trimToTextLimit(lines: string[]): string[] {
  const trimmed = [...lines];
  let totalLength = trimmed.reduce((sum, line) => sum + line.length, 0);
  if (trimmed.length > 0) totalLength += (trimmed.length - 1) * '\n'.length;

  while (totalLength > MAX_TEXT_DISPLAY_LENGTH && trimmed.length > 0) {
    const removed = trimmed.pop()!;
    totalLength -= removed.length;
    if (trimmed.length > 0) totalLength -= '\n'.length;
  }
  return trimmed;
}

/** Build attachments */
function buildAttachments(files: string[]): AttachmentBuilder[] {
  return files
    .filter((filePath) => !filePath.startsWith('http'))
    .map((filePath) => new AttachmentBuilder(filePath));
}

/** Resolve template */
function resolveContentLines(lines: string[], context: TemplateContext): string[] {
  return lines.map((line) => resolveTemplate(line, context));
}

/**
 * Build Container V2 đẹp như hình bạn gửi
 * - Section + Thumbnail: Tiêu đề (từ headerTemplate) + Avatar nhỏ góc trên bên phải
 * - TextDisplay: Nội dung bullet chính
 * - MediaGallery: Ảnh lớn Welcome ở dưới
 *
 * WHY: headerTemplate cho phép mỗi command (welcome/leave/booster) tự định nghĩa
 * header riêng thay vì dùng chung 1 string hardcoded.
 */
export function buildContainer(
  settings: ContainerSettings,
  context: TemplateContext,
): BuildContainerResult {
  const { accentColor, headerTemplate, contentLines, mediaUrl, mediaDescription, showSeparator, files } = settings;
  const { member, guild } = context;

  // Resolve & trim text
  const resolvedLines = resolveContentLines(contentLines, context);
  const finalLines = exceedsTextLimit(resolvedLines)
    ? trimToTextLimit(resolvedLines)
    : resolvedLines;
  const textContent = finalLines.join('\n');

  const containerInnerComponents: unknown[] = [];

  // ==================== 1. SECTION + THUMBNAIL (Header + Avatar top-right) ====================
  // Chỉ render header section khi headerTemplate có giá trị (không null/empty/undefined)
  if (headerTemplate && headerTemplate.trim().length > 0) {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 128 });

    const thumbnailAccessory: Record<string, unknown> = {
      type: ComponentType.Thumbnail,
      media: { url: avatarUrl },
      description: `${member.user.username} (mới tham gia)`,
    };

    // Resolve template variables trong header
    const resolvedHeader = resolveTemplate(headerTemplate, { member, guild });

    const headerSection: Record<string, unknown> = {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: resolvedHeader,
        },
      ],
      accessory: thumbnailAccessory,
    };

    containerInnerComponents.push(headerSection);
  }

  // ==================== 2. TextDisplay chính (nội dung bullet) ====================
  if (textContent.length > 0) {
    containerInnerComponents.push({
      type: ComponentType.TextDisplay,
      content: textContent,
    });
  }

  // ==================== 3. Separator (tùy chọn) ====================
  if (showSeparator) {
    const separator: Record<string, unknown> = { type: ComponentType.Separator };
    if (accentColor) separator.accentColor = accentColor;
    containerInnerComponents.push(separator);
  }

  // ==================== 4. MediaGallery - Ảnh lớn Welcome ====================
  if (mediaUrl && isValidUrl(mediaUrl)) {
    const mediaItems: Array<Record<string, unknown>> = [
      {
        media: { url: mediaUrl.startsWith('attachment://') ? mediaUrl : mediaUrl },
        ...(mediaDescription ? { description: mediaDescription } : {}),
      },
    ];

    containerInnerComponents.push({
      type: ComponentType.MediaGallery,
      items: mediaItems,
    });
  }

  // Container wrapper
  const containerComponents: Record<string, unknown> = {
    type: ComponentType.Container,
    components: containerInnerComponents,
  };

  const attachmentFiles = files ? buildAttachments(files) : [];

  return {
    components: [containerComponents],
    flags: MessageFlags.IsComponentsV2,
    files: attachmentFiles,
  };
}

/* ====================== Các hàm khác giữ nguyên ====================== */
export function buildEmptyContainer(_accentColor: number): BuildContainerResult {
  return {
    components: [{ type: ComponentType.Container, components: [] as unknown[] }],
    flags: MessageFlags.IsComponentsV2,
    files: [],
  };
}

export function buildSuccessContainer(successMessage: string): BuildContainerResult {
  const text = { type: ComponentType.TextDisplay, content: `**✅ Success**\n${successMessage}` };
  const sep = { type: ComponentType.Separator, accentColor: EMBED_COLORS.SUCCESS };
  return {
    components: [{ type: ComponentType.Container, components: [text, sep] }],
    flags: MessageFlags.IsComponentsV2,
    files: [],
  };
}

export function buildErrorContainer(errorMessage: string): BuildContainerResult {
  const text = { type: ComponentType.TextDisplay, content: `**❌ Error**\n${errorMessage}` };
  const sep = { type: ComponentType.Separator, accentColor: EMBED_COLORS.ERROR };
  return {
    components: [{ type: ComponentType.Container, components: [text, sep] }],
    flags: MessageFlags.IsComponentsV2,
    files: [],
  };
}

export function buildTextOnlyContainer(
  content: string,
  accentColor?: number,
): BuildContainerResult {
  const finalContent =
    content.length > MAX_TEXT_DISPLAY_LENGTH ? content.slice(0, MAX_TEXT_DISPLAY_LENGTH) : content;

  const components: unknown[] = [{ type: ComponentType.TextDisplay, content: finalContent }];
  if (accentColor) components.push({ type: ComponentType.Separator, accentColor });

  return {
    components: [{ type: ComponentType.Container, components }],
    flags: MessageFlags.IsComponentsV2,
    files: [],
  };
}
