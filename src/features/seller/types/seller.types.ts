/**
 * Type declarations cho Feature Seller (Quản lý Thợ Kéo & Thanh toán VietQR).
 */

export type TransactionStatus = 'pending' | 'confirmed' | 'cancelled';

/** Hồ sơ cấu hình QR ngân hàng của Thợ Kéo */
export interface SellerProfile {
  userId: string;
  guildId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Đơn giao dịch thanh toán dịch vụ kéo */
export interface SellerTransaction {
  txId: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  buyerId: string;
  sellerId: string;
  amount: number;
  description: string;
  status: TransactionStatus;
  note: string | null;
  processedBy: string | null;
  createdAt: number;
  processedAt: number | null;
}

/** Đánh giá từ khách hàng sau khi hoàn tất giao dịch */
export interface SellerReview {
  id: number;
  txId: string;
  sellerId: string;
  buyerId: string;
  rating: number; // 1 -> 5
  comment: string | null;
  createdAt: number;
}

/** Thông tin ngân hàng từ VietQR API */
export interface VietQrBank {
  id: number;
  name: string;
  shortName: string;
  code: string;
  bin: string;
  logo: string;
  transferSupported: number;
  lookupSupported: number;
}

/** Tùy chọn khi tạo VietQR payload */
export interface VietQrGenerateOptions {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  addInfo: string;
  template?: string;
}

/** Thống kê hoạt động của Thợ Kéo */
export interface SellerStats {
  sellerId: string;
  totalTransactions: number;
  confirmedCount: number;
  cancelledCount: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
}
