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
        type: ComponentType.Section,
        components: [
          {
            type: ComponentType.TextDisplay,
            content:
              '> 👑 **Chào mừng quý khách đến với dịch vụ Kéo Lão Bản!**\n' +
              '> ⚙️ Quản Lý hoặc Thợ Kéo vui lòng bấm nút bên cạnh để mở đơn và thiết lập giá dịch vụ.',
          },
        ],
        accessory: {
          type: ComponentType.Button,
          custom_id: `keo:open_modal:${ticketChannelId}`,
          label: '📋 Mở Đơn Kéo',
          style: ButtonStyle.Primary,
        },
      },
    ],
  };

  return {
    components: [containerJson],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Modal thiết lập đơn kéo (Khách hàng, Tên gói, Số tiền, Ghi chú).
 */
export function buildOpenOrderModal(
  ticketChannelId: string,
  customerId: string,
  customerDisplay?: string,
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`keo_modal:create:${ticketChannelId}:${customerId}`)
    .setTitle('Thiết Lập Đơn Kéo Lão Bản');

  const customerInput = new TextInputBuilder()
    .setCustomId('customer_input')
    .setLabel('👤 ID hoặc Username Khách (Lão Bản)')
    .setStyle(TextInputStyle.Short)
    .setValue(customerDisplay || customerId)
    .setPlaceholder('Nhập Discord ID hoặc username của khách')
    .setRequired(true);

  const pkgInput = new TextInputBuilder()
    .setCustomId('package_name')
    .setLabel('📦 Tên gói / Nhiệm vụ kéo')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('VD: Space City 2h, Tháp Zero, Két sắt...')
    .setRequired(true);

  const amountInput = new TextInputBuilder()
    .setCustomId('amount')
    .setLabel('💰 Số tiền thanh toán (VNĐ)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('VD: 300000')
    .setRequired(true);

  const noteInput = new TextInputBuilder()
    .setCustomId('note')
    .setLabel('📝 Ghi chú thêm (Tùy chọn)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Yêu cầu đặc biệt, khung giờ kéo, v.v...')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(customerInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(pkgInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput),
  );

  return modal;
}

/**
 * Thẻ bắn sang Kênh Bắn Đơn (#đơn-đang-mở).
 */
export function buildDispatchCard(
  order: KeoOrderRecord,
  workerRoleId?: string | null,
): { components: any[]; flags: number } {
  let accessoryButton: any = null;

  if (order.status === 'OPEN') {
    accessoryButton = {
      type: ComponentType.Button,
      custom_id: `keo:claim:${order.id}`,
      label: '🎯 Nhận Kèo Ngay',
      style: ButtonStyle.Success,
    };
  } else if (order.status === 'CLAIMED' || order.status === 'PAID') {
    accessoryButton = {
      type: ComponentType.Button,
      custom_id: `keo:worker_done:${order.id}`,
      label: '✅ Báo Cáo Xong',
      style: ButtonStyle.Primary,
    };
  } else if (order.status === 'WORKER_DONE') {
    accessoryButton = {
      type: ComponentType.Button,
      custom_id: `keo_disabled_1:${order.id}`,
      label: '⏳ Chờ Duyệt',
      style: ButtonStyle.Secondary,
      disabled: true,
    };
  } else {
    accessoryButton = {
      type: ComponentType.Button,
      custom_id: `keo_disabled_2:${order.id}`,
      label: '✨ Hoàn Thành',
      style: ButtonStyle.Secondary,
      disabled: true,
    };
  }

  const containerJson = {
    type: ComponentType.Container,
    components: [
      {
        type: ComponentType.Section,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: `## 🎯 ĐƠN KÉO MỚI #${order.id.slice(-6)}`,
          },
        ],
        ...(accessoryButton ? { accessory: accessoryButton } : {}),
      },
      {
        type: ComponentType.Separator,
        accentColor: COLORS.DF,
      },
      {
        type: ComponentType.TextDisplay,
        content:
          (workerRoleId ? `> 📢 **Dành cho**: <@&${workerRoleId}>\n` : '') +
          `> 📦 **Gói dịch vụ**: **${order.package_name}**\n` +
          `> 💰 **Thù lao**: **${formatVnd(order.amount)}**\n` +
          `> 👤 **Khách hàng**: <@${order.customer_id}>\n` +
          `> 🎫 **Kênh Ticket**: <#${order.ticket_channel_id}>\n` +
          (order.note ? `> 📝 **Ghi chú**: ${order.note}\n` : '') +
          `> 🛠️ **Trạng thái**: ${formatKeoStatusBadge(order.status, order.worker_id)}`,
      },
    ],
  };

  return {
    components: [containerJson],
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

  // Nếu đã nhận kèo và chưa thanh toán -> chèn hình ảnh mã VietQR và các nút Section
  if (order.status === 'CLAIMED') {
    if (qrImageUrl) {
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

    containerComponents.push({
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content:
            '💳 **Xác Nhận Tiền**\n> Chủ Server bấm nút bên cạnh sau khi kiểm tra tài khoản.',
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `keo:confirm_pay:${order.id}`,
        label: '✅ Đã Nhận Tiền (Chỉ Owner)',
        style: ButtonStyle.Success,
      },
    });

    containerComponents.push({
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: '❌ **Hủy Kèo**\n> Hủy bỏ đơn kéo này.',
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `keo:cancel:${order.id}`,
        label: 'Hủy Đơn',
        style: ButtonStyle.Danger,
      },
    });
  } else if (order.status === 'WORKER_DONE') {
    containerComponents.push({
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content:
            '🏁 **Nghiệm Thu**\n> Quản lý/Chủ Server bấm nút bên cạnh sau khi xác nhận với khách.',
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `keo:complete:${order.id}`,
        label: '🏁 Nghiệm Thu & Hoàn Tất',
        style: ButtonStyle.Success,
      },
    });
  }

  const containerJson = {
    type: ComponentType.Container,
    components: containerComponents,
  };

  return {
    components: [containerJson],
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
