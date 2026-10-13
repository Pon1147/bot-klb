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
export const MAP_HOMEPAGE_URL = 'https://deltaforcetools.gg/?utm_source=PonN%C3%A8';

/** Đường dẫn tới ảnh banner 3D Interactive Map */
export const BANNER_IMAGE_FILENAME = 'banner_3d_map.png';

/**
 * Xây dựng Container V2 hiển thị cẩm nang học map, hướng dẫn mở 3D Simulator từ banner trang web
 * và duy nhất 1 button link chuyển tiếp qua URL hoa hồng.
 */
export function buildMapContainer(): BuildContainerResult {
  const content = [
    '## 🗺️ Trình Mô Phỏng Bản Đồ 3D & Cẩm Nang Học Map (Delta Force)',
    '',
    '🎮 **Cách mở Trình Giả Lập Di Chuyển 3D cho Newbie:**',
    '1. Nhấn nút **"Mở Website DeltaForceTools"** bên dưới để truy cập trang chủ.',
    '2. Tại đầu trang web, **bấm trực tiếp vào banner "3D Interactive Map"** (hình minh họa bên dưới).',
    '3. Trang web sẽ mở ra trình giả lập 3D: cho phép bạn di chuyển tự do (FPS / Top-down) để luyện tập thuộc địa hình mà không sợ mất đồ!',
    '',
    '💡 **Lợi ích khi luyện tập qua Bản đồ 3D:**',
    '• **Tập di chuyển không rủi ro (Zero-Risk):** Soi trước mọi ngóc ngách, cầu thang, cao độ để tránh bị bắn lén.',
    '• **Định vị điểm Loot & Rút quân:** Nhớ sẵn vị trí két sắt, hòm Safe Box và các lối thoát hiểm an toàn.',
    '',
    '🔰 **Gợi ý chọn map cho Tân thủ:**',
    '• **Đập Nước Zero:** Địa hình công trình dễ nhớ, đường rút quân thuận tiện.',
    '• **Thung Lũng Layali:** Không gian rộng mở, cần chú ý các mỏm đá bắn tỉa.',
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
      .setLabel('🗺️ Mở Website DeltaForceTools (Vào Giả Lập 3D)')
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
