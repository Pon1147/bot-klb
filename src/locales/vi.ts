/**
 * Từ điển ngôn ngữ Tiếng Việt (Default Ground Truth).
 * Khai báo dạng TypeScript const object để đảm bảo 100% type-safety và zero file copy overhead.
 */

export const VI_LOCALE = {
  // ─── Help Center Headers & Intent Prose ───
  help: {
    title: 'Trung Tâm Trợ Giúp — Bot Delta',
    page_indicator: 'Trang {current} / {total}',
    footer:
      '> **Bot Delta v{botVersion}** • **DF Toolbox v{extVersion}** • Tác giả: **Pon1147** • [Hỗ trợ](https://discord.gg/vz6w6c3Xe3)',
    user_isolation_error: 'Bạn không thể điều khiển menu trợ giúp của người khác.',

    // Option Labels for Select Menu
    options: {
      overview_label: '1. Tổng quan & Bắt đầu',
      overview_desc: 'Giới thiệu Bot Delta, hướng dẫn dùng bot và tiện ích',
      stats_label: '2. Hồ sơ chiến đấu',
      stats_desc: 'Chỉ số cá nhân, K/D, lịch sử, soi trận và kho đồ đỏ',
      tactics_label: '3. Tác chiến & Vũ khí',
      tactics_desc: 'Bản đồ 3D, build súng meta, mật mã két sắt và giá chợ',
      link_label: '4. Tiện ích & Liên kết',
      link_desc: 'Liên kết tài khoản HQ và đổi mã quà tặng Garena',
      payment_label: '5. Thanh toán & Quyên góp',
      payment_desc: 'Tạo mã QR thanh toán VietQR, nạp tiền và ủng hộ bot',
      admin_label: '6. Quản trị máy chủ',
      admin_desc: 'Cấu hình RBAC, VietQR workflow, tự động đăng bài & thông báo',
    },

    // Page Specific Written Prose
    pages: {
      1: {
        heading: '# Trung Tâm Trợ Giúp — Bot Delta',
        intro:
          '**Bot Delta** là trợ lý Discord chuyên biệt cho game thủ **Delta Force (Server Garena)**.\n🌐 **Song ngữ tự động**: Hỗ trợ Tiếng Việt & English thích ứng theo ngôn ngữ client Discord.',
        step_title: '### 3 Bước khởi đầu cho tân binh:',
        step_1:
          '1. **`/df link start`**: Nhận mã định danh & cài đặt tiện ích mở rộng **DF Toolbox**.',
        step_2:
          '2. **`/df stats`**: Tra cứu thẻ căn cước chiến binh (K/D, tỉ lệ sống sót, rank, số trận).',
        step_3: '3. **`/df code show`**: Lấy ngay bảng mật mã két sắt 6 bản đồ hôm nay.',
        nav_title: '### Hướng dẫn điều hướng:',
        nav_1: '• Chọn nhóm chức năng qua **Menu thả xuống** bên dưới.',
        nav_2: '• Dùng các nút **[ Trước ]** / **[ Sau ]** để chuyển từng trang.',
        nav_3: '• Bấm **[ Tải tiện ích ]** để nhận trực tiếp file cài đặt DF Toolbox.',
      },
      2: {
        heading: '# Hồ Sơ Chiến Đấu & Thống Kê Cá Nhân',
        note: '*Lưu ý: Bạn cần liên kết tài khoản qua `/df link start` để bot đọc dữ liệu cá nhân từ Delta Force HQ.*',
      },
      3: {
        heading: '# Tác Chiến, Bản Đồ & Vũ Khí Meta',
        note: '',
      },
      4: {
        heading: '# Tiện Ích DF Toolbox & Liên Kết Tài Khoản',
        intro:
          '**DF Toolbox** là tiện ích mở rộng (Chrome Extension) hỗ trợ đồng bộ dữ liệu game & tự động đổi Giftcode.',
        features_title: '### Tính năng nổi bật:',
        feature_1:
          '• **Đổi 200+ Giftcode Garena tự động**: Tự quét & nhận quà toàn bộ code còn hạn chỉ với 1 click.',
        feature_2:
          '• **Trích xuất Token an toàn**: Tự động mã hóa AES-256-GCM gửi về bot để xem stats mà không lộ mật khẩu.',
        feature_3:
          '• **Cập nhật realtime**: Tự động đồng bộ lịch sử đấu và chiến tích sau mỗi trận rút quân.',
        install_title: '### Hướng dẫn cài đặt nhanh (Yêu cầu PC/Laptop):',
        install_1: '1. Bấm nút **[ Tải tiện ích ]** bên dưới để tải file `DF-Extension.zip`.',
        install_2: '2. Giải nén file `.zip` vừa tải ra một thư mục trên máy tính.',
        install_3:
          '3. Mở trình duyệt Chrome/Edge -> Truy cập `chrome://extensions/` -> Bật **Developer mode**.',
        install_4: '4. Chọn **Load unpacked** -> Trỏ đến thư mục vừa giải nén để hoàn tất.',
      },
      5: {
        heading: '# Thanh Toán VietQR & Quyên Góp (Donate)',
        intro:
          'Hệ thống hỗ trợ tạo mã QR thanh toán chuẩn VietQR (NAPAS 247) và quyên góp tự động qua cổng PayOS.',
        vietqr_title: '### Dành cho Khách hàng & Giao dịch:',
        donate_title: '### Quyên góp duy trì Bot (Donate):',
        donate_desc:
          '• Sử dụng lệnh `/donate [amount]` để tạo link thanh toán PayOS ủng hộ chi phí duy trì server bot.',
      },
      6: {
        heading: '# Quản Trị Máy Chủ & Điều Hành Bot',
        intro:
          'Các lệnh cấu hình dành riêng cho **Server Owner**, **Administrator** và **Moderator** được ủy quyền.',
      },
    },
  },

  // ─── Descriptions & Examples for End-User Commands ───
  commands: {
    'df.stats': {
      desc: 'Xuất thẻ căn cước chiến binh (K/D, tỉ lệ rút quân, cấp bậc, số trận) & menu đổi mùa giải.',
      example: '/df stats season:s4 player:123456789012345678',
    },
    'df.daily': {
      desc: 'Báo cáo tổng hợp hiệu suất tác chiến trong ngày hôm nay.',
      example: '/df daily',
    },
    'df.history': {
      desc: 'Xem lịch sử 1–20 trận gần nhất (operator, map, kết quả rút quân).',
      example: '/df history limit:10',
    },
    'df.match': {
      desc: 'Soi chi tiết kết quả 1 trận cụ thể (kèm gợi ý tự động 5 trận gần nhất).',
      example: '/df match match_id:1234567890',
    },
    'df.vault': {
      desc: 'Sảnh Triển Lãm Đồ Đỏ — Kho báu vật phẩm quý hiếm đã rút quân an toàn & tổng định giá.',
      example: '/df vault',
    },
    'df.map': {
      desc: 'Cẩm nang bản đồ, soi két sắt, lối rút quân & liên kết mô phỏng 3D tại deltaforcetools.gg.',
      example: '/df map map_name:zero_dam',
    },
    'df.build': {
      desc: 'Thư viện build súng meta Garena, lọc theo chế độ/loại súng & copy mã 1-chạm.',
      example: '/df build weapon:m4a1 mode:havoc',
    },
    'df.gun': {
      desc: 'Tra cứu nhanh build súng meta theo tên súng và chế độ chơi.',
      example: '/df gun weapon:m4a1',
    },
    'df.gift-code': {
      desc: 'Nhận 200+ mã giftcode tân thủ và công cụ tự động nhận quà trên Garena.',
      example: '/df gift-code',
    },
    'df.code.show': {
      desc: 'Bảng mật mã két sắt 6 bản đồ hôm nay (tự động cập nhật mỗi sáng).',
      example: '/df code show page:1',
    },
    'df.code.status': {
      desc: 'Kiểm tra trạng thái cập nhật mật mã két sắt hôm nay.',
      example: '/df code status',
    },
    'df.market': {
      desc: 'Tra cứu giá nguyên liệu thị trường & biên lợi nhuận chế tác bàn xưởng từ HQ API.',
      example: '/df market item:titanium',
    },
    'df.workshop': {
      desc: 'Xem khuyến nghị sản xuất tối ưu tại Xưởng Căn Cứ Ngầm.',
      example: '/df workshop',
    },
    'df.link.start': {
      desc: 'Khởi tạo phiên liên kết tài khoản Delta Force HQ và nhận tiện ích DF Toolbox.',
      example: '/df link start',
    },
    'df.link.status': {
      desc: 'Kiểm tra trạng thái liên kết tài khoản Delta Force HQ hiện tại.',
      example: '/df link status',
    },
    'df.unlink': {
      desc: 'Hủy liên kết tài khoản Delta Force HQ khỏi tài khoản Discord của bạn.',
      example: '/df unlink',
    },
    'df.help': {
      desc: 'Hiển thị cẩm nang hướng dẫn sử dụng Bot Delta toàn tập.',
      example: '/df help',
    },
    'team.find': {
      desc: 'Đăng tin tuyển hoặc tìm squad leo rank theo map, chế độ & điều phối voice chat tự động.',
      example: '/team find map:dam rank:diamond mic:true',
    },
    'pay.create': {
      desc: 'Tạo mã QR thanh toán VietQR chuyển khoản ngân hàng tự động.',
      example: '/pay create amount:50000 description:DonHangDichVu',
    },
    'pay.history': {
      desc: 'Xem lịch sử các giao dịch thanh toán VietQR của bạn trong máy chủ.',
      example: '/pay history',
    },
    'pay.top': {
      desc: 'Xem bảng xếp hạng top thành viên ủng hộ / chi tiêu nhiều nhất trong máy chủ.',
      example: '/pay top',
    },
    donate: {
      desc: 'Tạo link thanh toán PayOS ủng hộ nhà phát triển duy trì bot.',
      example: '/donate amount:20000',
    },

    // ─── Lệnh Quản Trị & Cấu Hình Máy Chủ (BM-01 & BM-02) ───
    'config.roles.set': {
      desc: 'Thiết lập vai trò quản trị phân quyền RBAC (Admin, Mod, Member).',
      example: '/config roles set role_type:bot_admin role:@AdminRole',
    },
    'config.roles.view': {
      desc: 'Xem cấu hình phân quyền vai trò hiện tại của máy chủ.',
      example: '/config roles view',
    },

    'config.welcome.setchannel': {
      desc: 'Chọn kênh gửi tin nhắn chào mừng thành viên mới.',
      example: '/config welcome setchannel channel:#welcome',
    },
    'config.welcome.setrole': {
      desc: 'Chọn role tự động cấp cho thành viên mới khi vào máy chủ.',
      example: '/config welcome setrole role:@Member',
    },
    'config.welcome.toggle': {
      desc: 'Bật hoặc tắt hệ thống chào mừng thành viên mới.',
      example: '/config welcome toggle enabled:true',
    },
    'config.welcome.status': {
      desc: 'Xem trạng thái cấu hình hệ thống chào mừng hiện tại.',
      example: '/config welcome status',
    },
    'config.welcome.test': {
      desc: 'Gửi tin nhắn chào mừng thử nghiệm để kiểm tra giao diện.',
      example: '/config welcome test',
    },

    'config.leave.setchannel': {
      desc: 'Chọn kênh gửi thông báo khi thành viên rời máy chủ.',
      example: '/config leave setchannel channel:#farewell',
    },
    'config.leave.toggle': {
      desc: 'Bật hoặc tắt hệ thống thông báo thành viên rời máy chủ.',
      example: '/config leave toggle enabled:true',
    },
    'config.leave.status': {
      desc: 'Xem trạng thái cấu hình thông báo thành viên rời máy chủ.',
      example: '/config leave status',
    },
    'config.leave.test': {
      desc: 'Gửi tin nhắn thông báo rời máy chủ thử nghiệm để xem trước.',
      example: '/config leave test',
    },

    'config.booster.setchannel': {
      desc: 'Chọn kênh gửi tin nhắn cảm ơn khi có thành viên Boost máy chủ.',
      example: '/config booster setchannel channel:#boosters',
    },
    'config.booster.setrole': {
      desc: 'Chọn role dành riêng cho Server Booster.',
      example: '/config booster setrole role:@BoosterRole',
    },
    'config.booster.toggle': {
      desc: 'Bật hoặc tắt hệ thống thông báo cảm ơn Server Booster.',
      example: '/config booster toggle enabled:true',
    },
    'config.booster.status': {
      desc: 'Xem trạng thái cấu hình cảm ơn Server Booster hiện tại.',
      example: '/config booster status',
    },
    'config.booster.test': {
      desc: 'Gửi tin nhắn cảm ơn Booster thử nghiệm để xem trước giao diện.',
      example: '/config booster test',
    },

    'config.container.edit': {
      desc: 'Chỉnh sửa giao diện tin nhắn Container V2 của máy chủ tương tác.',
      example: '/config container edit type:welcome',
    },
    'config.container.reset': {
      desc: 'Đặt lại giao diện tin nhắn Container V2 về mẫu mặc định.',
      example: '/config container reset type:welcome',
    },

    'config.bot.guilds': {
      desc: 'Xem danh sách các máy chủ mà bot đang tham gia (Bot Owner).',
      example: '/config bot guilds',
    },
    'config.bot.setannouncechannel': {
      desc: 'Thiết lập kênh nhận thông báo cập nhật tính năng mới từ bot.',
      example: '/config bot setannouncechannel channel:#announcements',
    },
    'config.bot.announce': {
      desc: 'Phát sóng thông báo cập nhật tới toàn bộ máy chủ (Bot Owner).',
      example: '/config bot announce preview:true',
    },

    'config.qr-server.toggle': {
      desc: 'Bật hoặc tắt tính năng QR thanh toán trả phí cho máy chủ (Bot Owner).',
      example: '/config qr-server toggle enabled:true',
    },
    'config.qr-server.status': {
      desc: 'Kiểm tra trạng thái cấp phép tính năng QR của máy chủ (Bot Owner).',
      example: '/config qr-server status',
    },

    'config.vietqr.set': {
      desc: 'Cấu hình thông tin tài khoản ngân hàng nhận tiền chuyển khoản VietQR.',
      example: '/config vietqr set bank:MB account_no:0987654321 account_name:JohnDoe',
    },
    'config.vietqr.workflow': {
      desc: 'Cấu hình quy trình duyệt đơn, role nhân viên và đánh giá feedback.',
      example: '/config vietqr workflow staff_role:@Staff enable_rating:true',
    },
    'config.vietqr.status': {
      desc: 'Xem thông tin tài khoản nhận tiền VietQR hiện tại của máy chủ.',
      example: '/config vietqr status',
    },
    'config.vietqr.preview': {
      desc: 'Tạo mã QR thanh toán thử nghiệm để quét kiểm tra số tài khoản.',
      example: '/config vietqr preview amount:50000',
    },
    'config.vietqr.reset': {
      desc: 'Gỡ bỏ và xóa toàn bộ thông tin tài khoản ngân hàng VietQR của máy chủ.',
      example: '/config vietqr reset',
    },

    'df.code.setchannel': {
      desc: 'Cài đặt kênh tự động gửi mật mã két sắt 6 bản đồ mỗi ngày.',
      example: '/df code setchannel channel:#daily-codes',
    },
    'df.code.settime': {
      desc: 'Cài đặt giờ tự động gửi mật mã két sắt hằng ngày (mặc định 08:00).',
      example: '/df code settime time:08:00',
    },
    'df.code.setadminchannel': {
      desc: 'Cài đặt kênh nhận thông báo lỗi lịch trình gửi mã két sắt.',
      example: '/df code setadminchannel channel:#bot-logs',
    },

    'df.autopost.set': {
      desc: 'Cài đặt lịch tự động đăng cẩm nang bản đồ hoặc build súng meta.',
      example: '/df autopost set type:map interval_hours:6',
    },
    'df.autopost.toggle': {
      desc: 'Bật hoặc tắt hệ thống tự động đăng cẩm nang định kỳ.',
      example: '/df autopost toggle',
    },
    'df.autopost.status': {
      desc: 'Xem trạng thái các kênh tự động đăng bài của bot.',
      example: '/df autopost status',
    },
    'df.autopost.run': {
      desc: 'Kích hoạt gửi ngay cẩm nang bản đồ hoặc súng mà không cần chờ lịch.',
      example: '/df autopost run type:map',
    },
  },
} as const;
