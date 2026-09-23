# DF Toolbox — Tiện ích Chrome

Tiện ích Chrome cho Delta Force HQ, cung cấp 3 tính năng chính: **nạp code**, **liên kết tài khoản Discord**, và **giám sát trạng thái xác thực**.

---

## Tính năng

### 1. Nạp Code Tự động

Tự động nạp code trên [Trang Nạp Code Garena](https://redeem.df.garena.sg).

- Dán danh sách code (mỗi dòng một code)
- Nhấn **Lưu Code** để lưu lại
- Mở trang nạp code — bảng điều khiển xuất hiện ở góc dưới bên phải
- Nhấn **Bắt đầu** để tự động nạp
- Theo dõi kết quả theo thời gian thực: Thành công, Thất bại, Đã dùng, Có thể thử lại, Chưa kiểm tra

### 2. Liên kết Tài khoản Discord

Liên kết tài khoản Garena Delta Force với tài khoản Discord bot.

1. Chạy `/df-link start` trên Discord → nhận mã claim 6 ký tự
2. Mở `playdeltaforce.com` — bảng **DF Toolbox — Link** xuất hiện
3. Dán mã claim và nhấn **Link Discord**
4. Chờ thông báo DM "Linked successfully"

### 3. Động cơ Trạng thái Xác thực (Auth State Engine)

Giám sát trạng thái xác thực Garena theo thời gian thực.

- Theo dõi session ID, trạng thái token, khả năng refresh và thời gian còn lại
- Xem timeline sự kiện liên quan đến xác thực
- Kiểm tra quy trình refresh: request, response, thay đổi token
- Giám sát sự kiện mạng: XHR, fetch, ghi storage
- Xem chi tiết ghi storage: keys, types, values

---

## Cài đặt

### Bước 1: Giải nén

1. Bạn sẽ nhận được file: `garena-redeem-code-v2.0.0.zip`
2. Chuột phải → **Giải nén tất cả**
3. Chọn vị trí (ví dụ: Desktop)
4. Mở thư viện vừa giải nén

> **Quan trọng:** Bạn sẽ thấy `manifest.json` ngay trong thư mục. Nếu không thấy, hãy quay lại thư mục cha.

Cấu trúc đúng:

```bash
garena-redeem-code/
├── manifest.json
├── background/
├── content/
├── popup/
└── assets/
```

### Bước 2: Tải lên Chrome

1. Mở Chrome và truy cập `chrome://extensions`
2. Bật **Chế độ nhà phát triển** (góc trên bên phải)
3. Nhấn **Tải lên gói đã giải nén**
4. Chọn thư mục `garena-redeem-code`
5. Nhấn **Chọn thư mục**

Nếu cài đặt thành công, bạn sẽ thấy **DF Toolbox** trong danh sách tiện ích.

---

## Cấu hình

### Webhook URL (Bắt buộc cho liên kết Discord)

Tiện ích gửi dữ liệu claim đến Discord webhook.

1. Nhấn vào biểu tượng tiện ích **DF Toolbox**
2. Chuyển sang tab **Config**
3. Trong phần **Webhook**, dán URL Discord webhook của bạn:

   ```bash
   https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
   ```

4. Nhấn **Lưu Webhook**

> URL webhook được lưu cục bộ và không bao giờ gửi ra ngoài trình duyệt.

### Nạp Code

1. Nhấn vào biểu tượng tiện ích
2. Chuyển sang tab **Config**
3. Dán code vào ô **Redeem Codes** (mỗi dòng một code)
4. Nhấn **Lưu Code**

---

## Hướng dẫn sử dụng

### Hướng dẫn nạp code

1. Nhấn biểu tượng **DF Toolbox** → dán code → nhấn **Lưu Code**
2. Mở [Trang Nạp Code Garena](https://redeem.df.garena.sg)
3. Tìm bảng điều khiển **Garena Redeem** ở góc dưới bên phải
4. Nhấn **Bắt đầu** để tự động nạp
5. Theo dõi kết quả trên bảng:

| Trạng thái | Ý nghĩa                        |
| ---------- | ------------------------------ |
| Redeemed   | Code đã được nạp thành công    |
| Dead       | Code hết hạn hoặc đã được dùng |
| Retryable  | Lỗi tạm thời — có thể thử lại  |
| Untested   | Code chưa được xử lý           |

### Dừng hoặc Tiếp tục

- Nhấn **Dừng** để tạm dừng quy trình nạp
- Nhấn **Tiếp tục** để tiếp tục từ vị trí đã dừng

> **Lưu ý:** Không đóng trang nạp code trong khi quy trình đang chạy.

### Liên kết Discord

1. Chạy `/df-link start` trên Discord → nhận mã claim
2. Mở [playdeltaforce.com](https://www.playdeltaforce.com)
3. Bảng **DF Toolbox — Link** xuất hiện ở góc dưới bên phải
4. Dán mã claim → nhấn **Link Discord**
5. Chờ thông báo xác nhận từ bot

### Động cơ Trạng thái Xác thực

1. Nhấn vào biểu tượng tiện ích → chuyển sang tab **Auth Investigator**
2. Chuyển đến các tab con:

| Tab      | Hiển thị                                                          |
| -------- | ----------------------------------------------------------------- |
| Overview | Session ID, trạng thái token, khả năng refresh, thời gian còn lại |
| Timeline | Danh sách sự kiện xác thực theo thời gian                         |
| Refresh  | Quy trình refresh: request, response, thay đổi token              |
| Network  | Sự kiện XHR và fetch với chi tiết                                 |
| Storage  | Sự kiện ghi LocalStorage                                          |

---

## Khắc phục sự cố

### Bảng điều khiển không xuất hiện

1. Đảm bảo bạn đang ở đúng trang (`redeem.df.garena.sg` hoặc `playdeltaforce.com`)
2. F5 để tải lại trang
3. Kiểm tra tiện ích đã được bật trong `chrome://extensions`
4. Đóng và mở lại tab

### Quy trình nạp không bắt đầu

- Bạn đã đăng nhập Garena chưa?
- Bạn đã lưu code chưa?
- Code có được nhập mỗi dòng một code không?
- Bạn có đang ở đúng trang nạp code không?

### Bảng Link không xuất hiện

- Đảm bảo bạn đang ở `playdeltaforce.com`
- F5 để tải lại trang
- Kiểm tra tiện ích đã được bật

### Mã claim bị từ chối

- Mã hết hạn sau **10 phút** — tạo mã mới với `/df-link start`
- Mỗi code chỉ có thể dùng **một lần**

### "Webhook not configured"

- Vào popup tiện ích → tab Config → phần Webhook
- Lưu URL Discord webhook hợp lệ

### Tab Auth Investigator không hiển thị dữ liệu

- Truy cập `playdeltaforce.com`, `sso.garena.com` hoặc `auth.garena.com`
- Tiện ích tự động bắt sự kiện xác thực
- Dữ liệu xuất hiện trong tab Investigator sau khi truy cập các trang này

---

## Gỡ cài đặt

1. Mở Chrome → truy cập `chrome://extensions`
2. Tìm **DF Toolbox**
3. Nhấn **Xóa**

> Thao tác này chỉ gỡ tiện ích. Code nạp và URL webhook được lưu trong Chrome local storage sẽ bị xóa khi gỡ.

---

## Hỗ trợ

Nếu gặp vấn đề hoặc cần trợ giúp, tham gia Discord server: [Hỗ trợ Discord](https://discord.gg/vz6w6c3Xe3)

**Tác giả:** Pon1147
