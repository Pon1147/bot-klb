import { ComponentType, MessageFlags } from 'discord.js';
import { COLORS } from '../config/container.variables.js';
import { makeResult, BuildContainerResult } from './container.utils.js';

/**
 * Danh sách ngân hàng phổ biến được VietQR hỗ trợ.
 */
export const SUPPORTED_BANKS: Record<string, string> = {
  MB: 'MBBank (Quân Đội)',
  VCB: 'Vietcombank (Ngoại Thương)',
  TCB: 'Techcombank (Kỹ Thương)',
  ACB: 'ACB (Á Châu)',
  VPB: 'VPBank (Việt Nam Thịnh Vượng)',
  TPB: 'TPBank (Tiên Phong)',
  ICB: 'VietinBank (Công Thương)',
  BIDV: 'BIDV (Đầu tư & Phát triển)',
  VIB: 'VIB (Quốc Tế)',
  STB: 'Sacombank (Sài Gòn Thương Tín)',
  HDB: 'HDBank (Phát triển TP.HCM)',
  OCB: 'OCB (Phương Đông)',
  MSB: 'MSB (Hàng Hải)',
  SHB: 'SHB (Sài Gòn - Hà Nội)',
  LPB: 'LPBank (Lộc Phát)',
  KLB: 'KienlongBank (Kiên Long)',
};

/**
 * Mã BIN 6 chữ số chuẩn của các ngân hàng phục vụ API VietQR.
 */
export const BANK_BINS: Record<string, string> = {
  MB: '970422',
  VCB: '970436',
  TCB: '970407',
  ACB: '970416',
  VPB: '970432',
  TPB: '970423',
  ICB: '970415',
  BIDV: '970418',
  VIB: '970441',
  STB: '970403',
  HDB: '970437',
  OCB: '970448',
  MSB: '970426',
  SHB: '970443',
  LPB: '970449',
  KLB: '970452',
};

export interface VietQrImageOptions {
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
  addInfo: string;
  template?: 'compact' | 'compact2' | 'qr_only' | 'print';
}

/**
 * Sinh đường dẫn hình ảnh mã QR động từ dịch vụ chuẩn VietQR.
 */
export function buildVietQrImageUrl(options: VietQrImageOptions): string {
  const { bankId, accountNo, accountName, amount, addInfo, template = 'compact2' } = options;
  const cleanBank = bankId.trim().toUpperCase();
  const cleanAcc = accountNo.trim();
  const cleanName = encodeURIComponent(accountName.trim());
  const cleanInfo = encodeURIComponent(addInfo.trim());

  return `https://img.vietqr.io/image/${cleanBank}-${cleanAcc}-${template}.png?amount=${amount}&addInfo=${cleanInfo}&accountName=${cleanName}`;
}

/**
 * Tải buffer ảnh PNG của mã VietQR từ API.
 * Ưu tiên gọi POST https://api.vietqr.io/v2/generate (hỗ trợ đầy đủ tài khoản ảo PayOS 17 số)
 * và fallback sang GET img.vietqr.io.
 */
export async function fetchVietQrImageBuffer(options: VietQrImageOptions): Promise<Buffer | null> {
  const rawBank = options.bankId.trim().toUpperCase();
  const acqId = /^\d{6}$/.test(rawBank) ? rawBank : BANK_BINS[rawBank];

  // 1. Ưu tiên endpoint chính thức POST /v2/generate (tránh lỗi blank matrix của CDN GET đối với tài khoản định danh)
  if (acqId) {
    try {
      const res = await fetch('https://api.vietqr.io/v2/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BotKLB-Discord/1.6',
        },
        body: JSON.stringify({
          acqId,
          accountNo: options.accountNo.trim(),
          accountName: options.accountName.trim(),
          amount: options.amount,
          addInfo: options.addInfo.trim(),
          format: 'text',
          template: options.template || 'compact2',
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const json = (await res.json()) as { code: string; data?: { qrDataURL?: string } };
        if (json.code === '00' && json.data?.qrDataURL) {
          const base64Data = json.data.qrDataURL.replace(/^data:image\/png;base64,/, '');
          return Buffer.from(base64Data, 'base64');
        }
      }
    } catch {
      // Fallback sang GET CDN
    }
  }

  // 2. Fallback sang CDN GET img.vietqr.io
  const url = buildVietQrImageUrl(options);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BotKLB-Discord/1.6' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('image/png') || contentType.includes('image/jpeg')) {
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    }
    const text = await res.text();
    const match = text.match(/data:image\/png;base64,([^"']+)/);
    if (match && match[1]) {
      return Buffer.from(match[1], 'base64');
    }
    return null;
  } catch {
    return null;
  }
}

export interface VietQrContainerOptions {
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
  transferCode: string;
  memo?: string | null;
  serverName: string;
  creatorId: string;
  customerId?: string | null;
  attachmentName?: string | null;
  txId?: string | null;
}

/**
 * Tạo Container V2 hiển thị hóa đơn thanh toán VietQR kèm đầy đủ thông tin giao dịch.
 */
export function buildVietQrContainer(options: VietQrContainerOptions): BuildContainerResult {
  const {
    bankId,
    accountNo,
    accountName,
    amount,
    transferCode,
    memo,
    serverName,
    creatorId,
    customerId,
    attachmentName,
    txId,
  } = options;

  const bankDisplayName = SUPPORTED_BANKS[bankId.toUpperCase()] ?? bankId.toUpperCase();
  const formattedAmount = `${amount.toLocaleString('vi-VN')} đ`;
  const mediaUrl = attachmentName
    ? `attachment://${attachmentName}`
    : buildVietQrImageUrl({
        bankId,
        accountNo,
        accountName,
        amount,
        addInfo: transferCode,
        template: 'compact2',
      });

  const customerLine = customerId
    ? `• **Khách hàng**: <@${customerId}>`
    : `• **Khách hàng**: *Bất kỳ thành viên nào*`;

  const memoLine = memo ? `\n• **Dịch vụ / Ghi chú**: \`${memo}\`` : '';

  const invoiceTitle = txId
    ? `### 💳 Hóa Đơn Thanh Toán VietQR [${txId}]`
    : `### 💳 Hóa Đơn Thanh Toán / Chuyển Khoản VietQR`;

  const targetNotification = customerId
    ? `> 🔔 **Yêu cầu thanh toán** gửi tới <@${customerId}> từ <@${creatorId}>\n\n`
    : '';

  const content = [
    `${targetNotification}${invoiceTitle}`,
    '',
    `• **Máy chủ**: **${serverName}**`,
    `• **Người tạo đơn**: <@${creatorId}>`,
    customerLine,
    `• **Ngân hàng**: **${bankDisplayName}** (\`${bankId.toUpperCase()}\`)`,
    `• **Số tài khoản**: \`${accountNo}\``,
    `• **Chủ tài khoản**: **${accountName.toUpperCase()}**`,
    `• **Số tiền cần thanh toán**: 💵 **${formattedAmount}**`,
    `• **Nội dung chuyển khoản**: \`${transferCode}\`${memoLine}`,
    '',
    `> ⚠️ **HƯỚNG DẪN THANH TOÁN**:`,
    `> 1. Mở ứng dụng Ngân hàng (MB, Vietcombank, Techcombank, MoMo...) và **Quét mã QR** bên dưới.`,
    `> 2. Giữ **chính xác nội dung chuyển khoản** \`${transferCode}\` để hệ thống tự động ghi nhận giao dịch.`,
  ].join('\n');

  return makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content },
          { type: ComponentType.Separator, accentColor: COLORS.SUCCESS },
          {
            type: ComponentType.MediaGallery,
            items: [
              {
                media: { url: mediaUrl },
                description: `Mã VietQR thanh toán ${formattedAmount}`,
              },
            ],
          },
        ],
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );
}

/**
 * Tùy chọn để tạo Container V2 hiển thị kết quả duyệt hoặc hủy hóa đơn.
 */
export interface PaymentResultContainerOptions {
  /** True nếu là duyệt thanh toán thành công, False nếu là hủy hóa đơn */
  isConfirm: boolean;
  /** Mã đơn thanh toán (TX...) */
  txId: string;
  /** Số tiền của hóa đơn (VNĐ) */
  amount: number;
  /** ID Discord của khách hàng */
  buyerId: string;
  /** Mô tả / dịch vụ của hóa đơn */
  description: string;
  /** ID Discord của nhân viên hoặc admin thực hiện thao tác */
  operatorId: string;
  /** Lý do hủy hoặc ghi chú khi duyệt */
  reason?: string | null;
}

/**
 * Tạo Container V2 hiển thị trạng thái hóa đơn sau khi Admin hoặc Staff duyệt hoặc hủy.
 * Tuân thủ chuẩn Discord Components V2: không chứa trường legacy content hoặc embeds.
 */
export function buildPaymentResultContainer(
  options: PaymentResultContainerOptions,
): BuildContainerResult {
  const { isConfirm, txId, amount, buyerId, description, operatorId, reason } = options;

  const statusTitle = isConfirm
    ? '### ✅ Hóa Đơn Thanh Toán Đã Xác Nhận'
    : '### ❌ Hóa Đơn Thanh Toán Đã Bị Hủy';

  const tagNotification = isConfirm
    ? `🎉 <@${buyerId}> Hóa đơn thanh toán của bạn đã được xác nhận!`
    : `⚠️ <@${buyerId}> Hóa đơn thanh toán đã bị hủy.`;

  const formattedAmount = `${amount.toLocaleString('vi-VN')} đ`;
  const noteLine = reason ? `\n• **Ghi chú**: \`${reason}\`` : '';

  const textLines = [
    statusTitle,
    '',
    `> ${tagNotification}`,
    '',
    `• **Mã đơn (TX)**: \`${txId}\``,
    `• **Số tiền**: **${formattedAmount}**`,
    `• **Khách hàng**: <@${buyerId}>`,
    `• **Dịch vụ**: \`${description}\``,
    `• **Người thực hiện**: <@${operatorId}>${noteLine}`,
  ].join('\n');

  return makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content: textLines },
          {
            type: ComponentType.Separator,
            accentColor: isConfirm ? COLORS.SUCCESS : COLORS.ERROR,
          },
        ],
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );
}
