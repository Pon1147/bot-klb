/**
 * Subcommand Group: /config roles
 * Quản lý và cấu hình phân quyền RBAC máy chủ (BM-01).
 */

import {
  ChatInputCommandInteraction,
  Role,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService, SettingsService } from '../../../services/settings.service.js';
import { buildErrorContainer, buildTextOnlyContainer } from '../../../utils/container.utils.js';
import { sendReply } from '../../../utils/reply.utils.js';
import { COLORS } from '../../../config/container.variables.js';
import { createLogger } from '../../../utils/logger.js';
import { EN_LOCALE } from '../../../locales/en.js';

const logger = createLogger('RolesSubcommand');

const ROLE_TYPE_MAP = {
  bot_admin: { label: 'Bot Admin', field: 'botAdminRoleId' },
  moderator: { label: 'Moderator', field: 'moderatorRoleId' },
  member: { label: 'Member', field: 'memberRoleId' },
} as const;

export function buildRolesGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('roles')
    .setDescription('Cấu hình và xem các role RBAC của máy chủ.')
    .setDescriptionLocalizations({
      'en-US': 'Configure role-based access control (RBAC) permissions.',
    })
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('set')
        .setDescription('Thiết lập role cho một phân quyền bot.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.roles.set'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('role_type')
            .setDescription('Loại quyền cần gán role')
            .setDescriptionLocalizations({ 'en-US': 'Permission level to assign role' })
            .setRequired(true)
            .addChoices(
              { name: 'Bot Admin', value: 'bot_admin' },
              { name: 'Moderator', value: 'moderator' },
              { name: 'Member', value: 'member' },
            ),
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Role Discord cần gán')
            .setDescriptionLocalizations({ 'en-US': 'The Discord role to bind' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('view')
        .setDescription('Xem danh sách role RBAC hiện tại của máy chủ.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.roles.view'].desc,
        }),
    );
}

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

    await sendReply(interaction, {
      content: `✅ Đã thiết lập **${mapping.label}** role: ${role} (\`${role.id}\`) cho máy chủ này.`,
    });
  } catch (error) {
    logger.error(`Error saving role config: ${(error as Error).message}`);
    const err = buildErrorContainer(`Lỗi khi lưu: ${(error as Error).message}`);
    await sendReply(interaction, { components: err.toJSON() });
  }
}

async function handleRolesView(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const guild = interaction.guild!;

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
    await sendReply(interaction, { components: container.toJSON() });
  } catch (error) {
    logger.error(`Error viewing roles config: ${(error as Error).message}`);
    const err = buildErrorContainer(`Lỗi khi đọc cấu hình: ${(error as Error).message}`);
    await sendReply(interaction, { components: err.toJSON() });
  }
}

export async function executeRolesGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'set') {
    await handleRolesSet(interaction, database);
  } else if (subcommand === 'view') {
    await handleRolesView(interaction, database);
  }
}
