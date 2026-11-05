# Delta Bot (`bot-klb`) — Discord Bot

[![Version](https://img.shields.io/badge/version-1.2.1-informational.svg)](#)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)](https://discord.js.org/)
[![Architecture](https://img.shields.io/badge/architecture-vertical--slice-orange.svg)](#kiến-trúc-dự-án)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)

Discord Bot chuyên biệt cho cộng đồng người chơi **Delta Force** và quản trị máy chủ Discord, tích hợp **Discord Components V2**, cào mật khẩu hằng ngày tự động, dashboard thống kê đồ họa chất lượng cao, thư viện Gunsmith meta, bản đồ 3D tương tác, tiện ích **DF Toolbox Extension (v1.2.1)** tự động nhập giftcode Garena, và cơ chế liên kết tài khoản game bảo mật bằng AES-256-GCM.

---

## 🌟 Tính năng Nổi bật

### 1. Delta Force Suite (`/df`)
* **Thống kê Mùa giải (`/df stats`)**: Hiển thị bảng tổng quan chỉ số chiến đấu, sinh tồn, kinh tế và tiểu đội qua ảnh dashboard sinh động được render động từ SVG.
* **Báo cáo Chiến đấu Ngày (`/df daily`)**: Tra cứu điểm thương tổn, số hồ sơ tài liệu (docs) thu hồi, số trận, K/D và tỷ lệ rút quân thành công trong ngày.
* **Lịch sử Trận đấu (`/df history`)**: Xem chi tiết kết quả các trận gần nhất (bản đồ, operator, kill, phần thưởng) có phân trang.
* **Chi tiết Trận đấu (`/df match`)**: Phân tích chuyên sâu thông số trận đánh cụ thể (autocomplete hỗ trợ chọn trận gần đây hoặc xem trận mới nhất).
* **Sảnh Triển Lãm Đồ Đỏ (`/df vault`)**: Trưng bày kho báu vật phẩm giá trị cao (đồ đỏ) thu thập được cùng tổng giá trị định giá.
* **Thị Trường & Chế Tác (`/df market`)**: Tra cứu giá vật phẩm realtime trên thị trường và công thức bàn chế tác tối ưu (hỗ trợ autocomplete).
* **Bản Đồ 3D Tương Tác (`/df map`)**: Cung cấp góc nhìn bản đồ chiến thuật trực quan, vị trí tài nguyên và cẩm nang học map.
* **Thư Viện Gunsmith Meta (`/df build` / `/df gun`)**: Tra cứu bảng ngọc, phụ kiện tối ưu và mã build súng chuẩn meta máy chủ Garena theo từng chế độ chơi.
* **Khuyến nghị Chế tạo Xưởng (`/df workshop`)**: Gợi ý các công thức sản xuất tối ưu tại Xưởng Căn Cứ Ngầm.
* **Mật khẩu 6 Bản đồ Hằng ngày (`/df code`)**:
  * Tự động cào dữ liệu từ Delta Force HQ với bộ đệm **Cache 30 phút** và **In-flight Promise Deduplication** chống nghẽn CPU.
  * Tự động gửi mật khẩu định kỳ theo lịch cron cấu hình riêng cho từng server.
* **Auto-Post Toàn Hệ Thống (`/df autopost`)**: Bot Owner quản lý chu kỳ tự động phát sóng bản đồ 3D và build súng meta định kỳ tới toàn bộ các guild.
* **Liên kết Tài khoản An toàn (`/df link`)**:
  * Hỗ trợ xác thực qua tiện ích Chrome Extension (**DF Toolbox**) bằng cơ chế Webhook handoff.
  * Mã hóa token người dùng bằng **AES-256-GCM** trước khi lưu vào cơ sở dữ liệu.
  * Người dùng có thể hủy liên kết và xóa dữ liệu bất kỳ lúc nào qua `/df unlink`.
* **Trợ Giúp & Tải Tiện Ích (`/df help`)**: Bảng cẩm nang hướng dẫn sử dụng và nút tải nhanh tiện ích mở rộng **DF Toolbox Extension** trực tiếp từ bot.

### 2. Tiện Ích Trình Duyệt: DF Toolbox Extension (v1.2.1)
* **Auto Redeem Giftcode Garena**: Tự động hóa quá trình nhập danh sách hàng trăm mã giftcode Delta Force trên trang đổi quà Garena CDK, tự bypass CSP và nhận diện kết quả tự động.
* **Floating Dashboard trực quan**: Gắn bảng điều khiển trực tiếp trên giao diện web đổi quà, hiển thị tiến độ, nhật ký, số mã thành công/thất bại theo thời gian thực.
* **Auth State Engine & Cloud Relay**: Tự động trích xuất và đồng bộ session/token game an toàn với máy chủ bot qua webhook một chạm.
* **Quản lý Mã & Phân Trang**: Popup extension hiện đại hỗ trợ lọc mã theo trạng thái (Redeemed, Dead, Retryable, Untested) và phân trang tiện lợi.

### 3. Tìm Đội Chơi Game (`/team`)
* **Hệ thống LFG (`/team find`)**: Giao diện chọn bản đồ, chế độ chơi và mic tương tác qua Discord Components V2, tự động quản lý slot và điều phối kênh voice.

### 4. Quản trị Server Tập trung (`/config`)
* **RBAC per-guild (`/config roles`)**: Thiết lập phân quyền chi tiết cho Bot Admin, Moderator và Member theo từng server.
* **Hệ thống Chào mừng (`/config welcome`)**: Tự động gửi thông điệp chào đón và cấp role khi thành viên mới tham gia (hỗ trợ lệnh `test` kiểm tra hiển thị).
* **Hệ thống Tạm biệt (`/config leave`)**: Tự động thông báo khi thành viên rời máy chủ.
* **Cảm ơn Server Booster (`/config booster`)**: Tự động ghi nhận và trao role ưu đãi cho người ủng hộ server.
* **Quản lý Discord Components V2 (`/config container`)**: Trình chỉnh sửa cấu hình giao diện linh hoạt.

---

## 📋 Danh mục Lệnh Slash Commands

| Nhóm lệnh | Lệnh con | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| **/df** | `stats` | Thành viên | Xem thống kê tài khoản theo mùa giải |
| | `daily` | Thành viên | Xem báo cáo trận đấu trong ngày |
| | `history [limit]` | Thành viên | Xem lịch sử 1–20 trận gần nhất |
| | `match [match_id]` | Thành viên | Xem chi tiết kết quả & phân tích trận đấu |
| | `vault` | Thành viên | Sảnh Triển Lãm Đồ Đỏ: Xem kho báu vật phẩm giá trị cao |
| | `market [item]` | Thành viên | Tra cứu giá thị trường và bàn chế tác realtime |
| | `map` | Thành viên | Mô phỏng bản đồ 3D tương tác và cẩm nang học map |
| | `build` / `gun [weapon] [mode]` | Thành viên | Thư viện build súng và mã Gunsmith meta (Garena) |
| | `workshop` | Thành viên | Xem khuyến nghị sản xuất tại Xưởng Căn Cứ |
| | `code show [page]` | Thành viên | Xem mật khẩu 6 bản đồ ngày hôm nay (hỗ trợ phân trang) |
| | `code status` | Thành viên | Xem kênh và lịch cấu hình gửi mật khẩu hằng ngày |
| | `code setchannel <channel>` | Quản trị viên | Đặt channel tự động gửi mật khẩu mỗi ngày |
| | `code settime <time>` | Quản trị viên | Đặt giờ gửi mật khẩu hằng ngày (định dạng HH:mm) |
| | `code setadminchannel <channel>`| Quản trị viên | Đặt channel nhận cảnh báo khi bot cào mật khẩu gặp sự cố |
| | `link start` | Thành viên | Bắt đầu quy trình liên kết tài khoản Delta Force |
| | `link status` | Thành viên | Kiểm tra trạng thái liên kết tài khoản hiện tại |
| | `unlink` | Thành viên | Hủy liên kết và xóa dữ liệu tài khoản game khỏi hệ thống |
| | `help` | Thành viên | Xem hướng dẫn sử dụng và tải tiện ích DF Toolbox Extension |
| | `autopost set <type> <hours>` | Bot Owner | Cấu hình chu kỳ phát sóng tự động bản đồ / súng meta |
| | `autopost toggle <type> <bool>`| Bot Owner | Bật hoặc tắt tự động phát sóng nội dung |
| | `autopost status` | Bot Owner | Xem trạng thái cấu hình Auto-Post toàn hệ thống |
| | `autopost run <type>` | Bot Owner | Bắn thử nghiệm ngay lập tức 1 đợt phát sóng tới các server |
| **/team** | `find` | Thành viên | Mở giao diện tạo bài tìm đồng đội (LFG) |
| **/config** | `roles set` / `view` | Server Owner / Admin | Cấu hình role Bot Admin / Moderator / Member |
| | `welcome setchannel` / `setrole` / `toggle` / `status` / `test` | Quản trị viên | Cấu hình kênh, role, bật tắt và test thông điệp chào mừng |
| | `leave setchannel` / `toggle` / `status` / `test` | Quản trị viên | Cấu hình kênh, bật tắt và test thông báo tạm biệt thành viên |
| | `booster setchannel` / `setrole` / `toggle` / `status` / `test` | Quản trị viên | Cấu hình kênh, role, bật tắt và test thông điệp tri ân booster |
| | `container edit` / `reset` | Quản trị viên | Tùy chỉnh layout Discord Components V2 tương tác |

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
