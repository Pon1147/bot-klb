import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import Database from 'better-sqlite3';
import { makeResult, BuildContainerResult } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { requireGuild } from '../../utils/df-guards.js';

export const MAP_SIMULATOR_URL =
  'https://s1-static.deltaforcetools.gg/dftool/dfmaptool/en/index.html';
export const MAP_HOMEPAGE_URL = 'https://deltaforcetools.gg/?utm_source=PonN%C3%A8';

/**
 * Xây dựng Container V2 hiển thị cẩm nang học map và các nút điều hướng 3D Simulator.
 */
export function buildMapContainer(): BuildContainerResult {
  const content = [
    '## 🗺️ Trình Mô Phỏng Bản Đồ 3D & Cẩm Nang Học Map',
    '',
    '🎮 **Công Cụ 3D Map Simulation (Khuyên dùng):**',
    '• Di chuyển tự do góc nhìn thứ nhất (FPS / Top-down) mô phỏng chính xác map trong game.',
    '• Quan sát trực quan toàn bộ tầng lầu, cầu thang & ngóc ngách để tránh bị phục kích.',
    '• Định vị sẵn hòm Safe Box, két sắt và các điểm rút quân an toàn trước khi vào trận.',
    '',
    '🔰 **Lộ trình học map cho Tân thủ:**',
    '• **Đập Nước Zero (Zero Dam):** Map nhập môn lý tưởng, cấu trúc công trình dễ nhớ, đường rút quân thuận tiện.',
    '• **Thung Lũng Layali:** Không gian rộng mở, nhiều mỏm đá bắn tỉa — cần nắm rõ các tuyến di chuyển kín.',
    '• **Phố Cổ Brakkesh:** Đô thị giao tranh tầm gần (CQB), rất nhiều góc nấp trong nhà.',
  ].join('\n');

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('🎮 Mở Trình Mô Phỏng Map 3D')
      .setURL(MAP_SIMULATOR_URL),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('🌐 Trang Chủ DeltaForceTools.gg')
      .setURL(MAP_HOMEPAGE_URL),
  );

  return makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content },
          { type: ComponentType.Separator, accentColor: COLORS.DF },
        ],
      },
      actionRow.toJSON(),
    ],
    MessageFlags.IsComponentsV2,
    [],
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
    flags: MessageFlags.IsComponentsV2,
  } as Parameters<typeof interaction.reply>[0]);
}
