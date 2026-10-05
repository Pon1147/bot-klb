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

---

## 3. Quy chuẩn Bảo mật (Security Standards)

* **Không hardcode secrets**: Mọi token, secret, khóa mã hóa bắt buộc đọc từ biến môi trường qua `botConfig`.
* **Mã hóa token game**: Mọi thông tin xác thực nhạy cảm của người dùng (Garena/Delta Force) bắt buộc được mã hóa qua `df-crypto.ts` (AES-256-GCM).
* **RBAC Guard**: Mọi slash command quản trị phải được bảo vệ qua hệ thống role permissions trong `permissions.ts`.
