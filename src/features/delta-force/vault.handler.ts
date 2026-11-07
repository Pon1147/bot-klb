/**
 * Handler cho lệnh /df vault — Sảnh Triển Lãm Đồ Đỏ.
 * Lấy danh sách đồ đỏ đã sưu tầm (GetDahongCollection), map tên tiếng Việt qua workshop-data.service.
 * Render qua Discord Components V2 với hình ảnh trực quan, Spotlight Section và TOP 5 món tinh gọn.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getCollection } from '../../services/deltaforce.api.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import { getWorkshopItemName, getWorkshopItemInfo } from '../../services/workshop-data.service.js';
import { makeResult } from '../../utils/container.utils.js';
import { formatCoin } from '../../utils/df-format.utils.js';

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
  await runDfCommand({ userId: interaction.user.id, database, interaction }, async (apiToken) => {
    const collectionData = await getCollection(apiToken);

    const items = collectionData.collection_list || [];
    const totalTypes = collectionData.dahong_type_count ?? items.length;
    const totalCount =
      collectionData.dahong_total_count ?? items.reduce((sum, item) => sum + (item.count || 0), 0);
    const totalValueRaw = collectionData.dahong_total_value;
    const totalValueStr = totalValueRaw ? formatCoin(totalValueRaw) : 'Không xác định';

    // Nạp chi tiết vật phẩm và sắp xếp theo đơn giá cao nhất (Vật phẩm giá trị nhất đứng đầu)
    const itemsWithInfo = await Promise.all(
      items.map(async (item) => {
        const info = await getWorkshopItemInfo(item.item_id).catch(() => null);
        const name =
          info?.name ||
          (await getWorkshopItemName(item.item_id).catch(() => `Vật phẩm #${item.item_id}`));
        const unitValue = info?.value || 0;
        const totalValue = unitValue * item.count;
        return {
          ...item,
          name,
          info,
          unitValue,
          totalValue,
        };
      }),
    );

    const sortedItems = [...itemsWithInfo].sort((a, b) => {
      if (b.unitValue !== a.unitValue) {
        return b.unitValue - a.unitValue;
      }
      return b.count - a.count;
    });

    const topItems = sortedItems.slice(0, 5);

    const topItemsTextArray = topItems.map((item, index) => {
      const badge = item.is_new ? ' 🆕' : '';
      const rank = RANK_BADGES[index] || `**${index + 1}.**`;
      const valStr = item.unitValue > 0 ? ` · Giá: _~${formatCoinShort(item.unitValue)} Coin_` : '';

      return `${rank} **${item.name}** ─ \`×${item.count}\` món${badge}${valStr}`;
    });

    const topItemsText =
      topItemsTextArray.length > 0
        ? topItemsTextArray.join('\n')
        : 'Chưa có vật phẩm đỏ nào trong bộ sưu tập.';

    const headerLines = [
      '# 🔴 Sảnh Triển Lãm Đồ Đỏ',
      '-# Red Vault  ·  🟢 Đang diễn ra',
      '',
      `> 🏆 **Loại đồ đỏ:** \`${totalTypes}\`  ·  📦 **Tích lũy:** \`${totalCount.toLocaleString('vi-VN')}\` món  ·  ⭐ **Tổng giá trị:** \`${totalValueStr}\``,
      '',
      '### 💎 TOP Vật Phẩm Đắt Giá Nhất',
      topItemsText,
      ...(sortedItems.length > 5
        ? [`\n> 💡 *...và ${sortedItems.length - 5} loại vật phẩm đỏ khác trong kho.*`]
        : []),
    ];

    const innerComponents: unknown[] = [
      {
        type: ComponentType.TextDisplay,
        content: headerLines.join('\n'),
      },
      {
        type: ComponentType.Separator,
        accentColor: 0xed4245, // Đỏ rực rỡ đặc trưng Red Item
      },
    ];

    // Lấy thông tin món Top 1 để làm Spotlight Section (Thẻ vật phẩm giá trị nhất)
    if (topItems.length > 0) {
      const top1Item = topItems[0];
      const top1Desc =
        top1Item.info?.description ||
        'Bảo vật đỏ quý giá nhất bạn từng thu thập và rút quân thành công.';

      const spotlightLines = [
        '-# ⭐ VẬT PHẨM GIÁ TRỊ NHẤT',
        `### **${top1Item.name}**`,
        `> *${top1Desc}*`,
        `💎 **Đơn giá:** \`~${formatCoinShort(top1Item.unitValue)} Coin\` · **Đang có:** \`×${top1Item.count}\` món (Tổng: \`~${formatCoinShort(top1Item.totalValue)} Coin\`)`,
      ];

      const spotlightSection: Record<string, unknown> = {
        type: ComponentType.Section,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: spotlightLines.join('\n'),
          },
        ],
      };

      if (top1Item.info?.imageUrl) {
        spotlightSection.accessory = {
          type: ComponentType.Thumbnail,
          media: { url: top1Item.info.imageUrl },
          description: top1Item.name,
        };
      }

      innerComponents.push(spotlightSection);
      innerComponents.push({
        type: ComponentType.Separator,
        accentColor: 0x2b2d31,
      });
    }

    // Mẹo ở chân trang (Footer hint)
    innerComponents.push({
      type: ComponentType.TextDisplay,
      content: '-# ⓘ Mẹo: Đồ đỏ (Grade 6) mang lại giá trị coin khổng lồ khi rút quân thành công.',
    });

    // ActionRow gồm 3 nút pill thống kê nằm ngang + 1 nút link mở web (giống mockup)
    const statsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('df_vault_btn_types')
        .setLabel(`🏆 ${totalTypes} Loại đồ`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('df_vault_btn_count')
        .setLabel(`📦 ${totalCount.toLocaleString('vi-VN')} Tích lũy`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('df_vault_btn_value')
        .setLabel(`⭐ ~${formatCoinShort(Number(totalValueRaw || 0))} Coin`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('🌐 Mở Kho Đồ Web ↗')
        .setURL('https://www.playdeltaforce.com/events/hq/vi/index.html'),
    );

    const containerResult = makeResult(
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
      components: [...containerResult.toJSON(), statsRow.toJSON()],
      flags: containerResult.flags,
    };
  });
}
