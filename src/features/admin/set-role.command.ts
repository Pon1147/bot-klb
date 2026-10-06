/**
 * /set-role — Cấu hình role IDs cho RBAC theo từng máy chủ.
 *
 * Usage:
 *   /set-role owner @RoleName
 *   /set-role moderator @RoleName
 *   /set-role member @RoleName
 *
 * Lưu vào guild_settings (SQLite & Mongo) của máy chủ hiện tại qua SettingsService.
 */

import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  Role,
} from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { getSettingsService, SettingsService } from '../../services/settings.service.js';
import { requireAdministrator } from '../../utils/df-guards.js';
import { sendReply } from '../../utils/reply.utils.js';

// ─── Subcommand Builder ───────────────────────────────────────────

function buildOwnerSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('owner')
    .setDescription('Set Owner role cho RBAC của máy chủ.')
    .addRoleOption((opt) => opt.setName('role').setDescription('Role Owner').setRequired(true));
}

function buildModeratorSubcommand(
  sub: SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder {
  return sub
    .setName('moderator')
    .setDescription('Set Moderator role cho RBAC của máy chủ.')
    .addRoleOption((opt) => opt.setName('role').setDescription('Role Moderator').setRequired(true));
}

function buildMemberSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('member')
    .setDescription('Set Member role cho RBAC của máy chủ.')
    .addRoleOption((opt) => opt.setName('role').setDescription('Role Member').setRequired(true));
}

export const data = new SlashCommandBuilder()
  .setName('set-role')
  .setDescription('Cấu hình role IDs cho RBAC system của máy chủ.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(buildOwnerSubcommand)
  .addSubcommand(buildModeratorSubcommand)
  .addSubcommand(buildMemberSubcommand);

// ─── Permission mapping ───────────────────────────────────────────

const ROLE_KEY_MAP = {
  owner: { key: 'Owner', field: 'ownerRoleId' },
  moderator: { key: 'Moderator', field: 'moderatorRoleId' },
  member: { key: 'Member', field: 'memberRoleId' },
} as const;

// ─── Execute ──────────────────────────────────────────────────────

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await sendReply(interaction, { content: 'Lệnh này chỉ dùng được trong server.' });
    return;
  }

  // Guard: Yêu cầu quyền Administrator
  if (await requireAdministrator(interaction)) return;

  const subcommand = interaction.options.getSubcommand() as keyof typeof ROLE_KEY_MAP;
  const mapping = ROLE_KEY_MAP[subcommand];
  const role = interaction.options.getRole('role') as Role;

  if (!role) {
    await sendReply(interaction, {
      components: buildErrorContainer('Không tìm thấy role đã chọn.').toJSON(),
    });
    return;
  }

  // Kiểm tra: không set @everyone (ID = guild ID)
  if (role.id === interaction.guild.id) {
    await sendReply(interaction, {
      components: buildErrorContainer('Không thể dùng @everyone làm role.').toJSON(),
    });
    return;
  }

  // Kiểm tra: role name không rỗng
  if (!role.name || role.name.trim() === '') {
    await sendReply(interaction, {
      components: buildErrorContainer('Role phải có tên hợp lệ.').toJSON(),
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    let settingsService: SettingsService;
    try {
      settingsService = getSettingsService();
    } catch {
      if (!database) {
        throw new Error('SettingsService chưa được khởi tạo và database không khả dụng.');
      }
      settingsService = new SettingsService(database);
    }

    settingsService.update(interaction.guild.id, {
      rbac: {
        [mapping.field]: role.id,
      },
    });

    await interaction.editReply({
      content: `✅ Đã set **${mapping.key}** role: ${role} (${role.id}) cho máy chủ này.`,
    });
  } catch (error) {
    const err = buildErrorContainer(`Lỗi khi lưu: ${(error as Error).message}`);
    await interaction.editReply({ components: err.toJSON() });
  }
}
