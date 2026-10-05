import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Events,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { routeInteraction } from '../infrastructure/discord/interaction-router.js';

export async function execute(
  client: Client,
  interaction:
    | ButtonInteraction
    | StringSelectMenuInteraction
    | ChatInputCommandInteraction
    | ModalSubmitInteraction,
): Promise<void> {
  await routeInteraction(client, interaction);
}

export default {
  name: Events.InteractionCreate,
  once: false,
  execute,
};
