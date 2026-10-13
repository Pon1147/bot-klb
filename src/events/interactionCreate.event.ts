import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Events,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { routeInteraction } from '../infrastructure/discord/interaction-router.js';
import { isIgnorableInteractionError } from '../utils/discord-error.utils.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('InteractionCreateEvent');

export async function execute(
  client: Client,
  interaction:
    | ButtonInteraction
    | StringSelectMenuInteraction
    | ChatInputCommandInteraction
    | ModalSubmitInteraction,
): Promise<void> {
  try {
    await routeInteraction(client, interaction);
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      return;
    }
    logger.error('Lỗi chưa xử lý khi xử lý sự kiện interactionCreate:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export default {
  name: Events.InteractionCreate,
  once: false,
  execute,
};
