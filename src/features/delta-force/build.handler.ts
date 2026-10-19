import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import path from 'path';
import { existsSync } from 'fs';
import Database from 'better-sqlite3';
import { makeResult, BuildContainerResult } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { requireGuild } from '../../utils/df-guards.js';

/** Link thư viện build súng server Garena có gắn ref hoa hồng */
export const WEAPON_BUILDS_URL =
  'https://deltaforcetools.gg/vi/weapon-builds?page=1&server_region=Garena&utm_source=PonNè';

/** Đường dẫn tới ảnh preview danh sách build súng */
export const BUILD_IMAGE_FILENAME = 'weapon_builds_preview.png';

/**
 * Xây dựng Container V2 hiển thị cẩm nang & thư viện build súng meta (Garena).
 */
export function buildWeaponContainer(): BuildContainerResult {
  const content = [
    '## 🔫 Thư Viện Build Súng & Mã Gunsmith Meta (Server Garena)',
    '',
    '🎉 **TIN VUI:** Sau một thời gian làm việc và thống nhất cùng đội ngũ **DeltaForceTools**, thư viện súng đã chính thức hỗ trợ **Giao diện Tiếng Việt hoàn chỉnh** cho anh em game thủ Việt Nam!',
    '',
    '🎯 **Cách lấy & áp dụng Mã Build Súng trong Game:**',
    '1. Nhấn nút **"Xem Thư Viện Build Súng (Garena)"** bên dưới để mở danh sách bằng tiếng Việt.',
    '2. Tìm khẩu súng bạn muốn chơi (CAR-15, M4A1, AKM, K416, AUG, CI-19, MP5...).',
    '3. Bấm nút **"Copies"** (Sao chép mã) trên thẻ súng để copy mã Gunsmith Code.',
    '4. Mở game **Delta Force** ➔ Chọn súng ➔ Bấm **Nhập mã (Import Code)** để tự động trang bị nguyên bộ phụ kiện chuẩn meta!',
    '',
    '🔥 **Các kiểu Build phổ biến theo lối chơi:**',
    '• **Ổn Định Cao (High Stability):** Triệt tiêu tối đa độ giật, sấy đầm tay cho giao tranh tầm trung & xa.',
    '• **Cơ Động Cận Chiến (Fast ADS / CQB):** Tối ưu tốc độ ngắm bắn và độ cơ động cho các pha công nhà.',
    '• **Tiết Kiệm / Tân Thủ (Budget Friendly):** Cấu hình phụ kiện tối ưu ngân sách, dễ mở khóa cho tân binh.',
  ].join('\n');

  const files: AttachmentBuilder[] = [];
  const containerInner: unknown[] = [{ type: ComponentType.TextDisplay, content }];

  // Đính kèm ảnh preview minh họa nếu tồn tại
  const imagePath = path.resolve(process.cwd(), 'src/assets/img/build', BUILD_IMAGE_FILENAME);
  if (existsSync(imagePath)) {
    files.push(new AttachmentBuilder(imagePath, { name: BUILD_IMAGE_FILENAME }));
    containerInner.push({
      type: ComponentType.MediaGallery,
      items: [
        {
          media: { url: `attachment://${BUILD_IMAGE_FILENAME}` },
          description: 'Giao diện Thư Viện Build Súng Delta Force Garena',
        },
      ],
    });
  }

  containerInner.push({ type: ComponentType.Separator, accentColor: COLORS.DF });

  // Duy nhất 1 button chuyển tiếp về trang web tính hoa hồng
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('🔫 Xem Thư Viện Build Súng (Garena)')
      .setURL(WEAPON_BUILDS_URL),
  );

  return makeResult(
    [
      {
        type: ComponentType.Container,
        components: containerInner,
      },
      actionRow.toJSON(),
    ],
    MessageFlags.IsComponentsV2,
    files,
  );
}

/**
 * Handler thực thi khi người dùng gõ /df build hoặc /df gun.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database?: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const result = buildWeaponContainer();

  await interaction.reply({
    components: result.toJSON(),
    files: result.files,
    flags: MessageFlags.IsComponentsV2,
  } as Parameters<typeof interaction.reply>[0]);
}
