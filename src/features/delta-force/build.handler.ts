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
import { searchWeaponLoadouts, WeaponLoadoutRecord } from '../../database/df-loadouts.db.js';

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
    '## 🔫 Thư Viện Build Súng & Mã Gunsmith Meta (Bản Tiếng Việt)',
    '> 🇻🇳 **ĐÃ CÓ BẢN TIẾNG VIỆT:** Hợp tác chính thức cùng **DeltaForceTools** mang trọn bộ build súng chuẩn meta đến game thủ Garena!',
    '',
    '### ⚡ Lợi Thế Vượt Trội Cho Bạn:',
    '- 🏆 **Chuẩn Meta Server Garena:** Tuyển tập CAR-15, M4A1, AKM, K416, AUG... với phụ kiện tối ưu độ giật, sấy siêu đầm tay hoặc càn quét cự ly gần cực gắt.',
    '- 📋 **Copy 1-Click Cực Tiện:** Chọn súng ➔ Bấm **"Copies"** (Sao chép mã) trên web là có ngay mã Gunsmith.',
    '- 🎯 **Áp Dụng Trong 1 Giây:** Vào game ➔ Dán mã ➔ Tự động lên đầy đủ phụ kiện tuyển thủ mà không tốn công mò mẫm.',
    '',
    '### 🚀 Nâng Cấp Hỏa Lực Ngay:',
    'Bấm nút **"🔫 Khám Phá Build Súng Chuẩn Meta"** bên dưới để sao chép mã và leo rank ngay hôm nay! 👇',
    '',
    '-# 💡 Mẹo: Danh sách được cập nhật liên tục theo các bản vá cân bằng súng mới nhất.',
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
 * Xây dựng Container V2 hiển thị thông tin build cụ thể của 1 khẩu súng.
 */
export function buildSpecificWeaponContainer(
  weaponQuery: string,
  loadouts: WeaponLoadoutRecord[],
): BuildContainerResult {
  if (loadouts.length === 0) {
    const content = [
      `## 🔍 Không Tìm Thấy Build Súng: "${weaponQuery}"`,
      '> ⚠️ Chưa có dữ liệu mã Gunsmith cho súng này trong bộ nhớ đệm máy chủ.',
      '',
      '### 💡 Gợi Ý Dành Cho Bạn:',
      '- Thử lại với tên súng chuẩn: `CAR-15`, `M4A1`, `AKM`, `K416`, `AUG`...',
      '- Bấm nút bên dưới để truy cập thư viện đầy đủ và sao chép mã trực tiếp từ web!',
    ].join('\n');

    const containerInner: unknown[] = [
      { type: ComponentType.TextDisplay, content },
      { type: ComponentType.Separator, accentColor: COLORS.DF },
    ];

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('🔫 Mở Thư Viện Build Súng (Garena)')
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
      [],
    );
  }

  const primary = loadouts[0];
  const typeText = primary.weapon_type ? ` (${primary.weapon_type})` : '';
  const content = [
    `## 🔫 Build Súng: ${primary.weapon_name}${typeText}`,
    `> 🏷️ **Tags:** \`${primary.tags || 'Meta'}\` • 🎮 **Chế độ:** \`${primary.game_mode || 'Tất cả'}\``,
    '',
    '### 📋 Mã Gunsmith (Sao chép và dán vào game):',
    '```',
    primary.loadout_code,
    '```',
    '',
    '### 💡 Mô Tả & Khuyên Dùng:',
    primary.description
      ? primary.description
      : 'Build chuẩn meta tối ưu độ đầm tay, sấy ổn định cự ly trung bình và gần.',
    '',
    '-# 👤 Nguồn: ' +
      (primary.author || 'deltaforcetools.gg') +
      ' | Server: ' +
      primary.server_region,
  ].join('\n');

  const containerInner: unknown[] = [
    { type: ComponentType.TextDisplay, content },
    { type: ComponentType.Separator, accentColor: COLORS.DF },
  ];

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(`🔫 Xem Thêm Build ${primary.weapon_name} Trên Web`)
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
    [],
  );
}

/**
 * Handler thực thi khi người dùng gõ /df build hoặc /df gun.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const weaponOption = interaction.options?.getString?.('weapon') ?? null;
  const modeOption = interaction.options?.getString?.('mode') ?? null;

  let result: BuildContainerResult;

  if (weaponOption && database) {
    const loadouts = searchWeaponLoadouts(database, {
      weapon: weaponOption,
      gameMode: modeOption || undefined,
      serverRegion: 'Garena',
    });
    result = buildSpecificWeaponContainer(weaponOption, loadouts);
  } else {
    result = buildWeaponContainer();
  }

  await interaction.reply({
    components: result.toJSON(),
    files: result.files,
    flags: MessageFlags.IsComponentsV2,
  } as Parameters<typeof interaction.reply>[0]);
}
