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
    '## 🗺️ Trình Mô Phỏng Bản Đồ 3D (Bản Tiếng Việt)',
    '> 🇻🇳 **ĐÃ CÓ BẢN TIẾNG VIỆT:** Toàn bộ bản đồ tương tác chiến thuật từ **DeltaForceTools** đã hỗ trợ **100% Tiếng Việt**!',
    '',
    '### 🧭 Trở Thành Bậc Thầy Chiến Trường & Sinh Tồn:',
    '- 📍 **Soi Sạch Két Sắt & Hòm Báu:** Nắm trọn tọa độ loot đỏ giá trị cao tại Đập Nước Zero, Thung Lũng Layali, Phố Cổ Brakkesh...',
    '- 🚪 **Làm Chủ Điểm Rút Quân:** Định vị lối thoát hiểm an toàn nhất, bắt bài mọi góc phục kích hiểm hóc của đối phương.',
    '- 🎮 **Tập Chạy Zero-Risk (3D):** Khám phá địa hình thực tế với góc nhìn tự do (FPS / Top-down) mà không sợ rủi ro mất đồ.',
    '',
    '### 🚀 Bắt Đầu Khám Phá Ngay:',
    'Bấm nút bên dưới ➔ Chọn banner **"3D Interactive Map"** để mở trình mô phỏng 3D tương tác! 👇',
    '',
    '-# 💡 Mẹo: Hỗ trợ hiển thị đầy đủ trên cả PC và thiết bị di động.',
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
