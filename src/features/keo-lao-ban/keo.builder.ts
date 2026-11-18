import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { KeoOrderRecord, KeoOrderStatus } from '../../database/keo.db.js';
import { COLORS } from '../../config/container.variables.js';

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

export function formatKeoStatusBadge(status: KeoOrderStatus, workerId?: string | null): string {
  switch (status) {
    case 'OPEN':
      return '🟡 Đang tìm Thợ Kéo...';
    case 'CLAIMED':
      return `🟠 Đã có thợ nhận: <@${workerId}> (Chờ thanh toán)`;
    case 'PAID':
      return `🟢 Đã thanh toán! Thợ <@${workerId}> đang kéo...`;
    case 'WORKER_DONE':
      return `🔵 Thợ <@${workerId}> đã báo xong! Chờ nghiệm thu`;
    case 'COMPLETED':
      return '✨ Đơn kéo đã hoàn thành';
    case 'CANCELLED':
      return '❌ Đơn đã hủy';
  }
}

/**
 * Thẻ Chào Mừng Kéo Lão Bản ghim trong kênh Ticket khi vừa mở ticket.
 */
export function buildTicketWelcomeCard(ticketChannelId: string): {
  components: any[];
  flags: number;
} {
  const containerJson = {
    type: ComponentType.Container,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: '## 🎮 Dịch Vụ Kéo Delta Force • Lão Bản VIP',
      },
      {
        type: ComponentType.Separator,
        accentColor: COLORS.DF,
      },
      {
        type: ComponentType.TextDisplay,
        content:
          '> 👑 **Chào mừng quý khách đến với dịch vụ Kéo Lão Bản!**\n' +
          '> ⚙️ Quản Lý hoặc Thợ Kéo vui lòng bấm nút bên dưới để tạo đơn và thiết lập giá dịch vụ.',
      },
    ],
  };

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`keo:open_modal:${ticketChannelId}`)
      .setLabel('📋 Mở Đơn Kéo')
      .setStyle(ButtonStyle.Primary),
  );

  return {
    components: [containerJson, buttonRow.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Modal thiết lập đơn kéo (Tên gói, Số tiền, Ghi chú).
 */
export function buildOpenOrderModal(ticketChannelId: string, customerId: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`keo_modal:create:${ticketChannelId}:${customerId}`)
    .setTitle('Thiết Lập Đơn Kéo Lão Bản');

  const pkgInput = new TextInputBuilder()
    .setCustomId('package_name')
    .setLabel('Tên gói / Nhiệm vụ kéo')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('VD: Space City 2h, Tháp Zero, Két sắt...')
    .setRequired(true);

  const amountInput = new TextInputBuilder()
    .setCustomId('amount')
    .setLabel('Số tiền thanh toán (VNĐ)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('VD: 300000')
    .setRequired(true);

  const noteInput = new TextInputBuilder()
    .setCustomId('note')
    .setLabel('Ghi chú thêm (Tùy chọn)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Yêu cầu đặc biệt, khung giờ kéo, v.v...')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(pkgInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput),
  );

  return modal;
}

/**
 * Thẻ bắn sang Kênh Bắn Đơn (#đơn-đang-mở).
 */
export function buildDispatchCard(order: KeoOrderRecord): { components: any[]; flags: number } {
  const isDone = order.status === 'COMPLETED' || order.status === 'CANCELLED';

  const containerJson = {
    type: ComponentType.Container,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: `## 🎯 ĐƠN KÉO MỚI #${order.id.slice(-6)}`,
      },
      {
        type: ComponentType.Separator,
        accentColor: COLORS.DF,
      },
      {
        type: ComponentType.TextDisplay,
        content:
          `> 📦 **Gói dịch vụ**: **${order.package_name}**\n` +
          `> 💰 **Thù lao**: **${formatVnd(order.amount)}**\n` +
          `> 👤 **Khách hàng**: <@${order.customer_id}>\n` +
          `> 🎫 **Kênh Ticket**: <#${order.ticket_channel_id}>\n` +
          (order.note ? `> 📝 **Ghi chú**: ${order.note}\n` : '') +
          `> 🛠️ **Trạng thái**: ${formatKeoStatusBadge(order.status, order.worker_id)}`,
      },
    ],
  };

  const buttonRow = new ActionRowBuilder<ButtonBuilder>();

  if (order.status === 'OPEN') {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`keo:claim:${order.id}`)
        .setLabel('🎯 Nhận Kèo Ngay')
        .setStyle(ButtonStyle.Success),
    );
  } else if (order.status === 'CLAIMED' || order.status === 'PAID') {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`keo:worker_done:${order.id}`)
        .setLabel('✅ Báo Cáo Xong Đơn')
        .setStyle(ButtonStyle.Primary),
    );
  } else if (order.status === 'WORKER_DONE') {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`keo_disabled_1:${order.id}`)
        .setLabel('⏳ Chờ Nghiệm Thu')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );
  } else if (isDone) {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`keo_disabled_2:${order.id}`)
        .setLabel('✨ Đã Hoàn Thành')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );
  }

  return {
    components: [containerJson, buttonRow.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Thẻ trạng thái sống trong Kênh Ticket kèm mã VietQR và các nút quản lý.
 */
export function buildTicketOrderCard(
  order: KeoOrderRecord,
  qrImageUrl?: string | null,
): { components: any[]; flags: number } {
  const containerComponents: any[] = [
    {
      type: ComponentType.TextDisplay,
      content: `## 💎 Đơn Kéo #${order.id.slice(-6)}: ${order.package_name}`,
    },
    {
      type: ComponentType.Separator,
      accentColor: COLORS.DF,
    },
    {
      type: ComponentType.TextDisplay,
      content:
        `> 💰 **Số tiền thanh toán**: **${formatVnd(order.amount)}**\n` +
        `> 👤 **Khách hàng**: <@${order.customer_id}>\n` +
        (order.worker_id ? `> 🛠️ **Thợ Kéo**: <@${order.worker_id}>\n` : '') +
        (order.note ? `> 📝 **Ghi chú**: ${order.note}\n` : '') +
        `> 📊 **Trạng thái**: ${formatKeoStatusBadge(order.status, order.worker_id)}`,
    },
  ];

  // Nếu đã nhận kèo và chưa thanh toán -> chèn hình ảnh mã VietQR
  if (order.status === 'CLAIMED' && qrImageUrl) {
    containerComponents.push(
      {
        type: ComponentType.Separator,
      },
      {
        type: ComponentType.MediaGallery,
        items: [
          {
            media: {
              url: qrImageUrl,
            },
            description: 'Mã QR chuyển khoản ngân hàng VietQR',
          },
        ],
      },
    );
  }

  const containerJson = {
    type: ComponentType.Container,
    components: containerComponents,
  };

  const actionRows: any[] = [];

  if (order.status === 'CLAIMED') {
    actionRows.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`keo:confirm_pay:${order.id}`)
            .setLabel('✅ Xác Nhận Đã Nhận Tiền (Chỉ Owner)')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`keo:cancel:${order.id}`)
            .setLabel('❌ Hủy Đơn')
            .setStyle(ButtonStyle.Danger),
        )
        .toJSON(),
    );
  } else if (order.status === 'WORKER_DONE') {
    actionRows.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`keo:complete:${order.id}`)
            .setLabel('🏁 Nghiệm Thu & Hoàn Tất')
            .setStyle(ButtonStyle.Success),
        )
        .toJSON(),
    );
  }

  return {
    components: [containerJson, ...actionRows],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Thẻ cảm ơn và 5 nút đánh giá sao gửi cho khách hàng khi đơn hoàn tất.
 */
export function buildRatingCard(order: KeoOrderRecord): { components: any[]; flags: number } {
  const containerJson = {
    type: ComponentType.Container,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: '## ⭐ Đánh Giá Dịch Vụ Kéo Lão Bản',
      },
      {
        type: ComponentType.Separator,
        accentColor: COLORS.DF,
      },
      {
        type: ComponentType.TextDisplay,
        content:
          `Cảm ơn Lão Bản <@${order.customer_id}> đã tin tưởng và sử dụng dịch vụ kéo Delta Force!\n` +
          `Vui lòng chấm điểm chất lượng dịch vụ của Thợ Kéo <@${order.worker_id}> để giúp chúng tôi hoàn thiện hơn.`,
      },
    ],
  };

  const ratingRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`keo:rate:${order.id}:1`)
      .setLabel('1 ⭐')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`keo:rate:${order.id}:2`)
      .setLabel('2 ⭐')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`keo:rate:${order.id}:3`)
      .setLabel('3 ⭐')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`keo:rate:${order.id}:4`)
      .setLabel('4 ⭐')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`keo:rate:${order.id}:5`)
      .setLabel('5 ⭐')
      .setStyle(ButtonStyle.Success),
  );

  return {
    components: [containerJson, ratingRow.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  };
}
