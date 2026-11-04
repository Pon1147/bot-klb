/**
 * Handler cho lệnh /df market [item]
 * Tra cứu giá thị trường, biểu đồ biến động và lợi nhuận chế tác realtime từ Delta Force HQ.
 * Không yêu cầu liên kết tài khoản (Public NoAuth API).
 */

import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import Database from 'better-sqlite3';
import {
  getManufactureDetail,
  getManufactureRecommendationListNoAuth,
} from '../../services/deltaforce.api.js';
import {
  getWorkshopItemName,
  getItemImageUrl,
  searchCraftItems,
} from '../../services/workshop-data.service.js';
import { resolveUserDfToken } from '../../utils/df-token.utils.js';
import { buildErrorContainer, makeResult } from '../../utils/container.utils.js';

function formatCoin(num: number | string): string {
  const n = Number(num) || 0;
  return n.toLocaleString('vi-VN');
}

function formatCoinShort(num: number | string): string {
  const n = Number(num) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return n.toLocaleString('vi-VN');
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * Xử lý Autocomplete cho option item
 */
export async function handleMarketAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focusedValue = interaction.options.getFocused();
  const matches = await searchCraftItems(focusedValue, 20).catch(() => []);

  await interaction.respond(
    matches.map((item) => ({
      name: `${item.name} (${item.id})`.slice(0, 100),
      value: item.id,
    })),
  );
}

/**
 * Thực thi lệnh /df market
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  await interaction.deferReply();

  const db = (database ?? interaction.client?.database) as Database.Database | undefined;
  const userToken = db ? resolveUserDfToken(db, interaction.user.id) : null;

  let itemId = interaction.options.getString('item');

  // Nếu người dùng không nhập item, tự động lấy item được đề xuất lợi nhuận cao nhất
  if (!itemId) {
    try {
      const rec = await getManufactureRecommendationListNoAuth();
      const best = rec.workbench_list?.[0];
      if (best?.item_id) {
        itemId = best.item_id;
      }
    } catch {
      // Fallback mặc định
      itemId = '37210500001';
    }
  }

  if (!itemId) {
    itemId = '37210500001';
  }

  try {
    const { detail, isPersonal } = await getManufactureDetail(itemId, userToken || undefined);
    const itemName = await getWorkshopItemName(detail.item_id).catch(
      () => `Vật phẩm #${detail.item_id}`,
    );
    const imageUrl = await getItemImageUrl(detail.item_id).catch(() => undefined);

    const sellPrice = Number(detail.total_sell_price) || 0;
    const cost = Number(detail.manufacture_cost) || 0;
    const fee = Number(detail.handling_fee) || 0;
    const deposit = Number(detail.deposit) || 0;
    const income = Number(detail.total_income) || 0;
    const hourly = Number(detail.hourly_income) || 0;

    // Tìm giá cao nhất và thấp nhất trong 24h
    const prices = (detail.price_fluctuation_list || []).map((p) => Number(p.price) || 0);
    const maxPrice = prices.length ? Math.max(...prices) : sellPrice;
    const minPrice = prices.length ? Math.min(...prices) : sellPrice;

    // Lấy thời điểm chốt giá gần nhất từ server game
    const lastPoint = (detail.price_fluctuation_list || []).slice(-1)[0];
    const lastUpdatedText = lastPoint?.hour_timestamp
      ? new Date(Number(lastPoint.hour_timestamp) * 1000).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        })
      : 'Gần nhất';

    // Danh sách nguyên liệu cần thiết
    const materialLines = await Promise.all(
      (detail.material_list || []).map(async (m) => {
        const matName = await getWorkshopItemName(m.material_id).catch(
          () => `Nguyên liệu #${m.material_id}`,
        );
        const uPrice = Number(m.unit_price) || 0;
        const tPrice = Number(m.total_price) || 0;
        return `• **${matName}** ×${m.material_count} ─ Đơn giá: \`${formatCoin(uPrice)}\` Coin _(Tổng: ${formatCoin(tPrice)})_`;
      }),
    );

    const materialsText =
      materialLines.length > 0
        ? materialLines.join('\n')
        : 'Không yêu cầu nguyên liệu chế tác phụ.';

    const profitIcon = income >= 0 ? '📈' : '📉';
    const profitSign = income >= 0 ? '+' : '';

    const marketBadge = isPersonal
      ? '🟢 **Thị trường:** `Garena SEA (Đã liên kết)`'
      : '⚪ **Thị trường:** `Global Quốc Tế (Chưa liên kết)`';

    const footerText = isPersonal
      ? `-# ⓘ Dữ liệu chốt lúc: \`${lastUpdatedText}\` (Đồng bộ cụm Garena SEA từ Delta Force HQ).`
      : `-# ⓘ Dữ liệu chốt lúc: \`${lastUpdatedText}\` (Cụm Global · Dùng \`/df link start\` để xem giá cụm Garena).`;

    const sectionContent = [
      `# 🛠️ Bàn Chế Tác: **${itemName}**`,
      `-# ID: \`${detail.item_id}\`  ·  Thời gian sản xuất: \`${formatDuration(detail.total_duration)}\``,
      marketBadge,
      '',
      `💰 **Tổng giá bán (cả mẻ):** \`${formatCoin(sellPrice)}\` Coin`,
      `📊 **Biến động đơn giá 24h:** Đỉnh \`${formatCoin(maxPrice)}\`  ·  Đáy \`${formatCoin(minPrice)}\` Coin/món`,
      `${profitIcon} **Lợi nhuận ròng:** \`${profitSign}${formatCoin(income)}\` Coin *(Thu nhập: \`~${formatCoin(hourly)}/giờ\`)*`,
      '',
      `### 🧱 Vật Liệu Sản Xuất Cần Dùng:`,
      materialsText,
      '',
      `> ⚙️ **Chi phí sản xuất:** \`${formatCoin(cost)}\` Coin  ·  **Phí & Tiền cọc:** \`${formatCoin(fee + deposit)}\` Coin`,
      '',
      footerText,
    ].join('\n');

    const innerComponents: unknown[] = [
      {
        type: ComponentType.Section,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: sectionContent,
          },
        ],
        ...(imageUrl
          ? {
              accessory: {
                type: ComponentType.Thumbnail,
                media: { url: imageUrl },
                description: itemName,
              },
            }
          : {}),
      },
      {
        type: ComponentType.Separator,
        accentColor: income >= 0 ? 0x2ecc71 : 0xed4245,
      },
    ];

    const statsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('df_market_stat_price')
        .setLabel(`💰 Giá bán: ${formatCoinShort(sellPrice)}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('df_market_stat_hourly')
        .setLabel(`${profitIcon} ${profitSign}${formatCoinShort(hourly)}/giờ`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('🌐 Mở Bàn Chế Tác ↗')
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

    await interaction.editReply({
      components: [...containerResult.toJSON(), statsRow.toJSON()],
      flags: containerResult.flags,
    });
  } catch (error) {
    const err = buildErrorContainer(
      `Không thể lấy thông tin thị trường cho vật phẩm #${itemId}: ${(error as Error).message}`,
    );
    await interaction.editReply({
      components: err.toJSON(),
      flags: err.flags,
    });
  }
}
