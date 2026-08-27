# KL BOT — Discord Bot

Discord bot cho server Delta Force, được phát triển bằng TypeScript và discord.js v14.

## Slash Commands

### Delta Force (`/df-*`)

- `/df-daily` — Trạng thái chiến đấu hàng ngày (thương, số docs, số trận, K/D, tỉ lệ rút quân)
- `/df-stats` — Thống kê tài khoản theo mùa (rank, combat, economy, team). Có select menu chọn season
- `/df-history` — Lịch sử trận đấu gần nhất (map, operator, kết quả, kill, reward). Phân trang
- `/df-code` — Mật khẩu hằng ngày của 6 map (Zero Dam, Layali, Brakkesh, AZ3, Space City, Tide Prison). Có subcommand `setchannel`, `setrole`, `toggle`, `status`, `settime`
- `/df-link start` — Tạo claim code 6 ký tự, gửi script qua DM, hướng dẫn user link
- `/df-link status` — Kiểm tra trạng thái link (mask identifier, last_ok_at)
- `/df-link manual` — Fallback: user paste openid + token
- `/df-unlink` — Hủy liên kết tài khoản Delta Force
- `/df-team-find` — Tìm đồng đội theo bản đồ và chế độ (select menu flow)

### Container (`/container`)

- `/container edit` — Chỉnh sửa welcome/leave/booster container settings qua interactive UI
- `/container reset` — Reset container về mặc định

### Server Setup

- `/welcome main` — Cấu hình hệ thống chào thành viên mới
- `/welcome setchannel` — Chọn kênh gửi tin nhắn chào
- `/welcome setrole` — Chọn role cấp khi thành viên join
- `/welcome toggle` — Bật hoặc tắt hệ thống welcome
- `/welcome status` — Xem cấu hình welcome hiện tại
- `/booster main` — Cấu hình hệ thống cảm ơn booster
- `/booster setchannel` — Chọn kênh gửi tin nhắn cảm ơn booster
- `/booster setrole` — Chọn role cấp khi boost
- `/booster toggle` — Bật hoặc tắt hệ thống booster
- `/booster status` — Xem cấu hình booster hiện tại

### Admin

- `/set-role` — Cấu hình role IDs cho RBAC (owner, moderator, container)

## Công nghệ

| Thành phần        | Chi tiết                          |
| ----------------- | --------------------------------- |
| **Ngôn ngữ**      | TypeScript                        |
| **Framework**     | discord.js v14                    |
| **Node.js**       | >= 22.12.0                        |
| **Database**      | SQLite3 (better-sqlite3)          |
| **Testing**       | Jest                              |
| **Package manager** | npm                            |

## Cài đặt

### 1. Clone và cài đặt

```bash
git clone <repository-url>
cd bot_klb
npm install
```

### 2. Cấu hình biến môi trường

```bash
copy .env.example .env
```

Sửa `.env` và điền thông tin:

```env
BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_bot_client_id
GUILD_ID=your_guild_id
DATABASE_PATH=./data/bot.db
WEBHOOK_PORT=3500
DF_WEBHOOK_SECRET=your_secret
DF_LINK_CHANNEL_ID=channel_id_for_link
DF_CLAIM_WEBHOOK_URL=https://discord.com/api/webhooks/...
DF_CRED_KEY_V1=base64_32byte_encryption_key
```

### 3. Chạy bot

```bash
# Development (auto-reload)
npm run dev

# Production
npm run build
npm start
```

### 4. Bật Privileged Intents

Mở [Discord Developer Portal](https://discord.com/developers/applications), kích hoạt:

- **Server Members Intent**
- **Message Content Intent**

## Cấu trúc

```bash
src/
├── index.ts                  # Entry point, 13-step boot sequence
├── config/                   # Bot config, intents, variables
├── database/                 # SQLite schema + queries
├── commands/
│   ├── df/                   # Delta Force commands (monolithic)
│   ├── container/            # Container editor
│   ├── welcome/              # Welcome message setup
│   ├── booster/              # Booster message setup
│   └── admin/                # Admin commands
├── events/                   # Discord event handlers
├── handlers/                 # Command/event loaders
├── services/                 # SettingsService, API, scraper, crypto
├── utils/                    # Helpers, guards, container utils
└── types/                    # TypeScript declarations
```

## Chạy tests

```bash
npm run test             # Chạy tất cả tests
npm run test:coverage    # Xem coverage report
npm run check            # Type check (tsc --noEmit)
```

## Extension Chrome

Extension **DF Toolbox** đi kèm bot, cung cấp:

- **Redeem Codes**: Tự động đổi code trên Garena
- **Discord Link**: Liên kết tài khoản Garena ↔ Discord
- **Auth State Engine**: Theo dõi auth token, refresh flow

Xem hướng dẫn: [garena-redeem-code/README.md](garena-redeem-code/README.md)

## Quy tắc Commit

```
<type>[scope]: <subject>

- description_1
- description_2
```

**Type:** `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `chore` | `build` | `ci` | `temp`

**Ví dụ:**

```
refactor: xóa dead code và chuẩn hóa comments

- xóa 2 file không dùng: df-tools-client.ts, config/index.ts
- xóa 6 hàm không có caller
- dịch 14 comments tiếng Anh sang tiếng Việt có dấu
- thêm cache 30s cho df-stats select handler
```

## Hỗ trợ

Discord server: [https://discord.gg/vz6w6c3Xe3](https://discord.gg/vz6w6c3Xe3)

**Author:** Pon1147
