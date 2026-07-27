/**
 * /set-role — Cấu hình role IDs cho RBAC.
 *
 * Usage:
 *   /set-role owner @RoleName
 *   /set-role moderator @RoleName
 *
 * Lưu vào permissions.json để persist.
 */

import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  GuildMember,
  Role,
} from 'discord.js';
import Database from 'better-sqlite3';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { loadPermissions } from '../../config/permissions.js';

// ─── Subcommand Builder ───────────────────────────────────────────

function buildOwnerSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('owner')
    .setDescription('Set Owner role cho RBAC.')
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('Role Owner').setRequired(true),
    );
}

function buildModeratorSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('moderator')
    .setDescription('Set Moderator role cho RBAC.')
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('Role Moderator').setRequired(true),
    );
}

export const data = new SlashCommandBuilder()
  .setName('set-role')
  .setDescription('Cấu hình role IDs cho RBAC system.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(buildOwnerSubcommand)
  .addSubcommand(buildModeratorSubcommand);

// ─── Permission mapping ───────────────────────────────────────────

const ROLE_KEY_MAP: Record<string, 'Owner' | 'Moderator'> = {
  owner: 'Owner',
  moderator: 'Moderator',
};

// ─── Execute ──────────────────────────────────────────────────────

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'Lệnh này chỉ dùng được trong server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Bạn cần quyền Administrator để sử dụng lệnh này.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const roleKey = ROLE_KEY_MAP[subcommand];
  const role = interaction.options.getRole('role') as Role;

  if (!role) {
    const err = buildErrorContainer('Không tìm thấy role đã chọn.');
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // 1. Đọc permissions.json
    const permPath = join(__dirname, '..', '..', 'config', 'permissions.json');
    const permData = JSON.parse(readFileSync(permPath, 'utf8')) as Record<string, unknown>;

    // 2. Update role ID
    if (typeof permData.roles === 'object' && permData.roles !== null) {
      (permData.roles as Record<string, string>)[roleKey] = role.id;
    }

    // 3. Ghi lại file
    writeFileSync(permPath, JSON.stringify(permData, null, 2), 'utf8');

    // 4. Reload runtime cache
    loadPermissions(permData as any);

    await interaction.editReply({
      content: `✅ Đã set **${roleKey}** role: ${role} (${role.id})`,
    });
  } catch (error) {
    const err = buildErrorContainer(`Lỗi khi lưu: ${(error as Error).message}`);
    await interaction.editReply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
