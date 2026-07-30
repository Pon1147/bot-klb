// @deprecated — NOT loaded by manifest. Use content/content.js (monolithic) instead.
import { initDashboard } from './dashboard.js';
import { initRedeemController } from './redeem-controller.js';

console.log('[Garena Redeem] Bootstrap initializing...');

initDashboard();
initRedeemController();

console.log('[Garena Redeem] Dashboard + RedeemController initialized.');
