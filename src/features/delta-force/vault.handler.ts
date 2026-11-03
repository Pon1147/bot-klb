/**
 * Handler cho lệnh /df vault — Sảnh Triển Lãm Đồ Đỏ.
 * Lấy danh sách đồ đỏ đã sưu tầm (GetDahongCollection), map tên tiếng Việt qua workshop-data.service.
 * Render qua Discord Components V2.
 */

import { ChatInputCommandInteraction, ComponentType, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { getCollection } from '../../services/deltaforce.api.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { getWorkshopItemName } from '../../services/workshop-data.service.js';
import { makeResult } from '../../utils/container.utils.js';

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await runDfCommand({ userId: interaction.user.id, database, interaction }, async (rawToken) => {
    const apiToken = buildDfApiToken(rawToken);
    const collectionData = await getCollection(apiToken);

    const items = collectionData.collection_list || [];
    const totalTypes = collectionData.dahong_type_count ?? items.length;
    const totalCount =
      collectionData.dahong_total_count ?? items.reduce((sum, item) => sum + (item.count || 0), 0);
    const totalValueRaw = collectionData.dahong_total_value;
    const totalValueStr = totalValueRaw
      ? Number(totalValueRaw).toLocaleString('vi-VN') + ' Coin'
      : 'Không xác định';

    // Sắp xếp theo số lượng nhiều nhất và lấy tên cho TOP 15
    const sortedItems = [...items].sort((a, b) => b.count - a.count);
    const topItems = sortedItems.slice(0, 15);

    const topItemsTextArray = await Promise.all(
      topItems.map(async (item, index) => {
        const name = await getWorkshopItemName(item.item_id).catch(
          () => `Vật phẩm #${item.item_id}`,
        );
        const badge = item.is_new ? ' 🆕' : '';
        return `**${index + 1}. ${name}** ×${item.count}${badge}`;
      }),
    );

    const topItemsText =
      topItemsTextArray.length > 0
        ? topItemsTextArray.join('\n')
        : 'Chưa có vật phẩm đỏ nào trong bộ sưu tập.';

    const content = [
      '# 🔴 Sảnh Triển Lãm Đồ Đỏ (Red Vault)',
      '',
      `> 🏆 **Tổng loại đã mở khóa:** \`${totalTypes}\` loại`,
      `> 📦 **Tổng số lượng tích lũy:** \`${totalCount.toLocaleString('vi-VN')}\` món`,
      `> 💰 **Tổng giá trị quy đổi:** \`${totalValueStr}\``,
      '',
      '### 💎 Danh Sách Vật Phẩm Tiêu Biểu:',
      topItemsText,
      ...(sortedItems.length > 15
        ? [`\n*...và ${sortedItems.length - 15} loại vật phẩm đỏ khác.*`]
        : []),
    ].join('\n');

    const result = makeResult(
      [
        {
          type: ComponentType.Container,
          components: [
            { type: ComponentType.TextDisplay, content },
            { type: ComponentType.Separator, accentColor: 0xed4245 }, // Đỏ rực rỡ đặc trưng Red Item
          ],
        },
      ],
      MessageFlags.IsComponentsV2,
      [],
    );

    return {
      components: result.toJSON(),
      flags: result.flags,
    };
  });
}
