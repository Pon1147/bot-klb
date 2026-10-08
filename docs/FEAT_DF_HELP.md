# Feature Proposal: `/df help` & Tự động Đóng gói Extension (.zip)

## 1. Mục tiêu (Goals)
- Cung cấp trung tâm trợ giúp và hướng dẫn toàn diện cho người dùng Discord ngay trong ứng dụng thông qua lệnh `/df help`.
- Tự động đóng gói extension `garena-redeem-code` thành file `DF-Extension.zip` sạch (loại bỏ tests và file tạm).
- Đính kèm trực tiếp file `DF-Extension.zip` qua Discord (`AttachmentBuilder`) trong cả `/df help` và `/df link start` để người dùng non-tech có thể tải về 1-click mà không cần tìm link ngoài.

---

## 2. Checklist Kỹ thuật & Nghiệp vụ

### 📦 2.1. Đóng gói Extension (Build & Packaging)
- [ ] Viết script `scripts/package-extension.ts`:
  - Đọc thư mục `garena-redeem-code/`.
  - Chỉ lọc các file cần thiết: `manifest.json`, `background/`, `content/`, `popup/`, `assets/`.
  - Loại bỏ thư mục `tests/`, file markdown, file tạm.
  - Nén thành file zip tại `src/assets/downloads/DF-Extension.zip`.
- [ ] Thêm lệnh npm script vào `package.json`:
  ```json
  "package:extension": "tsx scripts/package-extension.ts"
  ```
- [ ] Xử lý path resolution an toàn cho cả môi trường dev (`src/`) và prod (`dist/`).

### 🛡️ 2.2. Bảo mật & Xác thực (Security)
- [ ] Đảm bảo file zip không chứa bất kỳ secret hay webhook URL cứng nào.
- [ ] Hướng dẫn người dùng về thông báo "Developer mode / Load unpacked" của trình duyệt để họ yên tâm cài đặt.

### 🤖 2.3. Trải nghiệm Discord & Slash Commands (UX & Handlers)
- [ ] Khai báo subcommand `help` trong `src/features/delta-force/df.command.ts`:
  ```typescript
  .addSubcommand((sub) =>
    sub.setName('help').setDescription('Xem hướng dẫn sử dụng bot và tải tiện ích liên kết tài khoản.'),
  )
  ```
- [ ] Xây dựng `src/features/delta-force/help.handler.ts`:
  - Sử dụng Discord Components V2 (`ContainerBuilder`).
  - Gồm 2 tab/view: Tổng quan lệnh (`/df`, `/team`, `/config`) và Hướng dẫn liên kết tài khoản từng bước.
  - Đính kèm file `DF-Extension.zip` với cờ `MessageFlags.Ephemeral`.
- [ ] Cập nhật `src/features/delta-force/link.handler.ts`:
  - Trong lệnh `/df link start`, đính kèm sẵn file `DF-Extension.zip` để người dùng vừa lấy claim code vừa có file cài tiện ích ngay lập tức.

### 🧪 2.4. Kiểm thử & Kiểm soát chất lượng (Testing)
- [ ] Viết unit test cho `help.handler.ts`.
- [ ] Cập nhật unit test `__tests__/df/df.command.test.ts` cho subcommand `help`.
- [ ] Đảm bảo `npm run check` và `npm test` vượt qua 100%.

