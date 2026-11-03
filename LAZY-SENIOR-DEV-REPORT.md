# Lazy Senior Dev — Targeted Technical Debt Cleanup Report

> Ngày thực hiện: 03/11/2026  
> Branch: `feat/non-tech-df-guide`  
> Triết lý áp dụng: Ponytail Core (Smallest correct solution, Zero regression, Data security first)

---

## 1. Phase 1 — Remove Dead SVG Renderer (Hoàn thành)

### Rà soát tiền điều kiện
- **Consumers**: Kiểm tra `src/` qua `git grep`: 0 consumers tĩnh/dynamic. Lệnh `/df stats` dùng 100% Discord Components V2.
- **Dev/Build scripts**: Chỉ có `scripts/dev-preview.ts` và npm script `"dev:preview"`.
- **Dependencies**: Thư viện nặng `sharp` (`^0.35.4`) chỉ được sử dụng duy nhất bởi `src/renderers/df-stats/svg-renderer.ts`.
- **Tests**: `__tests__/renderers/df-stats/text-fit.test.ts` chỉ test 2 helper nội bộ của SVG renderer cũ.

### Thực hiện
- Xóa thư mục: `src/renderers/` (4 files: `svg-renderer.ts`, `view-model.ts`, `types.ts`, `text-fit.ts`).
- Xóa file config: `src/config/df-stats-renderer.config.ts`.
- Xóa script test/dev: `scripts/dev-preview.ts` và gỡ bỏ script `"dev:preview"` trong `package.json`.
- Gỡ bỏ package phụ thuộc: `sharp` khỏi `dependencies` trong `package.json`.
- Xóa test suite: `__tests__/renderers/df-stats/text-fit.test.ts`.

---

## 2. Phase 2 — Audit Legacy Credentials (`df_tokens`) (Báo cáo & Giữ nguyên)

### Kết quả kiểm toán dữ liệu thực tế (`data/bot.db`)
- Bảng `df_tokens` hiện lưu **2 bản ghi legacy**:
  1. `discord_id: 935161947861704844` (openid: `15618793433650902465`)
  2. `discord_id: 781866607269773332` (openid: `7882496458699115941`)
- Đối chiếu chéo với bảng mã hóa `df_account_bindings` (9 active bindings):
  - User `781866607269773332`: Đã có trong `df_account_bindings` (status: `active`).
  - **User `935161947861704844`**: **CHƯA CÓ TRONG `df_account_bindings`!**

### Đánh giá rủi ro & Quyết định
- ⚠️ **RỦI RO MẤT TRUY CẬP GAME**: Nếu xóa bảng `df_tokens` hoặc gỡ bỏ fallback trong `df-guards.ts`, người dùng `935161947861704844` sẽ bị ngắt kết nối tài khoản game ngay lập tức và gặp lỗi quyền truy cập.
- **Hành động tuân thủ nguyên tắc "Security trước convenience & Không xóa dữ liệu để làm sạch code"**:
  - **GIỮ NGUYÊN** bảng `df_tokens` và luồng fallback trong `src/utils/df-guards.ts` cũng như `initializeDfTokensTable` trong `bootstrap.ts`.
  - **KHÔNG THỰC HIỆN BẤT KỲ DESTRUCTIVE CHANGE NÀO**.
  - **Migration Plan kiến nghị**: Gửi tin nhắn hướng dẫn/thông báo bot tới user `935161947861704844` thực hiện re-link qua `/df link start` (đổi sang mã hóa AES-GCM `df_account_bindings`). Sau khi user này hoàn tất liên kết mới, mới tiến hành deprecate bảng `df_tokens`.

---

## 3. Phase 3 — Matchmaking TTLStore (Hoàn thành)

### Rà soát Lifecycle & Semantics
- Session matchmaking `TeamFindSession` vốn có vòng đời 10 phút (`TEAM_FIND_SESSION_TIMEOUT_MS`).
- Trước đây: `bootstrap.ts` chạy riêng `setInterval(cleanupTeamFindSessions, 30_000)` độc lập với Map session.
- `TTLStore<K, V>` đã hỗ trợ đầy đủ `TouchEntry` (`lastInteractionAt`), gia hạn TTL khi tương tác (`touch()`) và tự động dọn dẹp bằng timer nội bộ (`startCleanup()`).

### Thực hiện
- Sửa hàm `touch()` trong `src/utils/ttl-store.ts` để đồng bộ cả `expiresAt` khi gia hạn TTL dạng `lastInteractionAt`.
- Thêm `startSessionCleanup()` và `stopSessionCleanup()` vào `src/services/team-find-session.ts`.
- Gỡ bỏ vòng lặp `setInterval(cleanupTeamFindSessions, ...)` thủ công trong `src/app/bootstrap.ts`, chuyển sang gọi trực tiếp `startTeamFindCleanup()`.
- Bổ sung bộ kiểm thử toàn diện `__tests__/team-find/team-find-session.test.ts` (6 tests bao phủ: create, update selection, touch renewal, timeout expiration, deletion, cleanup start/stop).

---

## 4. Phase 4 — Explicitly Defer

Tuân thủ nghiêm ngặt yêu cầu không làm phân tán phạm vi:
- ❌ **Hoãn**: Không di chuyển hàng loạt 24 file trong `src/features/delta-force/`.
- ❌ **Hoãn**: Không đổi tên `welcome.database.ts`.
- ❌ **Hoãn**: Không tạo thêm abstraction hay wrapper mới.

---

## 5. Kết quả Kiểm thử & Nghiệm thu (Verification)

- `npm run check`: **0 errors** (TypeScript pass 100%).
- `npm test`: **78/78 test suites PASS**, **1008/1008 tests PASS**.
- `git diff`: Chỉ sửa đổi đúng các file trong phạm vi Phase 1, 3. Dữ liệu credentials Phase 2 an toàn tuyệt đối.
