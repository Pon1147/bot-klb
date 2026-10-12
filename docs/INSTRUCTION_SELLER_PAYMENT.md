# 📖 Hướng Dẫn Sử Dụng & Vận Hành Hệ Thống Thợ Kéo (Seller Payment)

Tài liệu hướng dẫn chi tiết dành cho **Server Admin**, **Thợ Kéo (Sellers)** và **Khách Hàng (Buyers)** khi sử dụng tính năng Quản lý Thợ Kéo & Thanh toán VietQR tự động trên bot **`bot_klb`**.

---

## 🎯 Tổng Quan Các Lệnh

| Lệnh Slash | Người Sử Dụng | Mục Đích |
| :--- | :--- | :--- |
| `/seller config setrole <role>` | **Admin / Guild Owner** | Thiết lập role định danh Thợ Kéo của máy chủ |
| `/seller qr [user]` | **Thợ Kéo / Admin** | Cấu hình tài khoản ngân hàng (STK, Tên, Bank) & xem trước QR |
| `/seller pay <buyer> <amount> <desc> [seller]` | **Thợ Kéo / Admin** | Tạo đơn kéo & xuất mã VietQR động có sẵn số tiền & mã đơn |
| `/seller history [user] [status]` | **Tất cả thành viên** | Xem lịch sử đơn kéo cá nhân (Pending, Confirmed, Cancelled) |
| `/seller top [limit]` | **Tất cả thành viên** | Bảng xếp hạng thợ kéo uy tín & doanh thu cao nhất server |

---

## 🛠️ Quy Trình Vận Hành Từng Bước

### Bước 1: Quản Trị Viên Thiết Lập Role Thợ Kéo
> **Mục đích**: Phân định rõ ràng ai là thợ kéo uy tín được server chứng nhận.

1. Vào **Cài đặt máy chủ (Server Settings)** trên Discord -> tạo một Role mới (ví dụ: `@Thợ Kéo`).
2. Gõ lệnh:
   ```text
   /seller config setrole role:@Thợ Kéo
   ```
3. Bot phản hồi xác nhận: `✅ Đã thiết lập role Thợ Kéo của server thành: Thợ Kéo`.

---

### Bước 2: Thợ Kéo Cài Đặt Tài Khoản Ngân Hàng (Chỉ làm 1 lần)
> **Mục đích**: Lưu thông tin ngân hàng để bot tự sinh mã VietQR nhận tiền.

1. Thợ kéo gõ:
   ```text
   /seller qr
   ```
   *(Thông báo gửi dạng riêng tư - Ephemeral, chỉ thợ kéo nhìn thấy)*.
2. Bấm nút **`[🏦 Chọn Ngân Hàng]`** (hoặc `[🏦 Đổi Ngân Hàng]`).
3. Chọn ngân hàng của bạn từ danh sách (Top 25 ngân hàng tại Việt Nam: MBBank, Vietcombank, Techcombank, ACB, VPBank, TPBank...).
4. Một cửa sổ (Modal) sẽ hiện lên yêu cầu:
   * **Số Tài Khoản**: Nhập chính xác STK ngân hàng.
   * **Tên Chủ Tài Khoản**: Nhập họ tên in hoa không dấu (ví dụ: `NGUYEN VAN A`).
5. Bấm **Gửi (Submit)**.
6. Bot sẽ cập nhật Dashboard hiển thị ảnh QR mẫu để bạn kiểm tra lại.

---

### Bước 3: Tạo Đơn Kéo & Thanh Toán Trực Tiếp
> **Mục đích**: Tạo phiếu thanh toán an toàn, minh bạch ngay trong kênh chat hoặc Ticket.

1. Khi chốt kèo với khách, Thợ kéo gõ:
   ```text
   /seller pay buyer:@KháchHàng amount:150000 description:Kéo 3 trận Đập Nước
   ```
2. Bot tự động:
   * Sinh mã giao dịch duy nhất dạng: `TX...` (ví dụ: `TX8A2B9C1D`).
   * Sinh ảnh VietQR chuẩn NAPAS 24/7 chứa sẵn số tiền `150,000 VNĐ` và nội dung chuyển khoản `TX8A2B9C1D`.
   * Gửi phiếu thanh toán vào kênh kèm 2 nút bấm: **`[✅ Xác Nhận Đã Nhận Tiền]`** và **`[❌ Hủy Đơn]`**.
3. **Khách Hàng**:
   * Mở app ngân hàng (hoặc ví điện tử bất kỳ) -> Quét mã QR hiển thị trên màn hình.
   * Toàn bộ STK, tên người nhận, số tiền và nội dung đều được điền tự động 100%. Khách chỉ cần xác nhận chuyển tiền.
4. **Xác Nhận Đơn**:
   * Khi tài khoản thông báo đã nhận đủ tiền, Thợ Kéo bấm nút **`[✅ Xác Nhận Đã Nhận Tiền]`**.
   * Nhập ghi chú xác nhận (nếu muốn) và bấm Gửi.
   * Bot cập nhật trạng thái phiếu thành: `✅ THANH TOÁN ĐÃ ĐƯỢC XÁC NHẬN` và khóa các nút bấm.
5. **Nếu Hủy Kèo**:
   * Nếu có vấn đề phát sinh, Thợ kéo hoặc Khách bấm **`[❌ Hủy Đơn]`**.
   * Nhập lý do hủy bắt buộc (ví dụ: *Khách bận đột xuất*).
   * Bot cập nhật trạng thái thành `❌ ĐƠN GIAO DỊCH ĐÃ BỊ HỦY`.

---

### Bước 4: Khách Hàng Đánh Giá Dịch Vụ (1 - 5 ⭐)
1. Ngay khi đơn được Xác nhận hoàn tất, bot tự động gửi thông báo mời khách đánh giá:
   * Hàng nút 5 sao: `[1 ⭐]` `[2 ⭐]` `[3 ⭐]` `[4 ⭐]` `[5 ⭐]`.
2. Khách bấm chọn số sao tương ứng và nhập nhận xét (feedback).
3. Đánh giá được lưu vào hồ sơ uy tín của thợ kéo để tính điểm trung bình trên Bảng Xếp Hạng.

---

### Bước 5: Xem Lịch Sử & Bảng Xếp Hạng
* **Xem lịch sử giao dịch cá nhân**:
  ```text
  /seller history
  ```
  *(Có thể lọc theo trạng thái: Pending, Confirmed, Cancelled)*.
* **Xem bảng xếp hạng Thợ Kéo toàn server**:
  ```text
  /seller top
  ```
  *(Hiển thị Top 10 thợ kéo có doanh thu cao nhất, số đơn hoàn thành và điểm đánh giá sao ⭐)*.

---

## 🔒 Quy Tắc An Toàn & Bảo Mật Giao Dịch

1. **Tuyệt đối không sửa nội dung chuyển tiền**: Nội dung chuyển khoản là mã `TX...` duy nhất của từng đơn. Cố ý sửa nội dung sẽ khiến việc đối soát bill bị chậm trễ.
2. **Khách hàng không được tự confirm**: Chỉ thợ kéo nhận tiền hoặc Quản trị viên (Admin) mới có quyền bấm nút `[✅ Xác Nhận Đã Nhận Tiền]`.
3. **Chống xác nhận trùng**: Hệ thống sử dụng khóa logic SQLite, chống tình trạng bấm đúp chuột hoặc 2 người cùng confirm một lúc.
4. **Hồ sơ minh bạch**: Mọi đơn hủy hoặc hoàn tất đều ghi nhận chính xác ID người thực hiện (`processed_by`) và thời gian thực hiện (`processed_at`) để Admin đối soát khi có tranh chấp.

