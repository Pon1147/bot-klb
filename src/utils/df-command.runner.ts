/** Shared DF command runner — eliminates boilerplate across stats/daily/history */

import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { sendReply } from './reply.utils.js';
import Database from 'better-sqlite3';
import { getDfToken, touchDfToken } from '../database/df.token.db.js';
import { getActiveBinding } from '../database/df-binding.db.js';
import { decryptCredential } from '../services/df-crypto.js';
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
 * 2. Binding validation (getActiveBinding → decrypt, fallback getDfToken legacy)
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

  // Step 2: Binding validation (new encrypted binding first, fallback legacy)
  let token: import('../database/df.token.db.js').DfTokenRow | undefined | null = null;

  try {
    const binding = getActiveBinding(ctx.database, ctx.userId);
    if (binding) {
      // Decrypt credential from binding
      try {
        const decrypted = decryptCredential(
          binding.cred_nonce,
          binding.cred_ciphertext,
          binding.cred_tag,
          binding.discord_user_id,
          binding.openid,
        );
        const cred = JSON.parse(decrypted);
        token = {
          discord_id: ctx.userId,
          openid: binding.openid,
          token: cred.token,
          ts: cred.ts || null,
          s: cred.s || null,
          u: cred.u || null,
          linked_at: binding.captured_at || new Date().toISOString(),
          last_used_at: null,
        };
      } catch {
        // Decrypt failed → fallback to legacy
        token = getDfToken(ctx.database, ctx.userId);
      }
    } else {
      // No binding → check legacy token
      token = getDfToken(ctx.database, ctx.userId);
    }
  } catch {
    // Table doesn't exist (test env) → fallback to legacy
    token = getDfToken(ctx.database, ctx.userId);
  }

  if (!token) {
    const err = buildErrorContainer(
      'Ban chua lien ket tai khoan. Dung `/df-link start` hoac `/df-link manual` de bat dau.',
    );
    await sendReply(ctx.interaction, { components: err.toJSON() });
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
