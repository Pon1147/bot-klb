import {
  ChatInputCommandInteraction,
  ComponentType,
  GuildTextBasedChannel,
  MessageFlags,
  SlashCommandBuilder,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  Snowflake,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from 'discord.js';

import { buildErrorContainer, makeResult } from '../../utils/container.utils.js';
import { fetchDailyCodes, DailyCodes } from '../../services/deltaforce.scraper.js';
import { requireGuild } from '../../utils/df-guards.js';

export const data = new SlashCommandBuilder()
  .setName('df-code')
  .setDescription('Mật khẩu hằng ngày của các map.');

const ASSETS_PATH = './src/assets/img/map/';

export const MAP_DISPLAY: Record<keyof DailyCodes, { name: string; image: string }> = {
  'Đập Nước Zero': { name: 'Zero Dam', image: 'map_zero.png' },
  'Thung lũng Layali': { name: 'Layali', image: 'map_layali.png' },
  'Phố Cổ Brakkesh': { name: 'Brakkesh', image: 'map_brakkesh.png' },
  'Trạm Không Gian': { name: 'Space City', image: 'map_spacecity.png' },
  'Ngục Giam Thủy Triều': { name: 'Tide Prison', image: 'map_tideprison.png' },
};

const LAST_MESSAGE = new Map<string, Snowflake>();

/** Check if DailyCodes object has at least one non-null value */
export function hasAnyCodes(codes: DailyCodes | null): boolean {
  if (!codes) return false;
  return Object.values(codes).some((v) => v !== null && v !== undefined);
}

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
        new TextDisplayBuilder().setContent(`#\n Mã Code: ${code}\n`),
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

/** Delete previous /df-code message in the same channel */
async function deleteLastMessage(channel: GuildTextBasedChannel): Promise<void> {
  const oldId = LAST_MESSAGE.get(channel.id);
  if (!oldId) return;
  try {
    const msg = await channel.messages.fetch(oldId);
    await msg.delete();
  } catch {
    // Message already gone or permission denied — swallow
  }
  LAST_MESSAGE.delete(channel.id);
}

/** Save the new message id for future cleanup */
function saveMessageId(channel: GuildTextBasedChannel, messageId: Snowflake): void {
  LAST_MESSAGE.set(channel.id, messageId);
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const channel = interaction.channel as GuildTextBasedChannel;

  await interaction.deferReply({});

  // Delete previous message in this channel
  await deleteLastMessage(channel);

  try {
    const codes = await fetchDailyCodes().catch(() => null);

    const hasCodes = hasAnyCodes(codes);

    const container = buildCodesContainer(codes, hasCodes);

    const response = await interaction.editReply({
      components: container.toJSON(),
      files: container.files,
      flags: MessageFlags.IsComponentsV2,
    });

    // Save new message id for next run
    saveMessageId(channel, response.id);
  } catch (error) {
    const err = buildErrorContainer(`Lỗi khi lấy dữ liệu: ${(error as Error).message}`);
    const errResponse = await interaction.editReply({
      components: err.toJSON(),
      flags: MessageFlags.IsComponentsV2,
    });
    saveMessageId(channel, errResponse.id);
  }
}
