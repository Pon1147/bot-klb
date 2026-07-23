/** /df-code — Mật khẩu hằng ngày của các map (Container V2 pattern) */

import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';

import { buildErrorContainer, makeResult } from '../../utils/container.utils.js';
import { fetchDailyCodes, DailyCodes } from '../../services/deltaforce.scraper.js';
import { requireGuild } from '../../utils/df-guards.js';
import { MAP_DISPLAY, ASSETS_PATH, type MapKey, type MapInfo } from '../../config/team-find.config.js';
export { MAP_DISPLAY };

export const data = new SlashCommandBuilder()
  .setName('df-code')
  .setDescription('Mật khẩu hằng ngày của các map.');

/** Check if DailyCodes object has at least one non-null value */
export function hasAnyCodes(codes: DailyCodes | null): boolean {
  if (!codes) return false;
  return Object.values(codes).some((v) => v !== null && v !== undefined);
}

function buildCodesContainer(codes: DailyCodes | null, hasCodes: boolean) {
  const attachments: AttachmentBuilder[] = [];
  const containerInner: unknown[] = [];

  if (hasCodes && codes) {
    const maps = Object.entries(MAP_DISPLAY) as [MapKey, MapInfo][];

    maps.forEach(([fullName, mapInfo], index) => {
      const code = codes[fullName] || 'Chưa có';

      const attachment = new AttachmentBuilder(
        `${ASSETS_PATH}${mapInfo.image}`,
      ).setName(`${mapInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`);
      attachments.push(attachment);

      containerInner.push({
        type: ComponentType.TextDisplay,
        content: `#\n Mã Code: ${code}\n`,
      });

      containerInner.push({
        type: ComponentType.MediaGallery,
        items: [
          {
            media: { url: `attachment://${attachment.name}` },
          },
        ],
      });

      if (index < maps.length - 1) {
        containerInner.push({ type: ComponentType.Separator });
      }
    });
  } else {
    containerInner.push({
      type: ComponentType.TextDisplay,
      content: '_Không tìm thấy mật khẩu hôm nay._',
    });
  }

  return makeResult(
    [{ type: ComponentType.Container, components: containerInner }],
    MessageFlags.IsComponentsV2,
    attachments,
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  await interaction.deferReply({});

  try {
    const codes = await fetchDailyCodes().catch(() => null);

    const hasCodes = hasAnyCodes(codes);

    const container = buildCodesContainer(codes, hasCodes);

    await interaction.editReply({
      components: container.toJSON(),
      files: container.files,
      flags: container.flags,
    });
  } catch (error) {
    const err = buildErrorContainer(`Lỗi khi lấy dữ liệu: ${(error as Error).message}`);
    await interaction.editReply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
