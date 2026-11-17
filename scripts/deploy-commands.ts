import { Collection } from 'discord.js';
import {
  loadCommands,
  deployCommands,
  CommandModule,
} from '../src/infrastructure/discord/command-loader.js';
import { botConfig } from '../src/config/bot.config.js';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('DeployScript');

async function main() {
  const isGlobalFlag = process.argv.includes('--global') || process.env.COMMAND_SCOPE === 'global';
  if (isGlobalFlag) {
    botConfig.commandScope = 'global';
  }

  const targetGuildId = botConfig.isDev
    ? (botConfig.devGuildId || botConfig.guildId)
    : botConfig.guildId;
  logger.info(`Starting command deployment...`);
  logger.info(`Target Guild ID: ${isGlobalFlag ? 'N/A (Global)' : targetGuildId}`);
  logger.info(`Command Scope: ${botConfig.commandScope}`);

  const commands = new Collection<string, CommandModule>();
  loadCommands(commands);

  logger.info(`Found ${commands.size} commands: ${[...commands.keys()].join(', ')}`);

  await deployCommands(commands);
  logger.info(`Deployment completed successfully!`);
}

main().catch((err) => {
  logger.error(`Deployment failed: ${err.message}`, { err });
  process.exit(1);
});
