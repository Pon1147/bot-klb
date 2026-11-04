# Hướng dẫn Kiến trúc & Giới hạn Ngữ cảnh cho AI Agents (AGENTS.md)

Tài liệu này định nghĩa cấu trúc kiến trúc và các quy tắc làm việc cho AI Coding Assistants trong repository **`bot-klb`** để hạn chế quá tải ngữ cảnh (cognitive load) và triệt tiêu hallucination.

---

## 1. Cấu trúc Kiến trúc (Vertical Slice Architecture)

Repository được tổ chức theo ranh giới lớp và tính năng:

```text
src/
├── app/                  # Application Layer: Orchestration & Startup sequence (bootstrap.ts)
├── infrastructure/       # Discord Infrastructure: Command loader, Event loader, Interaction router
├── features/             # Feature Slices (Tự chứa: commands, services, db, handlers riêng)
│   ├── welcome/          # Hệ thống chào mừng thành viên mới
│   ├── booster/          # Hệ thống cảm ơn server booster
│   ├── container/        # Trình soạn thảo Discord Components V2
│   ├── delta-force/      # Nghiệp vụ game Delta Force (Stats, Daily, Code, Team-find, Link)
│   └── admin/            # Quản trị & RBAC
├── database/             # SQLite connection & legacy tables
├── services/             # Shared background services
├── utils/                # Pure utilities & logging
└── types/                # Type declarations
```

---

## 2. Quy tắc chống Hallucination (Anti-Hallucination Boundaries)

1. **Local Context First**: Khi được yêu cầu chỉnh sửa hoặc thêm tính năng thuộc nghiệp vụ X, **CHỈ ĐỌC VÀ SỬA ĐỔI FILE TRONG `src/features/X/`**. Tuyệt đối không load tràn lan file của các tính năng khác.
2. **Import Extension Bắt buộc**: Dự án dùng `"moduleResolution": "node16"`. Mọi relative import trong TypeScript **bắt buộc phải có đuôi `.js`** (ví dụ: `import { ... } from './my-service.js';`).
3. **Không đoán mò Path**: Luôn kiểm tra file tồn tại trước khi import.
4. **Không Monkey-Patching**: Không tự tiện gán thêm thuộc tính tùy tiện vào `client` nếu chưa có declaration merging trong `src/types/`.
5. **Giữ kỷ luật Testing**: Sau mỗi thay đổi code, chạy `npm run check` và `npm test` để đảm bảo 0 regression.
6. **Chú thích Tiếng Việt**: Code mới hoặc code refactor phải có comment tiếng Việt rõ ràng.
7. **Kỷ luật Quản lý Version (Version Discipline)**: Mọi bản cập nhật tính năng hoặc sửa lỗi cho Extension/Bot bắt buộc phải tăng version SemVer (`npm run version:bump` hoặc `npm run bump:ext`). Tuyệt đối không thay đổi logic hay UI mà giữ nguyên số version cũ.

---

## 3. Quy chuẩn Bảo mật (Security Standards)

* **Không hardcode secrets**: Mọi token, secret, khóa mã hóa bắt buộc đọc từ biến môi trường qua `botConfig`.
* **Mã hóa token game**: Mọi thông tin xác thực nhạy cảm của người dùng (Garena/Delta Force) bắt buộc được mã hóa qua `df-crypto.ts` (AES-256-GCM).
* **RBAC Guard**: Mọi slash command quản trị phải được bảo vệ qua hệ thống role permissions trong `permissions.ts`.

---

## 4. Nguyên tắc Lazy Senior Dev (Ponytail Core Philosophy)

> *"The best code is the code you never wrote. He says nothing. He writes one line. It works."*

AI Agent phải hoạt động như một Senior Developer thực dụng, đề cao tính tối giản và hiệu quả cao:

1. **Understand before coding (Hiểu rõ trước khi code)**:
   - Đọc kỹ yêu cầu và đọc trực tiếp các file code liên quan trước khi sửa.
   - Xác định toàn bộ phạm vi ảnh hưởng (callers, tests, types, configs). Không sửa mò.
2. **Smallest correct solution (Giải pháp đúng nhỏ nhất)**:
   - Chọn cách tiếp cận tốn ít dòng code mới nhất nhưng giải quyết trọn vẹn vấn đề.
   - Ưu tiên phương án 1 dòng code dễ hiểu hơn là viết hàm phức tạp.
3. **Reuse before creating (Tái sử dụng trước khi tạo mới)**:
   - Tận dụng tối đa các helper, service, util có sẵn trong codebase trước khi viết mới.
   - Tận dụng tính năng có sẵn của ngôn ngữ (Standard Library) và nền tảng runtime.
4. **KISS & YAGNI (Đơn giản tối đa & Bạn sẽ chưa cần đến nó)**:
   - Không thêm các option, tham số, nhánh rẽ dự phòng cho tương lai nếu người dùng không yêu cầu.
   - Xóa bỏ code thừa tốt hơn là thêm code mới.
5. **No unnecessary dependencies (Không thêm thư viện thừa)**:
   - Tuyệt đối không cài thêm package bên ngoài chỉ để giải quyết vài dòng code có thể tự viết đơn giản hoặc đã có trong stdlib.
6. **No premature abstraction (Không trừu tượng hóa sớm)**:
   - Không tạo thêm lớp bọc (wrapper), interface, factory, design pattern cồng kềnh khi chưa có từ 3 trường hợp sử dụng cụ thể trở lên.
7. **No unrelated refactoring (Không refactor lan man)**:
   - Giữ nguyên kiến trúc, convention và format hiện tại của codebase.
   - Không tự ý format lại toàn bộ file hoặc sửa đổi các hàm không liên quan đến phạm vi nhiệm vụ.
8. **Security and validation are mandatory (Bảo mật & Kiểm tra là bất khả xâm phạm)**:
   - Không bao giờ cắt bớt validation tại trust boundary, xử lý lỗi ngăn chặn mất dữ liệu, kiểm tra quyền truy cập hay mã hóa.
9. **Never claim tests passed without execution (Không bao giờ khẳng định test đã pass nếu chưa chạy)**:
   - Phải thực thi test (`npm test`, `npm run check`) và kiểm tra output thực tế trước khi khẳng định thành công.
10. **Follow existing project conventions (Tuân thủ quy ước dự án)**:
    - Bắt buộc tuân thủ moduleResolution `node16` (đuôi `.js`), kiến trúc Vertical Slice và comment tiếng Việt của dự án.
11. **Risk & Omission Summary (Tóm tắt rủi ro và phần lược bỏ)**:
    - Khi kết thúc mỗi nhiệm vụ, cung cấp 1-2 dòng ngắn gọn nêu rõ những gì đã bỏ qua/chưa kiểm tra và rủi ro (nếu có) để người dùng nắm rõ.

---

## 5. Phân cấp Quyền ưu tiên & Phối hợp Ponytail - Superpowers

1. **Ponytail kiểm soát Coding Philosophy (Kim chỉ nam cốt lõi)**:
   - Mọi dòng code viết ra bắt buộc tuân theo tư duy Lazy Senior Dev: giải pháp nhỏ nhất, trực diện, không tạo boilerplate, tái sử dụng tối đa.
2. **Superpowers điều phối Workflow theo nhu cầu (On-Demand Workflows)**:
   - Chỉ kích hoạt quy trình lập kế hoạch hoặc subagents (`writing-plans`, subagents) khi đối mặt với tính năng phức tạp, thay đổi lớn chạm nhiều module, hoặc khi người dùng yêu cầu rõ ràng.
   - **Tuyệt đối không áp đặt quy trình phức tạp (worktrees, multi-step subagents) cho các tác vụ nhỏ hoặc cục bộ.**
3. **Kỷ luật Testing linh hoạt theo mức độ rủi ro (Risk-Based Testing)**:
   - **Rủi ro cao (High Risk)**: Logic bảo mật, mã hóa token (`df-crypto`), xác thực người dùng, giao dịch dữ liệu nhạy cảm $\rightarrow$ Bắt buộc có kiểm thử nghiêm ngặt bao phủ cả happy path và edge cases trước khi hoàn thành.
   - **Rủi ro trung bình (Medium Risk)**: Nghiệp vụ mới, command handler, query database $\rightarrow$ Đảm bảo có unit/integration test cho logic chính và xử lý lỗi.
   - **Rủi ro thấp / Tầm thường (Low/Trivial Risk)**: Thay đổi nhãn giao diện (copy/text), format log, chỉnh sửa type định nghĩa $\rightarrow$ Không cần tạo thêm test dư thừa; chỉ cần chạy `npm run check` xác minh 0 lỗi compile.
4. **Tối ưu Context nhưng không hy sinh chất lượng**:
   - Trả lời thẳng thắn, súc tích, cung cấp diff cụ thể và bằng chứng thực thi thực tế.

---

## 6. Hướng dẫn Xử lý theo từng loại Nhiệm vụ (Task Playbooks)

AI Agent khi nhận nhiệm vụ cần nhận diện và áp dụng đúng playbook tương ứng:

### 1. Quick Fix (Sửa nhanh lỗi nhỏ, typo, cập nhật config cục bộ)
- **Quy trình**: Đọc trực tiếp file $\rightarrow$ Sửa đúng dòng cần sửa (nhỏ nhất) $\rightarrow$ Chạy `npm run check` $\rightarrow$ Kết thúc với 1 dòng Risk Note.
- **Quy tắc**: Không tạo plan, không subagent, không thêm abstraction.

### 2. Feature Development (Phát triển tính năng mới)
- **Quy trình**: 
  1. Đọc kiến trúc Vertical Slice trong `src/features/<feature>/`.
  2. Tận dụng tối đa services/utils có sẵn trong codebase trước khi viết mới.
  3. Viết code tối giản, tuân thủ moduleResolution `node16` (`.js` extension) và comment tiếng Việt.
  4. Viết test cho logic nghiệp vụ mới (nếu phi tầm thường).
  5. Chạy `npm run check` và `npm test` liên quan.

### 3. Bug Investigation (Điều tra & Sửa lỗi)
- **Quy trình**: 
  1. Tái hiện lỗi qua test runner hoặc lệnh gọi cụ thể trước khi sửa.
  2. Lần theo stack trace đến nguyên nhân gốc (root cause). Dùng grep tìm mọi callers bị ảnh hưởng.
  3. Sửa dứt điểm tại gốc trong shared code, không vá ngọn hay bọc `try/catch` nuốt lỗi.
  4. Chạy lại test tái hiện để chứng minh bug đã được diệt tận gốc.

### 4. Code Review (Kiểm duyệt mã nguồn)
- **Quy trình**: 
  1. Kích hoạt tư duy `/ponytail-review`.
  2. Soát lỗi bảo mật (secret leak, SQL/NoSQL injection, thiếu RBAC guard).
  3. Tìm kiếm bloatware: hàm/class tạo ra chỉ dùng 1 lần, thư viện thừa, abstraction sớm.
  4. Kiểm tra import extension `.js` và quy chuẩn kiến trúc của dự án.
  5. Báo cáo phân loại: Blocker (phải sửa) $\rightarrow$ Simplification (nên sửa) $\rightarrow$ Risk Note.

### 5. Refactoring (Tái cấu trúc code)
- **Quy trình**: 
  1. Chạy test suite trước khi refactor để bảo đảm baseline đang xanh (Green baseline).
  2. Thực hiện refactor bảo toàn hành vi bên ngoài (external behavior).
  3. Xóa bỏ code chết, code thừa tốt hơn là thêm wrapper mới.
  4. Chạy lại test suite để chứng minh 0 regression.

### 6. Architecture Design (Thiết kế kiến trúc / Module lớn)
- **Quy trình**:
  1. Thảo luận và thống nhất ranh giới module (Slice boundaries).
  2. Thiết kế cấu trúc thư mục tự chứa trong `src/features/<new-slice>/`.
  3. Xác định rõ RBAC permissions, database schema, và error boundaries.
  4. Kích hoạt quy trình `writing-plans` (Superpowers) nếu cần phân rã thành các bước triển khai độc lập.
