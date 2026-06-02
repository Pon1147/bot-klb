# 🎫 Workflow: Ticket System — Tóm Tắt Kiến Trúc Và Luồng Hoạt Động

**Project:** bot_klb | **Branch:** `feat/KhoaLPD/ticket-system`  
**Tech Stack:** Discord.js v14, TypeScript, SQLite3, Container V2

---

## 📊 Tổng Quan

Hệ thống Ticket cho Discord Bot cho phép:

- **User** tạo ticket qua panel button → nhận channel riêng (voice + text)
- **Staff** claim, quản lý, đóng ticket
- **Auto-close** ticket sau thời gian không hoạt động
- **Container V2** cho tất cả UI (panel message, welcome, close panel)

| Thành Phần    | Số File | Mô Tả                                    |
| ------------- | ------- | ---------------------------------------- |
| Source        | 14      | Core logic, handlers, commands, database |
| Test          | 13      | Coverage cho từng module                 |
| Documentation | 1       | `PLAN.md` (438 dòng)                     |

---

## 🏗️ Kiến Trúc Tổng Thể

```markdown
┌──────────────────────────────────────────────────────────────┐
│                        Discord Bot                           │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────┐ │
│  │  Slash Cmd    │    │ Button Inter │    │ Voice State    │ │
│  │  /ticket *    │    │ ticket_*     │    │ Update Event   │ │
│  └──────┬───────┘    └──────┬───────┘    └───────┬────────┘ │
│         │                   │                    │           │
│         ▼                   ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              TicketFeature (index.ts)                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │ │
│  │  │ TicketState  │  │TicketService│  │ Voice Utils    │  │ │
│  │  │ (in-memory)  │  │  (CRUD+DB)  │  │ (voice chan)   │  │ │
│  │  └─────────────┘  └─────────────┘  └────────────────┘  │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         ▼                  ▼                  ▼             │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐        │
│  │ Handlers/  │    │ Commands/  │    │ Database   │        │
│  │ create     │    │ panel      │    │ SQLite3    │        │
│  │ close      │    │ manage     │    │ 3 tables   │        │
│  │ panel      │    │ settings   │    │            │        │
│  │ voice      │    │ info/list  │    │            │        │
│  └────────────┘    └────────────┘    └────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Luồng Workflow Chính

### 1️⃣ Setup Panel (Staff → Admin)

```markdown
┌──────────┐     ┌─────────────────────┐     ┌──────────────────┐
│ Admin    │────▶│ /ticket panel create│────▶│ Panel Handler    │
│ click cmd│     │                     │     │ (panel.handler)  │
└──────────┘     └─────────────────────┘     └────────┬─────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │ Create Panel DB  │
                                              │ Build Container  │
                                              │ V2 + Buttons     │
                                              │ Send to Channel  │
                                              └──────────────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │  🎫 Tạo Ticket   │
                                              │  [🛟 Hỗ Trợ]     │
                                              │  [💡 Đề Xuất]    │
                                              │  [🚨 Báo Cáo]    │
                                              └──────────────────┘
```

**Flow chi tiết:**

1. Admin chạy `/ticket panel create` (yêu cầu Administrator)
2. `handlePanelCreate` → gọi `createPanelMessage(feature, guild, channelId, buttons)`
3. `panel.handler.ts` build ActionRowBuilder với các button `ticket_create_<categoryId>`
4. Panel data (panelId, guildId, channelId, buttons) lưu vào DB `ticket_panels`
5. Gửi message Container V2 vào channel với title + description + button row
6. Lưu `messageId` vào DB panel record

---

### 2️⃣ Tạo Ticket (User → Panel Button)

```markdown
┌─────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  User   │────▶│ Click category   │────▶│ TicketFeature       │
│ click   │     │ button on panel  │     │ .handleButton()     │
└─────────┘     └──────────────────┘     └──────┬──────────────┘
                                                │
                                    customId: "ticket_create_support"
                                                │
                                    ┌───────────▼────────────┐
                                    │  create.handler.ts      │
                                    │  handleCreateTicket()   │
                                    └───────┬────────────────┘
                                            │
                          ┌─────────────────┼─────────────────┐
                          ▼                 ▼                 ▼
                  ┌───────────────┐ ┌───────────────┐ ┌──────────────┐
                  │ Cooldown Check│ │ Rate Limit    │ │ Create       │
                  │ (in-memory)   │ │ Check (DB)    │ │ Channels     │
                  └───────┬───────┘ └───────┬───────┘ └──────┬───────┘
                          │                 │                │
                          ▼                 ▼                ▼
                    allowed?            allowed?        Voice Channel
                    (5 min)             (max 3/user)    Text Channel
                          │                 │           Permission
                          ▼                 ▼           Overwrites
                   ┌──────┴────────────────┴──────┐    └──────┬───────┘
                   │  Tạo Voice + Text Channel    │           │
                   │  Lưu ticket vào DB + State   │           │
                   │  Gửi welcome message         │◀──────────┘
                   │  Set cooldown user           │
                   └─────────────────────────────┘
```

**Flow chi tiết:**

1. User click button `ticket_create_<categoryId>`
2. `TicketFeature.handleButton()` route based on customId
3. `handleCreateTicket()`:
   - **Cooldown Check**: `state.checkCooldown(userId, 5 phút)` → reject nếu chưa hết cooldown
   - **Rate Limit Check**: `service.checkRateLimit(guildId, userId, maxTicketsPerUser)` → reject nếu vượt quota (mặc định 3 tickets)
   - **Tạo Voice Channel**: `createTicketChannel()` → channel voice với permission overwrite (creator + staff connect/speak, @everyone deny view)
   - **Tạo Text Channel**: `createTextChannel()` → channel text với permission overwrite tương tự
   - **Lưu Ticket**: `service.createTicket()` → DB `tickets` table
   - **State Management**: `state.setActiveTicket()`, `state.setCooldown(userId)`
   - **Welcome Message**: Gửi Container V2 vào text channel (TextDisplay + close panel buttons)

---

### 3️⃣ Claim / Unclaim Ticket (Staff → Button)

```markdown
┌────────┐    ┌────────────────┐    ┌───────────────────────┐
│  Staff │───▶│ Click "Tiếp    │───▶│ TicketFeature         │
│ member │    │ Nhận" button   │    │ .handleButton()       │
└────────┘    └────────────────┘    └──────┬────────────────┘
                                           │
                              customId: "ticket_claim"
                                           │
                              ┌────────────▼────────────┐
                              │ close.handler.ts         │
                              │ handleClaimTicket()      │
                              └────────┬────────────────┘
                                       │
                               ┌───────▼───────┐
                               │ isStaffCheck()│
                               └───────┬───────┘
                                       │
                              ┌────────┴────────┐
                              │                  │
                    ┌─────────▼────────┐ ┌──────▼────────┐
                    │ User đang claim  │ │ User chưa     │
                    │ ticket này       │ │ claim         │
                    │ → UNCLAIM        │ │ → CLAIM       │
                    └────────┬─────────┘ └──────┬────────┘
                             │                  │
                    service.unclaim()   service.claim()
                    Update panel UI     Update panel UI +
                    (bỏ claim)          DB + state + notify
```

**Flow chi tiết:**

1. Staff click button `ticket_claim` trong ticket channel
2. `handleClaimTicket()`:
   - Kiểm tra staff role: `isStaffCheck()` → reject nếu không phải staff
   - Nếu đang claim → **Unclaim**: `service.unclaim()` → reset `claimantId`
   - Nếu chưa claim → **Claim**: `service.claim()` → set `claimantId = staffId`
   - Update panel UI: `interaction.update()` với Container thông báo

---

### 4️⃣ Đóng Ticket (Creator/Staff → Button)

```markdown
┌──────────┐    ┌─────────────────┐    ┌──────────────────────┐
│ Creator/ │────▶Click "Đóng      │────▶│ TicketFeature        │
│  Staff   │    │ Ticket" button  │    │ .handleButton()      │
└──────────┘    └─────────────────┘    └──────┬───────────────┘
                                              │
                                   customId: "ticket_close"
                                              │
                                   ┌──────────▼────────────┐
                                   │ close.handler.ts       │
                                   │ handleCloseTicket()    │
                                   └──────┬────────────────┘
                                          │
                                  ┌───────▼───────┐
                                  │ canCloseTicket│
                                  │ (creator|staff)│
                                  └───────┬───────┘
                                          │
                                   ┌──────▼──────┐
                                   │performClose │
                                   └────┬────┬───┘
                                        │    │
                          ┌─────────────┤    │
                          ▼             ▼    ▼
                    ┌──────────┐ ┌────────┐ ┌────────────┐
                    │ DB status│ │ Remove │ │ Delete     │
                    │ = closed │ │state   │ │ voice chan │
                    └──────────┘ └────────┘ └────────────┘
```

**Flow chi tiết:**

1. Creator hoặc Staff click button `ticket_close`
2. `handleCloseTicket()`:
   - Tìm ticket: `state.getActiveTicket(channelId)` → reject nếu không tìm thấy
   - Kiểm tra quyền: `canCloseTicket()` → phải là creator hoặc staff
   - `performClose()`:
     - `service.updateStatus('closed')` → cập nhật DB
     - `state.removeActiveTicket()` → xóa khỏi in-memory + clear timers
     - `deleteTicketChannel()` → xóa voice channel Discord
     - `service.deleteTicket()` → xóa record khỏi DB
   - `interaction.update()` → update UI thành success message

---

### 5️⃣ Auto-Close (Voice State → Timer)

```markdown
┌────────────────────┐
│ voiceStateUpdate   │──── oldState, newState
│ event fires        │
└────────┬───────────┘
         │
  ┌──────▼───────┐
  │ Has guild?   │──NO──▶ Return
  └──────┬───────┘
   YES   │
  ┌──────▼───────┐
  │ Has channel? │──NO──▶ Return
  └──────┬───────┘
   YES   │
  ┌──────▼────────────┐
  │ Active ticket?    │──NO──▶ Return
  │ hasActiveTicket() │
  └──────┬────────────┘
   YES   │
  ┌──────▼────────────┐
  │ Auto-close        │──NO──▶ Return
  │ enabled?          │
  └──────┬────────────┘
   YES   │
  ┌──────▼──────────────────────┐
  │ scheduleAutoClose()         │
  │                             │
  │  reminderTimer: N phút      │
  │  └─▶ Gửi reminder log       │
  │                             │
  │  autoCloseTimer: M phút     │
  │  └─▶ autoCloseTicket()      │
  │      ├─ DB status = closed  │
  │      ├─ Remove state        │
  │      └─ Delete DB record    │
  └─────────────────────────────┘
```

**Flow chi tiết:**

1. `voiceStateUpdate` event fire mỗi khi user join/leave voice channel
2. `handleVoiceStateUpdate()`:
   - Guard: phải có guild, phải có channelId
   - Guard: phải là active ticket channel
   - Guard: auto-close phải được enabled trong settings
3. `scheduleAutoClose(channelId, settings, closeCallback, reminderCallback)`:
   - Clear timer cũ nếu có
   - Set `autoCloseTimer`: default 30 phút → `autoCloseTicket()`
   - Set `reminderTimer`: default 5 phút trước khi close → log reminder

**Cleanup:**

- `TicketState.startCleanup()`: Interval 5 phút, dọn cooldown entries > 60 phút
- `TicketFeature.onShutdown()`: Stop cleanup + clear all timers

---

### 6️⃣ Slash Commands (`/ticket`)

```markdown
/ticket
├── panel
│   └── create          → Tạo panel ticket (Administrator)
│
├── manage
│   ├── close <channel> → Force close ticket bằng channel (Administrator)
│   └── claim <channel> → Force claim/unclaim ticket (Administrator)
│
├── settings
│   ├── view            → Xem settings hiện tại
│   └── set <field> <value> → Đổi setting (Administrator)
│       └── Fields: auto-close, timeout, max-tickets, max-users, close-panel
│
├── info                → Info ticket của channel hiện tại
└── list [status]       → List tickets (filter: open/pending/closed)
```

---

## 🗄️ Database Schema

### Table: `tickets`

| Column                       | Type                 | Notes                                 |
| ---------------------------- | -------------------- | ------------------------------------- |
| `id`                         | TEXT PK              | `ticket_timestamp_random`             |
| `guild_id`                   | TEXT NOT NULL        | Server ID                             |
| `channel_id`                 | TEXT UNIQUE NOT NULL | Voice channel ID (primary lookup key) |
| `text_channel_id`            | TEXT                 | Text channel ID (miễn phí migration)  |
| `creator_id`                 | TEXT NOT NULL        | User tạo ticket                       |
| `claimant_id`                | TEXT                 | Staff đang handle ticket              |
| `category`                   | TEXT NOT NULL        | `support` / `suggestion` / `report`   |
| `status`                     | TEXT                 | `open` / `pending` / `closed`         |
| `name`, `reason`, `metadata` | TEXT                 | Optional fields                       |
| `created_at`, `closed_at`    | TEXT                 | ISO timestamps                        |
| `transcript_id`              | TEXT                 | Link đến transcript                   |

### Table: `ticket_panels`

| Column                 | Type      | Notes                    |
| ---------------------- | --------- | ------------------------ |
| `panel_id`             | TEXT PK   | `panel_timestamp_random` |
| `guild_id`             | TEXT      | Server ID                |
| `channel_id`           | TEXT      | Channel chứa panel       |
| `message_id`           | TEXT      | Discord message ID       |
| `buttons`              | TEXT JSON | Mảng PanelButton         |
| `title`, `description` | TEXT      | Panel content            |
| `created_at`           | TEXT      | ISO timestamp            |

### Table: `ticket_settings`

| Column          | Type      | Notes                      |
| --------------- | --------- | -------------------------- |
| `guild_id`      | TEXT PK   | 1 settings/guild           |
| `settings_json` | TEXT JSON | Full TicketSettings object |
| `updated_at`    | TEXT      | ISO timestamp              |

---

## 🧠 In-Memory State (TicketState)

| Map               | Key         | Value       | Purpose                         |
| ----------------- | ----------- | ----------- | ------------------------------- |
| `activeTickets`   | `channelId` | `Ticket`    | Lookup nhanh ticket đang active |
| `cooldowns`       | `userId`    | `timestamp` | Cooldown tạo ticket (5 phút)    |
| `autoCloseTimers` | `channelId` | `Timeout`   | Timer auto-close                |
| `reminderTimers`  | `channelId` | `Timeout`   | Timer reminder trước close      |

**Special:** Active ticket lookup dual-key:

- **Primary**: Voice channel ID → `Map.get(channelId)`
- **Fallback**: Text channel ID → Loop qua `activeTickets.values()` so sánh `textChannelId`

**WHY:** Ticket buttons (close/claim) nằm trong text channel, nhưng ticket được lưu theo voice channel ID. Cần lookup từ cả 2 phía.

---

## 🔑 Default Settings

| Setting             | Giá Trị | Mô Tả                                    |
| ------------------- | ------- | ---------------------------------------- |
| Auto-close timeout  | 30 phút | Thời gian không hoạt động trước khi đóng |
| Auto-close reminder | 5 phút  | Reminder trước khi auto-close            |
| Max tickets/user    | 3       | Rate limit: số ticket mở tối đa          |
| Cooldown            | 5 phút  | Thời gian chờ giữa các lần tạo           |
| Max users/ticket    | 10      | Số user vào voice channel tối đa         |
| Close panel         | Enabled | Hiển thị nút close/claim                 |
| Staff roles         | `[]`    | Role IDs được config riêng               |

---

## 📂 File Structure

```markdown
src/
├── commands/ticket/
│   └── ticket.command.ts        # /ticket slash command (define + route)
│
├── features/
│   ├── index.ts                 # Barrel export + getTicketFeature()
│   ├── registry.ts             # Feature lifecycle manager
│   ├── types.ts                # Feature interface
│   └── ticket/
│       ├── index.ts            # TicketFeature class (entry point)
│       ├── service.ts          # TicketService (CRUD wrapper)
│       ├── state.ts            # TicketState (in-memory manager)
│       ├── voice.ts            # Voice channel utilities
│       ├── handlers/
│       │   ├── create.handler.ts   # handleCreateTicket
│       │   ├── close.handler.ts    # handleCloseTicket, handleClaimTicket
│       │   ├── panel.handler.ts    # buildClosePanelComponents, createPanelMessage
│       │   └── voice.handler.ts    # handleVoiceStateUpdate, autoCloseTicket
│       └── commands/
│           ├── panel.handler.ts    # handlePanelCreate
│           ├── manage.handler.ts   # handleTicketList, handleTicketManageClose/Claim
│           ├── settings.handler.ts # handleSettingsView, handleSettingsUpdate
│           └── info.handler.ts     # handleTicketInfo
│
├── database/
│   └── ticket.database.ts      # SQLite layer (3 tables + CRUD)
│
├── types/
│   └── ticket.types.ts         # TypeScript types + guards + converters
│
└── config/
    └── ticket.variables.ts     # Defaults, colors, categories, labels

__tests__/
├── ticket.database.test.ts
├── ticket-feature.test.ts
├── ticket-service.test.ts
├── ticket-panel.handler.test.ts
├── ticket-close.handler.test.ts
├── ticket-voice.handler.test.ts
├── ticket-feature-buttons.test.ts
├── ticket-coverage-missing.test.ts
├── ticket-command.test.ts
├── ticket-commands.test.ts
├── ticket-voice.test.ts
├── ticket-state.test.ts
└── ticket.types.test.ts
```

---

## 🔐 Permission Model

| Action                    | Yêu Cầu                  |
| ------------------------- | ------------------------ |
| Tạo ticket (panel button) | Thành viên server bất kỳ |
| Đóng ticket (button)      | Creator hoặc Staff       |
| Claim/Unclaim (button)    | Staff                    |
| `/ticket panel create`    | Administrator            |
| `/ticket manage *`        | Administrator            |
| `/ticket settings set`    | Administrator            |
| `/ticket settings view`   | Bất kỳ                   |
| `/ticket info`            | Administrator            |
| `/ticket list`            | Administrator            |

---

## 🧩 Event Routing

```markdown
interactionCreate
    │
    ▼
interaction.customId.startsWith("ticket_")
    │
    ├── "ticket_create_<categoryId>"  → handleCreateTicket()
    ├── "ticket_close"                 → handleCloseTicket()
    └── "ticket_claim"                 → handleClaimTicket()

voiceStateUpdate
    │
    ▼
handleVoiceStateUpdate()
    │
    └── scheduleAutoClose() / resetTimers()
```

---

## 🚀 Lifecycle (Feature Registration)

```markdown
Bot Startup
    │
    ▼
FeatureRegistry.onPreload()      → (noop)
    │
    ▼
FeatureRegistry.provideCommands() → register /ticket slash command
    │
    ▼
FeatureRegistry.onPostload()     → (noop)
    │
    ▼
TicketFeature.setService(db)     → khởi tạo TicketService + singleton
    │
    ▼
FeatureRegistry.onReady()
    ├── register voiceStateUpdate listener
    ├── start state cleanup interval (5 phút)
    └── log: "Voice state listener registered"
    │
    ▼
Bot Running
    │
    ▼
FeatureRegistry.onShutdown()
    ├── stop cleanup interval
    ├── clear all auto-close timers
    └── log: "Shutdown. N ticket(s) in memory."
```

---

## ✨ Design Patterns Sử Dụng

| Pattern              | Vị Trí                           | Mô Tả                             |
| -------------------- | -------------------------------- | --------------------------------- |
| **Singleton**        | `TicketService`, `TicketFeature` | Global access qua getter          |
| **Repository**       | `ticket.database.ts`             | CRUD abstraction layer            |
| **Service Layer**    | `TicketService`                  | Business logic wrapper            |
| **State Management** | `TicketState`                    | In-memory reactive state          |
| **Guard Clauses**    | All handlers                     | Flat control flow, giảm nesting   |
| **Strategy**         | Button routing                   | CustomId prefix → handler mapping |
| **Builder Pattern**  | Panel/Close components           | ActionRowBuilder + ButtonBuilder  |
