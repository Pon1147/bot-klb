# BOT-KLB — BÁO CÁO THỰC THI SỬA CHỮA GIAI ĐOẠN 1 (PHASE 1 CONTROLLED REMEDIATION)

> **Ngày thực hiện**: 10/11/2026  
> **Nhánh thực thi**: `fix/phase-1-remediation-key-rotation-and-claim-coverage`  
> **Phạm vi kiểm soát**: Chỉ thực hiện Task 2 (Key-version handling) và Task 4 (Coverage tests cho `df-claim-store.ts`).  
> **Quy chuẩn**: Không hạ threshold coverage; không thay đổi logic `unlink`; giữ nguyên Node16 resolution và comment tiếng Việt.

---

## 1. TỔNG QUAN KẾT QUẢ THỰC HIỆN

| Hạng mục | Trước thực thi | Sau thực thi | Trạng thái |
|---|---|---|---|
| **Task 2: Key-version rotation trong `stats-select.handler.ts`** | Bỏ qua `binding.key_version`, fallback âm thầm sang `df_tokens` khi decrypt lỗi | Truyền chính xác `binding.key_version` vào `decryptCredential()`, chặn silent fallback sang plaintext token | **HOÀN THÀNH** |
| **Task 4: Coverage `df-claim-store.ts`** | Statements 81.7%, Branch 54.54%, Funcs 66.66%, Lines 83.33% (FAIL) | Statements 100%, Branch 100%, Funcs 100%, Lines 100% | **HOÀN THÀNH (100%)** |
| **Test Suites** | 92 passed | 92 passed | **100% PASS** |
| **Tổng số Tests** | 1,162 passed | 1,171 passed (+9 tests mới) | **100% PASS** |
| **TypeScript Compilation (`npm run check`)** | 0 lỗi | 0 lỗi | **PASS** |
| **Phiên bản Bot** | `v1.6.13` | `v1.6.14` (`npm run bump:bot`) | **BUMPED** |

---

## 2. CHI TIẾT THỰC HIỆN TASK 2 — KEY-VERSION HANDLING & DECRYPTION

### 2.1. Phân tích nguyên nhân & Rủi ro bảo mật cũ
- Trước đây, `stats-select.handler.ts` giải mã dữ liệu `binding` mà không truyền tham số `key_version`. Do đó, nếu khóa bí mật được rotate sang `v2`, hàm `decryptCredential` sẽ mặc định dùng khóa `v1` dẫn đến lỗi `Unsupported state or unable to authenticate data`.
- Đồng thời, khối `catch` bên ngoài đã âm thầm gọi `getDfToken(database, targetUserId)` (fallback sang token plaintext cũ trong bảng `df_tokens`). Điều này vi phạm nguyên tắc bảo mật: nếu người dùng đã có binding mã hóa nhưng bị lỗi giải mã hoặc token hết hạn, bot lại âm thầm dùng token plaintext rác/lỗi thời từ quá khứ thay vì yêu cầu người dùng liên kết lại.

### 2.2. Giải pháp triển khai
1. **Truyền `binding.key_version`**: Cập nhật hàm gọi `decryptCredential()` trong `src/features/delta-force/stats-select.handler.ts`:
   ```typescript
   const decrypted = decryptCredential(
     binding.cred_nonce,
     binding.cred_ciphertext,
     binding.cred_tag,
     binding.discord_user_id,
     binding.openid,
     binding.key_version, // Hỗ trợ xoay khóa đa phiên bản (v1, v2, ...)
   );
   ```
2. **Chặn Silent Fallback**:
   - Nếu `binding` tồn tại mà giải mã thất bại $\rightarrow$ Ghi log lỗi bảo mật và gửi thông báo trực tiếp đến người dùng: *"Binding tài khoản bị lỗi hoặc khóa không hợp lệ. Vui lòng unlink và liên kết lại bằng `/df link start`."*
   - Chỉ khi hoàn toàn không có bản ghi trong `df_account_bindings` thì mới kiểm tra bảng fallback `df_tokens`.
3. **Bộ test hồi quy (`__tests__/df/df-stats-select.handler.test.ts`)**:
   - Test giải mã thành công với binding mang `key_version: 'v2'` và xác minh không chạm vào `df_tokens`.
   - Test khi giải mã binding thất bại (do sai key hoặc hỏng ciphertext/tag): bot chặn ngay lập tức, thông báo lỗi cho người dùng, và tuyệt đối không đọc token plaintext từ `df_tokens`.
   - Test khi người dùng chưa có bất kỳ liên kết nào.

---

## 3. CHI TIẾT THỰC HIỆN TASK 4 — COVERAGE `df-claim-store.ts`

### 3.1. Phân tích nguyên nhân gốc (Root Cause)
- Ngưỡng cấu hình trong `jest.config.cjs` cho `src/services/df-claim-store.ts` là:
  - Branches: `100%`
  - Functions: `100%`
  - Lines: `96%`
  - Statements: `96%`
- Thực tế trước khi fix, toàn bộ logic dọn dẹp nền định kỳ `runDbCleanup()`, xử lý reentrancy `cleanupInProgress`, và các nhánh lỗi DB khi dọn dẹp định kỳ không có unit test kích hoạt (đặc biệt là timer 5 phút chạy ngầm).
- Trong quá trình phân tích JavaScript runtime, phát hiện một lỗi bất đồng bộ nghiêm trọng:
  ```javascript
  // Lỗi cú pháp assignment trong runtime:
  cleanupInProgress = (async () => {
    try { ... }
    finally { cleanupInProgress = null; }
  })();
  ```
  Do thân hàm `(async () => { ... })()` chạy đồng bộ cho tới điểm await đầu tiên, khối `finally` đã gán `cleanupInProgress = null` **TRƯỚC KHI** phép gán `=` hoàn thành. Sau đó, giá trị `Promise { result }` mới được gán đè vào `cleanupInProgress`, khiến biến này bị kẹt ở trạng thái non-null mãi mãi!

### 3.2. Giải pháp triển khai
1. **Sửa Async Coordination trong `src/services/df-claim-store.ts`**:
   - Đưa `await Promise.resolve()` vào đầu async IIFE để đảm bảo `cleanupInProgress` được gán Promise trước khi microtask xử lý khối `finally`.
   - Bổ sung kiểm tra định danh `if (cleanupInProgress === currentCleanup) { cleanupInProgress = null; }`.
   - Tối ưu `resetStore()` và `stopCleanup()` để dọn dẹp sạch sẽ tài nguyên, đóng timer và reset in-flight promise.
2. **Bổ sung Unit Tests toàn diện (`__tests__/df/df-claim-store.test.ts`)**:
   - Test chu kỳ dọn dẹp định kỳ 5 phút (`jest.advanceTimersByTime(300_000)`).
   - Test in-flight deduplication: hai chu kỳ gọi sát nhau sẽ tái sử dụng `cleanupInProgress` thay vì chạy chồng lấn.
   - Test xử lý an toàn khi database throw lỗi hoặc DB bị đóng (`open = false`).
   - Test xử lý duck-typing khi database không có thuộc tính `open`.
   - Test graceful shutdown coordination với `stopCleanup()`.
   - Test re-export `cleanupExpiredClaimSessions` để đảm bảo bao phủ getter function do CommonJS compile tạo ra.

### 3.3. Kết quả Coverage chi tiết
```text
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |     100 |      100 |     100 |     100 |                   
 df-claim-store.ts |     100 |      100 |     100 |     100 |                   
-------------------|---------|----------|---------|---------|-------------------
```
Đạt **100% tuyệt đối** trên cả 4 chỉ số (Statements, Branch, Functions, Lines), vượt xa ngưỡng yêu cầu.

---

## 4. XÁC MINH KIỂM THỬ THỰC TẾ (VERIFICATION EVIDENCE)

### 4.1. TypeScript Compilation
```bash
> discord-bot-klb@1.6.14 check
> tsc --noEmit -p tsconfig.json
# Trạng thái: Exit code 0 (Hoàn toàn không có lỗi kiểu)
```

### 4.2. Test Suite Execution
```bash
> discord-bot-klb@1.6.14 test
Test Suites: 92 passed, 92 total
Tests:       1171 passed, 1171 total
Snapshots:   0 total
Time:        20.787 s
# Trạng thái: 100% test suites và test cases đều PASS
```

### 4.3. Full Coverage Verification
```bash
> discord-bot-klb@1.6.14 test:coverage
# Trạng thái: Exit code 0
# Mọi threshold (Global và Per-file) đều PASS thành công.
```

---

## 5. DANH SÁCH FILE ĐÃ THAY ĐỔI

1. `src/features/delta-force/stats-select.handler.ts` (Sửa logic key-version và chặn silent fallback)
2. `src/services/df-claim-store.ts` (Sửa async in-flight cleanup và timer coordination)
3. `__tests__/df/df-stats-select.handler.test.ts` (Bổ sung test suite xác minh Task 2)
4. `__tests__/df/df-claim-store.test.ts` (Bổ sung test cases bao phủ 100% Task 4)
5. `package.json` & `package-lock.json` (Bump patch version lên `1.6.14`)
6. `docs/audit/PHASE_1_REMEDIATION.md` (Tài liệu báo cáo chi tiết này)

---

## 6. GHI CHÚ RỦI RO & PHẦN LƯỢC BỎ (RISK & OMISSION NOTE)

- **Phần lược bỏ theo thỏa thuận**:
  - Không sửa đổi logic unlink (`unlink.handler.ts`) và không xóa dữ liệu bảng `df_tokens` (được bảo lưu sang Phase 2 theo kế hoạch).
  - Không điều chỉnh phiên bản dependency hay `package-lock.json` override.
- **Rủi ro còn lại**:
  - Người dùng có binding hỏng trong cơ sở dữ liệu sẽ nhận được thông báo yêu cầu unlink và link lại khi chọn mùa giải, thay vì bot tự động lấy token plaintext cũ để hiển thị thông số. Đây là hành vi bảo mật có chủ đích (intentional security guard).
