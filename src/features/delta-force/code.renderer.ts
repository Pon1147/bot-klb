import { AttachmentBuilder, ComponentType, MessageFlags } from 'discord.js';
import {
  ASSETS_PATH,
  MAP_DISPLAY,
  type MapKey,
  type MapInfo,
} from '../../config/team-find.config.js';
import type { DailyCodes } from '../../services/deltaforce.scraper.js';

export { MAP_DISPLAY };

/**
 * Kiểm tra xem DailyCodes có ít nhất 1 mã hợp lệ hay không.
 */
export function hasAnyCodes(codes: DailyCodes | null): boolean {
  if (!codes) return false;
  return Object.values(codes).some((v) => v !== null && v !== undefined);
}

/**
 * Xây dựng Container hiển thị mật khẩu các map hôm nay.
 */
export function buildCodesContainer(codes: DailyCodes | null, hasCodes: boolean) {
  const containerInner: unknown[] = [];
  const files: AttachmentBuilder[] = [];

  if (hasCodes && codes) {
    const maps = Object.entries(MAP_DISPLAY) as [MapKey, MapInfo][];

    for (const [fullName, mapInfo] of maps) {
      const code = codes[fullName] || 'Chưa có';
      const imageUrl = mapInfo.url ?? `attachment://${mapInfo.image}`;

      if (!mapInfo.url) {
        files.push(new AttachmentBuilder(`${ASSETS_PATH}${mapInfo.image}`).setName(mapInfo.image));
      }

      containerInner.push({
        type: ComponentType.Section,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: `### **${mapInfo.name}**\n\`\`\`ini\n[${code}]\n\`\`\``,
          },
        ],
        accessory: {
          type: ComponentType.Thumbnail,
          media: { url: imageUrl },
          description: mapInfo.name,
        },
      });
    }
  } else {
    containerInner.push({
      type: ComponentType.TextDisplay,
      content: '_Không tìm thấy mật khẩu hôm nay._',
    });
  }

  return {
    components: [{ type: ComponentType.Container, components: containerInner }],
    flags: MessageFlags.IsComponentsV2,
    files,
    toJSON() {
      return this.components;
    },
  };
}
