/**
 * Service Worker — duy nhất được POST Claim API (TLS).
 *
 * Nhận message từ content script → POST lên Claim API.
 * Không lưu credential dài hạn.
 */

// URL Claim API — đọc từ env hoặc hardcode fallback
const CLAIM_API_URL =
  typeof CHROME_EXTENSION_CLAIM_URL !== 'undefined'
    ? CHROME_EXTENSION_CLAIM_URL
    : 'https://localhost:3500/api/df/claim';

/**
 * Xử lý message từ content script.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'DF_CLAIM_REQUEST') {
    return false;
  }

  const { code, params, source } = message;

  // POST lên Claim API
  fetch(CLAIM_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      openid: params.openid,
      token: params.token,
      ts: params.ts,
      s: params.s,
      u: params.u,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.ok) {
        chrome.storage.local.set({ df_link_status: 'linked' });
        // Thông báo cho panel
        chrome.runtime.sendMessage({ type: 'DF_LINK_SUCCESS' });
      } else {
        chrome.runtime.sendMessage({
          type: 'DF_LINK_ERROR',
          error: data.error || 'Unknown error',
        });
      }
    })
    .catch((err) => {
      chrome.runtime.sendMessage({
        type: 'DF_LINK_ERROR',
        error: 'Network error: ' + err.message,
      });
    });

  // Return true để sendResponse async
  return true;
});

/**
 * Xử lý click action button — mở panel.
 */
chrome.action.onClicked.addListener(() => {
  chrome.storage.local.get(['df_link_status'], (result) => {
    const status = result.df_link_status;
    if (status === 'linked') {
      // Đã link — mở tab Redeem
      chrome.storage.local.set({ df_active_tab: 'redeem' });
    }
    // Mở popup
    chrome.action.openPopup();
  });
});

console.log('[DF Toolbox] Service Worker started');
