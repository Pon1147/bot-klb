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
 * VietQR CDN trả về file SVG nhúng PNG dạng base64, hàm này bóc tách để lấy binary PNG chuẩn.
 */
export async function fetchVietQrImageBuffer(options: VietQrImageOptions): Promise<Buffer | null> {
  const url = buildVietQrImageUrl(options);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BotKLB-Discord/1.4' },
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

  const content = [
    `### 💳 Hóa Đơn Thanh Toán / Chuyển Khoản VietQR`,
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
