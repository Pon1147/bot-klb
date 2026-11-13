/**
 * /df — Lệnh tổng hợp Delta Force (Stats, Daily, History, Workshop, Unlink, Code, Link, Autopost, Build, Map).
 *
 * Composite Slash Command Orchestrator:
 * Phân phối thực thi tới các Subcommand Modules:
 * - BM-03 (Delta Force Profiles & Game Data): stats, daily, history, vault, match, workshop, market, unlink, map, build, gun, link
 * - BM-04 (Delta Force Codes & Automation): code, autopost, help
 */

import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';

import { buildCodeGroup, executeCodeGroup } from './subcommands/df-code.subcommand.js';
import { buildAutopostGroup, executeAutopostGroup } from './subcommands/df-autopost.subcommand.js';
import {
  registerProfileSubcommands,
  dispatchProfileSubcommand,
} from './subcommands/df-profiles.subcommand.js';
import { execute as executeHelp } from './help.handler.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { sendReply } from '../../utils/reply.utils.js';

// Khởi tạo SlashCommandBuilder với BM-03 Profile subcommands
const commandBuilder = new SlashCommandBuilder()
  .setName('df')
  .setDescription('Các lệnh Delta Force: stats, daily, history, workshop, link, code, unlink.')
  .setDescriptionLocalizations({
    'en-US': 'Delta Force suite: stats, daily, history, weapon builds, tactical maps & tools.',
  });

registerProfileSubcommands(commandBuilder);

// Gắn các SubcommandGroups
commandBuilder.addSubcommandGroup(buildCodeGroup).addSubcommandGroup(buildAutopostGroup);

export const data = commandBuilder;

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();
  const db = (database ?? interaction.client.database) as Database.Database;

  // 1. Phân phối nhóm SubcommandGroups
  if (group === 'code') {
    await executeCodeGroup(interaction, db);
    return;
  }

  if (group === 'autopost') {
    await executeAutopostGroup(interaction, db);
    return;
  }

  // 2. Help subcommand (BM-04)
  if (subcommand === 'help') {
    await executeHelp(interaction, db);
    return;
  }

  // 3. Phân phối các Profile Subcommands (BM-03)
  const handled = await dispatchProfileSubcommand(interaction, db);
  if (!handled) {
    await sendReply(interaction, {
      components: buildErrorContainer('Lệnh Delta Force không hợp lệ.').toJSON(),
    });
  }
}
