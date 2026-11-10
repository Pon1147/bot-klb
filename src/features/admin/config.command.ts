/**
 * /config — Quản lý cấu hình máy chủ (Roles RBAC, Welcome, Booster, Container, Bot, QR Server, VietQR).
 *
 * Composite Slash Command Orchestrator:
 * Phân phối thực thi tới các Subcommand Modules thuộc từng Feature Slice:
 * - BM-01 (Core Admin & RBAC): roles, bot, qr-server, vietqr
 * - BM-02 (Server Experience & Engagement): welcome, leave, booster, container
 */

import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { sendReply } from '../../utils/reply.utils.js';
import { buildErrorContainer } from '../../utils/container.utils.js';

// BM-01: Admin & RBAC Subcommands
import { buildRolesGroup, executeRolesGroup } from './subcommands/roles.subcommand.js';
import {
  buildBotGroup,
  executeBotGroup,
  buildAnnouncementContainer,
} from './subcommands/bot.subcommand.js';
import { buildQrServerGroup, executeQrServerGroup } from './subcommands/qr-server.subcommand.js';
import { buildVietQrGroup, executeVietQrGroup } from './subcommands/vietqr.subcommand.js';

// BM-02: Server Experience Subcommands
import { buildWelcomeGroup, executeWelcomeGroup } from '../welcome/welcome.subcommand.js';
import { buildLeaveGroup, executeLeaveGroup } from '../welcome/leave.subcommand.js';
import { buildBoosterGroup, executeBoosterGroup } from '../booster/booster.subcommand.js';
import { buildContainerGroup, executeContainerGroup } from '../container/container.subcommand.js';

// Re-export buildAnnouncementContainer cho test compatibility
export { buildAnnouncementContainer };

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Quản lý cấu hình bot, roles, welcome, booster, và container.')
  .addSubcommandGroup(buildRolesGroup)
  .addSubcommandGroup(buildWelcomeGroup)
  .addSubcommandGroup(buildLeaveGroup)
  .addSubcommandGroup(buildBoosterGroup)
  .addSubcommandGroup(buildContainerGroup)
  .addSubcommandGroup(buildBotGroup)
  .addSubcommandGroup(buildQrServerGroup)
  .addSubcommandGroup(buildVietQrGroup);

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await sendReply(interaction, { content: 'Lệnh này chỉ dùng được trong server.' });
    return;
  }

  const group = interaction.options.getSubcommandGroup(false);
  const db = (database ?? interaction.client.database) as Database.Database;

  switch (group) {
    case 'roles':
      return executeRolesGroup(interaction, db);
    case 'welcome':
      return executeWelcomeGroup(interaction, db);
    case 'leave':
      return executeLeaveGroup(interaction, db);
    case 'booster':
      return executeBoosterGroup(interaction, db);
    case 'container':
      return executeContainerGroup(interaction);
    case 'bot':
      return executeBotGroup(interaction, db);
    case 'qr-server':
      return executeQrServerGroup(interaction, db);
    case 'vietqr':
      return executeVietQrGroup(interaction, db);
    default:
      await sendReply(interaction, {
        components: buildErrorContainer('Nhóm lệnh không hợp lệ.').toJSON(),
      });
  }
}
