/**
 * Custom types cho Discord Components V2 (Container, TextDisplay, MediaGallery, Separator).
 *
 * WHY: discord.js v14 chưa có official types cho Components V2,
 * nên phải định nghĩa manual để replace `as any` casts.
 *
 * Source of truth: discord-api-types v10 (node_modules/discord-api-types/payloads/v10/message.d.ts)
 */

import { ComponentType } from 'discord.js';

// ─── Container V2 Component Types ─────────────────────────────────

/**
 * Container V2 - wrapper chứa các components con.
 * type = ComponentType.Container (17)
 */
export interface ContainerComponentV2 {
  type: ComponentType.Container;
  components: Array<ContainerChildComponentV2>;
}

/**
 * TextDisplay - hiển thị markdown text.
 * type = ComponentType.TextDisplay (10)
 */
export interface TextDisplayComponentV2 {
  type: ComponentType.TextDisplay;
  content: string;
}

/**
 * Separator - đường ngăn cách giữa các sections.
 * type = ComponentType.Separator (14)
 */
export interface SeparatorComponentV2 {
  type: ComponentType.Separator;
}

/**
 * MediaGallery - hiển thị ảnh/GIF.
 * type = ComponentType.MediaGallery (12)
 */
export interface MediaGalleryComponentV2 {
  type: ComponentType.MediaGallery;
  components: Array<MediaGalleryItemV2>;
}

/**
 * MediaGalleryItem - item trong MediaGallery.
 */
export interface MediaGalleryItemV2 {
  type: 13; // MediaGalleryItem (không có trong ComponentType enum, hardcode an toàn)
  image: string;
  description?: string;
}

/**
 * Union type cho tất cả child components của Container.
 * Container chỉ chấp nhận TextDisplay, Separator, MediaGallery làm con.
 */
export type ContainerChildComponentV2 =
  | TextDisplayComponentV2
  | SeparatorComponentV2
  | MediaGalleryComponentV2;

/**
 * Union type cho tất cả Container V2 components.
 */
export type ContainerV2Component =
  | ContainerComponentV2
  | TextDisplayComponentV2
  | SeparatorComponentV2
  | MediaGalleryComponentV2;

// ─── Builder Result Types ─────────────────────────────────────────

/**
 * Kết quả trả về từ buildContainer / buildLivePreviewContainer.
 * Thay thế `as any` khi cast components array.
 */
export interface BuildContainerResultV2 {
  components: Array<Record<string, unknown>>;
  flags: number;
  files: Array<unknown>;
}

// ─── Helper Type Guards ───────────────────────────────────────────

/**
 * Type guard: kiểm tra component có phải Container không.
 */
export function isContainerComponent(
  component: unknown,
): component is ContainerComponentV2 {
  return (
    typeof component === 'object' &&
    component !== null &&
    'type' in component &&
    (component as any).type === ComponentType.Container
  );
}

/**
 * Type guard: kiểm tra component có phải TextDisplay không.
 */
export function isTextDisplayComponent(
  component: unknown,
): component is TextDisplayComponentV2 {
  return (
    typeof component === 'object' &&
    component !== null &&
    'type' in component &&
    (component as any).type === ComponentType.TextDisplay
  );
}

/**
 * Type guard: kiểm tra component có phải Separator không.
 */
export function isSeparatorComponent(
  component: unknown,
): component is SeparatorComponentV2 {
  return (
    typeof component === 'object' &&
    component !== null &&
    'type' in component &&
    (component as any).type === ComponentType.Separator
  );
}

/**
 * Type guard: kiểm tra component có phải MediaGallery không.
 */
export function isMediaGalleryComponent(
  component: unknown,
): component is MediaGalleryComponentV2 {
  return (
    typeof component === 'object' &&
    component !== null &&
    'type' in component &&
    (component as any).type === ComponentType.MediaGallery
  );
}
