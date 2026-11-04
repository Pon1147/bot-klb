# Kế hoạch Triển khai: Sửa lỗi Hiển thị, Tối ưu Extension Capture và Tính năng `/df market`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục lỗi hiển thị đặc vụ & nút link trên Discord (`/df history`), sửa luồng bắt token tức thì trong Extension DF Toolbox, và triển khai tính năng tra cứu thị trường chế tác `/df market` realtime không cần auth.

**Architecture:** 
- Phân rã thành 3 Path độc lập (3 Slice):
  - **Path 1 (Display & UX)**: Sửa từ điển `df-operator.utils.ts` và chuyển nút xem lịch sử thành Link Button.
  - **Path 2 (Extension Token Capture)**: Hook trực tiếp response `/v2/auth/login` và popup `postMessage` trong `link-page-capture.js`, đóng gói lại file ZIP.
  - **Path 3 (Market Feature)**: Tích hợp API `GetManufactureDetail` (public no-auth) vào `deltaforce.api.ts` và dựng slash command `/df market` bằng Discord Components V2.

**Tech Stack:** TypeScript, discord.js (Components V2), Jest, Chrome Extension MV3, PlayerInfinite API.

---

## Global Constraints
- Tuân thủ moduleResolution `node16`: Mọi relative import phải có đuôi `.js`.
- Tuân thủ Lazy Senior Dev: Viết giải pháp nhỏ nhất, trực diện, không thêm thư viện ngoài.
- Bảo mật: Token game được che giấu trong log, các endpoint public không đòi hỏi quyền liên kết.
- Phân quyền: Đăng ký đầy đủ `df.market` vào `permissions.json` và `DEFAULT_PERMISSIONS`.

## Review Focus
1. `resolveOperator('30011')` phải trả về `Gizmo (Thiết Bị)` thay vì chỉ `Thiết Bị`.
2. Nút "Xem tất cả" trong `/df history` phải mở link web trực tiếp mà không cần bot xử lý interaction.
3. Extension phải bắt được `openid` và `token` ngay khi vừa đăng nhập xong mà không cần reload trang.
4. `/df market` phải xử lý an toàn khi người dùng nhập ID/tên vật phẩm không tồn tại hoặc API lỗi.
5. Kiểm thử 100% xanh (`npm run check` và `npm test`).

---

### Task 1: Sửa lỗi Hiển thị Đặc vụ Gizmo và Nút Xem Tất Cả trong `/df history`

**Files:**
- Modify: `src/utils/df-operator.utils.ts`
- Modify: `src/features/delta-force/history.handler.ts`
- Modify: `src/infrastructure/discord/interaction-router.ts`
- Test: `__tests__/df/df-operator.utils.test.ts` (hoặc test tương ứng)

- [ ] **Step 1: Viết test kiểm tra tên đặc vụ 30011 và cấu trúc button trong history**
- [ ] **Step 2: Chạy test để xác nhận fail hoặc thiếu kiểm chứng**
- [ ] **Step 3: Cập nhật `df-operator.utils.ts`**: Đổi tên đặc vụ `30011` từ `'Thiết Bị'` thành `'Gizmo (Thiết Bị)'`
- [ ] **Step 4: Cập nhật `history.handler.ts`**: Chuyển button `df_history_view_all` từ `ButtonStyle.Secondary` sang `ButtonStyle.Link` trỏ thẳng tới `https://www.playdeltaforce.com/events/hq/vi/index.html`
- [ ] **Step 5: Dọn dẹp code thừa trong `interaction-router.ts`**: Xóa nhánh `if (interaction.customId === 'df_history_view_all')` vì button link do Discord client tự mở web
- [ ] **Step 6: Chạy test xác minh pass 100%**
- [ ] **Step 7: Commit**: `git commit -m "fix(df-history): sua ten dac vu Gizmo va chuyen nut view all thanh link button"`

---

### Task 2: Tối ưu Luồng Bắt Token trong Extension (`DF Toolbox`)

**Files:**
- Modify: `garena-redeem-code/content/link-page-capture.js`
- Build Output: `assets/DF-Extension.zip`

- [ ] **Step 1: Bổ sung hook bắt response từ `iegg.garena.com/v2/auth/login`**
  - Khi có response trả về từ `https://intlsdk-new.iegg.garena.com/v2/auth/login`, trích xuất `data.openid` và `data.token`.
- [ ] **Step 2: Bổ sung listener lắng nghe `window.addEventListener('message')` từ popup callback `garenalogincallback.html`**
- [ ] **Step 3: Gửi `CREDENTIAL_CANDIDATE` về `link-content.js` ngay lập tức**
- [ ] **Step 4: Chạy script đóng gói extension**: `npm run package:extension`
- [ ] **Step 5: Commit**: `git commit -m "feat(extension): bat credential tuc thi tu auth login response va callback"`

---

### Task 3: Triển khai Tính năng `/df market` (Bàn Chế Tác & Chợ Realtime)

**Files:**
- Modify: `src/config/permissions.json`
- Modify: `src/config/permissions.ts`
- Modify: `src/services/deltaforce.api.ts`
- Create: `src/features/delta-force/market.handler.ts`
- Modify: `src/features/delta-force/df.command.ts`
- Test: `__tests__/df/df-market.test.ts`

- [ ] **Step 1: Viết test cho API `getManufactureDetail` và handler `/df market`**
- [ ] **Step 2: Chạy test xác nhận fail**
- [ ] **Step 3: Bổ sung hàm API trong `deltaforce.api.ts`**:
  - `getManufactureDetail(itemId: string)` gọi `POST /api/proxy_direct/logicial/DfTools/GetManufactureDetail`
  - `getManufactureRecommendationListNoAuth()` gọi `POST /api/proxy_direct/logicial/DfTools/GetManufactureRecommendationListNoAuth`
- [ ] **Step 4: Viết `market.handler.ts`**:
  - Truy xuất dữ liệu chi tiết chế tác của item.
  - Render Container V2: Tên vật phẩm, ảnh, giá bán, chi phí sản xuất, thuế phí, thu nhập/giờ (`hourly_income`), giá cao nhất/thấp nhất trong 24h, danh sách nguyên liệu.
- [ ] **Step 5: Đăng ký subcommand `market` vào `df.command.ts`** kèm autocomplete gợi ý vật phẩm.
- [ ] **Step 6: Cấu hình RBAC permissions**: Thêm `df.market` role `Member` vào `permissions.json` và `permissions.ts`.
- [ ] **Step 7: Chạy kiểm thử xác minh `npm test __tests__/df/df-market.test.ts` và `npm run check`**
- [ ] **Step 8: Commit**: `git commit -m "feat(df-market): them tinh nang tra cuu ban che tac va gia cho realtime"`
