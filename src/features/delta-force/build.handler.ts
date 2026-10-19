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
    '# 🔫 Thư Viện Build Súng & Mã Gunsmith Meta (Bản Tiếng Việt)',
    '',
    '🔥 **Chính thức:** Thư viện build súng Garena chuẩn meta đã có **100% Tiếng Việt** sau thời gian hợp tác cùng **DeltaForceTools**!',
    '',
    '⚡ **Tại sao nên xem ngay?**',
    '• 🏆 **Chuẩn Meta Server Garena:** Đầy đủ CAR-15, M4A1, AKM, K416, AUG... với dàn phụ kiện sấy siêu đầm tay hoặc đẩy nhà cực gắt.',
    '• 📋 **Copy 1-Click cực nhanh:** Bấm **"Copies"** (Sao chép mã) trên web là có ngay mã Gunsmith.',
    '• 🎯 **Dán là xong:** Vào game ➔ Nhập mã ➔ Tự động lên đồ chuẩn meta trong 1 giây!',
    '',
    '👉 **Lấy mã súng ngay:** Bấm nút **"🔫 Khám Phá Build Súng Chuẩn Meta"** bên dưới! 👇',
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
      .setLabel('🔫 Khám Phá Build Súng Chuẩn Meta (Garena)')
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
