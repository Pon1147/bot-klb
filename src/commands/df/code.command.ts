import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from 'discord.js';

import { buildErrorContainer, makeResult } from '../../utils/container.utils.js';
import { fetchDailyCodes, DailyCodes } from '../../services/deltaforce.scraper.js';

export const data = new SlashCommandBuilder()
  .setName('df-code')
  .setDescription('Mật khẩu hằng ngày của các map.');

const ASSETS_PATH = './src/assets/img/map/';

const MAP_DISPLAY: Record<keyof DailyCodes, { name: string; image: string }> = {
  'Đập Nước Zero': { name: 'Zero Dam', image: 'map_zero.png' },
  'Thung lũng Layali': { name: 'Layali', image: 'map_layali.png' },
  'Phố Cổ Brakkesh': { name: 'Brakkesh', image: 'map_brakkesh.png' },
  'Trạm Không Gian': { name: 'Space City', image: 'map_spacecity.png' },
  'Ngục Giam Thủy Triều': { name: 'Tide Prison', image: 'map_tideprison.png' },
};

function buildCodesContainer(codes: DailyCodes | null, hasCodes: boolean) {
  const attachments: AttachmentBuilder[] = [];
  const container = new ContainerBuilder();

  if (hasCodes && codes) {
    const maps = Object.entries(MAP_DISPLAY) as [
      keyof DailyCodes,
      { name: string; image: string },
    ][];

    maps.forEach(([fullName, mapInfo], index) => {
      const code = codes[fullName] || 'Chưa có';

      const attachment = new AttachmentBuilder(`${ASSETS_PATH}${mapInfo.image}`).setName(
        `${mapInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`,
      );
      attachments.push(attachment);

      // Tên map + code
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${mapInfo.name}**\n\`\`\`diff\n+ ${code}\n\`\`\``),
      );

      // Ảnh to, full width bằng MediaGallery
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder({
            media: { url: `attachment://${attachment.name}` },
          }),
        ),
      );

      if (index < maps.length - 1) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }
    });
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('_Không tìm thấy mật khẩu hôm nay._'),
    );
  }

  return makeResult(
    [{ type: ComponentType.Container, components: container.components }],
    MessageFlags.IsComponentsV2,
    attachments,
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  try {
    const codes = await fetchDailyCodes().catch(() => null);

    let hasCodes = false;
    if (codes) {
      hasCodes = Object.values(codes).some((v) => v !== null && v !== undefined);
    }

    const container = buildCodesContainer(codes, hasCodes);

    await interaction.editReply({
      components: container.toJSON(),
      files: container.files,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  } catch (error) {
    const err = buildErrorContainer(`Lỗi khi lấy dữ liệu: ${(error as Error).message}`);
    await interaction.editReply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
