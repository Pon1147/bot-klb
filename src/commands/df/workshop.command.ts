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
import { getWorkshopItemName } from '../../services/workshop-data.service.js';

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

  // ── Gộp toàn bộ content vào 1 TextDisplay block ──
  const lines: string[] = [`## Xưởng Căn Cứ Ngầm\n${dateStr}`];

  if (recommendedItems.length > 0) {
    const namePromises = recommendedItems.map((item) => getWorkshopItemName(item.item_id));
    const names = await Promise.all(namePromises);

    lines.push('');
    lines.push('**Đề Xuất Sản Xuất**');
    for (let i = 0; i < recommendedItems.length; i++) {
      const item = recommendedItems[i];
      const incomeText = formatHourlyIncome(item.hourly_income);
      lines.push(`• **${names[i]}** — ${incomeText}`);
    }
  }

  if (currentItems.length > 0) {
    const namePromises = currentItems.map((item) => getWorkshopItemName(item.item_id));
    const names = await Promise.all(namePromises);

    lines.push('');
    lines.push('**Chi Tiết Sản Xuất**');
    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];
      const timeText = formatRemainingTime(item.remaining_time);
      lines.push(`• **${names[i]}** — Còn ${timeText}`);
    }
  }

  lines.push('');
  lines.push(
    'Đến Căn Cứ Ngầm trong game để sản xuất vật phẩm nhằm kiếm lợi nhuận hoặc thu thập với chi phí thấp.',
  );

  containerInner.push({ type: ComponentType.TextDisplay, content: lines.join('\n') });

  return makeResult(
    [{ type: ComponentType.Container, components: containerInner }],
    MessageFlags.IsComponentsV2,
    [],
  );
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
              { type: ComponentType.TextDisplay, content: 'Không có dữ liệu sản xuất.' },
            ],
          },
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      };
    }

    const container = await buildWorkshopContainer(allItems, dateStr);

    return {
      components: container.toJSON(),
      flags: container.flags,
    };
  });
}
