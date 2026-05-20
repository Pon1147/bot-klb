import { AttachmentBuilder, ComponentType, MessageFlags } from 'discord.js';
import { ContainerSettings, TemplateContext } from '../types/settings.types.js';
import { resolveTemplate } from './template.utils.js';
import { EMBED_COLORS } from '../config/embed.variables.js';

/**
 * Giới hạn ký tự tối đa cho TextDisplay (Discord limit).
 */
const MAX_TEXT_DISPLAY_LENGTH = 4000;

/**
 * Kết quả trả về từ buildContainer().
 * - container_components: mảng components V2 để gửi kèm message
 * - flags: MessageFlags.IsComponentsV2 (bắt buộc cho Container)
 * - files: mảng AttachmentBuilder nếu có file local
 */
export interface BuildContainerResult {
  /** Content của message (TextDisplay components được nhúng trong container) */
  components: unknown[];
  /** Flags bắt buộc cho Components V2 */
  flags: typeof MessageFlags.IsComponentsV2;
  /** Files attachment (nếu có) */
  files: AttachmentBuilder[];
}

/**
 * Validate URL hợp lệ (http/https/attachment).
 */
function isValidUrl(url: string): boolean {
  // Allow attachment:// protocol
  if (url.startsWith('attachment://')) {
    return true;
  }
  // Validate http/https URLs
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Kiểm tra tổng độ dài text có vượt quá limit không.
 */
function exceedsTextLimit(lines: string[]): boolean {
  const totalLength = lines.reduce((sum, line) => sum + line.length, 0);
  return totalLength > MAX_TEXT_DISPLAY_LENGTH;
}

/**
 * Cắt content lines để không vượt quá 4000 ký tự.
 * Xóa dần từ dòng cuối cùng cho đến khi đủ limit.
 * Tính cả ký tự newline ('\n') giữa các dòng khi join.
 */
function trimToTextLimit(lines: string[]): string[] {
  const trimmed = [...lines];
  // Tính tổng độ dài: sum(lines) + (lines.length - 1) * '\n'.length
  let totalLength = 0;
  for (const line of trimmed) {
    totalLength += line.length;
  }
  // Cộng thêm độ dài của newline separators
  if (trimmed.length > 0) {
    totalLength += (trimmed.length - 1) * '\n'.length;
  }

  while (totalLength > MAX_TEXT_DISPLAY_LENGTH && trimmed.length > 0) {
    const removed = trimmed.pop()!;
    totalLength -= removed.length;
    // Cũng trừ newline separator tương ứng
    if (trimmed.length > 0) {
      totalLength -= '\n'.length;
    }
  }

  return trimmed;
}

/**
 * Build AttachmentBuilder từ mảng file paths.
 * Chỉ xử lý file paths (không phải URL).
 */
function buildAttachments(files: string[]): AttachmentBuilder[] {
  return files
    .filter((filePath) => !filePath.startsWith('http'))
    .map((filePath) => new AttachmentBuilder(filePath));
}

/**
 * Resolve template variables trong mảng content lines.
 * Mỗi dòng được resolve độc lập.
 */
function resolveContentLines(lines: string[], context: TemplateContext): string[] {
  return lines.map((line) => resolveTemplate(line, context));
}

/**
 * Build Container V2 từ ContainerSettings + TemplateContext.
 *
 * Hàm này tạo một welcome/leave message sử dụng Components V2:
 * - TextDisplay: hiển thị nội dung text (hỗ trợ markdown, mention)
 * - MediaGallery: hiển thị ảnh/GIF
 * - Separator: đường ngăn cách (tùy chọn)
 * - Accent Color: màu sidebar container
 *
 * @param settings - Cấu hình container (accent color, content lines, media...)
 * @param context - Context chứa member và guild để resolve template variables
 * @returns BuildContainerResult chứa components, flags và files
 *
 * @example
 * ```ts
 * const result = buildContainer(welcomeSettings, { member, guild });
 * await channel.send({ components: result.components, flags: result.flags, files: result.files });
 * ```
 */
export function buildContainer(
  settings: ContainerSettings,
  context: TemplateContext,
): BuildContainerResult {
  const { accentColor, contentLines, mediaUrl, mediaDescription, showSeparator, files } = settings;

  // Step 1: Resolve template variables trong content lines
  const resolvedLines = resolveContentLines(contentLines, context);

  // Step 2: Kiểm tra và cắt text nếu vượt quá limit
  const finalLines = exceedsTextLimit(resolvedLines)
    ? trimToTextLimit(resolvedLines)
    : resolvedLines;

  // Step 3: Join lines thành 1 text display content (mỗi dòng cách nhau bằng newline)
  const textContent = finalLines.join('\n');

  // Step 4: Build components array theo cấu trúc Container V2
  // Cấu trúc: Container > [TextDisplay?, (Separator?), MediaGallery?]
  const containerInnerComponents: unknown[] = [];

  // TextDisplay component (type 10) - chỉ thêm nếu có nội dung
  // WHY: Discord yêu cầu content length từ 1-4000. Empty string (0 chars) sẽ bị reject.
  // Khi "clear all" → contentLines = [] → textContent = "" → skip TextDisplay
  if (textContent.length > 0) {
    const textDisplayComponent: Record<string, unknown> = {
      type: ComponentType.TextDisplay, // 10 - TextDisplay
      content: textContent,
    };
    containerInnerComponents.push(textDisplayComponent);
  }

  // Separator component (type 14) - tùy chọn
  if (showSeparator) {
    const separatorComponent: Record<string, unknown> = {
      type: ComponentType.Separator, // 14 - Separator
    };
    // Accent color cho separator (tùy chọn)
    if (accentColor) {
      separatorComponent.accentColor = accentColor;
    }
    containerInnerComponents.push(separatorComponent);
  }

  // MediaGallery component (type 12) - chỉ thêm nếu có media URL hợp lệ
  // WHY: APIMediaGalleryItem yêu cầu `media: { url: string }` + `description?: string`
  // Tham khảo: discord-api-types/payloads/v10/message.d.ts:1626
  if (mediaUrl && isValidUrl(mediaUrl)) {
    const mediaItems: Array<Record<string, unknown>> = [];

    // Nếu là attachment URL, dùng attachment protocol
    const processedUrl = mediaUrl.startsWith('attachment://') ? mediaUrl : mediaUrl;

    mediaItems.push({
      media: { url: processedUrl },
      ...(mediaDescription ? { description: mediaDescription } : {}),
    });

    const mediaGalleryComponent: Record<string, unknown> = {
      type: ComponentType.MediaGallery, // 12 - MediaGallery
      items: mediaItems,
    };
    containerInnerComponents.push(mediaGalleryComponent);
  }

  const containerComponents: Record<string, unknown> = {
    type: ComponentType.Container, // 17 - Container
    components: containerInnerComponents,
  };

  // Step 5: Build attachments từ file paths
  const attachmentFiles = files ? buildAttachments(files) : [];

  // Step 6: Return result với flags IsComponentsV2
  return {
    components: [containerComponents],
    flags: MessageFlags.IsComponentsV2,
    files: attachmentFiles,
  };
}

/**
 * Build Container V2 chỉ với accent color (không có components con).
 * Dùng khi muốn container đơn giản chỉ có màu sidebar.
 *
 * @param accentColor - Màu accent cho container sidebar
 * @returns BuildContainerResult với container rỗng
 */
export function buildEmptyContainer(_accentColor: number): BuildContainerResult {
  const containerComponents: Record<string, unknown> = {
    type: ComponentType.Container, // 17 - Container
    components: [] as unknown[],
  };

  return {
    components: [containerComponents],
    flags: MessageFlags.IsComponentsV2,
    files: [],
  };
}

/**
 * Build Container V2 cho message thành công (success).
 * Thay thế buildSuccessEmbed (EmbedBuilder) sang Container.
 *
 * @param successMessage - Nội dung thông báo thành công
 * @returns BuildContainerResult với TextDisplay + accent color xanh lá
 */
export function buildSuccessContainer(successMessage: string): BuildContainerResult {
  const textDisplayComponent: Record<string, unknown> = {
    type: ComponentType.TextDisplay, // 10 - TextDisplay
    content: `**✅ Success**\n${successMessage}`,
  };

  const separatorComponent: Record<string, unknown> = {
    type: ComponentType.Separator, // 14 - Separator
    accentColor: EMBED_COLORS.SUCCESS,
  };

  const containerComponents: Record<string, unknown> = {
    type: ComponentType.Container, // 17 - Container
    components: [textDisplayComponent, separatorComponent],
  };

  return {
    components: [containerComponents],
    flags: MessageFlags.IsComponentsV2,
    files: [],
  };
}

/**
 * Build Container V2 cho message lỗi (error).
 * Thay thế buildErrorEmbed (EmbedBuilder) sang Container.
 *
 * @param errorMessage - Nội dung thông báo lỗi
 * @returns BuildContainerResult với TextDisplay + accent color đỏ
 */
export function buildErrorContainer(errorMessage: string): BuildContainerResult {
  const textDisplayComponent: Record<string, unknown> = {
    type: ComponentType.TextDisplay, // 10 - TextDisplay
    content: `**❌ Error**\n${errorMessage}`,
  };

  const separatorComponent: Record<string, unknown> = {
    type: ComponentType.Separator, // 14 - Separator
    accentColor: EMBED_COLORS.ERROR,
  };

  const containerComponents: Record<string, unknown> = {
    type: ComponentType.Container, // 17 - Container
    components: [textDisplayComponent, separatorComponent],
  };

  return {
    components: [containerComponents],
    flags: MessageFlags.IsComponentsV2,
    files: [],
  };
}

/**
 * Build Container V2 chỉ có TextDisplay (không có media, separator).
 * Dùng cho message đơn giản chỉ cần text.
 *
 * @param content - Nội dung text (hỗ trợ markdown)
 * @param accentColor - Màu accent (tùy chọn)
 * @returns BuildContainerResult
 */
export function buildTextOnlyContainer(
  content: string,
  accentColor?: number,
): BuildContainerResult {
  // Validate text length
  const finalContent =
    content.length > MAX_TEXT_DISPLAY_LENGTH ? content.slice(0, MAX_TEXT_DISPLAY_LENGTH) : content;

  const textDisplayComponent: Record<string, unknown> = {
    type: ComponentType.TextDisplay, // 10 - TextDisplay
    content: finalContent,
  };

  const textContainerInnerComponents: unknown[] = [textDisplayComponent];

  // Apply accent color via separator nếu có
  if (accentColor) {
    const separatorComponent: Record<string, unknown> = {
      type: ComponentType.Separator, // 14 - Separator
      accentColor,
    };
    textContainerInnerComponents.push(separatorComponent);
  }

  const containerComponents: Record<string, unknown> = {
    type: ComponentType.Container, // 17 - Container
    components: textContainerInnerComponents,
  };

  return {
    components: [containerComponents],
    flags: MessageFlags.IsComponentsV2,
    files: [],
  };
}
