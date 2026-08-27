/** Workshop (Xưởng Căn Cứ Ngầm) config — workbench sections & item mappings */

import { COLORS } from './container.variables.js';

/** Workbench ID → section display name & color */
export const WORKBENCH_SECTIONS: Record<string, { name: string; color: number }> = {
  '1002': { name: 'Sư đoàn Tác chiến Điện tử', color: COLORS.DF },
  '1005': { name: 'Bàn Chế Tác', color: 0xff8c00 },
  '1006': { name: 'Trạm Y Tế', color: 0xe74c3c },
  '1007': { name: 'Bàn Chế Tạo Giáp', color: 0x9b59b6 },
};

/** Workbench ID → item ID prefix (first 4 digits) for section detection */
export const WORKBENCH_ITEM_PREFIXES: Record<string, string> = {
  '1002': '15', // Personal equipment (15xxxxx)
  '1005': '11', // Ammunition (11xxxxx)
  '1006': '14', // Medical supplies (14xxxxx)
  '1007': '37', // Armor (37xxxxx)
};

/** Item ID → Vietnamese name (from collections_vi.js, filtered to workshop-relevant items) */
export const WORKSHOP_ITEM_NAMES: Record<string, string> = {
  // === Personal Equipment (15xxxxx) ===
  '15200000044': 'Đèn Pin Tác Chiến OLIGHT Warrior 3S',
  '15030010001': 'Sạc Dự Phòng Quân Dụng',
  '15030010002': 'Pin Lithium',
  '15030040001': 'Tròng kính',
  '15030040002': 'Camera',
  '15030040003': 'CPU',
  '15030040005': 'Ổ Cứng SSD',
  '15030040006': 'RAM',
  '15030040007': 'Bo Mạch Chủ ASOS',
  '15030040010': 'Màn Hình LCD',
  '15030040011': 'Đầu Đọc Thẻ UHF',
  '15030040012': 'Radio',
  '15030040013': 'Điện Thoại Di Động',
  '15030040014': 'Thiết Bị Gây Nhiễu',
  '15030050001': 'Card Đồ Họa',
  '15030050002': 'UAV Quân Sự',
  '15030050003': 'Bộ Vi Xử Lý Tự Lập Trình',
  '15030050004': 'Radio Quân Dụng',
  '15030050005': 'Card Âm Thanh HiFi',
  '15030050006': 'Camera Kỹ Thuật Số',
  '15030050007': 'Laptop',
  '15030050008': 'Máy Chủ Phiến',
  '15030050011': 'Tay Cầm GS5',
  '15030050012': 'Dãy Ổ Cứng Tốc Độ Cao',
  '15030050013': 'Ăngten SATCOM G.T.I.',
  '15030050014': 'Hộp Đen Máy Bay',
  '15030050016': 'Tấm Quang Năng',
  '15030050017': 'Đạn Pháo Quân Sự',
  '15030050018': 'Trạm Thông Tin - Điều Khiển Quân Sự',
  '15030050019': 'Chất Nổ Quân Dụng',
  '15080050034': 'Ống Nhòm Quân Đội',
  '15080050035': 'Thiết Bị Tạo Ảnh Nhiệt Quân Dụng',
  '15080050036': 'Ống Kính Góc Rộng',
  '15080050037': 'Card Âm Thanh Chuyên Nghiệp',
  '15080050038': 'Nhiệt Kế Điện Tử',
  '15080050105': 'Đèn Cắm Trại Quân Dụng',
  '15080050106': 'Túi Sinh Tồn',
  '15080050107': 'Diêm Đặc Biệt',
  '15080050108': 'Pin Đa Năng',
  '15080050110': 'Bộ Pin Sạc',
  '15080050111': 'Pin 9V',
  '15080050126': 'Điện Thoại Vệ Tinh',
  '15080050130': 'Động Cơ Điện',

  // === Ammunition (11xxxxx) ===
  '11050005001': '7,62x51mm M62',
  '11050005002': '7,62x51mm M61',
  '11050005003': '5,56x45mm M855',
  '11050005004': '5,56x45mm M855A1',
  '11050005005': '5,45x39mm PS',
  '11050005006': '5,45x39mm BS',
  '11050005007': '9x19mm PBP',
  '11050005008': '.45 ACP FMJ',
  '11060010001': 'Hộp Y Tế Dã Chiến',
  '11060010002': 'Combo Sửa Mũ Cao Cấp',

  // === Medical (14xxxxx) ===
  '14020000006': 'Combo Sửa Mũ Cao Cấp',
  '14020000007': 'Hộp Y Tế Dã Chiến',
  '14020000008': 'Bộ Truyền Dịch',
  '14020000009': 'Thanh Năng Lượng Quân Dụng',
  '14020000010': 'Máy Trợ Thở',

  // === Armor (37xxxxx) ===
  '37120500001': 'Giáp Titan',
  '37120500002': 'Giáp Đặc Nhiệm HMP',
  '37120500003': 'Giáp Xung Kích',
  '37120500004': 'Giáp Tác Chiến MK-2',
  '37120500005': 'Giáp Gốm',
  '37170500001': '7,62x51mm M61',
};

/** Format remaining_time (seconds) → HH:MM:SS string */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Format hourly income → locale string with money emoji */
export function formatHourlyIncome(hourlyIncome: string): string {
  const moneyEmoji = '<:icon9De6T9unB:1514474246779306115>';
  return `${moneyEmoji} ${Number(hourlyIncome).toLocaleString('vi-VN')}`;
}

/** Detect which workbench section an item belongs to by item ID prefix */
export function detectWorkbenchSection(itemPrefix: string): string | null {
  for (const [workbenchId, prefix] of Object.entries(WORKBENCH_ITEM_PREFIXES)) {
    if (itemPrefix.startsWith(prefix)) {
      return workbenchId;
    }
  }
  return null;
}
