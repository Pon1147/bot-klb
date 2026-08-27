# KL BOT — Discord Bot

Discord bot cho server Delta Force, được phát triển bằng TypeScript và discord.js v14.

## Tính năng

### Delta Force Commands

- `/df-daily` — Báo cáo hoạt động hàng ngày (kill, reward, match history)
- `/df-stats` — Thống kê tài khoản theo mùa (rank, combat, economy, team)
- `/df-history` — Lịch sử trận đấu gần nhất
- `/df-code` — Hệ thống redeem code tự động (cron job, webhook notification)
- `/df-link start` — Liên kết tài khoản Garena với Discord
- `/df-unlink` — Hủy liên kết tài khoản
- `/df-team-find` — Tìm đồng đội theo bản đồ, độ khó, rank

### Container Editor

- `/container edit` — Chỉnh sửa welcome/leave/booster container settings qua interactive UI
- `/container reset` — Reset container về mặc định
- Hỗ trợ 15 phút session, live preview, color picker, text line management

### Server Management

- `/welcome` — Thiết lập welcome message (channel, role, toggle, status)
- `/booster` — Thiết lập booster message (channel, role, toggle, status)
- `/set-role` — Phân quyền admin cho commands

### Webhook API

- `POST /api/df/claim` — Xử lý claim code từ extension
- `POST /api/df/message` — Nhận message từ Discord webhook
- Encrypted credential storage (AES-256-GCM)

## Công nghệ

| Thành phần        | Chi tiết                          |
| ----------------- | --------------------------------- |
| **Ngôn ngữ**      | TypeScript                        |
| **Framework**     | discord.js v14                    |
| **Node.js**       | >= 22.12.0                        |
| **Database**      | SQLite3 (better-sqlite3)          |
| **HTTP Server**   | Express (webhook endpoint)        |
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
├── server/                   # Express webhook server
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
