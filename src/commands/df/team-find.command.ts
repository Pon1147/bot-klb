/** /team-find — Tìm đồng đội chơi theo bản đồ và chế độ */

import {
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  MessageFlags,
} from 'discord.js';
import { requireGuild } from '../../utils/df-guards.js';
import { checkVoiceForTeamFind } from '../../utils/df-voice.utils.js';
import { buildTeamFindEmbed } from './team-find.embed.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import {
  storeMessage,
  getMessageRef,
  deleteMessageRef,
} from '../../services/team-find-message-store.js';
import {
  MAP_MODES,
  DIFFICULTY_CONFIG,
  TEAM_FIND_RANKS,
  type MapKey,
} from '../../config/team-find.config.js';

// Build mode label lookup
const modeLabels: Record<string, string> = {};
for (const [, cfg] of Object.entries(DIFFICULTY_CONFIG)) {
  modeLabels[cfg.id] = cfg.label;
}

// Raw command JSON — includes behavior_dependencies natively
export const data = {
  name: 'team-find',
  description: 'Tìm đồng đội chơi theo bản đồ và chế độ',
  type: 1, // ChatInput
  options: [
    {
      type: 3, // STRING
      name: 'map',
      description: 'Bản đồ muốn chơi',
      required: true,
      choices: [
        { name: 'Đập Nước Zero', value: 'Đập Nước Zero' },
        { name: 'Thung lũng Layali', value: 'Thung lũng Layali' },
        { name: 'Phố Cổ Brakkesh', value: 'Phố Cổ Brakkesh' },
        { name: 'Trạm Không Gian', value: 'Trạm Không Gian' },
        { name: 'Ngục Giam Thủy Triều', value: 'Ngục Giam Thủy Triều' },
      ],
    },
    {
      type: 3, // STRING
      name: 'mode',
      description: 'Độ khó muốn chơi',
      required: true,
      choices: Object.values(DIFFICULTY_CONFIG).map((c) => ({ name: c.label, value: c.label })),
    },
    {
      type: 3, // STRING
      name: 'rank',
      description: 'Bậc rank của bạn (tùy chọn)',
      required: false,
      choices: TEAM_FIND_RANKS,
    },
  ],
  behavior_dependencies: [
    {
      depending_on: 'mode',
      requiring: 'map',
      values: Object.fromEntries(
        Object.entries(MAP_MODES).map(([mapKey, modes]) => [
          mapKey,
          modes.map((m) => modeLabels[m]),
        ]),
      ),
    },
  ],
};

/** Xóa message cũ của user — fetch từ channel đúng nơi message được lưu */
async function deleteOldTeamFindMessage(
  guild: any,
  userId: string,
): Promise<void> {
  const ref = getMessageRef(guild.id, userId);
  if (!ref) return;

  try {
    const oldChannel = await guild.channels.fetch(ref.channelId).catch(() => null);
    if (oldChannel && oldChannel.isTextBased()) {
      const oldMsg = await oldChannel.messages.fetch(ref.messageId).catch(() => null);
      if (oldMsg) await oldMsg.delete();
    }
  } catch {
    // Message already gone
  }
  deleteMessageRef(guild.id, userId);
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  // Check voice state
  const voiceResult = checkVoiceForTeamFind(interaction);
  if (!voiceResult.success) {
    const err = buildErrorContainer(voiceResult.errorMessage!);
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  // Get options
  const mapKey = interaction.options.getString('map', true) as MapKey;
  const modeLabel = interaction.options.getString('mode', true);
  const rank = interaction.options.getString('rank', false);

  // Resolve difficulty from label
  let difficulty: 'easy' | 'normal' | 'hard' = 'easy';
  for (const [, cfg] of Object.entries(DIFFICULTY_CONFIG)) {
    if (cfg.label === modeLabel) {
      difficulty = cfg.id;
      break;
    }
  }

  const channel = interaction.channel as GuildTextBasedChannel;
  const guild = interaction.guild!;

  // Delete old message (fetch from stored channel, not current interaction channel)
  await deleteOldTeamFindMessage(guild, interaction.user.id);

  // Build embed
  const embed = buildTeamFindEmbed({
    mapKey,
    difficulty,
    channelName: voiceResult.channelName!,
    channelId: voiceResult.channelId!,
    username: interaction.user.username,
    avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
    rank: rank ?? null,
  });

  const response = await interaction.reply({
    components: embed.toJSON(),
    files: embed.files,
    flags: MessageFlags.IsComponentsV2,
  }) as any;

  // Store message reference for future updates
  storeMessage(guild.id, interaction.user.id, response.id, channel.id);
}
