import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { buildErrorEmbed, buildSuccessEmbed } from '../../utils/embed.utils.js';
import { getSettingsService } from '../../services/settings.service.js';
import { EMBED_COLORS } from '../../config/embed.variables.js';
import { TEMPLATE_VARIABLE_DESCRIPTIONS } from '../../config/variables.js';
import { cloneDefaultSettings } from '../../config/default.settings.js';
import { startInteractiveEdit } from './embed.interactive.edit.js';

// ─── Subcommand Builder Functions ─────────────────────────────
// Tách thành named functions để Jest coverage track được đầy đủ
// (Istanbul không track inline arrow callbacks trong ESM module scope).

/**
 * Builder cho subcommand "edit" — chỉnh sửa embed settings qua Interactive UI.
 */
export function buildEditSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('edit')
    .setDescription('Chỉnh sửa embed settings (Interactive UI).')
    .addStringOption(buildEditTypeOptionCallback);
}

/**
 * Builder cho subcommand "reset" — reset embed settings về mặc định.
 */
export function buildResetSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('reset')
    .setDescription('Reset embed settings về mặc định.')
    .addStringOption(buildResetTypeOptionCallback);
}

/**
 * Builder cho subcommand "preview" — xem trước embed message.
 */
export function buildPreviewSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('preview')
    .setDescription('Xem trước embed message.')
    .addStringOption(buildPreviewTypeOptionCallback)
    .addUserOption(buildPreviewMemberOptionCallback);
}

/**
 * Builder cho subcommand "list" — liệt kê template variables.
 */
export function buildListSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub.setName('list').setDescription('Liệt kê tất cả template variables có sẵn.');
}

// ─── Option Builder Callbacks ─────────────────────────────────
// Named callbacks cho addStringOption/addUserOption để Istanbul coverage track được.
// Export để test trực tiếp (Istanbul không track private functions trong ESM module scope).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildEditTypeOptionCallback(opt: any): any {
  return opt
    .setName('type')
    .setDescription('Loại embed cần chỉnh sửa.')
    .setRequired(true)
    .addChoices(
      { name: 'Welcome', value: 'welcome' },
      { name: 'Leave', value: 'leave' },
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildResetTypeOptionCallback(opt: any): any {
  return opt
    .setName('type')
    .setDescription('Loại embed cần reset.')
    .setRequired(true)
    .addChoices(
      { name: 'Welcome', value: 'welcome' },
      { name: 'Leave', value: 'leave' },
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPreviewTypeOptionCallback(opt: any): any {
  return opt
    .setName('type')
    .setDescription('Loại embed cần preview.')
    .setRequired(true)
    .addChoices(
      { name: 'Welcome', value: 'welcome' },
      { name: 'Leave', value: 'leave' },
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPreviewMemberOptionCallback(opt: any): any {
  return opt
    .setName('member')
    .setDescription('Member để preview (mặc định: người dùng).')
    .setRequired(false);
}

/**
 * Command structure: export `data` (SlashCommandBuilder) và `execute`.
 *
 * /embed — quản lý embed settings (edit, reset, preview, list).
 * Yêu cầu Administrator permission.
 */
export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Quản lý embed settings cho welcome/leave messages.')
  .addSubcommand(buildEditSubcommand)
  .addSubcommand(buildResetSubcommand)
  .addSubcommand(buildPreviewSubcommand)
  .addSubcommand(buildListSubcommand);

/**
 * Execute /embed command: router phân phối subcommand.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  // Guard clause: chỉ dùng trong guild
  if (!interaction.guild) {
    await interaction.reply({
      content: 'Lệnh này chỉ dùng được trong server.',
      ephemeral: true,
    });
    return;
  }

  // Guard clause: check Administrator permission
  const commandingMember = interaction.member as GuildMember;
  if (!commandingMember || !commandingMember.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Bạn cần quyền Administrator để sử dụng lệnh này.',
      ephemeral: true,
    });
    return;
  }

  const subcommandName = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  try {
    switch (subcommandName) {
      case 'edit':
        // Chuyển sang Interactive Button UI thay vì text options cũ
        const type = interaction.options.getString('type') as 'welcome' | 'leave';
        await startInteractiveEdit(interaction, type);
        break;
      case 'reset':
        await handleReset(interaction, guildId);
        break;
      case 'preview':
        await handlePreview(interaction, guildId);
        break;
      case 'list':
        await handleList(interaction);
        break;
      default:
        await interaction.reply({
          embeds: [buildErrorEmbed('Subcommand không hợp lệ.')],
          ephemeral: true,
        });
    }
  } catch (error) {
    console.error(`Error in /embed ${subcommandName}:`, error);
    // Guard: interaction có thể đã replied ở trong handler
    if (!interaction.replied) {
      await interaction.reply({
        embeds: [buildErrorEmbed('Xảy ra lỗi. Kiểm tra console logs.')],
        ephemeral: true,
      });
    }
  }
}

// ─── Handlers ───────────────────────────────────────────────
/**
 * Handle /embed reset — reset embed settings về default.
 */
async function handleReset(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  const type = interaction.options.getString('type') as 'welcome' | 'leave';
  const defaults = cloneDefaultSettings();

  const settingsService = getSettingsService();

  // Merge: chỉ reset phần embed của type, giữ nguyên các settings khác (channelId, roleId, enabled)
  settingsService.update(guildId, {
    [type]: {
      embed: defaults[type].embed,
    },
  });

  await interaction.reply({
    embeds: [
      buildSuccessEmbed(`Đã reset embed "${type}" về mặc định.`),
    ],
    ephemeral: true,
  });
}

/**
 * Handle /embed preview — xem trước embed message.
 * Có try-catch vì buildEmbed có thể throw (template resolve fail, avatar URL error, ...).
 */
async function handlePreview(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  const type = interaction.options.getString('type') as 'welcome' | 'leave';
  const targetUser = interaction.options.getUser('member') ?? interaction.user;

  const settingsService = getSettingsService();
  const settings = settingsService.get(guildId);

  // Guard: cần GuildMember để build embed (avatar, joinedAt, ...)
  const guildMember = await interaction.guild!.members.fetch({ user: targetUser.id }).catch(() => null);
  if (!guildMember) {
    await interaction.reply({
      embeds: [buildErrorEmbed(`Không tìm thấy member "${targetUser.tag}" trong server.`)],
      ephemeral: true,
    });
    return;
  }

  // Build template context
  const context = {
    member: guildMember,
    guild: interaction.guild!,
  };

  // Build embed từ settings — wrap try-catch vì resolveTemplate có thể throw
  try {
    const embed = settingsService.buildEmbed(settings[type].embed, context);
    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error building preview embed:', error);
    await interaction.reply({
      embeds: [buildErrorEmbed(`Không thể build preview: ${(error as Error).message}`)],
      ephemeral: true,
    });
  }
}

/**
 * Handle /embed list — liệt kê template variables.
 */
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('📋 Template Variables')
    .setDescription('Các biến có sẵn dùng trong embed settings (dùng `{variable}` syntax).')
    .setColor(EMBED_COLORS.INFO)
    .setTimestamp();

  // Build fields từ descriptions
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  for (const [variable, description] of Object.entries(TEMPLATE_VARIABLE_DESCRIPTIONS)) {
    fields.push({
      name: `\`${variable}\``,
      value: description,
      inline: false,
    });
  }

  embed.addFields(fields);
  embed.setFooter({ text: 'Ví dụ: "Chào mừng {member} đến {guild}!"' });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

