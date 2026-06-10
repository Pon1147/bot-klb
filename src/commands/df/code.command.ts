import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { fetchDailyCodes, DailyCodes } from '../../services/deltaforce.scraper.js';

export const data = new SlashCommandBuilder()
  .setName('df-code')
  .setDescription('Mat khau hang ngay cua Delta Force HQ.');

const MAP_DISPLAY: Record<keyof DailyCodes, string> = {
  'Đập Nước Zero': 'Zero Dam',
  'Thung lũng Layali': 'Layali',
  'Phố Cổ Brakkesh': 'Brakkesh',
  'Trạm Không Gian': 'Space City',
  'Ngục Giam Thủy Triều': 'Tide Prison',
};

function buildCodesContainer(codes: DailyCodes | null, hasCodes: boolean): {
  components: unknown[];
  flags: number;
} {
  let content: string;

  if (hasCodes && codes) {
    const parts: string[] = [];
    const maps = Object.entries(MAP_DISPLAY) as [keyof DailyCodes, string][];
    for (let i = 0; i < maps.length; i++) {
      const [fullName, shortName] = maps[i];
      const code = codes[fullName] || 'Chưa có';
      if (i > 0) parts.push('');
      parts.push(`**${shortName}**`);
      parts.push('```diff');
      parts.push(`+ ${code}`);
      parts.push('```');
    }
    content = parts.join('\n');
  } else {
    content = '_Khong tim thay mat khau hom nay._';
  }

  const inner: unknown[] = [
    { type: ComponentType.TextDisplay, content },
    { type: ComponentType.Separator, accentColor: 0x5865F2 },
  ];

  return {
    components: [{ type: ComponentType.Container, components: inner }],
    flags: MessageFlags.IsComponentsV2,
  };
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Chi dung trong server.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const codes = await fetchDailyCodes().catch(() => null);

    let hasCodes = false;
    if (codes) {
      hasCodes = Object.values(codes).some((v) => v !== null);
    }

    const container = buildCodesContainer(codes, hasCodes);
    await interaction.editReply({
      components: container.components as any,
      flags: container.flags | MessageFlags.Ephemeral,
    });
  } catch (error) {
    const err = buildErrorContainer(`Loi khi lay du lieu: ${(error as Error).message}`);
    await interaction.editReply({
      components: err.components as any,
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
