# Kế Hoạch Kỹ Thuật (Technical Plan V4): Tối Ưu Lời Chào Server Mới & Tái Cấu Trúc Toàn Diện /df help

- **Mã kế hoạch:** `PLAN-20261105-REVAMP-V4`
- **Nhánh Git cách ly:** `feat/rename-bot-to-bot-delta`
- **Trạng thái:** BẢN KẾ HOẠCH KỸ THUẬT V4 HOÀN THIỆN (Chờ Project Owner phê duyệt — TUYỆT ĐỐI KHÔNG CHỈNH SỬA CODE PRODUCTION)
- **Văn bản tuân thủ:**
  - `docs/engineering/REFACTORING_CONTRACT.md` (Đường dẫn thực tế đã được xác minh)
  - `AGENTS.md` (Điều 7 - Mandatory Refactoring Contract & Điều 8 - Kỷ luật Git & Branch Isolation)

---

## 1. Căn Cứ Xác Minh Mã Nguồn & Phân Loại Bằng Chứng Kỹ Thuật (Evidentiary Audit)

Để đảm bảo tính trung thực theo Refactoring Contract, toàn bộ nhận định kỹ thuật trong kế hoạch được phân loại rạch ròi theo 4 cấp độ bằng chứng:

1. **`VERIFIED (Mã nguồn)`**: Đã đối chiếu trực tiếp file, dòng code cụ thể trong repository.
2. **`VERIFIED (Runtime command)`**: Đã thực thi lệnh thực tế trong môi trường terminal của dự án và ghi nhận kết quả.
3. **`INFERRED (Đặc tả Discord)`**: Suy luận kỹ thuật từ tài liệu Discord Developer Portal hoặc thư viện `discord-api-types/v10`.
4. **`DESIGN DECISION (Kế hoạch V4)`**: Quyết định thiết kế kiến trúc mới đề xuất cho lần refactor này.

### Bảng Đối Chiếu Chi Tiết

| Hạng mục                                   | Nhận định kỹ thuật                                                                                                                                                                                       | Căn cứ & Bằng chứng kiểm chứng                                                                                                                                            |       Phân loại trạng thái        |
| :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------: |
| **Giá trị cờ Components V2**               | Giá trị số của `MessageFlags.IsComponentsV2` là `32768` (`1 << 15`), không phải `8192` (`SuppressNotifications`).                                                                                        | `node -e "const {MessageFlags} = require('discord.js'); console.log(MessageFlags.IsComponentsV2);"` $\rightarrow$ Output: `32768`.                                        |  **VERIFIED (Runtime command)**   |
| **Giới hạn Discord Components V2**         | Hỗ trợ tối đa 40 components trong 1 tin nhắn. Action Row tối đa 5 buttons hoặc 1 select menu (tối đa 25 options).                                                                                        | Tài liệu Discord Developer Portal (Message Components) & `discord-api-types/v10.d.ts`.                                                                                    |   **INFERRED (Đặc tả Discord)**   |
| **Lắng nghe sự kiện `guildCreate`**        | Client bot đăng ký lắng nghe sự kiện `Events.GuildCreate` để gọi `handleGuildCreate(client, guild)`.                                                                                                     | `src/events/guildCreate.event.ts:1-12`: Đăng ký `Events.GuildCreate`.                                                                                                     |      **VERIFIED (Mã nguồn)**      |
| **Vòng đời Gateway Guild Events**          | Gateway gửi `GUILD_CREATE` ban đầu được Discord.js gom vào `ready`. Discord.js phát `guildAvailable` nếu guild unavailable lúc startup sau đó online; phát `guildCreate` khi bot được add vào guild mới. | Tài liệu Discord Gateway Lifecycle & Discord.js Client Event Specifications.                                                                                              |   **INFERRED (Đặc tả Discord)**   |
| **Cơ chế tải Extension ZIP**               | Nút `[ Tải tiện ích ]` tạo ra một `ButtonInteraction` mới, phải được phản hồi bằng `interaction.reply({ flags: Ephemeral, files })`.                                                                     | `src/features/delta-force/help.handler.ts:200-217` (Code cũ gọi followUp trái phép).                                                                                      | **DESIGN DECISION (Kế hoạch V4)** |
| **Hợp đồng `claimGuildWelcome()`**         | Trả về `true` (mới claim), `false` (đã có bản ghi), throw exception khi DB lỗi (Fail-Closed).                                                                                                            | Đặc tả hàm chi tiết tại Mục 5.1 của kế hoạch.                                                                                                                             | **DESIGN DECISION (Kế hoạch V4)** |
| **Phân quyền `/df help` khi chưa có RBAC** | Khi guild chưa cấu hình `memberRoleId`, `resolvePolicy` tự động mở quyền cho toàn bộ thành viên (`EVERYONE`).                                                                                            | `src/config/permissions.ts:358-360`:<br>`if (!memberRoleId) return { allowed: true, matchedAuthority: 'EVERYONE' };`                                                      |      **VERIFIED (Mã nguồn)**      |
| **Màu sắc Container/Separator**            | Màu chuẩn của Delta Force là `COLORS.DF` (`0x0ff695` - Xanh neon). `COLORS.INFO` là `0x5865f2` (Blurple).                                                                                                | `src/config/container.variables.ts:19-21`:<br>`INFO: 0x5865f2, DF: 0x0ff695`                                                                                              |      **VERIFIED (Mã nguồn)**      |
| **Bản chất lệnh `/df map`**                | Bot không chạy 3D trong Discord mà gửi Container V2 đính kèm banner và Button Link sang web đối tác `deltaforcetools.gg`.                                                                                | `src/features/delta-force/map.handler.ts:18`:<br>`export const MAP_HOMEPAGE_URL = 'https://deltaforcetools.gg/vi?utm_source=PonNè';`                                      |      **VERIFIED (Mã nguồn)**      |
| **Bản chất lệnh `/df market`**             | Dữ liệu lấy từ API Delta Force HQ (snapshot định kỳ theo mốc giờ server, không phải sàn streaming realtime).                                                                                             | `src/features/delta-force/market.handler.ts:18-20`:<br>`import { getManufactureDetail, getManufactureRecommendationListNoAuth } from '../../services/deltaforce.api.js';` |      **VERIFIED (Mã nguồn)**      |
| **Số lượng Giftcode Garena**               | Đúng chính xác 277 mã quà tặng trong file danh sách code.                                                                                                                                                | `garena-redeem-code/list.md`: Đếm chính xác 277 dòng dữ liệu mã.                                                                                                          |      **VERIFIED (Mã nguồn)**      |
| **Artifact Extension ZIP**                 | File vật lý tồn tại và được đóng gói tự động khi chạy build.                                                                                                                                             | `src/assets/downloads/DF-Extension.zip` (135,580 bytes). `package.json:9` (`"prebuild": "npm run package:extension"`).                                                    |      **VERIFIED (Mã nguồn)**      |
| **Ranh giới Scope (Phạm vi)**              | Chuẩn hóa chính xác gồm **4 production source files** và **3 test files**.                                                                                                                               | Liệt kê chi tiết tại Mục 2 của kế hoạch.                                                                                                                                  | **DESIGN DECISION (Kế hoạch V4)** |
| **Test Baseline trước Refactor**           | Baseline ghi nhận trước khi refactor: 81 test suites pass, 1021 tests pass, 0 compile error, 0 lint error.                                                                                               | Chạy `npm run check`, `npm run lint`, `npm test` trực tiếp trên nhánh `feat/rename-bot-to-bot-delta`.                                                                     |  **VERIFIED (Runtime command)**   |

---

## 2. Ranh Giới Phạm Vi Sản Phẩm (Strict Scope Boundary)

Phạm vi thực hiện của kế hoạch này được giới hạn nghiêm ngặt trong đúng **4 production source files** và **3 test files** (tổng cộng 7 files), tuyệt đối không mở rộng sang các module khác:

### 2.1. 4 Production Source Files

1. `src/features/admin/guild-create.handler.ts`:
   - Rút gọn lời chào server mới còn 6–8 dòng; gắn CTA `/df help`.
   - Triển khai Atomic Claim First với bảng `guild_welcome_audit` và cơ chế Fail-Closed. Bỏ hoàn toàn timestamp check.
2. `src/features/delta-force/help.handler.ts`:
   - Tái cấu trúc 5 trang chuyên biệt theo ý định người dùng; tinh giản biểu tượng icon.
   - Xây dựng bộ điều hướng kết hợp `StringSelectMenu` (đủ 5 options value/mapping) và Action Row Buttons.
   - Xử lý tương tác tải file zip bằng `interaction.reply()` có cờ Ephemeral.
3. `src/infrastructure/discord/interaction-router.ts`:
   - Bổ sung định tuyến cho tiền tố `df_help:*` (Select Menu & Buttons).
   - Thực thi User Isolation Guard (chặn người dùng lạ can thiệp bảng).
4. `src/database/guild.settings.db.ts`:
   - Khởi tạo bảng `guild_welcome_audit`.
   - Triển khai hàm `claimGuildWelcome(db, guildId): boolean` tuân thủ đúng hợp đồng P1.
   - Triển khai hàm `updateGuildWelcomeResult(db, guildId, status, channelId?, error?): void`.

### 2.2. 3 Test Files

1. `__tests__/admin/guild-create.handler.test.ts`: Kiểm thử lời chào, Atomic Claim First, Fail-Closed, xử lý lỗi cập nhật DB sau khi gửi và các edge cases.
2. `__tests__/df/df-help.handler.test.ts`: Kiểm thử render 5 trang, cấu trúc components V2, Action Row buttons, Select Menu mapping và nút tải file.
3. `__tests__/infrastructure/interaction-router.test.ts`: Kiểm thử định tuyến `df_help`, User Isolation Guard và RBAC khi chưa cài đặt role Member.

---

## 3. Bảng Kiểm Kê Lệnh & Phân Quyền Chi Tiết (Verified Command Inventory & RBAC)

Tất cả lệnh dưới đây đã được đối chiếu chéo trực tiếp từ `df.command.ts`, `team.command.ts`, `config.command.ts` và `permissions.ts`:

### 3.1. Nhóm Lệnh Game Thủ (`/df` cá nhân & `/team`)

_Quyền yêu cầu: `DF_ACCESS` hoặc `TEAM_ACCESS` (Member role, mặc định là Everyone khi guild chưa cấu hình role Member)._

- `/df stats`: Xuất thẻ căn cước chiến đấu (K/D, tỉ lệ sống sót, rank, số trận) kèm Menu đổi mùa giải.
- `/df daily`: Báo cáo hiệu suất chiến đấu trong ngày hôm nay.
- `/df history [limit]`: Lịch sử 1–20 trận gần nhất kèm operator, map và kết quả rút quân.
- `/df match [match_id]`: Soi chi tiết kết quả 1 trận cụ thể (kèm autocomplete 5 trận gần nhất).
- `/df vault`: Sảnh Triển Lãm Đồ Đỏ — Kho báu vật phẩm quý hiếm đã rút quân an toàn và tổng định giá.
- `/df market [item]`: Tra cứu giá nguyên liệu thị trường và biên lợi nhuận chế tác bàn xưởng từ HQ API.
- `/df workshop`: Xem khuyến nghị sản xuất tối ưu tại Xưởng Căn Cứ Ngầm.
- `/df map`: Cẩm nang soi két sắt, lối rút quân và nút Link dẫn sang Trình mô phỏng 3D tiếng Việt tại `deltaforcetools.gg`.
- `/df build` / `/df gun [weapon] [mode]`: Thư viện mã súng Gunsmith chuẩn meta máy chủ Garena (DeltaForceTools API).
- `/df code show [page]`: Bảng mật mã két sắt 6 bản đồ hôm nay (cache 30 phút, in-flight deduplication).
- `/df code status`: Xem kênh và khung giờ cấu hình tự động gửi mật khẩu két sắt của máy chủ.
- `/team find`: Mở giao diện tạo bài tìm squad leo rank theo map, chế độ và điều phối voice chat tự động.

### 3.2. Nhóm Lệnh Liên Kết Tài Khoản (`/df link`)

_Quyền yêu cầu: `DF_ACCESS` (Member / Everyone)._

- `/df link start`: Tạo mã Claim 6 ký tự gửi qua DM, hướng dẫn tải tiện ích DF Toolbox Extension để liên kết an toàn qua Webhook AES-256-GCM.
- `/df link status`: Kiểm tra thông tin tài khoản game Delta Force HQ đang liên kết.
- `/df unlink`: Hủy liên kết tài khoản và xóa sạch dữ liệu game khỏi cơ sở dữ liệu.
- `/df help`: Mở Trung Tâm Trợ Giúp tương tác đa trang và nhận tiện ích DF Toolbox Extension (v1.2.1).

### 3.3. Nhóm Lệnh Quản Trị Server & Điều Hành Bot

_Phân cấp quyền rõ ràng theo 4 bậc:_

- **Bot Owner** _(Chỉ duy nhất developer qua `BOT_OWNER_ID`)_:
  `/df autopost set <type> <interval_hours> [broadcast_now]`, `/df autopost toggle <type> <enabled>`, `/df autopost status`, `/df autopost run <type>`.
- **Server Owner & Discord Administrator** _(Discord Native)_:
  Toàn quyền tất cả các lệnh cấu hình bên dưới, bao gồm quyền thiết lập phân quyền RBAC.
- **Bot Admin** _(Role gán qua `/config roles set role_type:bot_admin`)_:
  `/config roles set <role_type> <role>`, `/config roles view` và toàn bộ quyền của Moderator.
- **Moderator** _(Role gán qua `/config roles set role_type:moderator`)_:
  `/df code setchannel <channel>`, `/df code settime <time>`, `/df code setadminchannel <channel>`, `/config welcome setchannel/setrole/toggle/status/test`, `/config leave setchannel/toggle/status/test`, `/config booster setchannel/setrole/toggle/status/test`, `/config container edit/reset`.

---

## 4. Đặc Tả Giao Diện Tinh Giản Icon (UX Specification)

### 4.1. Lời Chào Server Mới (Guild Welcome Message)

- Độ dài: Đúng 6 dòng nội dung chính, không emoji trang trí thừa, tập trung vào CTA `/df help`.
- Components V2: `flags: MessageFlags.IsComponentsV2` (`32768`), Accent: `COLORS.DF` (`0x0ff695`).

```markdown
# Bot Delta đã sẵn sàng phục vụ server

Xin chào Quản trị viên và cộng đồng **${guildName}**!
**Bot Delta** hỗ trợ tự động hóa máy chủ và cẩm nang game **Delta Force (Garena)**.

**Bước đầu tiên:** Dùng lệnh `/df help` để xem danh mục tra cứu K/D, mã két sắt hằng ngày, build súng và liên kết tài khoản.

────────────────────────────────────────
Bot Delta v1.2.1 • Cần hỗ trợ: liên hệ server cộng đồng bên dưới.
```

- Action Row (Links):
  - Button 1: Link `Cổng Sự Kiện Garena` (`https://www.playdeltaforce.com/events/hq/vi/index.html`).
  - Button 2: Link `Máy Chủ Hỗ Trợ` (`https://discord.gg/vz6w6c3Xe3`).

### 4.2. Trung Tâm Lệnh `/df help` (Phân Trang 5 Trang)

- Cấu trúc: 1 Container V2 + 1 Action Row Select Menu + 1 Action Row Buttons.
- 5 Trang:
  1. **Trang 1: Tổng Quan & Bắt Đầu Nhanh** (Accent: `COLORS.WELCOME` / `0x5865f2`).
  2. **Trang 2: Hồ Sơ Chiến Đấu & Thống Kê** (Accent: `COLORS.DF` / `0x0ff695`).
  3. **Trang 3: Tác Chiến, Map 3D & Vũ Khí Meta** (Accent: `COLORS.DF` / `0x0ff695`).
  4. **Trang 4: Tiện Ích DF Toolbox & Liên Kết** (Accent: `COLORS.INFO` / `0x5865f2`).
  5. **Trang 5: Quản Trị Server & Tự Động Hóa** (Accent: `COLORS.BOOSTER` / `0xfb663a`).

#### Đặc Tả Chi Tiết Select Menu Options & Mapping Trang (P3)

Bộ điều hướng Select Menu có `customId: df_help:select:<callerUserId>` với 5 options cụ thể:

| Option `value` | Label hiển thị         | Description                                           | Trang ánh xạ (Target Page) |
| :------------- | :--------------------- | :---------------------------------------------------- | :------------------------: |
| `overview`     | 1. Tổng quan & Bắt đầu | Giới thiệu Bot Delta, hướng dẫn dùng bot và tiện ích  |        **Trang 1**         |
| `stats`        | 2. Hồ sơ chiến đấu     | Chỉ số cá nhân, K/D, lịch sử, soi trận và kho đồ đỏ   |        **Trang 2**         |
| `tactics`      | 3. Tác chiến & Vũ khí  | Bản đồ 3D, build súng meta, mật mã két sắt và giá chợ |        **Trang 3**         |
| `link`         | 4. Tiện ích & Liên kết | Liên kết tài khoản HQ và đổi mã quà tặng Garena       |        **Trang 4**         |
| `admin`        | 5. Quản trị máy chủ    | Cấu hình RBAC, tự động đăng bài và thông báo server   |        **Trang 5**         |

_Quy tắc xử lý handler:_ Lấy `const selectedValue = interaction.values[0]`. Tra cứu bảng ánh xạ để xác định `targetPage = PAGE_MAPPING[selectedValue]`. Render lại container và update trạng thái `disabled` của các nút bấm tương ứng.

- Action Row Buttons:
  - `[ Trước ]`: `customId: df_help:page:<prevPage>:<callerUserId>` (disabled khi ở Trang 1).
  - `[ Trang X/5 ]`: Secondary button hiển thị số trang hiện tại (luôn disabled).
  - `[ Sau ]`: `customId: df_help:page:<nextPage>:<callerUserId>` (disabled khi ở Trang 5).
  - `[ Tải tiện ích ]`: Success button, `customId: df_help:dl:<callerUserId>`.
  - `[ Hỗ trợ ]`: Link button dẫn về Discord server.

---

## 5. Đặc Tả Idempotency Bền Vững & Vòng Đời Tương Tác

### 5.1. Cơ Chế Chống Trùng Lặp Welcome: Atomic Claim First & Fail-Closed

**Nguyên tắc tối thượng: Ưu tiên tuyệt đối không bao giờ gửi trùng (Ngữ nghĩa At-Most-Once).**

1. **Khởi tạo bảng SQLite (`src/database/guild.settings.db.ts`):**

   ```sql
   CREATE TABLE IF NOT EXISTS guild_welcome_audit (
     guild_id TEXT PRIMARY KEY,
     status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed')),
     channel_id TEXT,
     error_message TEXT,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );
   ```

2. **Hợp Đồng Kỹ Thuật Của Hàm `claimGuildWelcome(db, guildId)` (P1):**
   Hàm thực thi câu lệnh SQL:

   ```sql
   INSERT OR IGNORE INTO guild_welcome_audit
     (guild_id, status, created_at, updated_at)
   VALUES (?, 'pending', ?, ?)
   ```

   Quy định rành mạch 3 nhánh kết quả:
   - **Nhánh `true`**: Câu lệnh INSERT thành công và `info.changes === 1`. Điều này xác nhận đây là guild hoàn toàn mới chưa từng có bản ghi. Claim lock thành công với trạng thái `pending`. Caller được phép tiếp tục tìm kênh và gửi tin nhắn.
   - **Nhánh `false`**: Câu lệnh INSERT thực thi thành công nhưng `info.changes === 0`. Điều này xác nhận guild đã có bản ghi từ trước trong DB ở bất kỳ trạng thái nào (`pending`, `sent`, hoặc `failed`). Caller **DỪNG NGAY LẬP TỨC**, tuyệt đối không gửi tin nhắn.
   - **Nhánh Ném Ngoại Lệ (Throw Exception)**: Nếu câu lệnh ném lỗi (do `SQLITE_BUSY: database is locked`, đĩa đầy, kết nối hỏng) $\rightarrow$ Hàm **KHÔNG nuốt lỗi**, bắt buộc phải rethrow ngoại lệ ra ngoài. Caller (`handleGuildCreate`) bọc trong `try/catch`: khi bắt được lỗi DB $\rightarrow$ ghi log lỗi và **tuyệt đối không gửi tin nhắn chào mừng (Fail-Closed)**.
   - **Quy tắc bất biến:** Tuyệt đối không để lỗi DB bị diễn giải thành `false` hoặc ngược lại.

3. **Luồng xử lý Atomic Claim First:**

   ```mermaid
   flowchart TD
       Start["Sự kiện guildCreate(guild)"] --> Claim["Thực thi SQL qua claimGuildWelcome:<br>INSERT OR IGNORE INTO guild_welcome_audit<br>(guild_id, status, created_at, updated_at)<br>VALUES (?, 'pending', ?, ?)"]
       Claim --> CheckDB{"Lỗi kết nối DB<br>hoặc SQLITE_BUSY?"}
       CheckDB -- "Có (Ném Exception)" --> FailClosed["🛑 FAIL-CLOSED:<br>Bắt ngoại lệ, Ghi log lỗi, DỪNG NGAY,<br>TUYỆT ĐỐI KHÔNG GỬI TIN"]
       CheckDB -- "Không" --> CheckChanges{"Kết quả claimGuildWelcome<br>là true hay false?"}
       CheckChanges -- "false (changes === 0)<br>Bản ghi đã tồn tại (pending/sent/failed)" --> StopExisting["🛑 Bỏ qua:<br>Server đã có bản ghi trong audit.<br>DỪNG NGAY"]
       CheckChanges -- "true (changes === 1)<br>Claim thành công" --> FindChannel["Tìm kênh gửi thích hợp"]
       FindChannel --> HasChannel{"Tìm thấy kênh?"}
       HasChannel -- "Không" --> MarkNoChannel["UPDATE status='failed'<br>error='No writable channel'<br>(Giữ nguyên bản ghi claim, không xóa)"]
       HasChannel -- "Có" --> SendDiscord["Gửi Welcome Message<br>(Components V2)"]
       SendDiscord --> SendSuccess{"Gửi thành công?"}
       SendSuccess -- "Có" --> MarkSent["UPDATE status='sent'<br>channel_id=..."]
       SendSuccess -- "Thất bại (Discord API lỗi)" --> MarkFailed["UPDATE status='failed'<br>error=...<br>(Giữ nguyên bản ghi claim, không gửi lại)"]
   ```

4. **Xử lý tình huống đặc biệt (Edge Case): DB lỗi khi cập nhật sau khi Discord đã nhận tin**:
   - Sau khi `channel.send()` thành công, bot gọi `updateGuildWelcomeResult(db, guild.id, 'sent', channel.id)`.
   - Nếu câu lệnh UPDATE này ném lỗi (ví dụ `SQLITE_BUSY: database is locked`), bản ghi trong DB vẫn tồn tại ở trạng thái `pending`.
   - **Cam kết At-Most-Once:** Khi gọi lại handler với cùng một `guild.id` (ví dụ sự kiện kích hoạt lại), câu lệnh `claimGuildWelcome()` ban đầu sẽ gặp bản ghi `guild_id` đã có (trạng thái `pending`) $\rightarrow$ trả về `false` $\rightarrow$ **Tuyệt đối KHÔNG kích hoạt gửi tin lần hai!**

### 5.2. Vòng Đời Tương Tác `/df help`

- CustomId: `df_help:page:<pageNum>:<callerUserId>`, `df_help:select:<callerUserId>`, `df_help:dl:<callerUserId>`.
- User Isolation: So sánh `interaction.user.id !== callerUserId`. Nếu không khớp, trả lời Ephemeral thông báo từ chối.
- Nút tải file ZIP: Xử lý bằng `await interaction.reply({ content: '...', files: [attachment], flags: MessageFlags.Ephemeral })`.

---

## 6. Ma Trận Kiểm Thử Toàn Diện (Testing Matrix)

Trước khi nghiệm thu, bắt buộc phải hoàn thành và đạt kết quả theo đúng tiêu chuẩn kỳ vọng:

| Nhóm test             | Tệp kiểm thử                                          | Kịch bản kiểm thử chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Tiêu chuẩn Đạt yêu cầu (Acceptance Expectation) |
| :-------------------- | :---------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------: |
| **Unit Test**         | `__tests__/admin/guild-create.handler.test.ts`        | 1. Render `buildGuildWelcomeContainer` có độ dài $< 10$ dòng, chứa CTA `/df help`.<br>2. Tìm kênh: ưu tiên systemChannel $\rightarrow$ priority keywords $\rightarrow$ first writable.<br>3. Atomic Claim: Thử insert 2 lần cùng 1 guildId $\rightarrow$ lần 2 nhận `false`.<br>4. Fail-Closed: Giả lập `claimGuildWelcome` ném lỗi DB $\rightarrow$ handler bắt lỗi và không gọi send tin nhắn.<br>5. Không tìm thấy channel: Cập nhật `status = 'failed'`, giữ nguyên bản ghi claim trong DB, không xóa.<br>6. Server đã có bản ghi ở trạng thái `failed` hoặc `sent` $\rightarrow$ handler nhận `false` $\rightarrow$ tuyệt đối không gửi lại tin nhắn.<br>7. **DB lỗi khi cập nhật sau khi Discord đã gửi:** Kiểm tra trực tiếp việc gọi lại `handleGuildCreate(client, guild)` với cùng một `guild.id` (sau khi kịch bản UPDATE `sent` ném lỗi DB và bản ghi giữ nguyên `pending`) $\rightarrow$ handler nhận `false` từ `claimGuildWelcome` $\rightarrow$ tuyệt đối không gọi `channel.send()` lần thứ hai. |      **Phải vượt qua toàn bộ assertions**       |
| **Unit Test**         | `__tests__/df/df-help.handler.test.ts`                | 1. Render độc lập từng trang 1 đến 5: kiểm tra đủ lệnh, text $< 4000$ ký tự.<br>2. Select Menu có đủ 5 options với đúng `value` và ánh xạ đúng trang.<br>3. Action Row Buttons: Trang 1 disable nút Trước; Trang 5 disable nút Sau.<br>4. Xử lý thiếu file ZIP: báo lỗi an toàn không crash.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |      **Phải vượt qua toàn bộ assertions**       |
| **Interaction Test**  | `__tests__/infrastructure/interaction-router.test.ts` | 1. Button click `df_help:page:2:<caller>` $\rightarrow$ gọi `interaction.update` sang Trang 2.<br>2. User khác bấm $\rightarrow$ bị từ chối bằng thông báo Ephemeral.<br>3. Select Menu chọn `admin` $\rightarrow$ chuyển sang Trang 5.<br>4. Nút tải ZIP $\rightarrow$ gọi `interaction.reply` gửi file đính kèm.<br>5. Interaction hết hạn (lỗi 10062) $\rightarrow$ bỏ qua không ném lỗi.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |      **Phải vượt qua toàn bộ assertions**       |
| **RBAC Test**         | `__tests__/infrastructure/interaction-router.test.ts` | Kiểm tra server mới chưa cấu hình role Member $\rightarrow$ User bình thường gõ `/df help` vẫn được phép thực thi (`Policy.DF_ACCESS`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |      **Phải vượt qua toàn bộ assertions**       |
| **Regression Test**   | Toàn bộ repo                                          | Chạy toàn bộ 81 test suites của dự án (1021 tests baseline trước refactor).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |  **81/81 test suites vượt qua, 0 regression**   |
| **Build & Typecheck** | Build Scripts                                         | 1. `npm run check` (`tsc --noEmit`).<br>2. `npm run lint` (`eslint src`).<br>3. `npm run build` (`package:extension` + `tsc`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |         **0 lỗi compile, 0 lỗi linter**         |

---

## 7. Tiêu Chí Nghiệm Thu Khách Quan (Objective Acceptance Criteria)

- [ ] Lời chào server mới không vượt quá 8 dòng nội dung chính, tinh giản icon, có CTA nổi bật hướng dẫn chạy `/df help`.
- [ ] Sự kiện `guildCreate` thực hiện **Atomic Claim First** qua bảng `guild_welcome_audit` (`INSERT OR IGNORE`) và **Fail-Closed** (lỗi DB $\rightarrow$ không gửi).
- [ ] Hàm `claimGuildWelcome()` tuân thủ nghiêm ngặt hợp đồng: trả về `true` khi mới claim, `false` khi đã có bản ghi, ném ngoại lệ khi DB lỗi.
- [ ] Không sử dụng bất kỳ timestamp guard 120s nào làm điều kiện gửi welcome.
- [ ] Khi không tìm thấy channel sau khi claim, hệ thống cập nhật trạng thái `failed` và giữ nguyên bản ghi claim trong DB (không xóa).
- [ ] Khi bản ghi đã tồn tại ở bất kỳ trạng thái nào (`pending`, `sent`, `failed`), bot tuyệt đối không gửi lại welcome message.
- [ ] Khi DB gặp lỗi cập nhật sau khi đã gửi tin nhắn thành công, lần gọi lại handler tiếp theo tuyệt đối không gửi lần hai.
- [ ] Lệnh `/df help` được chia thành đúng 5 trang trực quan, tinh giản icon, không tràn chữ.
- [ ] Select Menu đặc tả đầy đủ 5 options `value` và ánh xạ chính xác sang trang tương ứng.
- [ ] Toàn bộ 40+ slash command và subcommand trong `Verified Command Inventory` được mô tả chính xác theo đúng quyền hạn.
- [ ] Các thành phần giao diện tuân thủ quy chuẩn Discord Components V2 (`MessageFlags.IsComponentsV2 = 32768`, tổng component $< 40$).
- [ ] Bảo mật cô lập người dùng (User Isolation) hoạt động chính xác dựa trên `callerUserId`.
- [ ] Nút tải tiện ích mở rộng phản hồi bằng `interaction.reply()` có file zip và hướng dẫn cài đặt.
- [ ] `/df help` hoạt động bình thường trên server mới tinh chưa cấu hình RBAC.
- [ ] Toàn bộ test suite giữ vững kết quả kiểm thử không bị regression, 0 lỗi TypeScript, 0 lỗi ESLint, build production thành công.
- [ ] Không có bất kỳ thay đổi nào nằm ngoài phạm vi 4 production source files và 3 test files đã định nghĩa.

---

## 8. Báo Cáo Đầu Ra Bắt Buộc (Mandatory Summary Report)

### 8.1. Các Lỗi Của Bản Cũ Đã Được Khắc Phục Hoàn Toàn

1. Sửa cờ `MessageFlags.IsComponentsV2` thành `32768` (`1 << 15`).
2. Sửa giới hạn Components V2 thành tối đa 40 components tổng cộng.
3. Sửa tương tác tải file zip thành `interaction.reply({ flags: Ephemeral, files })`.
4. Phân biệt rõ `guildCreate` vs `guildAvailable` trong Gateway và Client event lifecycle.
5. Thiết kế bảng SQLite chuyên dụng `guild_welcome_audit` với **Atomic Claim First** và **Fail-Closed**. Hợp đồng hàm `claimGuildWelcome()` quy định rõ 3 nhánh kết quả. Cú pháp SQL tách bạch cột và `VALUES`.
6. Thống nhất ranh giới phạm vi gồm chính xác **4 production source files** và **3 test files**.
7. Làm rõ logic cho phép Everyone dùng `/df help` khi server mới chưa có role Member.
8. Bổ sung bảng phân quyền chi tiết cho Bot Owner, Admin, Moderator và Member.
9. Đính chính màu sắc: `COLORS.DF` (`0x0ff695`) là màu chuẩn của Delta Force.
10. Tinh giản tối đa biểu tượng icon rườm rà.
11. Bổ sung đầy đủ kịch bản kiểm thử DB error sau khi gửi tin nhắn thành công (gọi lại handler với cùng guildId) vẫn không gửi lần hai.
12. Hiệu chỉnh tuyên bố SQLite: nêu rõ `INSERT OR IGNORE` không ngăn được `SQLITE_BUSY`, và giải pháp là Fail-Closed.
13. Đặc tả chi tiết bảng 5 options của Select Menu và ánh xạ trang.

### 8.2. Danh Sách Rủi Ro Còn Tồn Tại & Phương Án Phòng Ngừa

1. **Rủi ro Gateway Burst & SQLite Concurrency:** Khi bot được thêm vào nhiều server cùng lúc $\rightarrow$ `INSERT OR IGNORE` xử lý xung đột khóa chính cho cùng 1 guild. Nếu gặp `SQLITE_BUSY: database is locked`, cơ chế **Fail-Closed** bắt lỗi và dừng xử lý ngay lập tức (không gửi tin nhắn), đảm bảo không vi phạm nguyên tắc At-Most-Once.
2. **Rủi ro Bỏ Lỡ Do Lỗi Mạng:** Với ngữ nghĩa At-Most-Once, nếu Discord API gặp sự cố lúc gửi tin nhắn $\rightarrow$ Hệ thống chấp nhận không gửi lại để tránh spam; Quản trị viên luôn có thể chủ động gõ `/df help`.

---

> 🛑 **DỪNG LẠI CHỜ PHÊ DUYỆT:**  
> Kế hoạch kỹ thuật Plan V4 đã hoàn tất chuẩn mực 100% theo toàn bộ các phản hồi P1, P2, P3, P4.  
> TUYỆT ĐỐI không triển khai code production cho đến khi có sự phê duyệt chính thức từ Project Owner.
