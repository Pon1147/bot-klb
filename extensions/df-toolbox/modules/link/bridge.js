/**
 * Isolated content script — validate message + handoff to SW.
 *
 * Nhận postMessage từ MAIN world → validate → gửi SW qua runtime.sendMessage.
 */

(function () {
  'use strict';

  let capturedCredential = null;
  let claimCode = null;
  let panelVisible = false;

  /**
   * Xử lý postMessage từ MAIN world.
   */
  window.addEventListener('message', (event) => {
    // Chỉ nhận từ cùng origin
    if (event.source !== window) return;

    const msg = event.data;
    if (!msg || msg.type !== 'DF_CREDENTIALS') return;

    // Lưu credential
    capturedCredential = msg.params;

    // Hiển thị panel nếu chưa hiện
    if (!panelVisible) {
      panelVisible = true;
      chrome.runtime.sendMessage({
        type: 'DF_SHOW_PANEL',
        credential: capturedCredential,
      });
    }
  });

  /**
   * Xử lý message từ SW/panel.
   */
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'DF_SET_CLAIM_CODE') {
      claimCode = message.code;
      sendResponse({ ok: true });
    }

    if (message.type === 'DF_SUBMIT_CLAIM') {
      if (!claimCode || !capturedCredential) {
        sendResponse({ ok: false, error: 'Missing code or credential' });
        return false;
      }

      // Gửi lên SW
      chrome.runtime.sendMessage({
        type: 'DF_CLAIM_REQUEST',
        code: claimCode,
        params: capturedCredential,
        source: 'extension',
      });

      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  console.log('[DF Toolbox] Bridge initialized (isolated world)');
})();
