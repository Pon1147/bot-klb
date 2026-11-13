/**
 * Feature Slice: Delta Force
 * Nghiệp vụ game Delta Force: Stats, Daily combat, Map passwords/codes,
 * Account link/unlink, Team matchmaking, và Workshop crafting.
 */

// Commands
export * as dfCommand from './df.command.js';

// Handlers
export * as codeHandler from './code.handler.js';
export * as dailyHandler from './daily.handler.js';
export * as historyHandler from './history.handler.js';
export * as linkHandler from './link.handler.js';
export * as statsHandler from './stats.handler.js';
export * as unlinkHandler from './unlink.handler.js';
export * as workshopHandler from './workshop.handler.js';
export * as helpHandler from './help.handler.js';
export * as mapHandler from './map.handler.js';
export * as buildHandler from './build.handler.js';
export * as autopostHandler from './autopost.handler.js';
export * as vaultHandler from './vault.handler.js';
export * as matchHandler from './match.handler.js';
export * as marketHandler from './market.handler.js';
export * as weaponLoadoutsService from './weapon-loadouts.service.js';

// Interaction handlers & IDs
export * from './stats-select.handler.js';
export { handleMatchSelect, MATCH_SELECT_PREFIX } from './match.handler.js';
export { handleHelpButton } from './help.handler.js';
export { handleLinkButton } from './link.handler.js';
export { getExtensionZipPath } from './extension.utils.js';

// Re-export BM-05 Team Find cho tương thích ngược
export * from '../team-find/index.js';

// Services, Schedulers & Crypto
export * from '../../services/df-codes-scheduler.js';
export {
  startDfAutoPostScheduler,
  rescheduleDfAutoPost,
  broadcastAutoPost,
  isAutoPostBroadcasting,
  AutoPostBroadcastInProgressError,
  stopAutoPostTask,
  stopAllAutoPostTasks,
  getActiveAutoPostTypes,
  intervalToCron,
} from '../../services/df-autopost-scheduler.js';
export * from '../../services/df-crypto.js';
export * from '../../services/df-claim-handler.js';
export {
  startSessionCleanup as startTeamFindCleanup,
  stopSessionCleanup as stopTeamFindCleanup,
} from '../../services/team-find-session.js';
export {
  startCleanup as startClaimCleanup,
  stopCleanup as stopClaimCleanup,
  cleanupExpiredClaimSessions,
} from '../../services/df-claim-store.js';
