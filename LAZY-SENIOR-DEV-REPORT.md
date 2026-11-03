# BÁO CÁO TOÀN DIỆN: HỆ SINH THÁI LAZY SENIOR DEV CHO ANTIGRAVITY
*(Final Architecture Audit & Production Setup)*

> **Môi trường hệ thống:**
> - **Hệ điều hành:** Windows 11 (64-bit)
> - **Antigravity CLI:** v1.4.12
> - **Node.js:** v24.21.0
> - **NPM:** 11.19.0
> - **Git:** 2.55.0.windows.5
> - **LLM Model:** Gemini Flash (Tối ưu token context, Zero-Bloat, Progressive Disclosure, Ưu tiên chất lượng & độ ổn định)

---

## 1. Những thành phần đã cài đặt

1. **Plugin Ponytail (v5.3.3)**:
   - Cài đặt chính thức qua Antigravity CLI tại `~/.gemini/config/plugins/ponytail`.
   - Cung cấp 6 kỹ năng và slash commands chính:
     - `/ponytail` (Chuyển đổi mức độ: lite, full, ultra)
     - `/ponytail-review` (Rà soát bloatware, over-engineering, reinventions)
     - `/ponytail-audit` (Kiểm tra chất lượng & độ phức tạp tổng thể dự án)
     - `/ponytail-debt` (Theo dõi nợ kỹ thuật và các chú thích `shortcut:`)
     - `/ponytail-gain` (Đo lường lượng LOC và token tiết kiệm)
     - `/ponytail-help` (Hướng dẫn sử dụng Ponytail)
2. **Plugin Superpowers (v7.0.1)**:
   - Cài đặt chính thức qua Antigravity CLI tại `~/.gemini/config/plugins/superpowers`.
   - Cung cấp 15 kỹ năng kỹ thuật phần mềm tiêu chuẩn (Brainstorming, TDD, Systematic Debugging, Worktrees, Code Review, Subagent-driven planning...).
3. **Workspace Skills Chuyên biệt (Tại `.agents/skills/`)**:
   - `documentation-research`: Truy vấn tài liệu thực tế qua Context7 & type declarations local, chống hallucination.
   - `ui-ux-design`: Thiết kế giao diện thực dụng, tinh gọn, chuẩn Discord Components V2 và Accessibility.
4. **Quy tắc Dự án Toàn cục (`AGENTS.md`)**:
   - Tích hợp 11 nguyên tắc cốt lõi của Ponytail.
   - Bảo toàn 100% quy tắc kiến trúc Vertical Slice, Node16 `.js` import và an toàn bảo mật của `bot-klb`.
   - Thiết lập nguyên tắc phân cấp rõ ràng giữa Ponytail (Coding Philosophy) và Superpowers (Workflow Planning).

---

## 2. Trạng thái MCP (Model Context Protocol)

Cấu hình tại `~/.gemini/config/mcp_config.json`:

| MCP Server | Trạng thái | Chế độ khởi chạy | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Context7** (`@upstash/context7-mcp`) | ✅ **Enabled** | Stdio (npx) | Luôn sẵn sàng tra cứu tài liệu mới nhất từ các thư viện / framework. |
| **Playwright** (`@playwright/mcp`) | ⏸️ **Disabled** | On-Demand (`agy mcp enable playwright`) | Browser E2E testing & scraping (tắt mặc định để tiết kiệm ~3,500 token schema). |
| **GitHub MCP** (`github-mcp-server`) | ⏸️ **Disabled** | On-Demand (`agy mcp enable github`) | Quản lý Issue/PR trên GitHub (tắt mặc định cho đến khi người dùng cấp PAT). |

> **Lợi ích**: Tắt 2 server nặng giúp giảm ngay **~5,000 tokens schema** ở mỗi lượt request mà không làm mất tính năng khi cần.

---

## 3. Cần cấp quyền hoặc API key (Nếu cần kích hoạt)

- **GitHub MCP Server**:
  - Cần biến môi trường `GITHUB_PERSONAL_ACCESS_TOKEN` để gọi API GitHub.
  - Thiết lập trong PowerShell khi cần:
    ```powershell
    [System.Environment]::SetEnvironmentVariable('GITHUB_PERSONAL_ACCESS_TOKEN', 'ghp_your_token_here', 'User')
    agy mcp enable github
    ```
- **Context7 MCP**: Hoạt động sẵn sàng ở chế độ Community không cần API key. Nếu có key trả phí, đặt `CONTEXT7_API_KEY`.

---

## 4. Nguyên tắc Phân cấp & Triết lý Làm việc

### 1. Ponytail kiểm soát Coding Philosophy:
- "The best code is the code you never wrote."
- Giải pháp đúng nhỏ nhất, 1 dòng code dễ hiểu hơn hàm phức tạp.
- Tận dụng Standard Library và helpers sẵn có trước khi viết mới hoặc cài thư viện.
- Không bao giờ cắt bớt validation, error handling chống mất dữ liệu, hoặc bảo mật.

### 2. Superpowers điều phối Workflow (Theo nhu cầu):
- Chỉ kích hoạt quy trình phân rã kế hoạch lớn (`writing-plans`, subagents) khi đối mặt với tác vụ đa module phức tạp hoặc khi người dùng yêu cầu rõ ràng.
- **Không áp đặt quy trình phức tạp (worktree, subagent) cho các tác vụ nhỏ hoặc cục bộ.**

### 3. Kỷ luật Testing theo mức độ rủi ro (Risk-Based Testing):
- **Rủi ro cao (High Risk)**: Logic bảo mật, mã hóa token (`df-crypto`), xác thực, database mutation $\rightarrow$ Bắt buộc viết test nghiêm ngặt (TDD).
- **Rủi ro trung bình (Medium Risk)**: Slash commands, logic feature mới $\rightarrow$ Unit/Integration test cho luồng chính và lỗi.
- **Rủi ro thấp / Tầm thường (Low/Trivial Risk)**: Đổi copy/text UI, format log, sửa comment $\rightarrow$ Không cần test mới; chạy `npm run check` xác minh 0 compile error.

---

## 5. Hướng dẫn Xử lý theo từng loại Nhiệm vụ (Task Playbooks)

| Loại Task | Quy trình thực thi | Skills / Tools ưu tiên |
| :--- | :--- | :--- |
| **1. Quick Fix** | Sửa đúng dòng cần sửa $\rightarrow$ Chạy `npm run check` $\rightarrow$ Kết thúc bằng 1 dòng Risk Note. Không tạo plan, không subagent. | Ponytail minimalism |
| **2. Feature Development** | Đọc slice trong `src/features/<feature>/` $\rightarrow$ Tái sử dụng utils/services $\rightarrow$ Viết code tối giản (.js import) $\rightarrow$ Viết test logic $\rightarrow$ Verify (`npm run check` & `npm test`). | `ponytail`, `ui-ux-design` |
| **3. Bug Investigation** | Tái hiện lỗi qua test runner $\rightarrow$ Lần theo stack trace đến root cause $\rightarrow$ Grep callers $\rightarrow$ Sửa dứt điểm tại gốc trong shared code $\rightarrow$ Verify lại test. | `systematic-debugging` |
| **4. Code Review** | Rà soát secret leak, RBAC guard, over-engineering, dead code, import extension $\rightarrow$ Báo cáo phân loại Blocker / Simplification / Risk. | `/ponytail-review` |
| **5. Refactoring** | Chạy test suite trước (Green baseline) $\rightarrow$ Tái cấu trúc giữ nguyên hành vi bên ngoài $\rightarrow$ Xóa code thừa $\rightarrow$ Chạy lại test suite để chứng minh 0 regression. | `ponytail`, `npm test` |
| **6. Architecture Design** | Thảo luận ranh giới Slice $\rightarrow$ Thiết kế cấu trúc thư mục tự chứa trong `src/features/` $\rightarrow$ Xác định RBAC & error boundaries $\rightarrow$ Lập plan chi tiết nếu cần. | `writing-plans`, `brainstorming` |

---

## 6. Kết quả Kiểm thử Thực tế (Verification Evidence)

1. **TypeScript Typecheck (`npm run check`):**
   - Lệnh: `tsc --noEmit -p tsconfig.json`
   - Kết quả: **0 errors** (Exit code `0`).
2. **Toàn bộ Test Suite (`npm test`):**
   - Lệnh: `jest --forceExit --detectOpenHandles`
   - **Test Suites:** `82/82 passed` (100%)
   - **Tests:** `1078/1078 passed` (100%)
   - **Snapshots:** 0
   - **Thời gian chạy:** ~33.5s
3. **MCP JSON-RPC Handshake:**
   - `context7`: Server Info Version `4.5.0` (Active).
   - `playwright`: Server Info Version `1.65.0-alpha` (Configured, Disabled).
   - `github`: Server Info Version `0.6.2` (Configured, Disabled).

---

## 7. Kết quả Real-World Acceptance Test (5 Tình huống Thực tế)

| Tình huống | Mục tiêu & Phạm vi thực thi | Workflow & Triết lý áp dụng | Kết quả xác minh |
| :--- | :--- | :--- | :--- |
| **1. Quick Fix** | Thêm assertion kiểm tra idempotency cho hàm khởi tạo bảng SQLite trong `__tests__/utils/coverage-gaps.test.ts`. | **Playbook Quick Fix**: Sửa trực diện 1 dòng, không tạo plan/subagent/abstraction. | ✅ `PASS` (2/2 tests pass, 0.8s) |
| **2. Bug Investigation** | Truy vết nguồn gốc lỗi log: `Scrape daily codes failed: A dynamic import callback was invoked without --experimental-vm-modules` tại `code.handler.ts:67`. | **Playbook Bug Investigation**: Lần stack trace từ caller đến callee. Root cause: Jest Node VM chạy CommonJS không hỗ trợ dynamic ESM import nếu thiếu cờ. Runtime có graceful fallback an toàn. | ✅ Root cause xác định rõ ràng, không vá ẩu. |
| **3. Feature Development** | Triển khai tiện ích `isValidSnowflake` kiểm tra Discord ID (17-20 chữ số) tại `src/utils/snowflake.util.ts` + unit tests. | **Playbook Feature Dev**: KISS & YAGNI, 1 dòng regex `/^\d{17,20}$/`, zero-dependency, Node16 `.js` import. | ✅ `PASS` (2/2 tests pass, coverage 100%) |
| **4. Code Review** | Rà soát module production `src/database/df-binding.db.ts` (đang mở trên editor). | **Playbook Code Review**: Đánh giá bảo mật AES-256-GCM, SQL parameterized query, chỉ ra điểm cải thiện: `void upsertAccountBindingToMongo` (fire-and-forget promise desync). | ✅ Báo cáo phân loại Blocker / Simplification / Risk rõ ràng. |
| **5. Refactoring** | Nâng cấp `isValidSnowflake` thành TypeScript Type Guard (`id is string`) để tự động thu hẹp kiểu dữ liệu ở call sites. | **Playbook Refactoring**: Giữ nguyên baseline xanh, 0 runtime behavioral changes, cải thiện tính an toàn kiểu. | ✅ `PASS` (Tests pass, `npm run check` 0 error). |

---

## 8. Hướng dẫn Rollback

1. **Khôi phục file gốc:**
   ```powershell
   Copy-Item -Path "f:\KhoaLPD\bot\bot_klb\AGENTS.md.bak" -Destination "f:\KhoaLPD\bot\bot_klb\AGENTS.md" -Force
   Copy-Item -Path "$env:USERPROFILE\.gemini\config\mcp_config.json.bak" -Destination "$env:USERPROFILE\.gemini\config\mcp_config.json" -Force
   ```
2. **Xóa cấu hình cục bộ & plugin:**
   ```powershell
   Remove-Item -Path "f:\KhoaLPD\bot\bot_klb\.agents" -Recurse -Force
   & "$env:USERPROFILE\.gemini\bin\agy.exe" plugin uninstall ponytail
   & "$env:USERPROFILE\.gemini\bin\agy.exe" plugin uninstall superpowers
   ```
