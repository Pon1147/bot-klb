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

export interface VietQrContainerOptions {
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
  transferCode: string;
  memo?: string | null;
  serverName: string;
  requestedBy: string;
}

/**
 * Tạo Container V2 hiển thị mã thanh toán VietQR kèm đầy đủ thông tin giao dịch.
 */
export function buildVietQrContainer(options: VietQrContainerOptions): BuildContainerResult {
  const { bankId, accountNo, accountName, amount, transferCode, memo, serverName, requestedBy } =
    options;

  const bankDisplayName = SUPPORTED_BANKS[bankId.toUpperCase()] ?? bankId.toUpperCase();
  const formattedAmount = `${amount.toLocaleString('vi-VN')} đ`;
  const qrUrl = buildVietQrImageUrl({
    bankId,
    accountNo,
    accountName,
    amount,
    addInfo: transferCode,
    template: 'compact2',
  });

  const memoLine = memo ? `\n• **Ghi chú**: \`${memo}\`` : '';

  const content = [
    `### 💳 Thanh Toán / Chuyển Khoản Qua VietQR`,
    '',
    `• **Máy chủ**: **${serverName}**`,
    `• **Người tạo yêu cầu**: <@${requestedBy}>`,
    `• **Ngân hàng**: **${bankDisplayName}** (\`${bankId.toUpperCase()}\`)`,
    `• **Số tài khoản**: \`${accountNo}\``,
    `• **Chủ tài khoản**: **${accountName.toUpperCase()}**`,
    `• **Số tiền thanh toán**: 💵 **${formattedAmount}**`,
    `• **Nội dung chuyển khoản**: \`${transferCode}\`${memoLine}`,
    '',
    `> ⚠️ **LƯU Ý QUAN TRỌNG**:`,
    `> 1. Quét mã QR bên dưới bằng ứng dụng Ngân hàng bất kỳ (MB, Vietcombank, Techcombank, MoMo...).`,
    `> 2. Giữ **nguyên vẹn nội dung chuyển khoản** \`${transferCode}\` để hệ thống tự động xác nhận giao dịch.`,
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
                media: { url: qrUrl },
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
