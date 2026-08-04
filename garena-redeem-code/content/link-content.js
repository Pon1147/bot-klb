/**
 * Isolated content script — bridge + panel cho tab Link trên HQ.
 *
 * Lắng nghe postMessage từ link-page-capture.js → render panel → submit claim.
 */

(function () {
  'use strict';

  console.log('[DF Toolbox] Link content script loaded');

  // ===== STATE =====
  let state = {
    candidate: null,
    endpoint: null,
    claimCode: null,
    status: 'idle', // idle | capturing | ready | submitting | success | error
  };

  // ===== A. Lắng nghe candidate từ MAIN world =====
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const d = event.data;
    if (!d || d.source !== 'df-link-capture') return;
    if (d.type !== 'CREDENTIAL_CANDIDATE') return;
    if (!d.credential?.openid || !d.credential?.token) return;

    state.candidate = d.credential;
    state.endpoint = d.endpoint;
    state.status = 'ready';

    renderPanel();
  });

  // ===== B. Inject panel UI =====
  function renderPanel() {
    // Xóa panel cũ nếu có
    const oldPanel = document.getElementById('df-toolbox-panel');
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'df-toolbox-panel';
    panel.innerHTML = `
      <style>
        #df-toolbox-panel {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 320px;
          background: #1a1a2e;
          color: #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          z-index: 999999;
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 13px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        #df-toolbox-panel h3 {
          margin: 0 0 12px;
          color: #00d4ff;
          font-size: 15px;
        }
        #df-toolbox-panel .status {
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 12px;
          background: #16213e;
          border: 1px solid #0f3460;
          font-size: 12px;
        }
        #df-toolbox-panel input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #0f3460;
          border-radius: 4px;
          background: #16213e;
          color: #e0e0e0;
          font-size: 13px;
          margin-bottom: 12px;
          outline: none;
        }
        #df-toolbox-panel input:focus {
          border-color: #00d4ff;
        }
        #df-toolbox-panel button {
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: 4px;
          background: #00d4ff;
          color: #1a1a2e;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        #df-toolbox-panel button:disabled {
          background: #555;
          color: #888;
          cursor: not-allowed;
        }
        #df-toolbox-panel .hint {
          margin-top: 12px;
          font-size: 11px;
          color: #666;
          line-height: 1.5;
        }
      </style>
      <h3>DF Toolbox — Link</h3>
      <div class="status" id="df-link-status">${getStatusText()}</div>
      <input type="text" id="df-link-code" placeholder="Dán claim code từ Discord" maxlength="6" />
      <button id="df-link-submit" ${state.status !== 'ready' ? 'disabled' : ''}>Liên kết Discord</button>
      <div class="hint">
        1. Dùng /df-link start trên Discord<br>
        2. Dán code ở trên<br>
        3. Nhấn Liên kết Discord
      </div>
    `;

    document.body.appendChild(panel);

    // Bind submit button
    const submitBtn = panel.querySelector('#df-link-submit');
    submitBtn.addEventListener('click', handleSubmit);

    // Auto-fill code from storage if exists
    chrome.storage.local.get(['df_claim_code'], (result) => {
      if (result.df_claim_code) {
        panel.querySelector('#df-link-code').value = result.df_claim_code;
      }
    });
  }

  function getStatusText() {
    switch (state.status) {
      case 'idle': return 'Đang chờ credential từ HQ session...';
      case 'ready': return `Đã capture! OpenID: ${state.candidate.openid.slice(0, 4)}•••`;
      case 'submitting': return 'Đang gửi claim...';
      case 'success': return '✅ Linked thành công! Kiểm tra DM Discord.';
      case 'error': return '❌ Lỗi — xem console.';
      default: return 'Đang tải...';
    }
  }

  // ===== C. Submit claim → SW =====
  async function handleSubmit() {
    const codeInput = document.querySelector('#df-link-code');
    const submitBtn = document.querySelector('#df-link-submit');
    const statusEl = document.querySelector('#df-link-status');

    const code = codeInput.value.trim();
    if (!code || !state.candidate) {
      statusEl.textContent = '❌ Thiếu claim code hoặc credential';
      statusEl.style.color = '#f44336';
      return;
    }

    state.status = 'submitting';
    renderPanel();

    // Lưu code vào storage cho lần sau
    chrome.storage.local.set({ df_claim_code: code });

    // Gửi lên SW
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'DF_CLAIM',
        code,
        credential: state.candidate,
        source_endpoint: state.endpoint,
      });

      if (res?.ok) {
        state.status = 'success';
        state.candidate = null; // clear credential
        renderPanel();
      } else {
        state.status = 'error';
        statusEl.textContent = '❌ ' + (res?.error || 'Unknown error');
        statusEl.style.color = '#f44336';
        submitBtn.disabled = false;
      }
    } catch (err) {
      state.status = 'error';
      statusEl.textContent = '❌ Network error: ' + err.message;
      statusEl.style.color = '#f44336';
      submitBtn.disabled = false;
    }
  }

  // ===== D. Listen for SW response updates =====
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'DF_LINK_SUCCESS') {
      state.status = 'success';
      renderPanel();
    }
    if (msg?.type === 'DF_LINK_ERROR') {
      state.status = 'error';
      const statusEl = document.querySelector('#df-link-status');
      if (statusEl) {
        statusEl.textContent = '❌ ' + msg.error;
        statusEl.style.color = '#f44336';
      }
      const submitBtn = document.querySelector('#df-link-submit');
      if (submitBtn) submitBtn.disabled = false;
    }
  });

})();
