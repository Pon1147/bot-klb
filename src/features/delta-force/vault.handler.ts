/**
 * Handler cho lệnh /df vault — Sảnh Triển Lãm Đồ Đỏ.
 * Lấy danh sách đồ đỏ đã sưu tầm (GetDahongCollection), map tên tiếng Việt qua workshop-data.service.
 * Render qua Discord Components V2 với hình ảnh trực quan và TOP 5 món tinh gọn.
 */

import { ChatInputCommandInteraction, ComponentType, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { getCollection } from '../../services/deltaforce.api.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { getWorkshopItemName, getWorkshopItemInfo } from '../../services/workshop-data.service.js';
import { makeResult } from '../../utils/container.utils.js';

const RANK_BADGES = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

function formatCoinShort(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return Math.round(num / 1_000) + 'K';
  }
  return num.toLocaleString('vi-VN');
}

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

    // Sắp xếp theo số lượng nhiều nhất và lấy TOP 5 món tiêu biểu
    const sortedItems = [...items].sort((a, b) => b.count - a.count);
    const topItems = sortedItems.slice(0, 5);

    const topItemsTextArray = await Promise.all(
      topItems.map(async (item, index) => {
        const info = await getWorkshopItemInfo(item.item_id).catch(() => null);
        const name =
          info?.name ||
          (await getWorkshopItemName(item.item_id).catch(() => `Vật phẩm #${item.item_id}`));
        const badge = item.is_new ? ' 🆕' : '';
        const rank = RANK_BADGES[index] || `**${index + 1}.**`;
        const estValue =
          info?.value && info.value > 0
            ? ` · _~${formatCoinShort(info.value * item.count)} Coin_`
            : '';

        return `${rank} **${name}** ×${item.count}${badge}${estValue}`;
      }),
    );

    const topItemsText =
      topItemsTextArray.length > 0
        ? topItemsTextArray.join('\n')
        : 'Chưa có vật phẩm đỏ nào trong bộ sưu tập.';

    const content = [
      '# 🔴 Sảnh Triển Lãm Đồ Đỏ (Red Vault)',
      '',
      `> 🏆 **Đã mở khóa:** \`${totalTypes}\` loại đồ đỏ`,
      `> 📦 **Tổng tích lũy:** \`${totalCount.toLocaleString('vi-VN')}\` món`,
      `> 💰 **Tổng giá trị:** \`${totalValueStr}\``,
      '',
      '### 💎 TOP Vật Phẩm Sở Hữu Nhiều Nhất:',
      topItemsText,
      ...(sortedItems.length > 5
        ? [`\n*...và ${sortedItems.length - 5} loại vật phẩm đỏ khác trong kho.*`]
        : []),
      '',
      '-# 💡 Mẹo: Đồ đỏ (Grade 6) mang lại giá trị coin khổng lồ khi rút quân thành công.',
    ].join('\n');

    // Lấy ảnh của món Top 1 để làm MediaGallery trực quan
    const top1Info = topItems[0]
      ? await getWorkshopItemInfo(topItems[0].item_id).catch(() => null)
      : null;

    const innerComponents: unknown[] = [{ type: ComponentType.TextDisplay, content }];

    if (top1Info?.imageUrl) {
      innerComponents.push({
        type: ComponentType.MediaGallery,
        items: [
          {
            media: { url: top1Info.imageUrl },
            description: top1Info.name,
          },
        ],
      });
    }

    innerComponents.push({
      type: ComponentType.Separator,
      accentColor: 0xed4245, // Đỏ rực rỡ đặc trưng Red Item
    });

    const result = makeResult(
      [
        {
          type: ComponentType.Container,
          components: innerComponents,
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
