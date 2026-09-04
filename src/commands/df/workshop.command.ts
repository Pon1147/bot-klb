/** /df-workshop — Xưởng Căn Cứ Ngầm (Container V2 pattern) */

import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';

import { getWorkbenchList, getWorkshopRecommendations } from '../../services/deltaforce.api.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import { makeResult } from '../../utils/container.utils.js';
import { formatRemainingTime, formatHourlyIncome } from '../../config/workshop.config.js';
import { getWorkshopItemName, getWorkshopItemImage } from '../../services/workshop-data.service.js';
import { COLORS } from '../../config/container.variables.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('WorkshopCmd');

export const data = new SlashCommandBuilder()
  .setName('df-workshop')
  .setDescription('Xem thông tin sản xuất tại Xưởng Căn Cứ Ngầm.');

/** Build a Section for a single workshop item (pattern giống df-history) */
async function buildWorkshopItemSection(
  item: {
    hourly_income: string;
    item_id: string;
    recommended_recipe_id: string;
    remaining_time: number;
    status: number;
    workbench_id: string;
  },
  formatFn: (item: { hourly_income: string; remaining_time: number }) => string,
): Promise<Record<string, unknown>> {
  const name = await getWorkshopItemName(item.item_id);
  const imageUrl = await getWorkshopItemImage(item.item_id);
  if (!imageUrl) {
    logger.warn(`No image for itemId=${item.item_id} (name=${name})`);
  }
  const content = `**${name}**\n${formatFn(item)}`;

  const section: Record<string, unknown> = {
    type: ComponentType.Section,
    components: [
      {
        type: ComponentType.TextDisplay,
        content,
      },
    ],
  };

  // Thumbnail: ưu tiên ảnh recipe, fallback dùng ảnh local
  if (imageUrl) {
    section.accessory = {
      type: ComponentType.Thumbnail,
      media: { url: imageUrl },
      description: name,
    };
  } else {
    section.accessory = {
      type: ComponentType.Thumbnail,
      media: {
        url: 'https://www.playdeltaforce.com/basic_info/collections_5e312fbc4c8d85fa279ca9f53b21d812.png',
      },
      description: name,
    };
  }

  return section;
}

/** Build the full workshop container (async — fetches item names dynamically) */
async function buildWorkshopContainer(
  workbenchList: Array<{
    hourly_income: string;
    item_id: string;
    recommended_recipe_id: string;
    remaining_time: number;
    status: number;
    workbench_id: string;
  }>,
  dateStr: string,
) {
  const containerInner: unknown[] = [];

  // ── Phân loại: sản xuất hiện tại vs đề xuất ──
  const recommendedItems: typeof workbenchList = [];
  const currentItems: typeof workbenchList = [];

  for (const item of workbenchList) {
    if (item.status === 0 && item.remaining_time === 0) {
      recommendedItems.push(item);
    } else {
      currentItems.push(item);
    }
  }

  // ── Header ──
  containerInner.push({
    type: ComponentType.TextDisplay,
    content: `## Xưởng Căn Cứ Ngầm\n${dateStr}`,
  });

  // ── Current Production — mỗi item 1 Section + Thumbnail ──
  if (currentItems.length > 0) {
    containerInner.push({
      type: ComponentType.Separator,
      accentColor: 0xff8c00,
    });
    containerInner.push({
      type: ComponentType.TextDisplay,
      content: '🔧 **Chi Tiết Sản Xuất**',
    });

    for (const item of currentItems) {
      const section = await buildWorkshopItemSection(
        item,
        (i) => `⏱ Còn ${formatRemainingTime(i.remaining_time)}`,
      );
      containerInner.push(section);
    }
  }

  // ── Recommended Production — mỗi item 1 Section + Thumbnail ──
  if (recommendedItems.length > 0) {
    containerInner.push({
      type: ComponentType.Separator,
      accentColor: 0xff8c00,
    });
    containerInner.push({
      type: ComponentType.TextDisplay,
      content: '⚡ **Đề Xuất Sản Xuất**',
    });

    for (const item of recommendedItems) {
      const section = await buildWorkshopItemSection(
        item,
        (i) => `${formatHourlyIncome(i.hourly_income)}`,
      );
      containerInner.push(section);
    }
  }

  // ── Footer ──
  containerInner.push({
    type: ComponentType.TextDisplay,
    content:
      'Đến Căn Cứ Ngầm trong game để sản xuất vật phẩm nhằm kiếm lợi nhuận hoặc thu thập với chi phí thấp.',
  });

  // ── Container-level accent color ──
  const containerComponent: Record<string, unknown> = {
    type: ComponentType.Container,
    components: containerInner,
    accent_color: COLORS.DF,
  };

  return makeResult([containerComponent], MessageFlags.IsComponentsV2, []);
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await runDfCommand({ userId: interaction.user.id, database, interaction }, async (rawToken) => {
    const apiToken = buildDfApiToken(rawToken);

    // Gọi cả 2 API: sản xuất hiện tại + đề xuất
    const [workbenchData, recommendationData] = await Promise.allSettled([
      getWorkbenchList(apiToken),
      getWorkshopRecommendations(apiToken),
    ]);

    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    // Merge results: current production + recommendations
    const allItems: Array<{
      hourly_income: string;
      item_id: string;
      recommended_recipe_id: string;
      remaining_time: number;
      status: number;
      workbench_id: string;
    }> = [];

    if (workbenchData.status === 'fulfilled') {
      allItems.push(...workbenchData.value.workbench_list);
    }
    if (recommendationData.status === 'fulfilled') {
      allItems.push(...recommendationData.value.workbench_list);
    }

    if (!allItems.length) {
      return {
        components: [
          {
            type: ComponentType.Container,
            components: [
              {
                type: ComponentType.TextDisplay,
                content: 'Không có dữ liệu sản xuất.',
              },
            ],
            accent_color: COLORS.DF,
          },
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        files: [],
      };
    }

    const container = await buildWorkshopContainer(allItems, dateStr);

    return {
      components: container.toJSON(),
      flags: container.flags,
      files: container.files,
    };
  });
}
