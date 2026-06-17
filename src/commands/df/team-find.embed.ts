/** Build Container V2 embed cho /team-find — tactical, emoji-free design */

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
  avatarUrl: string;
  rank?: DfRank | null;
}

/** Build embed hiển thị thông tin tìm đồng đội + button join. */
export function buildTeamFindEmbed(params: TeamFindParams) {
  const mapInfo = MAP_DISPLAY[params.mapKey] as MapInfo;
  const diff = DIFFICULTY_CONFIG[params.difficulty];

  const attachmentName = mapInfo.name.toLowerCase().replace(/\s+/g, '-') + '.png';
  const mapAttachment = new AttachmentBuilder(`${ASSETS_PATH}${mapInfo.image}`).setName(attachmentName);

  // ── Header: username + avatar thumbnail ──
  const headerSection: Record<string, unknown> = {
    type: ComponentType.Section,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: `## **${params.username}** đang tìm đồng đội`,
      },
    ],
    accessory: {
      type: ComponentType.Thumbnail,
      media: { url: params.avatarUrl },
    },
  };

  // ── Stats: MODE / RANK / ROOM ──
  const lines: string[] = [];

  lines.push(`**MODE**`);
  lines.push(diff.label);
  lines.push('');

  if (params.rank) {
    lines.push(`**RANK**`);
    lines.push(params.rank.name);
    lines.push('');
  }

  lines.push(`**ROOM**`);
  lines.push(params.channelName);

  // ── Separator with difficulty accent color ──
  const separator: Record<string, unknown> = {
    type: ComponentType.Separator,
    accentColor: diff.color,
  };

  // ── Container ──
  const containerInner: unknown[] = [
    headerSection,
    { type: ComponentType.TextDisplay, content: lines.join('\n') },
    separator,
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
    .setLabel('Join Room')
    .setStyle(ButtonStyle.Primary);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton);

  const resultComponents: unknown[] = [container, buttonRow];

  return makeResult(resultComponents, MessageFlags.IsComponentsV2, [mapAttachment]);
}
