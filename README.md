# Delta Bot (`bot-klb`) — Discord Bot

[![Version](https://img.shields.io/badge/version-1.14.0-informational.svg)](#)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)](https://discord.js.org/)
[![Architecture](https://img.shields.io/badge/architecture-vertical--slice-orange.svg)](#kiến-trúc-dự-án)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)

Discord Bot chuyên biệt cho cộng đồng người chơi **Delta Force** và quản trị máy chủ Discord, tích hợp **Discord Components V2**, **Hỗ trợ Song ngữ Tự động (i18n: Tiếng Việt ⟷ English)**, cào mật khẩu hằng ngày tự động, dashboard thống kê đồ họa chất lượng cao, thư viện Gunsmith meta, bản đồ 3D tương tác, tiện ích **DF Toolbox Extension (v1.9.3)** tự động nhập giftcode Garena, thanh toán hóa đơn VietQR động & cổng quyên góp PayOS, cùng cơ chế liên kết tài khoản game bảo mật bằng AES-256-GCM.

---

## 🌟 Tính năng Nổi bật

### 1. Delta Force Suite (`/df`)

- **Thống kê Mùa giải (`/df stats`)**: Hiển thị bảng tổng quan chỉ số chiến đấu, sinh tồn, kinh tế và tiểu đội qua ảnh dashboard sinh động được render động từ SVG.
- **Báo cáo Chiến đấu Ngày (`/df daily`)**: Tra cứu điểm thương tổn, số hồ sơ tài liệu (docs) thu hồi, số trận, K/D và tỷ lệ rút quân thành công trong ngày.
- **Lịch sử Trận đấu (`/df history`)**: Xem chi tiết kết quả các trận gần nhất (bản đồ, operator, kill, phần thưởng) có phân trang.
- **Chi tiết Trận đấu (`/df match`)**: Phân tích chuyên sâu thông số trận đánh cụ thể (autocomplete hỗ trợ chọn trận gần đây hoặc xem trận mới nhất).
- **Sảnh Triển Lãm Đồ Đỏ (`/df vault`)**: Trưng bày kho báu vật phẩm giá trị cao (đồ đỏ) thu thập được cùng tổng giá trị định giá.
- **Thị Trường & Chế Tác (`/df market`)**: Tra cứu giá vật phẩm realtime trên thị trường và công thức bàn chế tác tối ưu (hỗ trợ autocomplete).
- **Bản Đồ 3D Tương Tác (`/df map`)**: Cung cấp góc nhìn bản đồ chiến thuật trực quan, vị trí tài nguyên và cẩm nang học map.
- **Thư Viện Gunsmith Meta (`/df build` / `/df gun`)**: Tra cứu bảng ngọc, phụ kiện tối ưu và mã build súng chuẩn meta máy chủ Garena theo từng chế độ chơi.
- **Khuyến nghị Chế tạo Xưởng (`/df workshop`)**: Gợi ý các công thức sản xuất tối ưu tại Xưởng Căn Cứ Ngầm.
- **Mật khẩu 6 Bản đồ Hằng ngày (`/df code`)**:
  - Tự động cào dữ liệu từ Delta Force HQ với bộ đệm **Cache 30 phút** và **In-flight Promise Deduplication** chống nghẽn CPU.
  - Tự động gửi mật khẩu định kỳ theo lịch cron cấu hình riêng cho từng server (`/df code setchannel`, `/df code settime`).
- **Auto-Post Toàn Hệ Thống (`/df autopost`)**: Bot Owner quản lý chu kỳ tự động phát sóng bản đồ 3D và build súng meta định kỳ tới toàn bộ các guild.
- **Liên kết Tài khoản An toàn (`/df link`)**:
  - Hỗ trợ xác thực qua tiện ích Chrome Extension (**DF Toolbox**) bằng cơ chế Ủy quyền Chủ động (On-Demand Opt-In Claim API).
  - Mã hóa token người dùng bằng **AES-256-GCM** trước khi lưu vào cơ sở dữ liệu.
  - Người dùng có thể hủy liên kết và xóa dữ liệu bất kỳ lúc nào qua `/df unlink`.
- **Trung Tâm Trợ Giúp Đa Ngữ (`/df help`)**: Bảng cẩm nang 6 trang tích hợp điều hướng Components V2, tự động thích ứng ngôn ngữ client (`vi` hoặc `en`), kèm nút tải tiện ích mở rộng **DF Toolbox Extension**.

### 2. Tiện Ích Trình Duyệt: DF Toolbox Extension (v1.9.3)

- **Auto Redeem Giftcode Garena**: Tự động hóa quá trình nhập danh sách hàng trăm mã giftcode Delta Force trên trang đổi quà Garena CDK, tự bypass CSP và nhận diện kết quả tự động.
- **Floating Dashboard trực quan**: Gắn bảng điều khiển trực tiếp trên giao diện web đổi quà, hiển thị tiến độ, nhật ký, số mã thành công/thất bại theo thời gian thực.
- **Ủy quyền Chủ động (On-Demand Opt-In)**: Mặc định không thu thập dữ liệu; người dùng chủ động bấm "Bắt đầu Ủy quyền", xác nhận tài khoản (ID masked) và tick xác nhận đồng thuận trước khi gửi dữ liệu mã hóa TLS.
- **Quản lý Mã & Phân Trang**: Popup extension hiện đại hỗ trợ lọc mã theo trạng thái (Redeemed, Dead, Retryable, Untested) và phân trang tiện lợi.

### 3. Tìm Đội Chơi Game (`/team`)

- **Hệ thống LFG (`/team find`)**: Giao diện chọn bản đồ, chế độ chơi và mic tương tác qua Discord Components V2, tự động quản lý slot và điều phối kênh voice.

### 4. Hệ Thống Thanh Toán & Quyên Góp (`/pay` & `/donate`)

- **Hóa đơn VietQR Động (`/pay create`)**: Tạo mã QR thanh toán chuẩn VietQR (NAPAS 247) tự động điền số tiền và nội dung, hỗ trợ nút xác nhận/hủy và chấm điểm dịch vụ (1–5 ⭐).
- **Lịch sử & BXH Chi tiêu (`/pay history` & `/pay top`)**: Tra cứu lịch sử thanh toán cá nhân và vinh danh Top người ủng hộ server.
- **Quyên góp Duy trì Bot (`/donate`)**: Tạo link thanh toán PayOS ủng hộ chi phí vận hành máy chủ bot một cách minh bạch.

### 5. Quản trị Server Tập trung (`/config`)

- **RBAC per-guild (`/config roles`)**: Thiết lập phân quyền chi tiết cho Bot Admin, Moderator và Member theo từng server.
- **Cấu hình VietQR & Workflow (`/config vietqr`)**: Thiết lập số tài khoản ngân hàng nhận tiền, role nhân viên duyệt đơn, và kênh gửi đánh giá dịch vụ.
- **Mở Tính Năng QR Server (`/config qr-server`)**: Bot Owner cấp phép mở tính năng tạo hóa đơn VietQR cho từng máy chủ.
- **Hệ thống Chào mừng (`/config welcome`)**: Tự động gửi thông điệp chào đón và cấp role khi thành viên mới tham gia.
- **Hệ thống Tạm biệt (`/config leave`)**: Tự động thông báo khi thành viên rời máy chủ.
- **Cảm ơn Server Booster (`/config booster`)**: Tự động ghi nhận và trao role ưu đãi cho người ủng hộ server.
- **Quản lý Discord Components V2 (`/config container`)**: Trình chỉnh sửa cấu hình giao diện linh hoạt.
- **Thông Báo Toàn Hệ Thống (`/config bot`)**: Phát sóng tin tức, changelog phiên bản tới toàn bộ các guild.

---

## 📋 Danh mục Lệnh Slash Commands

> 📖 **Tra cứu đầy đủ 55 lệnh**: Xem chi tiết tại [**Ground Truth Command Catalog (`docs/COMMANDS_CATALOG.md`)**](docs/COMMANDS_CATALOG.md) — tài liệu duy nhất được sinh tự động và bảo vệ bởi CI Drift Guard.

<!-- COMMANDS_TABLE_START -->

| Lệnh (Slash Command) | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- |
| `/config roles set` | Server Owner / Admin | Thiết lập vai trò quản trị phân quyền RBAC (Admin, Mod, Member). |
| `/config roles view` | Server Owner / Admin | Xem cấu hình phân quyền vai trò hiện tại của máy chủ. |
| `/config welcome setchannel` | Quản trị viên | Chọn kênh gửi tin nhắn chào mừng thành viên mới. |
| `/config welcome setrole` | Quản trị viên | Chọn role tự động cấp cho thành viên mới khi vào máy chủ. |
| `/config welcome toggle` | Quản trị viên | Bật hoặc tắt hệ thống chào mừng thành viên mới. |
| `/config welcome status` | Quản trị viên | Xem trạng thái cấu hình hệ thống chào mừng hiện tại. |
| `/config welcome test` | Quản trị viên | Gửi tin nhắn chào mừng thử nghiệm để kiểm tra giao diện. |
| `/config leave setchannel` | Quản trị viên | Chọn kênh gửi thông báo khi thành viên rời máy chủ. |
| `/config leave toggle` | Quản trị viên | Bật hoặc tắt hệ thống thông báo thành viên rời máy chủ. |
| `/config leave status` | Quản trị viên | Xem trạng thái cấu hình thông báo thành viên rời máy chủ. |
| `/config leave test` | Quản trị viên | Gửi tin nhắn thông báo rời máy chủ thử nghiệm để xem trước. |
| `/config booster setchannel` | Quản trị viên | Chọn kênh gửi tin nhắn cảm ơn khi có thành viên Boost máy chủ. |
| `/config booster setrole` | Quản trị viên | Chọn role dành riêng cho Server Booster. |
| `/config booster toggle` | Quản trị viên | Bật hoặc tắt hệ thống thông báo cảm ơn Server Booster. |
| `/config booster status` | Quản trị viên | Xem trạng thái cấu hình cảm ơn Server Booster hiện tại. |
| `/config booster test` | Quản trị viên | Gửi tin nhắn cảm ơn Booster thử nghiệm để xem trước giao diện. |
| `/config container edit` | Quản trị viên | Chỉnh sửa giao diện tin nhắn Container V2 của máy chủ tương tác. |
| `/config container reset` | Quản trị viên | Đặt lại giao diện tin nhắn Container V2 về mẫu mặc định. |
| `/config bot guilds` | Thành viên | Xem danh sách các máy chủ mà bot đang tham gia (Bot Owner). |
| `/config bot setannouncechannel` | Server Owner / Admin | Thiết lập kênh nhận thông báo cập nhật tính năng mới từ bot. |
| `/config bot announce` | Bot Owner | Phát sóng thông báo cập nhật tới toàn bộ máy chủ (Bot Owner). |
| `/config qr-server toggle` | Bot Owner | Bật hoặc tắt tính năng QR thanh toán trả phí cho máy chủ (Bot Owner). |
| `/config qr-server status` | Bot Owner | Kiểm tra trạng thái cấp phép tính năng QR của máy chủ (Bot Owner). |
| `/config vietqr set` | Thành viên | Cấu hình thông tin tài khoản ngân hàng nhận tiền chuyển khoản VietQR. |
| `/config vietqr workflow` | Server Owner / Admin | Cấu hình quy trình duyệt đơn, role nhân viên và đánh giá feedback. |
| `/config vietqr status` | Quản trị viên | Xem thông tin tài khoản nhận tiền VietQR hiện tại của máy chủ. |
| `/config vietqr preview` | Quản trị viên | Tạo mã QR thanh toán thử nghiệm để quét kiểm tra số tài khoản. |
| `/config vietqr reset` | Thành viên | Gỡ bỏ và xóa toàn bộ thông tin tài khoản ngân hàng VietQR của máy chủ. |
| `/df link` | Thành viên | Liên kết tài khoản Delta Force HQ và nhận tiện ích mở rộng DF Toolbox. |
| `/df stats` | Thành viên | Xuất thẻ căn cước chiến binh (K/D, tỉ lệ rút quân, cấp bậc, số trận) & menu đổi mùa giải. |
| `/df daily` | Thành viên | Báo cáo tổng hợp hiệu suất tác chiến trong ngày hôm nay. |
| `/df history` | Thành viên | Xem lịch sử 1–20 trận gần nhất (operator, map, kết quả rút quân). |
| `/df vault` | Thành viên | Sảnh Triển Lãm Đồ Đỏ — Kho báu vật phẩm quý hiếm đã rút quân an toàn & tổng định giá. |
| `/df match` | Thành viên | Soi chi tiết kết quả 1 trận cụ thể (kèm gợi ý tự động 5 trận gần nhất). |
| `/df workshop` | Thành viên | Xem khuyến nghị sản xuất tối ưu tại Xưởng Căn Cứ Ngầm. |
| `/df market` | Thành viên | Tra cứu giá nguyên liệu thị trường & biên lợi nhuận chế tác bàn xưởng từ HQ API. |
| `/df unlink` | Thành viên | Hủy liên kết tài khoản Delta Force HQ khỏi tài khoản Discord của bạn. |
| `/df help` | Thành viên | Hiển thị cẩm nang hướng dẫn sử dụng Bot Delta toàn tập. |
| `/df map` | Thành viên | Cẩm nang bản đồ, soi két sắt, lối rút quân & liên kết mô phỏng 3D tại deltaforcetools.gg. |
| `/df build` | Thành viên | Thư viện build súng meta Garena, lọc theo chế độ/loại súng & copy mã 1-chạm. |
| `/df giftcode` | Thành viên | Nhận 280 mã giftcode tân thủ và công cụ tự động nhận quà. |
| `/df code show` | Thành viên | Bảng mật mã két sắt 6 bản đồ hôm nay (tự động cập nhật mỗi sáng). |
| `/df code status` | Thành viên | Kiểm tra trạng thái cập nhật mật mã két sắt hôm nay. |
| `/df code setchannel` | Quản trị viên | Cài đặt kênh tự động gửi mật mã két sắt 6 bản đồ mỗi ngày. |
| `/df code settime` | Quản trị viên | Cài đặt giờ tự động gửi mật mã két sắt hằng ngày (mặc định 08:00). |
| `/df code setadminchannel` | Quản trị viên | Cài đặt kênh nhận thông báo lỗi lịch trình gửi mã két sắt. |
| `/df autopost set` | Bot Owner | Cài đặt lịch tự động đăng cẩm nang bản đồ hoặc build súng meta. |
| `/df autopost toggle` | Bot Owner | Bật hoặc tắt hệ thống tự động đăng cẩm nang định kỳ. |
| `/df autopost status` | Bot Owner | Xem trạng thái các kênh tự động đăng bài của bot. |
| `/df autopost run` | Bot Owner | Kích hoạt gửi ngay cẩm nang bản đồ hoặc súng mà không cần chờ lịch. |
| `/pay create` | Thành viên | Tạo mã QR thanh toán VietQR chuyển khoản ngân hàng tự động. |
| `/pay history` | Thành viên | Xem lịch sử các giao dịch thanh toán VietQR của bạn trong máy chủ. |
| `/pay top` | Thành viên | Xem bảng xếp hạng top thành viên ủng hộ / chi tiêu nhiều nhất trong máy chủ. |
| `/donate` | Thành viên | Tạo link thanh toán PayOS ủng hộ nhà phát triển duy trì bot. |
| `/team` | Thành viên | Đăng tin tuyển hoặc tìm squad leo rank theo map, chế độ & điều phối voice chat tự động. |

<!-- COMMANDS_TABLE_END -->

---

## 🏗 Kiến trúc Dự án (Vertical Slice Architecture)

Repository được thiết kế theo ranh giới mô-đun độc lập nhằm giảm thiểu phụ thuộc chéo và dễ bảo trì:

```text
src/
├── app/                  # Application Layer: Orchestration & Startup sequence (bootstrap.ts)
├── infrastructure/       # Discord Infrastructure: Command loader, Event loader, Router
│   ├── i18n/             # Locale resolver (vi ⟷ en-US) & translation service
│   └── registry/         # Runtime command parser & SSOT registry
├── features/             # Feature Slices (Tự chứa commands, handlers, services riêng)
│   ├── delta-force/      # Nghiệp vụ game Delta Force (Stats, Daily, Code, LFG, Link)
│   ├── payment/          # Hệ thống thanh toán VietQR & cổng Donate PayOS
│   ├── welcome/          # Hệ thống chào đón thành viên mới
│   ├── booster/          # Hệ thống cảm ơn server booster
│   ├── container/        # Trình soạn thảo Discord Components V2
│   └── admin/            # Quản trị server và phân quyền RBAC
├── locales/              # Từ điển song ngữ SSOT (vi.ts, en.ts)
├── database/             # SQLite connection (better-sqlite3) & MongoDB repositories
├── services/             # Shared background services (Scraper, Crypto, Scheduler)
├── utils/                # Pure utilities, logging, container builders
└── types/                # Type declarations & Discord client augmentation
```

- **Module Resolution**: `node16` (mọi relative import bắt buộc có đuôi `.js`).
- **Bảo mật**: Mọi token và thông tin nhạy cảm được mã hóa qua AES-256-GCM. Không bao giờ lưu chat log công khai của người dùng.

- **Module Resolution**: `node16` (mọi relative import bắt buộc có đuôi `.js`).
- **Bảo mật**: Mọi token và thông tin nhạy cảm được mã hóa qua AES-256-GCM. Không bao giờ lưu chat log công khai của người dùng.

---

## 🚀 Cài đặt & Chạy cục bộ

### 1. Yêu cầu hệ thống

- **Node.js**: Phiên bản `>= 22.12.0`
- **npm**: Phiên bản đi kèm với Node.js

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
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. Railway sẽ tự động build và chạy bot mỗi khi bạn push code lên nhánh `main`.

### Render

1. Truy cập [render.com](https://render.com) → Chọn **New** → **Background Worker** _(quan trọng: không chọn Web Service vì bot Discord không có HTTP port để listen và sẽ bị sleep sau 15 phút)_.
2. Kết nối tới repo `bot-klb`.
3. Cấu hình:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Điền các Environment Variables tương ứng và bấm **Deploy**.

---

## 🛡️ Chính sách & Điều khoản

- 🔒 [Chính sách Bảo mật (Privacy Policy)](PRIVACY.md)
- 📜 [Điều khoản Dịch vụ (Terms of Service)](TERMS.md)

---

## 📄 Bản quyền & Tuyên bố từ chối trách nhiệm

- Dự án là một sản phẩm cộng đồng phi lợi nhuận, **không liên kết, không được tài trợ hoặc bảo trợ bởi** TiMi Studio Group, Team Jade, Level Infinite hay Garena.
- Mọi nhãn hiệu và tài sản đồ họa liên quan đến Delta Force thuộc bản quyền của chủ sở hữu tương ứng.
