/**
 * /config — Quản lý cấu hình máy chủ (Roles RBAC, Welcome, Booster, Container).
 *
 * Cấu trúc:
 * /config roles set <role_type> <role>
 * /config roles view
 * /config welcome setchannel <channel>
 * /config welcome setrole <role>
 * /config welcome toggle <enabled>
 * /config welcome status
 * /config booster setchannel <channel>
 * /config booster setrole <role>
 * /config booster toggle <enabled>
 * /config booster status
 * /config container edit <type>
 * /config container reset <type>
 */

import {
  ChatInputCommandInteraction,
  MessageFlags,
  Role,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService, SettingsService } from '../../services/settings.service.js';
import {
  buildErrorContainer,
  buildTextOnlyContainer,
  buildEditTypeOptionCallback,
  buildResetTypeOptionCallback,
} from '../../utils/container.utils.js';
import { sendReply } from '../../utils/reply.utils.js';
import {
  executeSectionCommand,
  getBoosterConfig,
  getWelcomeConfig,
} from '../../utils/section-config.handlers.js';
import { startInteractiveEdit } from '../container/container-edit.handler.js';
import { handleContainerReset } from '../container/container-reset.handler.js';
import { COLORS } from '../../config/container.variables.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ConfigCommand');

// ─── Subcommand Builders ──────────────────────────────────────────

/** Nhóm roles: cấu hình và xem RBAC roles */
function buildRolesGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('roles')
    .setDescription('Cấu hình và xem các role RBAC của máy chủ.')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('set')
        .setDescription('Thiết lập role cho một phân quyền bot.')
        .addStringOption((opt) =>
          opt
            .setName('role_type')
            .setDescription('Loại quyền cần gán role')
            .setRequired(true)
            .addChoices(
              { name: 'Bot Admin', value: 'bot_admin' },
              { name: 'Moderator', value: 'moderator' },
              { name: 'Member', value: 'member' },
            ),
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role Discord cần gán').setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('view').setDescription('Xem danh sách role RBAC hiện tại của máy chủ.'),
    );
}

/** Nhóm welcome: cấu hình hệ thống chào mừng */
function buildWelcomeGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('welcome')
    .setDescription('Cấu hình hệ thống chào mừng thành viên mới.')
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setDescription('Chọn kênh gửi tin nhắn chào mừng.')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Kênh tin nhắn').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('setrole')
        .setDescription('Chọn role tự động cấp khi vào server.')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role cần cấp').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt hệ thống chào mừng.')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật (true) hoặc Tắt (false)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Xem trạng thái cấu hình chào mừng hiện tại.'),
    );
}

/** Nhóm booster: cấu hình hệ thống cảm ơn server booster */
function buildBoosterGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('booster')
    .setDescription('Cấu hình hệ thống cảm ơn Server Booster.')
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setDescription('Chọn kênh gửi tin nhắn cảm ơn Booster.')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Kênh tin nhắn').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('setrole')
        .setDescription('Chọn role dành riêng cho Booster.')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role Booster').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt hệ thống thông báo Booster.')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật (true) hoặc Tắt (false)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Xem trạng thái cấu hình Booster hiện tại.'),
    );
}

/** Nhóm container: biên tập giao diện Components V2 */
function buildContainerGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('container')
    .setDescription('Tùy biến giao diện thông báo Components V2.')
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Chỉnh sửa container settings (Interactive UI).')
        .addStringOption(buildEditTypeOptionCallback),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Reset container settings về mặc định.')
        .addStringOption(buildResetTypeOptionCallback),
    );
}

// ─── Slash Command Builder ────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Quản lý cấu hình bot, roles, welcome, booster, và container.')
  .addSubcommandGroup(buildRolesGroup)
  .addSubcommandGroup(buildWelcomeGroup)
  .addSubcommandGroup(buildBoosterGroup)
  .addSubcommandGroup(buildContainerGroup);

// ─── Roles Mapping ────────────────────────────────────────────────

const ROLE_TYPE_MAP = {
  bot_admin: { label: 'Bot Admin', field: 'botAdminRoleId' },
  moderator: { label: 'Moderator', field: 'moderatorRoleId' },
  member: { label: 'Member', field: 'memberRoleId' },
} as const;

// ─── Roles Subcommand Handlers ────────────────────────────────────

async function handleRolesSet(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const guild = interaction.guild!;
  const roleType = interaction.options.getString('role_type', true) as keyof typeof ROLE_TYPE_MAP;
  const role = interaction.options.getRole('role', true) as Role;
  const mapping = ROLE_TYPE_MAP[roleType];

  if (!mapping) {
    await sendReply(interaction, {
      components: buildErrorContainer('Loại role không hợp lệ.').toJSON(),
    });
    return;
  }

  // Kiểm tra không set @everyone (ID = guild ID)
  if (role.id === guild.id) {
    await sendReply(interaction, {
      components: buildErrorContainer('Không thể dùng @everyone làm role RBAC.').toJSON(),
    });
    return;
  }

  // Kiểm tra role name không rỗng
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

    const rbacUpdate: Record<string, string> = {
      [mapping.field]: role.id,
    };
    // Đồng bộ legacy ownerRoleId nếu cấu hình bot_admin
    if (roleType === 'bot_admin') {
      rbacUpdate.ownerRoleId = role.id;
    }

    settingsService.update(guild.id, {
      rbac: rbacUpdate,
    });

    await interaction.editReply({
      content: `✅ Đã thiết lập **${mapping.label}** role: ${role} (\`${role.id}\`) cho máy chủ này.`,
    });
  } catch (error) {
    logger.error(`Error saving role config: ${(error as Error).message}`);
    const err = buildErrorContainer(`Lỗi khi lưu: ${(error as Error).message}`);
    await interaction.editReply({ components: err.toJSON() });
  }
}

async function handleRolesView(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const guild = interaction.guild!;
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

    const settings = settingsService.get(guild.id);
    const rbac = settings.rbac ?? {};

    const botAdminRole = rbac.botAdminRoleId ?? rbac.ownerRoleId;
    const moderatorRole = rbac.moderatorRoleId;
    const memberRole = rbac.memberRoleId;

    const content = [
      '## 🛡️ Cấu hình RBAC Roles hiện tại',
      '',
      `• **Bot Admin:** ${botAdminRole ? `<@&${botAdminRole}> (\`${botAdminRole}\`)` : '_Chưa đặt_'}`,
      `• **Moderator:** ${moderatorRole ? `<@&${moderatorRole}> (\`${moderatorRole}\`)` : '_Chưa đặt_'}`,
      `• **Member:** ${memberRole ? `<@&${memberRole}> (\`${memberRole}\`)` : '_Chưa đặt_'}`,
      '',
      '> 💡 _Guild Owner và Discord Administrator luôn có toàn quyền quản trị._',
    ].join('\n');

    const container = buildTextOnlyContainer(content, COLORS.INFO);
    await interaction.editReply({ components: container.toJSON() });
  } catch (error) {
    logger.error(`Error viewing roles config: ${(error as Error).message}`);
    const err = buildErrorContainer(`Lỗi khi đọc cấu hình: ${(error as Error).message}`);
    await interaction.editReply({ components: err.toJSON() });
  }
}

// ─── Execute ──────────────────────────────────────────────────────

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await sendReply(interaction, { content: 'Lệnh này chỉ dùng được trong server.' });
    return;
  }

  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();
  const db = (database ?? interaction.client.database) as Database.Database;

  switch (group) {
    case 'roles': {
      if (subcommand === 'set') {
        await handleRolesSet(interaction, db);
      } else if (subcommand === 'view') {
        await handleRolesView(interaction, db);
      }
      break;
    }

    case 'welcome': {
      await executeSectionCommand(interaction, db, getWelcomeConfig());
      break;
    }

    case 'booster': {
      await executeSectionCommand(interaction, db, getBoosterConfig());
      break;
    }

    case 'container': {
      if (subcommand === 'edit') {
        const type = interaction.options.getString('type', true) as 'welcome' | 'leave' | 'booster';
        await startInteractiveEdit(interaction, type);
      } else if (subcommand === 'reset') {
        await handleContainerReset(interaction, interaction.guild.id);
      }
      break;
    }

    default: {
      await sendReply(interaction, {
        components: buildErrorContainer('Nhóm lệnh không hợp lệ.').toJSON(),
      });
    }
  }
}
