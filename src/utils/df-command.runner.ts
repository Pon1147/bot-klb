/** Shared DF command runner — eliminates boilerplate across stats/daily/history */

import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { getDfToken, touchDfToken } from '../database/df.token.db.js';
import { requireGuild } from './df-guards.js';
import { buildErrorContainer } from './container.utils.js';

/** Result returned by DF command callbacks */
export interface DfCommandResult {
  /** Components — use toComponentsV2() from container.utils */
  components: readonly unknown[];
  flags: number;
  files?: unknown[];
}

/** Context passed to runDfCommand */
export interface DfCommandContext {
  userId: string;
  database: Database.Database;
  interaction: ChatInputCommandInteraction;
}

/**
 * Execute a Delta Force command with shared boilerplate:
 * 1. requireGuild guard
 * 2. Token validation (getDfToken + error container)
 * 3. deferReply
 * 4. Execute the command callback
 * 5. Handle errors with buildErrorContainer
 *
 * Returns true in all cases (command executed or error handled).
 * The caller should `return` after calling this.
 */
export async function runDfCommand(
  ctx: DfCommandContext,
  fn: (token: import('../database/df.token.db.js').DfTokenRow) => Promise<DfCommandResult>,
): Promise<boolean> {
  // Step 1: Guild guard
  if (await requireGuild(ctx.interaction)) return true;

  // Step 2: Token validation
  const token = getDfToken(ctx.database, ctx.userId);
  if (!token) {
    const err = buildErrorContainer(
      'Ban chua lien ket tai khoan. Dung `/df-link start` hoac `/df-link manual` de bat dau.',
    );
    if (ctx.interaction.replied || ctx.interaction.deferred) {
      await ctx.interaction.editReply({ components: err.toJSON() });
    } else {
      await ctx.interaction.reply({
        components: err.toJSON(),
        flags: err.flags | MessageFlags.Ephemeral,
      });
    }
    return true;
  }

  // Step 3: Defer reply
  await ctx.interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Step 4: Execute command callback (passes full DfTokenRow)
    const result = await fn(token);
    // discord.js editReply expects specific component/file types;
    // callbacks return readonly unknown[] from toComponentsV2()
    await ctx.interaction.editReply({
      components: result.components,
      flags: result.flags,
      files: result.files,
    } as Parameters<typeof ctx.interaction.editReply>[0]);
    touchDfToken(ctx.database, ctx.userId);
  } catch (error) {
    const err = buildErrorContainer(`Loi khi lay du lieu: ${(error as Error).message}`);
    await ctx.interaction.editReply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }

  return true;
}
