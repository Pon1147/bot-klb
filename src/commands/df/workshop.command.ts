/** /df-workshop — Xưởng Căn Cứ Ngầm (Container V2 pattern) */

import {
  AttachmentBuilder,
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
import {
  formatRemainingTime,
  formatHourlyIncome,
  buildWorkshopSection,
  buildWorkshopItemLine,
} from '../../config/workshop.config.js';
import { getWorkshopItemName, getWorkshopItemImage } from '../../services/workshop-data.service.js';
import { COLORS } from '../../config/container.variables.js';

export const data = new SlashCommandBuilder()
  .setName('df-workshop')
  .setDescription('Xem thông tin sản xuất tại Xưởng Căn Cứ Ngầm.');

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
  const files: AttachmentBuilder[] = [];

  // ── Fallback icon cho section thumbnail (dùng attachment Discord) ──
  const FALLBACK_ICON_PATH = './src/assets/img/icon/icon_1.png';
  const FALLBACK_ICON_NAME = 'workshop-fallback-icon.png';
  let fallbackAttachment: AttachmentBuilder | null = null;

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

  // ── Current Production Section ──
  if (currentItems.length > 0) {
    const namePromises = currentItems.map((item) => getWorkshopItemName(item.item_id));
    const names = await Promise.all(namePromises);

    const itemLines = names.map((name, i) =>
      buildWorkshopItemLine(
        name,
        (item) => `⏱ Còn ${formatRemainingTime(item.remaining_time)}`,
        currentItems[i],
      ),
    );

    // Dùng ảnh recipe đầu tiên làm thumbnail section, fallback dùng ảnh local
    const firstImage = await getWorkshopItemImage(currentItems[0].recommended_recipe_id);
    const accessoryUrl = firstImage || `attachment://${FALLBACK_ICON_NAME}`;

    // Tạo attachment fallback nếu chưa có (lazy init — chỉ cần 1 lần)
    if (!fallbackAttachment) {
      fallbackAttachment = new AttachmentBuilder(FALLBACK_ICON_PATH).setName(FALLBACK_ICON_NAME);
      files.push(fallbackAttachment);
    }

    containerInner.push(buildWorkshopSection('Chi Tiết Sản Xuất', '🔧', itemLines, accessoryUrl));
    containerInner.push({ type: ComponentType.Separator, accentColor: 0xff8c00 });
  }

  // ── Recommended Production Section ──
  if (recommendedItems.length > 0) {
    const namePromises = recommendedItems.map((item) => getWorkshopItemName(item.item_id));
    const names = await Promise.all(namePromises);

    const itemLines = names.map((name, i) =>
      buildWorkshopItemLine(
        name,
        (item) => `${formatHourlyIncome(item.hourly_income)}`,
        recommendedItems[i],
      ),
    );

    // Dùng ảnh recipe đầu tiên làm thumbnail section, fallback dùng ảnh local
    const firstImage = await getWorkshopItemImage(recommendedItems[0].recommended_recipe_id);
    const accessoryUrl = firstImage || `attachment://${FALLBACK_ICON_NAME}`;

    // Tạo attachment fallback nếu chưa có (lazy init — chỉ cần 1 lần)
    if (!fallbackAttachment) {
      fallbackAttachment = new AttachmentBuilder(FALLBACK_ICON_PATH).setName(FALLBACK_ICON_NAME);
      files.push(fallbackAttachment);
    }

    containerInner.push(buildWorkshopSection('Đề Xuất Sản Xuất', '⚡', itemLines, accessoryUrl));
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

  return makeResult([containerComponent], MessageFlags.IsComponentsV2, files);
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
