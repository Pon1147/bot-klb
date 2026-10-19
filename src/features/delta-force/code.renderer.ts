import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import {
  ASSETS_PATH,
  MAP_DISPLAY,
  type MapKey,
  type MapInfo,
} from '../../config/team-find.config.js';
import type { DailyCodes } from '../../services/deltaforce.scraper.js';
import { makeResult, type BuildContainerResult } from '../../utils/container.utils.js';

export { MAP_DISPLAY };

/** Link trang chủ website chứa mục Daily Codes và thông tin chi tiết */
export const MAP_CODES_URL = 'https://deltaforcetools.gg/vi?utm_source=PonN%C3%A8';

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
export function buildCodesContainer(
  codes: DailyCodes | null,
  hasCodes: boolean,
): BuildContainerResult {
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

    // Dòng hint gợi trí tò mò
    containerInner.push({
      type: ComponentType.TextDisplay,
      content: '💡 _Có mã nhưng chưa biết cửa ở đâu để loot hòm? Bấm nút bên dưới để xem vị trí!_',
    });
  } else {
    containerInner.push({
      type: ComponentType.TextDisplay,
      content: '_Không tìm thấy mật khẩu hôm nay._',
    });
  }

  const components: unknown[] = [{ type: ComponentType.Container, components: containerInner }];

  if (hasCodes && codes) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('📍 Xem Chi Tiết Vị Trí Dùng Các Mã Này')
        .setURL(MAP_CODES_URL),
    );
    components.push(actionRow.toJSON());
  }

  return makeResult(components, MessageFlags.IsComponentsV2, files);
}
