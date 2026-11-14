/**
 * Isolated content script — Opt-In & Transparent Authorization Bridge cho tab Link trên HQ.
 *
 * MẶC ĐỊNH KHÔNG HOOK, KHÔNG BẮT TOKEN.
 * Chỉ khi người dùng bấm "Bắt đầu Ủy quyền", script mới tiêm động link-page-capture.js vào DOM.
 * Bắt buộc hiển thị Raw JSON preview (gồm độ dài token thật) và Checkbox đồng thuận trước khi gửi.
 */

(function () {
  'use strict';

  console.log('[DF Toolbox] link-content.js loaded (isolated world)');

  // ===== STATE =====
  let state = {
    status: 'idle', // idle | authorizing | candidate_captured | submitting | success | error
    candidate: null,
    endpoint: null,
    claimCode: '',
    consentChecked: false,
    authTimerSeconds: 60,
    timerInterval: null,
    errorMessage: null,
  };

  // ===== A. Lắng nghe candidate từ MAIN world =====
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== window) return;

    const d = event.data;
    if (!d || d.source !== 'df-link-capture') return;

    if (d.type === 'CAPTURE_TIMEOUT') {
      if (state.status === 'authorizing') {
        stopAuthorization(false);
        state.status = 'idle';
        state.errorMessage = 'Hết thời gian chờ (60s). Vui lòng bấm "Bắt đầu Ủy quyền" nếu bạn muốn thử lại.';
        renderPanel();
      }
      return;
    }

    if (d.type !== 'CREDENTIAL_CANDIDATE') return;
    if (!d.credential?.openid || !d.credential?.token) return;

    // Strict validation: openid phải là chuỗi số (Garena ID), token >= 32 ký tự, endpoint hợp lệ
    const cred = d.credential;
    if (!/^\d+$/.test(cred.openid)) return;
    if (typeof cred.token !== 'string' || cred.token.length < 32) return;
    const validEndpoints = [
      'AuthLogin',
      'GetPlayerStats',
      'GetRoleInfo',
      'DFToolBoxGetUserRoleInfo',
      'GetDailyReport',
      'GetWorkbenchList',
      'GetCardCollection',
      'Unknown',
    ];
    if (
      !d.endpoint ||
      typeof d.endpoint !== 'string' ||
      (!validEndpoints.includes(d.endpoint) && !d.endpoint.startsWith('DFToolBox') && !d.endpoint.startsWith('Get'))
    ) {
      return;
    }

    console.log(`[LinkContent] Captured credentials from ${d.endpoint}: openid=${d.credential.openid.slice(0, 4)}***`);

    // Dừng timer đếm ngược
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    state.candidate = d.credential;
    state.endpoint = d.endpoint;
    state.status = 'candidate_captured';
    state.errorMessage = null;

    renderPanel();
  });

  // Khởi động giao diện mặc định
  renderPanel();

  // ===== B. Tiêm & Dọn dẹp On-Demand Script =====
  function extractFromPerformance() {
    try {
      const entries = window.performance?.getEntriesByType?.('resource') || [];
      for (let i = entries.length - 1; i >= 0; i--) {
        const urlStr = entries[i]?.name || '';
        if (urlStr.includes('sg-act.playerinfinite.com') && urlStr.includes('/DfTools/')) {
          const p = new URL(urlStr, window.location.origin).searchParams;
          const openid = p.get('openid');
          const token = p.get('token');
          if (openid && token && /^\d+$/.test(openid) && typeof token === 'string' && token.length >= 32) {
            const urlPath = urlStr.split('?')[0];
            const endpoint = urlPath.split('/').pop() || 'DfTools';
            return {
              credential: {
                openid,
                token,
                ts: p.get('ts') || '0',
                s: p.get('s') || '0',
                u: p.get('u'),
                a: p.get('a'),
                game_id: p.get('game_id') || '30150',
              },
              endpoint,
            };
          }
        }
      }
    } catch (e) {
      console.warn('[LinkContent] Performance scan error:', e);
    }
    return null;
  }

  function startAuthorization() {
    // 1. Quét tức thì Performance Resource Buffer: Nếu đã có phiên thì nhận diện ngay 0s
    const existing = extractFromPerformance();
    if (existing) {
      console.log(`[LinkContent] Instant session found in performance buffer: openid=${existing.credential.openid.slice(0, 4)}*** from ${existing.endpoint}`);
      state.candidate = existing.credential;
      state.endpoint = existing.endpoint;
      state.status = 'candidate_captured';
      state.errorMessage = null;
      renderPanel();
      return;
    }

    // 2. Nếu chưa có phiên (chưa đăng nhập), mở cửa sổ đếm ngược 60s và tiêm script đón đầu
    state.status = 'authorizing';
    state.authTimerSeconds = 60;
    state.errorMessage = null;

    // Tiêm link-page-capture.js vào DOM MAIN world
    const existingScript = document.getElementById('df-link-capture-script');
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.id = 'df-link-capture-script';
    script.src = chrome.runtime.getURL('content/link-page-capture.js');
    (document.head || document.documentElement).appendChild(script);

    // Bắt đầu đếm ngược 60s
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.authTimerSeconds--;
      if (state.authTimerSeconds <= 0) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
      }
      const timerEl = document.querySelector('#df-auth-timer');
      if (timerEl) {
        timerEl.textContent = `${state.authTimerSeconds}s`;
      }
    }, 1000);

    renderPanel();
  }

  function stopAuthorization(userInitiated = true) {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    // Phát tín hiệu dừng tới capture script
    window.postMessage({ type: 'DF_STOP_CAPTURE' }, window.location.origin);

    const script = document.getElementById('df-link-capture-script');
    if (script) script.remove();

    if (userInitiated) {
      state.status = 'idle';
      state.candidate = null;
      state.errorMessage = null;
      renderPanel();
    }
  }

  // ===== C. Inject panel UI =====
  function renderPanel() {
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
          width: 340px;
          background: #0b0e14;
          color: #f1f5f9;
          border: 1px solid rgba(0, 229, 153, 0.3);
          border-radius: 10px;
          padding: 16px;
          z-index: 999999;
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 13px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 0 0 16px rgba(0, 229, 153, 0.15);
          box-sizing: border-box;
        }
        #df-toolbox-panel h3 {
          margin: 0 0 10px;
          color: #00e599;
          font-size: 14px;
          font-weight: 700;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        #df-toolbox-panel .btn-close {
          background: none;
          border: none;
          color: #64748b;
          font-size: 16px;
          cursor: pointer;
          padding: 0 4px;
        }
        #df-toolbox-panel .btn-close:hover {
          color: #f1f5f9;
        }
        #df-toolbox-panel .status {
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 12px;
          background: #10141d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.4;
        }
        #df-toolbox-panel .status.error {
          border-color: #ef4444;
          color: #fca5a5;
        }
        #df-toolbox-panel input[type="text"] {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          background: #10141d;
          color: #f1f5f9;
          font-size: 13px;
          font-family: 'JetBrains Mono', Consolas, monospace;
          margin-bottom: 10px;
          outline: none;
        }
        #df-toolbox-panel input[type="text"]:focus {
          border-color: #00e599;
        }
        #df-toolbox-panel .preview-box {
          background: #05080f;
          border: 1px solid rgba(0, 229, 153, 0.2);
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 10px;
          font-family: Consolas, monospace;
          font-size: 11px;
          color: #94a3b8;
          max-height: 120px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-all;
        }
        #df-toolbox-panel .consent-label {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 11px;
          color: #cbd5e1;
          margin-bottom: 12px;
          cursor: pointer;
          line-height: 1.4;
        }
        #df-toolbox-panel .consent-label input {
          margin-top: 2px;
          cursor: pointer;
        }
        #df-toolbox-panel button.primary {
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
        }
        #df-toolbox-panel button.primary:hover:not(:disabled) {
          background: #00c784;
        }
        #df-toolbox-panel button.primary:disabled {
          background: #1e293b;
          color: #64748b;
          cursor: not-allowed;
        }
        #df-toolbox-panel button.secondary {
          width: 100%;
          padding: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          background: transparent;
          color: #94a3b8;
          font-size: 12px;
          cursor: pointer;
          margin-top: 6px;
        }
        #df-toolbox-panel button.secondary:hover {
          color: #f1f5f9;
          border-color: rgba(255, 255, 255, 0.25);
        }
        #df-toolbox-panel .hint {
          margin-top: 10px;
          font-size: 11px;
          color: #64748b;
          line-height: 1.4;
        }
      </style>
      <h3>
        <span>DF Toolbox — Liên kết Bot</span>
        <button class="btn-close" id="df-btn-close" title="Đóng">✕</button>
      </h3>
      ${renderContentBody()}
    `;

    document.body.appendChild(panel);
    bindPanelEvents(panel);
  }

  function renderContentBody() {
    if (state.errorMessage) {
      return `
        <div class="status error">${state.errorMessage}</div>
        <button class="primary" id="df-btn-start">Thử lại</button>
      `;
    }

    switch (state.status) {
      case 'idle':
        return `
          <div class="status">
            <strong>🔒 Quyền riêng tư:</strong> Tiện ích mặc định <strong>tắt hoàn toàn</strong> thu thập dữ liệu.<br><br>
            Nếu bạn muốn dùng lệnh <code>/df stats</code> trên Discord, bấm nút dưới để bắt đầu phiên ủy quyền.
          </div>
          <button class="primary" id="df-btn-start">Bắt đầu Ủy quyền</button>
          <div class="hint">Nếu bạn chỉ nạp giftcode, không cần thực hiện bước này.</div>
        `;

      case 'authorizing':
        return `
          <div class="status">
            ⏳ Đang mở cửa sổ ủy quyền (<strong id="df-auth-timer">${state.authTimerSeconds}s</strong>)...<br><br>
            👉 Vui lòng đăng nhập tài khoản Garena trên trang Delta Force HQ nếu chưa đăng nhập.
          </div>
          <button class="secondary" id="df-btn-cancel">Hủy bỏ</button>
        `;

      case 'candidate_captured': {
        const cred = state.candidate;

        return `
          <div class="status" style="border-color: #00e599; color: #a7f3d0;">
            ✓ Đã phát hiện tài khoản Garena (ID: ${cred.openid.slice(0, 4)}****)
          </div>
          <input type="text" id="df-link-code" placeholder="Dán mã claim 6 ký tự từ /df link" maxlength="6" value="${state.claimCode}" />
          <label class="consent-label">
            <input type="checkbox" id="df-consent-cb" ${state.consentChecked ? 'checked' : ''} />
            <span>Tôi đồng ý liên kết tài khoản này với Bot Discord để tra cứu stats và lịch sử đấu (hủy bất cứ lúc nào qua <code>/df unlink</code>).</span>
          </label>
          <button class="primary" id="df-link-submit" ${(!state.consentChecked || state.claimCode.length < 6) ? 'disabled' : ''}>
            Xác nhận & Liên kết
          </button>
          <button class="secondary" id="df-btn-cancel">Hủy bỏ</button>
        `;
      }

      case 'submitting':
        return `
          <div class="status">Đang gửi dữ liệu mã hóa tới Bot Server...</div>
          <button class="primary" disabled>Đang xử lý...</button>
        `;

      case 'success':
        return `
          <div class="status" style="border-color: #00e599; color: #a7f3d0;">
            🎉 <strong>Liên kết thành công!</strong><br>
            Bạn có thể kiểm tra tin nhắn riêng chúc mừng trên Discord và bắt đầu dùng <code>/df stats</code>.
          </div>
          <button class="secondary" id="df-btn-close-final">Đóng</button>
        `;

      default:
        return `<div class="status">Đang tải...</div>`;
    }
  }

  function bindPanelEvents(panel) {
    const closeBtn = panel.querySelector('#df-btn-close');
    if (closeBtn) closeBtn.addEventListener('click', () => { stopAuthorization(); panel.remove(); });

    const closeFinalBtn = panel.querySelector('#df-btn-close-final');
    if (closeFinalBtn) closeFinalBtn.addEventListener('click', () => panel.remove());

    const startBtn = panel.querySelector('#df-btn-start');
    if (startBtn) startBtn.addEventListener('click', startAuthorization);

    const cancelBtn = panel.querySelector('#df-btn-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => stopAuthorization(true));

    const codeInput = panel.querySelector('#df-link-code');
    const consentCb = panel.querySelector('#df-consent-cb');
    const submitBtn = panel.querySelector('#df-link-submit');

    if (codeInput) {
      codeInput.addEventListener('input', (e) => {
        state.claimCode = e.target.value.trim().toUpperCase();
        if (submitBtn) {
          submitBtn.disabled = !state.consentChecked || state.claimCode.length < 6;
        }
      });
    }

    if (consentCb) {
      consentCb.addEventListener('change', (e) => {
        state.consentChecked = e.target.checked;
        if (submitBtn) {
          submitBtn.disabled = !state.consentChecked || state.claimCode.length < 6;
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', handleSubmit);
    }
  }

  // ===== D. Submit claim tới Service Worker =====
  async function handleSubmit() {
    if (!state.candidate || !state.consentChecked || state.claimCode.length < 6) return;

    state.status = 'submitting';
    renderPanel();

    try {
      // Lưu trữ bằng chứng đồng thuận có dấu thời gian trước khi gửi
      await chrome.storage.local.set({
        consent_version: 'v1.0',
        consent_granted_at: Date.now(),
      });

      chrome.runtime.sendMessage(
        {
          type: 'DF_CLAIM',
          code: state.claimCode,
          credential: state.candidate,
          source_endpoint: state.endpoint,
        },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            state.status = 'candidate_captured';
            state.errorMessage = chrome.runtime.lastError?.message || 'Không thể kết nối Service Worker';
            renderPanel();
            return;
          }

          if (response.ok) {
            state.status = 'success';
            state.candidate = null;
            renderPanel();
          } else {
            state.status = 'candidate_captured';
            state.errorMessage = response.error || 'Yêu cầu bị từ chối từ Bot Server';
            renderPanel();
          }
        },
      );
    } catch (err) {
      state.status = 'candidate_captured';
      state.errorMessage = err.message || 'Lỗi gửi yêu cầu';
      renderPanel();
    }
  }
})();
