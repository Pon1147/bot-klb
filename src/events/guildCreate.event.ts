import { Client, Events, Guild } from 'discord.js';
import { handleGuildCreate } from '../features/admin/guild-create.handler.js';

export async function execute(client: Client, guild: Guild): Promise<void> {
  await handleGuildCreate(client, guild);
}

export default {
  name: Events.GuildCreate,
  once: false,
  execute,
};
