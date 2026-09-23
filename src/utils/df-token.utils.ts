import type { DfApiToken } from '../types/deltaforce.types.js';
import type { DfTokenRow } from '../database/df.token.db.js';

export function buildDfApiToken(row: DfTokenRow): DfApiToken {
  return {
    openid: row.openid,
    token: row.token,
    ts: row.ts ?? undefined,
    s: row.s ?? undefined,
    u: row.u ?? undefined,
  };
}
