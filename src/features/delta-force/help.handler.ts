/**
 * Handler hiển thị trợ giúp (help) và hướng dẫn sử dụng bot Delta Force.
 * Hỗ trợ 2 view: Tổng quan lệnh và Hướng dẫn liên kết tài khoản 5 bước.
 * Tự động đính kèm file DF-Extension.zip để người dùng tải trực tiếp.
 */

import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import Database from 'better-sqlite3';
import { makeResult, BuildContainerResult } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { requireGuild } from '../../utils/df-guards.js';
import { getExtensionZipPath } from './extension.utils.js';
import { isIgnorableInteractionError } from '../../utils/discord-error.utils.js';

export type HelpTab = 'commands' | 'guide';

/**
 * Xây dựng Container V2 hiển thị nội dung trợ giúp theo tab đã chọn.
 */
export function buildHelpContainer(tab: HelpTab): BuildContainerResult {
  if (tab === 'commands') {
    const content = [
      '## 🎮 Trung Tâm Lệnh Bot KLB & Delta Force',
      '',
      '### ⚔️ Nhóm lệnh Delta Force (`/df`)',
      '- `/df stats`: Xem thống kê tổng quan (K/D, tỷ lệ rút quân, cấp bậc) & đổi mùa giải độc quyền.',
      '- `/df daily`: Xem trạng thái chiến đấu hàng ngày.',
      '- `/df history [limit]`: Xem lịch sử các trận đấu gần đây (1-20 trận).',
      '- `/df workshop`: Xem tình trạng sản xuất tại Xưởng Căn Cứ Ngầm.',
      '- `/df code show`: Xem mật khẩu các khu vực & két sắt hôm nay.',
      '- `/df code setchannel`: Thiết lập kênh tự động nhận mật mã két sắt hàng ngày (Dành cho Quản trị viên).',
      '- `/df map`: Trình mô phỏng bản đồ 3D tương tác và cẩm nang học map.',
      '- `/df build` (hoặc `/df gun`): Tra cứu build súng meta (DeltaForceTools API), lọc theo chế độ, loại súng, tên súng & copy mã Gunsmith 1-chạm.',
      '- `/df link start`: Nhận mã claim & tải tiện ích để liên kết tài khoản.',
      '- `/df link status`: Kiểm tra tình trạng liên kết tài khoản.',
      '- `/df unlink`: Hủy liên kết tài khoản hiện tại.',
      '- `/df help`: Xem hướng dẫn sử dụng và tải tiện ích mở rộng.',
      '',
      '✨ **Tính năng mới nổi bật:**',
      '• **Mô phỏng bản đồ 3D (`/df map`):** Giả lập di chuyển góc nhìn 3D (FPS / Top-down), soi vị trí két sắt, hòm Safe Box và các lối thoát hiểm an toàn.',
      '• **Build súng chuẩn Meta (`/df build` / `/df gun`):** Đồng bộ dữ liệu meta từ DeltaForceTools, hỗ trợ lọc theo chế độ Hazard/Havoc, loại súng, tên súng & copy mã Gunsmith 1-chạm.',
      '• **Bảo vệ thống kê cá nhân (`/df stats`):** Menu Season được mã hóa User ID và bảo vệ RBAC, ngăn chặn người khác can thiệp bảng stats của bạn.',
      '• **Tự động nhận mật mã hòm đồ (`/df code setchannel`):** Server chỉ định 1 kênh riêng để bot tự động cập nhật mật khẩu két sắt mỗi sáng.',
      '',
      '### 👥 Nhóm lệnh Squad (`/team`)',
      '- `/team find`: Đăng tin tuyển đồng đội hoặc tìm squad tham gia.',
      '',
      '### 💰 Nhóm lệnh Thợ Kéo & VietQR (`/seller`)',
      '- `/seller pay`: Tạo đơn kéo & xuất mã VietQR động nhận tiền tự động.',
      '- `/seller qr`: Cài đặt số tài khoản ngân hàng nhận tiền & xem mã QR cá nhân.',
      '- `/seller history`: Xem lịch sử các đơn kéo cá nhân (Pending, Confirmed, Cancelled).',
      '- `/seller top`: Bảng xếp hạng thợ kéo uy tín & doanh thu cao nhất server.',
      '- `/seller config setrole`: Thiết lập role định danh Thợ Kéo (Dành cho Quản trị viên).',
      '',
      '### ⚙️ Nhóm lệnh Quản trị (`/config`)',
      '- `/config bot setannouncechannel`: Cấu hình kênh nhận thông báo cập nhật bot cho máy chủ.',
      '- `/config bot guilds`: Xem danh sách server bot đang tham gia (Dành cho Quản trị viên).',
      '- `/config welcome / leave / booster ...`: Cấu hình thông báo Chào mừng, Tạm biệt, Booster (`setchannel`, `toggle`, `status`, `test`).',
      '- `/config roles set / view`: Cấu hình phân quyền quản trị bot (Bot Admin, Moderator, Member).',
      '',
      '> 💬 **Hỗ trợ & Thắc mắc:** Vui lòng liên hệ Discord: `crushpon` hoặc tham gia server [KLB Community](https://discord.gg/vz6w6c3Xe3) để đặt câu hỏi.',
    ].join('\n');

    return makeResult(
      [
        {
          type: ComponentType.Container,
          components: [
            { type: ComponentType.TextDisplay, content },
            { type: ComponentType.Separator, accentColor: COLORS.INFO },
          ],
        },
      ],
      MessageFlags.IsComponentsV2,
      [],
    );
  }

  // tab === 'guide'
  const content = [
    '## 🧩 Hướng Dẫn Cài Đặt Tiện Ích & Liên Kết Tài Khoản (Dành Cho Người Mới)',
    '',
    '🛡️ **CAM KẾT AN TOÀN & BẢO MẬT TÀI KHOẢN (100% Yên Tâm):**',
    '• **Cổng game chính thức:** [Delta Force HQ](https://www.playdeltaforce.com/events/hq/vi/index.html) là trang web sự kiện chính thức do Tencent Games & Garena quản lý.',
    '• **Tuyệt đối không hỏi mật khẩu:** Bạn chỉ đăng nhập tài khoản trực tiếp trên cổng Garena chính thức (`sso.garena.com`). Bot và tiện ích **KHÔNG BAO GIỜ** xem, hỏi hoặc lưu mật khẩu hay mã OTP của bạn.',
    '• **Minh bạch & An toàn:** Tiện ích hoạt động cục bộ trên máy tính của bạn, chỉ gửi mã định danh nhân vật (OpenID) qua đường truyền mã hóa quân sự AES-256-GCM để bot hỗ trợ tra cứu K/D (`/df stats`) và tự động nhận quà xưởng (`/df workshop`).',
    '',
    '---',
    '',
    '### 📥 BƯỚC 1: Cài Đặt Tiện Ích Vào Trình Duyệt (Chỉ làm 1 lần duy nhất)',
    '1. **Tải file:** Tải tệp **`DF-Extension.zip`** đính kèm ở tin nhắn bên dưới về máy tính.',
    '2. **Giải nén:** Nhấp chuột phải vào file vừa tải -> Chọn **Extract All... (Giải nén)** để mở thành một thư mục.',
    '3. **Thêm vào trình duyệt (Chrome, Cốc Cốc, Edge hoặc Brave):**',
    '   - Mở trình duyệt và truy cập: `chrome://extensions/` (hoặc `edge://extensions/`, `coccoc://extensions/`).',
    '   - Ở góc trên cùng bên phải, bật công tắc **Chế độ dành cho nhà phát triển** (**Developer mode**).',
    '   - Ở góc trên cùng bên trái, nhấn nút **Tải tiện ích đã giải nén** (**Load unpacked**) -> Chọn thư mục bạn vừa giải nén.',
    '',
    '### 🔗 BƯỚC 2: Liên Kết Tài Khoản Game (Chỉ mất 20 giây)',
    '1. **Lấy mã:** Gõ lệnh `/df link start` trên Discord để nhận mã số 6 ký tự của bạn (Ví dụ: `AB12CD`).',
    '2. **Mở trang sự kiện:** Truy cập [Delta Force HQ](https://www.playdeltaforce.com/events/hq/vi/index.html) và đăng nhập nick Garena của bạn.',
    '3. **Nhập mã:** Nhìn vào **góc dưới bên phải màn hình web**, bảng **"DF Toolbox"** sẽ tự động xuất hiện.',
    '4. **Xác nhận:** Dán mã 6 ký tự vào ô và nhấn nút **"Liên kết Discord"**.',
    '5. ✨ **Hoàn tất:** Bot sẽ gửi tin nhắn riêng (DM) xác nhận liên kết thành công!',
    '',
    '---',
    '',
    '🎬 **Video Hướng Dẫn & Hỗ Trợ:**',
    '> Bạn có thể xem video mẫu thao tác từng bước tại clip đính kèm trong máy chủ hoặc liên hệ hỗ trợ viên Discord: `crushpon` / [KLB Community](https://discord.gg/vz6w6c3Xe3) để được hỗ trợ 1-1.',
    '',

    '',

    '',

    '',

    '',

    '',

    '',
    '> 💬 **Hỗ trợ & Thắc mắc:** Vui lòng liên hệ Discord: `crushpon` hoặc tham gia server [KLB Community](https://discord.gg/vz6w6c3Xe3) để được hỗ trợ.',
  ].join('\n');

  return makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content },
          { type: ComponentType.Separator, accentColor: COLORS.WELCOME },
        ],
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );
}

/**
 * Xây dựng ActionRow chứa các nút chuyển tab chuyển đổi view trợ giúp.
 */
export function buildHelpActionRow(currentTab: HelpTab): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('df_help_tab_commands')
      .setLabel('📋 Danh Sách Lệnh')
      .setStyle(currentTab === 'commands' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('df_help_tab_guide')
      .setLabel('🧩 Hướng Dẫn Liên Kết')
      .setStyle(currentTab === 'guide' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

/**
 * Handler thực thi khi người dùng gõ /df help.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database?: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const container = buildHelpContainer('commands');
  const row = buildHelpActionRow('commands');

  const zipPath = getExtensionZipPath();
  const files = zipPath
    ? [
        new AttachmentBuilder(zipPath, {
          name: 'DF-Extension.zip',
          description: 'Tiện ích liên kết tài khoản Delta Force',
        }),
      ]
    : [];

  await interaction.reply({
    components: [...container.toJSON(), row.toJSON()],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  } as Parameters<typeof interaction.reply>[0]);

  // Gửi file ZIP qua followUp vì Discord client không render generic file attachments trong Components V2
  if (files.length > 0) {
    await interaction.followUp({
      content:
        '📦 **Tệp cài đặt Tiện ích mở rộng Delta Force (Extension):**\n' +
        '> 1. Tải tệp **`DF-Extension.zip`** đính kèm bên dưới về máy tính.\n' +
        '> 2. Nhấp chuột phải vào file đã tải -> Chọn **Extract All... (Giải nén)**.\n' +
        '> 3. Mở `chrome://extensions/` -> Bật **Developer mode** -> Chọn **Load unpacked** và chọn thư mục vừa giải nén.\n' +
        '> 🛡️ *Tệp cài đặt sạch 100%, chạy cục bộ trên máy và hoàn toàn không can thiệp vào tài khoản hay mật khẩu của bạn.*',
      files,
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handler xử lý tương tác khi người dùng nhấp vào nút chuyển tab trợ giúp.
 */
export async function handleHelpButton(
  interaction: ButtonInteraction,
): Promise<{ handled: boolean }> {
  if (
    interaction.customId !== 'df_help_tab_commands' &&
    interaction.customId !== 'df_help_tab_guide'
  ) {
    return { handled: false };
  }

  const tab: HelpTab = interaction.customId === 'df_help_tab_commands' ? 'commands' : 'guide';
  const container = buildHelpContainer(tab);
  const row = buildHelpActionRow(tab);

  try {
    await interaction.update({
      components: [...container.toJSON(), row.toJSON()],
    });
  } catch (error) {
    if (!isIgnorableInteractionError(error)) {
      throw error;
    }
  }

  return { handled: true };
}
