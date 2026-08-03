import Database from 'better-sqlite3';
import type { ChatInputCommandInteraction, Collection, SlashCommandBuilder } from 'discord.js';

declare module 'discord.js' {
  interface Client {
    commands: Collection<
      string,
      {
        data: SlashCommandBuilder | Record<string, unknown>;
        execute: (interaction: ChatInputCommandInteraction, ...args: unknown[]) => Promise<unknown>;
      }
    >;
    database: Database.Database;
  }
}
