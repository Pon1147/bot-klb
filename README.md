# Discord Bot - Exclusive Server Bot

Bot Discord **độc quyền** được phát triển dành riêng cho server của bạn. Bot này sẽ xử lý **toàn bộ** các tính năng cần thiết: Welcome/Leave message, Ticket System, và nhiều tính năng khác.

## ✨ Features

### Core Features (đã lập kế hoạch & sẽ triển khai đầu tiên)

- **Welcome Message**: Gửi tin nhắn chào mừng thành viên mới (Container V2, auto-role, hình ảnh tùy chỉnh, live preview editor).
- **Leave Message**: Gửi thông báo khi thành viên rời server (Container V2).
- **Ticket System**: Hệ thống ticket đầy đủ (tạo ticket qua button, modal form, transcript tự động, close/reopen ticket, staff management, log ticket).
- **Moderation Commands**: Ban, kick, mute, warn, timeout…
- **Auto-role & Reaction Role**.
- **Logging System**: Log message delete/edit, member join/leave/update, channel changes…
- **Server Utilities**: Clear message, server info, user info, ping…

### Tính năng sẽ phát triển dần (có thể thêm theo nhu cầu)

- Leveling / XP system
- Music bot
- Giveaways
- Custom commands
- Anti-spam / Anti-raid
- Dashboard web (nếu cần sau này)

---

## 🛠️ Công nghệ & Ngôn ngữ sử dụng

| Thành phần                         | Chi tiết                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| **Ngôn ngữ chính**                 | TypeScript (Node.js)                                             |
| **Framework**                      | [discord.js](https://discord.js.org) **v14.26.4** (stable)       |
| **Minimum Node.js**                | 22.12.0+                                                         |
| **Environment variables**          | dotenv                                                           |
| **Database ban đầu**               | SQLite3 (nhẹ, nhanh, không cần server)                           |
| **Package manager**                | npm (hoặc pnpm/yarn tùy chọn)                                    |
| **Testing**                        | Jest (target 100% coverage)                                      |
| **Linter / Formatter**             | ESLint + Prettier                                                |
| **Command & Interaction Handling** | Modular handlers (slash commands, buttons, modals, select menus) |
| **Deployment**                     | PM2 / Docker (tùy chọn sau)                                      |

---

## 📁 Cấu trúc Repository (Modular Architecture)

```bash
/
├── src/
│   ├── commands/         # Tất cả slash commands (từng file riêng)
│   ├── events/           # Tất cả Discord events (guildMemberAdd, interactionCreate...)
│   ├── handlers/         # Loaders: commandHandler, eventHandler, componentHandler
│   ├── components/       # Buttons, Modals, Select Menus (tách riêng)
│   ├── utils/            # Helper functions, container builders, template resolution...
│   ├── database/         # Models & connection (SQLite/MongoDB)
│   ├── config/           # Config files (nếu cần)
│   └── index.ts          # Entry point chính
├── __tests__/            # Unit tests (Jest)
├── .env.example          # Template biến môi trường
├── .eslintrc.cjs         # ESLint configuration
├── .prettierrc           # Prettier configuration
├── jest.config.cjs       # Jest configuration
├── tsconfig.json         # TypeScript configuration
├── package.json
├── README.md
├── docs/                 # Tài liệu chi tiết functions, examples
├── logs/                 # (gitignore) - lưu log bot
└── .gitignore
```

---

## 🚀 Installation & Setup

1. **Clone repository**

   ```bash
   git clone <repository-url>
   cd bot_klb
   ```

2. **Thiết lập biến môi trường**

   Copy `.env.example` thành `.env` và điền đầy đủ thông tin (`token`, `clientId`, `guildId`…):

   ```bash
   copy .env.example .env
   ```

3. **Cài đặt dependencies**

   ```bash
   npm install
   ```

4. **Bật Privileged Intents**

   Kích hoạt **Server Members Intent** và **Message Content Intent** trên [Discord Developer Portal](https://discord.com/developers/applications).

5. **Deploy slash commands**

   Sẽ có script riêng để deploy commands.

6. **Chạy bot**

   ```bash
   npm run build
   npm start
   ```

   Hoặc sử dụng PM2 để chạy persistent:

   ```bash
   pm2 start dist/index.js --name discord-bot
   ```

---

## 📋 Workflow Phát Triển

1. Luôn research trên [discord.js.org](https://discord.js.org) và [discordjs.guide](https://discordjs.guide) trước khi viết bất kỳ tính năng nào.
2. Viết code theo **modular pattern** (mỗi command/event là 1 file riêng).
3. Test kỹ trên server development trước khi apply production.
4. Commit thường xuyên với message rõ ràng.
5. Double-check syntax và logic trước khi push.

---

## 🔒 Rules Cứng Khi Code (Phải tuân thủ 100%)

1. **Không hardcode** token, ID, config → bắt buộc dùng `process.env` hoặc config file.
2. **Phải dùng** `async/await` toàn bộ, không dùng `.then().catch()` thuần.
3. **Bắt buộc có** error handling toàn diện (`try-catch` + logging).
4. **Tất cả commands** phải export object có `data` (`SlashCommandBuilder`) và `execute` function.
5. **Sử dụng Builder classes** (`SlashCommandBuilder`, `ActionRowBuilder`, `ButtonBuilder`, `ModalBuilder`…) và Container V2 Components thay vì embeds cũ.
6. **Tên file**: `kebab-case` hoặc `camelCase` nhất quán.
7. **Comment code** bằng tiếng Việt hoặc English rõ ràng, có ý nghĩa.
8. **Luôn double-check** toàn bộ file sau khi viết (syntax, import, logic).
9. **Không được commit** file `.env` hoặc chứa token thật.
10. **Giữ code sạch**, dễ maintain, dễ mở rộng.

---

## 🧹 Clean Code Principles (Bắt buộc tuân thủ)

| #   | Nguyên tắc            | Quy tắc                                                |
| --- | --------------------- | ------------------------------------------------------ |
| 1   | Naming                | Tên có nghĩa, không dùng `a`, `b`, `c`, `temp`, `data` |
| 2   | Single Responsibility | 1 hàm = 1 nhiệm vụ, < 20 dòng                          |
| 3   | Self-Documenting      | Code tự giải thích, comment giải thích WHY             |
| 4   | Flat over Nested      | Dùng guard clauses, tránh nesting sâu                  |
| 5   | No Dead Code          | Xóa code thừa, unused imports, unused params           |
| 6   | Consistent Style      | Tuân thủ 1 code style (eslint/prettier)                |

---

## 🧪 Testing

- **Framework**: Jest
- **Mục tiêu**: 100% code coverage
- **Chạy test**: `npm test`
- **Xem coverage**: `npm run test:coverage`
- Mỗi feature **bắt buộc** có unit test trước khi merge
- TDD: Write test → Write code → Refactor

---

> **Mục tiêu:** Bot sạch, chuyên nghiệp, dễ bảo trì và có thể mở rộng vô hạn.  
> Bạn có thể bắt đầu code ngay từ file `src/index.js` hoặc handlers sau khi có README này.
