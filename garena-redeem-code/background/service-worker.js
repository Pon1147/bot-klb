// Service Worker - Extension lifecycle + Claim forwarding to Bot API

// ===== CONSTANTS =====
const DF_CLAIM_PROCESSING_KEY = 'df_claim_processing';
const PRODUCTION_CLAIM_API_URL = 'https://bot-klb-production.up.railway.app/api/v1/auth/claim';

// ===== DF_CLAIM deduplication: cleanup processing lock =====
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[DF_CLAIM_PROCESSING_KEY]) {
    chrome.storage.local.remove(DF_CLAIM_PROCESSING_KEY);
  }
});

// ===== Lifecycle: init storage + onboarding =====
chrome.runtime.onInstalled.addListener((details) => {
  // Init redeem state
  chrome.storage.local.get('centralState', (result) => {
    if (!result.centralState) {
      chrome.storage.local.set({ centralState: defaultState });
    }
  });

  // First-run: mở trang onboarding hướng dẫn liên kết & redeem code
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'welcome/welcome.html' });
  }
});

const defaultState = {
  sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  codes: [],
  currentIndex: 0,
  currentCode: null,
  status: 'NO_CODES',
  stats: { total: 0, success: 0, failed: 0 },
  logs: [],
  codeStates: [],
};

// ===== MESSAGE HANDLER: DF_CLAIM =====
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'DF_CLAIM') {
    (async () => {
      try {
        // Kiểm tra bằng chứng đồng thuận từ storage (bảo đảm người dùng đã chủ động xác nhận)
        const storageData = await chrome.storage.local.get(['consent_version', 'consent_granted_at']);
        const { consent_version, consent_granted_at } = storageData || {};

        if (!consent_granted_at || consent_version !== 'v1.0') {
          console.warn('[SW] Claim rejected: Missing user consent');
          sendResponse({
            ok: false,
            error: 'Chưa có sự đồng thuận ủy quyền từ người dùng. Vui lòng xác nhận trước khi tiếp tục.',
          });
          return;
        }

        // Kiểm tra thời hạn hiệu lực của sự đồng thuận (10 phút)
        const TEN_MINUTES_MS = 10 * 60 * 1000;
        if (Date.now() - consent_granted_at > TEN_MINUTES_MS) {
          console.warn('[SW] Claim rejected: Consent expired');
          await chrome.storage.local.remove(['consent_granted_at']);
          sendResponse({
            ok: false,
            error: 'Phiên đồng thuận đã hết hạn (quá 10 phút). Vui lòng xác nhận lại sự đồng thuận.',
          });
          return;
        }

        const maskedOpenid = msg.credential?.openid ? `${msg.credential.openid.slice(0, 4)}***` : 'missing';
        console.log(`[SW] Processing authorized claim: code=${msg.code ? msg.code.slice(0, 2) + '****' : 'missing'}, openid=${maskedOpenid}`);

        const credential = msg.credential || {};
        const payload = {
          code: msg.code,
          openid: credential.openid || null,
          token: credential.token || null,
          ts: credential.ts || null,
          s: credential.s || null,
          u: credential.u || null,
          a: credential.a || null,
          game_id: credential.game_id || null,
          source_endpoint: msg.source_endpoint || null,
        };

        let res;
        let data = {};
        try {
          res = await fetch(PRODUCTION_CLAIM_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          data = await res.json().catch(() => ({}));
        } catch (fetchErr) {
          console.warn('[SW] Bot API unavailable');
        }

        const isSuccess = Boolean(res?.ok && data?.ok);
        // Xóa consent sau khi hoàn tất thành công hoặc bị từ chối dứt điểm (401/409)
        if (isSuccess || res?.status === 401 || res?.status === 409) {
          await chrome.storage.local.remove(['consent_granted_at']);
        }

        sendResponse({
          ok: isSuccess,
          error: data?.error || 'Mạng không ổn định hoặc Bot API chưa sẵn sàng. Thử lại sau.',
        });
      } catch (e) {
        console.error('[SW] Error during authorized claim flow:', e);
        sendResponse({ ok: false, error: 'Mạng không ổn định hoặc Bot API chưa sẵn sàng. Thử lại sau.' });
      }
    })();

    return true; // async sendResponse
  }
});
