# DF Toolbox — Tiện ích Chrome

Tiện ích Chrome dành riêng cho cộng đồng người chơi **Delta Force (Garena)**, cung cấp 2 tính năng chính: **Tự động nạp Giftcode** và **Liên kết tài khoản Discord (Ủy quyền On-Demand)**.

---

## Tính năng

### 1. Tự Động Nạp Giftcode Garena
Tự động nhập hàng loạt mã quà tặng trên trang [Garena Redeem CDK](https://redeem.df.garena.sg).
- Hỗ trợ lưu trữ danh sách mã tân thủ và mã cào hằng ngày.
- Bảng điều khiển trực quan hiển thị trực tiếp trên trang đổi quà.
- Nhận diện và phân loại trạng thái mã theo thời gian thực: Thành công, Thất bại, Đã dùng, Có thể thử lại.

### 2. Liên Kết Tài Khoản Discord (Ủy quyền Chủ động - On-Demand Opt-In)
Cung cấp giải pháp liên kết tài khoản Garena với Discord Bot theo mô hình minh bạch và tôn trọng quyền riêng tư:
- **Zero Background Sniffing**: Tiện ích mặc định tắt hoàn toàn việc đọc dữ liệu khi tải trang.
- **On-Demand Activation**: Chỉ kích hoạt quét phiên làm việc khi người dùng chủ động bấm **"Bắt đầu Ủy quyền"**.
- **Instant Buffer Scan**: Tự động nhận diện tài khoản đã đăng nhập trong 0 giây từ bộ đệm tài nguyên mà không cần F5 hay đăng nhập lại.
- **Explicit Consent**: Bắt buộc người dùng xác nhận đồng thuận trước khi truyền dữ liệu.
- **Bảo mật tuyệt đối**: Dữ liệu gửi qua kênh mã hóa HTTPS về Bot Server, được mã hóa AES-256-GCM để bot thực thi lệnh tra cứu chỉ số K/D (`/df stats`, `/df history`). Người dùng có thể xóa vĩnh viễn dữ liệu bất kỳ lúc nào bằng lệnh `/df unlink`.

---

## Cài đặt

1. Tải tệp tiện ích: `DF-Extension.zip` (nhận trực tiếp từ bot qua lệnh `/df help` hoặc `/df link`).
2. Giải nén tệp `.zip` ra một thư mục trên máy tính.
3. Mở trình duyệt Chrome/Edge và truy cập `chrome://extensions/`.
4. Bật công tắc **Chế độ cho nhà phát triển** (Developer mode) ở góc trên bên phải.
5. Nhấn **Tải tiện ích đã giải nén** (Load unpacked) và chọn thư mục vừa giải nén.

---

## Hướng dẫn sử dụng

### 1. Liên kết tài khoản Discord
1. Mở Discord, gõ lệnh `/df link` (hoặc `/df liên-kết` nếu Discord hiển thị tiếng Việt) ➔ nhận mã Claim 6 ký tự.
2. Đăng nhập tài khoản Garena trên trang sự kiện [playdeltaforce.com](https://www.playdeltaforce.com).
3. Bảng **DF Toolbox** xuất hiện ở góc dưới bên phải màn hình. Bấm **Bắt đầu Ủy quyền**.
4. Tiện ích nhận diện tài khoản của bạn. Dán mã Claim 6 ký tự và **tick chọn hộp thoại đồng thuận**.
5. Bấm **Xác nhận & Liên kết** để hoàn tất.
6. Hủy liên kết và xóa sạch dữ liệu bất kỳ lúc nào bằng lệnh `/df unlink`.

### 2. Tự động nạp Giftcode
1. Bấm vào biểu tượng tiện ích **DF Toolbox** trên thanh công cụ Chrome.
2. Dán danh sách mã code vào ô văn bản (mỗi dòng một code) và nhấn **Lưu Code**.
3. Mở [Trang Nạp Code Garena](https://redeem.df.garena.sg).
4. Bảng điều khiển nạp code xuất hiện ở góc dưới bên phải, bấm **Bắt đầu** để tự động xử lý.

---

## Cam kết Bảo mật & Quyền riêng tư

- **Phạm vi tối thiểu (Least Privilege)**: Tiện ích chỉ thực thi trên 2 tên miền duy nhất: `redeem.df.garena.sg` (đổi mã) và `www.playdeltaforce.com` (sự kiện HQ).
- **Không can thiệp trang đăng nhập**: Tiện ích **tuyệt đối không chạy** trên các cổng đăng nhập mật khẩu/SSO của Garena (`sso.garena.com`, `auth.garena.com`).
- **Không lưu mật khẩu**: Không bao giờ thấy, đọc hoặc lưu trữ mật khẩu hay mã OTP của người dùng.
- **Minh bạch mã nguồn**: Mã nguồn hoàn toàn mở và có thể kiểm tra trực tiếp.

---

## Hỗ trợ

Nếu bạn cần hỗ trợ hoặc báo lỗi, vui lòng tham gia máy chủ Discord: [KLB Community](https://discord.gg/vz6w6c3Xe3).
