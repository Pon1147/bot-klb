import type { APIMessageTopLevelComponent } from 'discord-api-types/v10';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { ContainerSettings, TemplateContext } from '../types/settings.types.js';
import { resolveTemplate } from './template.utils.js';
import { COLORS } from '../config/container.variables.js';
import { MAX_CONTAINER_TEXT_LENGTH, DEFAULT_AVATAR_SIZE } from '../config/app.constants.js';

/**
 * Giới hạn ký tự tối đa cho TextDisplay.
 */
const MAX_TEXT_DISPLAY_LENGTH = MAX_CONTAINER_TEXT_LENGTH;

/**
 * Tùy chọn bổ sung cho buildContainer.
 */
export interface BuildContainerOptions {
  /** Type container để thêm nút chỉnh sửa (pencil button). null = không hiển thị. */
  editType?: 'welcome' | 'leave' | 'booster' | null;
}

/**
 * Build hàng nút bút chì để mở container editor.
 * CustomId encode guildId + type để router có thể extract khi click.
 */
export function buildPencilButtonRow(
  editType: string,
  guildId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`container_edit_pencil_${guildId}_${editType}`)
      .setLabel('✏️ Chỉnh sửa')
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Kết quả trả về.
 */
/** Components payload compatible with discord.js reply/editReply(). */
export type ComponentsPayload = readonly APIMessageTopLevelComponent[];

export interface BuildContainerResult {
  components: readonly unknown[];
  flags: typeof MessageFlags.IsComponentsV2;
  files: AttachmentBuilder[];

  /**
   * Cast components to the type discord.js expects for reply/editReply.
   * Container V2 (Section, TextDisplay, etc.) has no official types in
   * discord.js v14 — this single cast replaces ~59 `as any` casts at call sites.
   */
  toJSON(): ComponentsPayload;
}

/** Single cast point for Container V2 components. */
export function toComponentsV2(c: readonly unknown[]): ComponentsPayload {
  return c as unknown as ComponentsPayload;
}

/** Factory — all builder functions use this to ensure toJSON() is present. */
export function makeResult(
  components: readonly unknown[],
  flags: number,
  files: AttachmentBuilder[],
): BuildContainerResult {
  return {
    components,
    flags,
    files,
    toJSON() {
      return toComponentsV2(this.components);
    },
  };
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
  options?: BuildContainerOptions & { guildId?: string },
): BuildContainerResult {
  const {
    accentColor,
    headerTemplate,
    contentLines,
    mediaUrl,
    mediaDescription,
    showSeparator,
    files,
  } = settings;
  const { member, guild } = context;
  const editType = options?.editType ?? null;
  const guildId = options?.guildId;

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
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: DEFAULT_AVATAR_SIZE });

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

  const resultComponents: unknown[] = [containerComponents];

  // Append pencil button row if editType is provided
  if (editType && guildId) {
    resultComponents.push(buildPencilButtonRow(editType, guildId));
  }

  return makeResult(resultComponents, MessageFlags.IsComponentsV2, attachmentFiles);
}

/* ====================== Các hàm khác giữ nguyên ====================== */
export function buildEmptyContainer(_accentColor: number): BuildContainerResult {
  return makeResult(
    [{ type: ComponentType.Container, components: [] as unknown[] }],
    MessageFlags.IsComponentsV2,
    [],
  );
}

export function buildSuccessContainer(successMessage: string): BuildContainerResult {
  const text = { type: ComponentType.TextDisplay, content: `**✅ Success**\n${successMessage}` };
  const sep = { type: ComponentType.Separator, accentColor: COLORS.SUCCESS };
  return makeResult(
    [{ type: ComponentType.Container, components: [text, sep] }],
    MessageFlags.IsComponentsV2,
    [],
  );
}

export function buildErrorContainer(errorMessage: string): BuildContainerResult {
  const text = { type: ComponentType.TextDisplay, content: `**❌ Error**\n${errorMessage}` };
  const sep = { type: ComponentType.Separator, accentColor: COLORS.ERROR };
  return makeResult(
    [{ type: ComponentType.Container, components: [text, sep] }],
    MessageFlags.IsComponentsV2,
    [],
  );
}

export function buildInfoContainer(infoMessage: string): BuildContainerResult {
  const text = { type: ComponentType.TextDisplay, content: `**ℹ️ Info**\n${infoMessage}` };
  const sep = { type: ComponentType.Separator, accentColor: COLORS.INFO };
  return makeResult(
    [{ type: ComponentType.Container, components: [text, sep] }],
    MessageFlags.IsComponentsV2,
    [],
  );
}

export function buildTextOnlyContainer(
  content: string,
  accentColor?: number,
): BuildContainerResult {
  const finalContent =
    content.length > MAX_TEXT_DISPLAY_LENGTH ? content.slice(0, MAX_TEXT_DISPLAY_LENGTH) : content;

  const components: unknown[] = [{ type: ComponentType.TextDisplay, content: finalContent }];
  if (accentColor) components.push({ type: ComponentType.Separator, accentColor });

  return makeResult(
    [{ type: ComponentType.Container, components }],
    MessageFlags.IsComponentsV2,
    [],
  );
}
