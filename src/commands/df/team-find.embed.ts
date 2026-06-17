/** Build Container V2 embed cho /team-find */

import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { makeResult } from '../../utils/container.utils.js';
import {
  MAP_DISPLAY,
  type Difficulty,
  type MapKey,
  type MapInfo,
} from '../../config/team-find.config.js';
import { DIFFICULTY_CONFIG } from '../../config/team-find.config.js';
import type { DfRank } from '../../utils/df-rank.utils.js';

const ASSETS_PATH = './src/assets/img/map/';

export interface TeamFindParams {
  mapKey: MapKey;
  difficulty: Difficulty;
  channelName: string;
  channelId: string;
  username: string;
  rank?: DfRank | null;
}

/** Build embed hiển thị thông tin tìm đồng đội + button join. */
export function buildTeamFindEmbed(params: TeamFindParams) {
  const mapInfo = MAP_DISPLAY[params.mapKey] as MapInfo;
  const diff = DIFFICULTY_CONFIG[params.difficulty];

  // Attach ảnh map
  const attachmentName = mapInfo.name.toLowerCase().replace(/\s+/g, '-') + '.png';
  const mapAttachment = new AttachmentBuilder(`${ASSETS_PATH}${mapInfo.image}`).setName(attachmentName);

  // ── Header Section: avatar + title ──
  const headerSection: Record<string, unknown> = {
    type: ComponentType.Section,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: `## 🔍 **${params.username}** đang tìm đồng đội`,
      },
    ],
    accessory: {
      type: ComponentType.Thumbnail,
      media: { url: `attachment://${attachmentName}` },
      description: mapInfo.name,
    },
  };

  // ── Stats Text ──
  const lines: string[] = [];

  lines.push(`🗺️ **Bản đồ**: ${mapInfo.name}`);
  lines.push(`🎯 **Chế độ**: ${diff.emoji} ${diff.label}`);

  if (params.rank) {
    const rankInfo = params.rank;
    lines.push(`🏅 **Rank**: ${rankInfo.name}`);
  }

  lines.push(`🎧 **Phòng**: ${params.channelName}`);
  lines.push('');
  lines.push('_Nhấn nút bên dưới để tham gia!_');

  // ── Separator with difficulty color ──
  const separator: Record<string, unknown> = {
    type: ComponentType.Separator,
    accentColor: diff.color,
  };

  // ── Container ──
  const containerInner: unknown[] = [
    headerSection,
    { type: ComponentType.TextDisplay, content: lines.join('\n') },
    separator,
    // Map image as media gallery
    {
      type: ComponentType.MediaGallery,
      items: [
        {
          media: { url: `attachment://${attachmentName}` },
          description: mapInfo.name,
        },
      ],
    },
  ];

  const container: Record<string, unknown> = {
    type: ComponentType.Container,
    components: containerInner,
  };

  // ── Button Row ──
  const joinButton = new ButtonBuilder()
    .setCustomId(`team-find-join:${params.channelId}`)
    .setLabel('🎧 Tôi muốn join')
    .setStyle(ButtonStyle.Primary);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton);

  const resultComponents: unknown[] = [container, buttonRow];

  return makeResult(resultComponents, MessageFlags.IsComponentsV2, [mapAttachment]);
}
