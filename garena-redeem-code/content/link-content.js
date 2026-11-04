/**
 * Isolated content script — bridge + panel cho tab Link trên HQ.
 *
 * Lắng nghe postMessage từ link-page-capture.js → render panel → submit claim.
 * Dùng chrome.runtime.sendMessage (giữ SW alive) + storage polling cho result.
 */

(function () {
  'use strict';

  console.log('[DF Toolbox] link-content.js loaded (isolated world)');

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

    console.log(`[LinkContent] Captured credentials from ${d.endpoint}: openid=${d.credential.openid.slice(0, 4)}***`);
    state.candidate = d.credential;
    state.endpoint = d.endpoint;
    state.status = 'ready';

    renderPanel();
  });

  // ===== Render panel ngay khi load (trước khi có credential) =====
  renderPanel();

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
          bottom: 20px;
          right: 20px;
          width: 320px;
          background: #0b0e14;
          color: #f1f5f9;
          border: 1px solid rgba(0, 229, 153, 0.3);
          border-radius: 10px;
          padding: 16px;
          z-index: 999999;
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 13px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 0 0 16px rgba(0, 229, 153, 0.15);
        }
        #df-toolbox-panel h3 {
          margin: 0 0 12px;
          color: #00e599;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }
        #df-toolbox-panel .status {
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 12px;
          background: #10141d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          font-size: 12px;
        }
        #df-toolbox-panel input {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          background: #10141d;
          color: #f1f5f9;
          font-size: 13px;
          font-family: 'JetBrains Mono', Consolas, monospace;
          margin-bottom: 12px;
          outline: none;
          transition: border-color 0.2s;
        }
        #df-toolbox-panel input:focus {
          border-color: #00e599;
          box-shadow: 0 0 8px rgba(0, 229, 153, 0.25);
        }
        #df-toolbox-panel button {
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: 6px;
          background: #00e599;
          color: #05080f;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 0 12px rgba(0, 229, 153, 0.25);
        }
        #df-toolbox-panel button:hover:not(:disabled) {
          background: #00c784;
          box-shadow: 0 0 16px rgba(0, 229, 153, 0.4);
        }
        #df-toolbox-panel button:disabled {
          background: #1e293b;
          color: #64748b;
          box-shadow: none;
          cursor: not-allowed;
        }
        #df-toolbox-panel .hint {
          margin-top: 12px;
          font-size: 11px;
          color: #64748b;
          line-height: 1.5;
        }
      </style>
      <h3>DF Toolbox — Link</h3>
      <div class="status" id="df-link-status">${getStatusText()}</div>
      <input type="text" id="df-link-code" placeholder="Dán claim code từ Discord" maxlength="6" />
      <button id="df-link-submit" ${state.status !== 'ready' ? 'disabled' : ''}>Liên kết Discord</button>
      <div class="hint">
        <strong>🛡️ An toàn 100%:</strong> Tuyệt đối không lưu mật khẩu<br>
        1. Gõ <strong>/df link start</strong> trên Discord để lấy mã 6 ký tự<br>
        2. Dán mã vào ô phía trên<br>
        3. Bấm nút <strong>Liên kết Discord</strong><br>
        4. Kiểm tra tin nhắn riêng chúc mừng từ bot!
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
      case 'success': return '✅ Đã liên kết thành công! Chờ DM xác nhận.';
      case 'error': return '❌ Lỗi — xem console.';
      default: return 'Đang tải...';
    }
  }

  // ===== C. Submit claim → Gửi qua Service Worker để tránh CORS của trang web =====
  function handleClaimFailure(rawError) {
    state.status = 'error';
    const claimErrorMap = {
      invalid_claim_code: 'Mã claim không đúng hoặc đã hết hạn.',
      account_linked_to_other_discord: 'Tài khoản Garena này đã liên kết với Discord khác.',
      already_linked: 'Tài khoản này đã được liên kết trước đó.',
    };
    const msg = claimErrorMap[rawError] || rawError || 'Lỗi liên kết. Vui lòng thử lại sau.';
    renderPanel();
    const errEl = document.querySelector('#df-link-status');
    if (errEl) {
      errEl.textContent = '❌ ' + msg;
      errEl.style.color = '#f44336';
    }
  }

  async function handleSubmit() {
    const codeInput = document.querySelector('#df-link-code');
    const statusEl = document.querySelector('#df-link-status');

    const code = codeInput ? codeInput.value.trim() : '';
    if (!code || !state.candidate) {
      if (statusEl) {
        statusEl.textContent = '❌ Thiếu mã claim hoặc chưa đăng nhập HQ';
        statusEl.style.color = '#f44336';
      }
      return;
    }

    state.status = 'submitting';
    renderPanel();

    const maskedOpenid = state.candidate?.openid ? `${state.candidate.openid.slice(0, 4)}***` : 'missing';
    console.log(`[LinkContent] Submitting claim via SW: code=${code}, openid=${maskedOpenid}`);

    try {
      // Gửi qua background Service Worker (chống hoàn toàn CORS vì Service Worker chạy độc lập với trang web)
      chrome.runtime.sendMessage(
        {
          type: 'DF_CLAIM',
          code,
          credential: state.candidate,
          source_endpoint: state.endpoint,
        },
        (response) => {
          console.log('[LinkContent] Received response from SW:', response, 'lastError:', chrome.runtime.lastError);
          if (chrome.runtime.lastError || !response) {
            const errMsg =
              chrome.runtime.lastError?.message || 'Không thể kết nối tới Service Worker';
            console.error('[LinkContent] SW communication error:', errMsg);
            handleClaimFailure(errMsg);
            return;
          }

          if (response.ok) {
            console.log('[LinkContent] Claim completed successfully!');
            state.status = 'success';
            state.candidate = null;
            renderPanel();
          } else {
            console.warn('[LinkContent] Claim rejected by Bot Server:', response.error);
            handleClaimFailure(response.error);
          }
        },
      );
    } catch (err) {
      console.error('[LinkContent] Internal extension error:', err);
      handleClaimFailure(err.message || 'Lỗi kết nối nội bộ extension');
    }
  }

  // ===== D. Listen for SW response updates (fallback) =====
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
