# Hướng Dẫn Đóng Góp (Contributing Guidelines)

Cảm ơn bạn đã quan tâm đóng góp cho dự án **bot_klb**! Để đảm bảo mã nguồn luôn ổn định và đồng nhất, vui lòng tuân thủ các quy tắc dưới đây.

---

## 1. Quy Trình Làm Việc (Git Workflow)

1. **Nhánh riêng biệt**: Luôn tạo branch mới từ `main` trước khi chỉnh sửa:
   - Tính năng mới: `git switch -c feat/<ten-tinh-nang>`
   - Sửa lỗi: `git switch -c fix/<ten-loi>`
2. **Không commit trực tiếp trên `main`**.
3. **Commit message có ý nghĩa**: Tuân thủ chuẩn Conventional Commits (ví dụ: `feat(keo): add auto qr`, `fix(auth): handle expired token`).

---

## 2. Quy Chuẩn Kỹ Thuật

- **ModuleResolution**: Dự án dùng `"moduleResolution": "node16"`. Mọi relative import trong TypeScript **bắt buộc có đuôi `.js`** (ví dụ: `import { ... } from './helper.js'`).
- **Chú thích mã nguồn**: Comment giải thích logic nghiệp vụ bằng **tiếng Việt**.
- **Tối giản (Ponytail)**: Tận dụng các hàm/service có sẵn trong codebase trước khi viết mới. Tránh thêm dependency không cần thiết.

---

## 3. Kiểm Thử & Xác Minh (Testing)

Trước khi mở Pull Request, bạn bắt buộc phải chạy và kiểm tra kết quả:

```bash
# 1. Kiểm tra lỗi kiểu dữ liệu TypeScript
npm run check

# 2. Chạy toàn bộ test suites
npm test
```

Mọi PR chỉ được duyệt khi `npm run check` đạt 0 lỗi và tất cả test cases đều PASS.
