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

/** Link trang chủ website duy nhất tính hoa hồng qua UTM source */
export const MAP_HOMEPAGE_URL = 'https://deltaforcetools.gg/vi?utm_source=PonNè';

/** Đường dẫn tới ảnh banner 3D Interactive Map */
export const BANNER_IMAGE_FILENAME = 'banner_3d_map.png';

/**
 * Xây dựng Container V2 hiển thị cẩm nang học map, hướng dẫn mở 3D Simulator từ banner trang web
 * và duy nhất 1 button link chuyển tiếp qua URL hoa hồng.
 */
export function buildMapContainer(): BuildContainerResult {
  const content = [
    '## 🗺️ Trình Mô Phỏng Bản Đồ 3D & Cẩm Nang Tác Chiến (Delta Force)',
    '',
    '🎉 **TIN VUI:** Sau một thời gian làm việc và kết nối cùng đội ngũ **DeltaForceTools**, website đã chính thức ra mắt **phiên bản Tiếng Việt 100%** dành riêng cho cộng đồng game thủ Việt Nam chúng ta!',
    '',
    '🎮 **Cách mở Trình Giả Lập Di Chuyển 3D (Luyện tập Zero-Risk):**',
    '1. Nhấn nút **"Mở Website DeltaForceTools"** bên dưới để truy cập bản đồ tiếng Việt.',
    '2. Tại đầu trang web, **bấm trực tiếp vào banner "3D Interactive Map"** (Bản đồ tương tác 3D).',
    '3. Trải nghiệm di chuyển tự do (FPS / Top-down) để thuộc lòng địa hình mà không sợ mất đồ!',
    '',
    '💡 **Lợi ích khi luyện tập qua Bản đồ 3D:**',
    '• **Soi vị trí Két Sắt & Hòm Giá Trị:** Nắm trước toạ độ két sắt, Safe Box để lên lộ trình loot tối ưu.',
    '• **Định vị Điểm Rút Quân An Toàn:** Biết trước các cửa thoát hiểm, điều kiện rút quân và tránh điểm phục kích.',
    '• **Tập di chuyển không rủi ro (Zero-Risk):** Soi trước mọi góc kê, cầu thang, cao độ để hạn chế bị bắn lén.',
    '',
    '🔰 **Gợi ý chọn map cho Tân thủ:**',
    '• **Đập Nước Zero:** Địa hình công trình khép kín dễ nhớ, đường rút quân thuận tiện.',
    '• **Thung Lũng Layali:** Không gian đồi núi rộng mở, cần chú ý các mỏm đá bắn tỉa.',
    '• **Phố Cổ Brakkesh:** Đô thị giao tranh tầm gần (CQB), rất nhiều góc nấp trong nhà.',
  ].join('\n');

  const files: AttachmentBuilder[] = [];
  const containerInner: unknown[] = [{ type: ComponentType.TextDisplay, content }];

  // Đính kèm ảnh banner minh họa nếu tồn tại
  const bannerPath = path.resolve(process.cwd(), 'src/assets/img/map', BANNER_IMAGE_FILENAME);
  if (existsSync(bannerPath)) {
    files.push(new AttachmentBuilder(bannerPath, { name: BANNER_IMAGE_FILENAME }));
    containerInner.push({
      type: ComponentType.MediaGallery,
      items: [
        {
          media: { url: `attachment://${BANNER_IMAGE_FILENAME}` },
          description: 'Banner 3D Interactive Map',
        },
      ],
    });
  }

  containerInner.push({ type: ComponentType.Separator, accentColor: COLORS.DF });

  // Duy nhất 1 button chuyển tiếp về trang web tính hoa hồng
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('🗺️ Mở Bản Đồ 3D (DeltaForceTools)')
      .setURL(MAP_HOMEPAGE_URL),
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
 * Handler thực thi khi người dùng gõ /df map.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database?: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const result = buildMapContainer();

  await interaction.reply({
    components: result.toJSON(),
    files: result.files,
    flags: MessageFlags.IsComponentsV2,
  } as Parameters<typeof interaction.reply>[0]);
}
