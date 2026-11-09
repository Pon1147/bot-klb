/**
 * Delta Force operator info (name + avatar).
 * Proxy và re-export từ DfMetadataService để đồng bộ realtime với CDN.
 */

import {
  resolveOperator as resolveOp,
  DEFAULT_AVATAR,
  FALLBACK_OPERATORS,
} from '../services/df-metadata.service.js';

export interface DfOperator {
  operatorId: string;
  name: string;
  avatarUrl: string;
}

/** Default fallback avatar (Stinger). */
export const DEFAULT_OPERATOR_AVATAR = DEFAULT_AVATAR;

/** Fallback operators list (for backwards compatibility). */
export const OPERATORS = FALLBACK_OPERATORS;

/**
 * Resolve operator info by ID. Returns fallback name/avatar if unknown.
 */
export function resolveOperator(operatorId: string | number | undefined | null): DfOperator {
  return resolveOp(operatorId);
}
