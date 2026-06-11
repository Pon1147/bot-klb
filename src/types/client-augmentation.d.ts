import Database from 'better-sqlite3';
import type { Collection } from 'discord.js';

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, { data: any; execute: (...args: any[]) => Promise<any> }>;
    database: Database.Database;
  }
}

