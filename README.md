# Delta Bot (`bot-klb`) — Discord Bot

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)](https://discord.js.org/)
[![Architecture](https://img.shields.io/badge/architecture-vertical--slice-orange.svg)](#kiến-trúc-dự-án)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)

Discord Bot chuyên biệt cho cộng đồng người chơi **Delta Force** và quản trị máy chủ Discord, tích hợp **Discord Components V2**, cào mật khẩu hằng ngày tự động, dashboard thống kê đồ họa chất lượng cao và cơ chế liên kết tài khoản game bảo mật bằng AES-256-GCM.

---

## 🌟 Tính năng Nổi bật

### 1. Delta Force Suite (`/df`)
* **Thống kê Mùa giải (`/df stats`)**: Hiển thị bảng tổng quan chỉ số chiến đấu, sinh tồn, kinh tế và tiểu đội qua ảnh dashboard sinh động được render động từ SVG.
* **Báo cáo Chiến đấu Ngày (`/df daily`)**: Tra cứu điểm thương tổn, số hồ sơ tài liệu (docs) thu hồi, số trận, K/D và tỷ lệ rút quân thành công trong ngày.
* **Lịch sử Trận đấu (`/df history`)**: Xem chi tiết kết quả các trận gần nhất (bản đồ, operator, kill, phần thưởng) có phân trang.
* **Khuyến nghị Chế tạo Xưởng (`/df workshop`)**: Gợi ý các công thức sản xuất tối ưu tại Xưởng Căn Cứ Ngầm.
* **Mật khẩu 6 Bản đồ Hằng ngày (`/df code`)**:
  * Tự động cào dữ liệu từ Delta Force HQ với bộ đệm **Cache 30 phút** và **In-flight Promise Deduplication** chống nghẽn CPU.
  * Tự động gửi mật khẩu định kỳ theo lịch cron cấu hình riêng cho từng server.
* **Liên kết Tài khoản An toàn (`/df link`)**:
  * Hỗ trợ xác thực qua tiện ích Chrome Extension (`garena-redeem-code`) bằng giao chế Webhook handoff.
  * Mã hóa token người dùng bằng **AES-256-GCM** trước khi lưu vào cơ sở dữ liệu.
  * Người dùng có thể hủy liên kết và xóa dữ liệu bất kỳ lúc nào qua `/df unlink`.

### 2. Tìm Đội Chơi Game (`/team`)
* **Hệ thống LFG (`/team find`)**: Giao diện chọn bản đồ, chế độ chơi và mic tương tác qua Discord Components V2, tự động quản lý slot và điều phối kênh voice.

### 3. Quản trị Server Tập trung (`/config`)
* **RBAC per-guild (`/config roles`)**: Thiết lập phân quyền chi tiết cho Bot Admin, Moderator và Member theo từng server.
* **Hệ thống Chào mừng (`/config welcome`)**: Tự động gửi thông điệp chào đón và cấp role khi thành viên mới tham gia.
* **Cảm ơn Server Booster (`/config booster`)**: Tự động ghi nhận và trao role ưu đãi cho người ủng hộ server.
* **Quản lý Discord Components V2 (`/config container`)**: Trình chỉnh sửa cấu hình giao diện linh hoạt.

---

## 📋 Danh mục Lệnh Slash Commands

| Nhóm lệnh | Lệnh con | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| **/df** | `stats` | Thành viên | Xem thống kê tài khoản theo mùa giải |
| | `daily` | Thành viên | Xem báo cáo trận đấu trong ngày |
| | `history [limit]` | Thành viên | Xem lịch sử 1–20 trận gần nhất |
| | `workshop` | Thành viên | Xem khuyến nghị sản xuất tại Xưởng Căn Cứ |
| | `code show` | Thành viên | Xem mật khẩu 6 bản đồ ngày hôm nay |
| | `code config` | Quản trị viên | Cấu hình kênh và lịch cron gửi code tự động |
| | `link start` | Thành viên | Bắt đầu quy trình liên kết tài khoản Delta Force |
| | `link status` | Thành viên | Kiểm tra trạng thái liên kết hiện tại |
| | `link manual` | Thành viên | Phương thức liên kết thủ công fallback |
| | `unlink` | Thành viên | Hủy liên kết và xóa toàn bộ dữ liệu game |
| **/team** | `find` | Thành viên | Mở giao diện tạo bài tìm đồng đội (LFG) |
| **/config** | `roles set` / `view` | Server Owner / Admin | Cấu hình role Bot Admin / Moderator / Member |
| | `welcome` | Quản trị viên | Cấu hình kênh, role và nội dung chào mừng |
| | `booster` | Quản trị viên | Cấu hình kênh, role và thông điệp tri ân booster |
| | `container` | Quản trị viên | Tùy chỉnh layout Discord Components V2 |

---

## 🏗 Kiến trúc Dự án (Vertical Slice Architecture)

Repository được thiết kế theo ranh giới mô-đun độc lập nhằm giảm thiểu phụ thuộc chéo và dễ bảo trì:

```text
src/
├── app/                  # Application Layer: Orchestration & Startup sequence (bootstrap.ts)
├── infrastructure/       # Discord Infrastructure: Command loader, Event loader, Router
├── features/             # Feature Slices (Tự chứa commands, handlers, services riêng)
│   ├── welcome/          # Hệ thống chào đón thành viên
│   ├── booster/          # Hệ thống cảm ơn server booster
│   ├── container/        # Trình soạn thảo Discord Components V2
│   ├── delta-force/      # Nghiệp vụ game Delta Force (Stats, Daily, Code, LFG, Link)
│   └── admin/            # Quản trị server và phân quyền RBAC
├── database/             # SQLite connection (better-sqlite3) & MongoDB repositories
├── services/             # Shared background services (Scraper, Crypto, Scheduler)
├── utils/                # Pure utilities, logging, container builders
└── types/                # Type declarations & Discord client augmentation
```

* **Module Resolution**: `node16` (mọi relative import bắt buộc có đuôi `.js`).
* **Bảo mật**: Mọi token và thông tin nhạy cảm được mã hóa qua AES-256-GCM. Không bao giờ lưu chat log công khai của người dùng.

---

## 🚀 Cài đặt & Chạy cục bộ

### 1. Yêu cầu hệ thống
* **Node.js**: Phiên bản `>= 22.12.0`
* **npm**: Phiên bản đi kèm với Node.js

### 2. Thiết lập môi trường
```bash
# 1. Clone repository
git clone https://github.com/Pon1147/bot-klb.git
cd bot-klb

# 2. Cài đặt dependencies
npm install

# 3. Tạo file cấu hình môi trường
cp .env.example .env
```

Điền các biến cần thiết trong file `.env`:
```env
BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_development_guild_id
DF_CRYPTO_KEY_V1=your_32_byte_hex_key
DF_LINK_CHANNEL_ID=your_admin_webhook_channel_id
DF_WEBHOOK_SECRET=your_secret
```

### 3. Chạy Bot
```bash
# Chạy ở chế độ phát triển (auto-reload qua tsx)
npm run dev

# Kiểm tra type và lint
npm run check
npm run lint

# Chạy test suite
npm test

# Build và chạy production
npm run build
npm start
```

---

## ☁️ Hướng dẫn Triển khai (Deployment)

### Railway (Khuyến nghị)
1. Truy cập [railway.app](https://railway.app) → Đăng nhập bằng GitHub.
2. Chọn **New Project** → **Deploy from GitHub repo** → chọn `bot-klb`.
3. Vào tab **Variables** và thêm các biến môi trường từ `.env.example`.
4. Cấu hình:
   * **Build Command**: `npm run build`
   * **Start Command**: `npm start`
5. Railway sẽ tự động build và chạy bot mỗi khi bạn push code lên nhánh `main`.

### Render
1. Truy cập [render.com](https://render.com) → Chọn **New** → **Background Worker** *(quan trọng: không chọn Web Service vì bot Discord không có HTTP port để listen và sẽ bị sleep sau 15 phút)*.
2. Kết nối tới repo `bot-klb`.
3. Cấu hình:
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `npm start`
4. Điền các Environment Variables tương ứng và bấm **Deploy**.

---

## 🛡️ Chính sách & Điều khoản

* 🔒 [Chính sách Bảo mật (Privacy Policy)](PRIVACY.md)
* 📜 [Điều khoản Dịch vụ (Terms of Service)](TERMS.md)

---

## 📄 Bản quyền & Tuyên bố từ chối trách nhiệm

* Dự án là một sản phẩm cộng đồng phi lợi nhuận, **không liên kết, không được tài trợ hoặc bảo trợ bởi** TiMi Studio Group, Team Jade, Level Infinite hay Garena.
* Mọi nhãn hiệu và tài sản đồ họa liên quan đến Delta Force thuộc bản quyền của chủ sở hữu tương ứng.
