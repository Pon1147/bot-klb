import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';

export interface EventModule {
  name: string;
  once: boolean;
  execute: (..._args: any[]) => Promise<void>;
}

export function loadEvents(botClient: Client): void {
  const eventsPath = path.join(__dirname, '..', 'events');

  try {
    const files = readdirSync(eventsPath);
    if (!files.length) {
      console.log('No events found.');
      return;
    }

    const eventFiles = files.filter(
      (file): file is string => typeof file === 'string' && file.endsWith('.js')
    );

    if (!eventFiles.length) {
      console.log('No event files found.');
      return;
    }

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const eventModule = require(filePath) as EventModule;

      if (!eventModule.name || typeof eventModule.execute !== 'function') {
        console.warn(`Skipping event ${file}: missing name or execute.`);
        continue;
      }

      const shouldOnce = eventModule.once ?? false;
      const eventName = eventModule.name;

      if (shouldOnce) {
        botClient.once(eventName, eventModule.execute);
      } else {
        botClient.on(eventName, eventModule.execute);
      }

      console.log(`Registered event: ${eventName}`);
    }
  } catch (error) {
    console.error('Failed to load events:', error);
  }
}