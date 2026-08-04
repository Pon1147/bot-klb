/**
 * Panel logic — hiển thị claim code + nút submit.
 */

(function () {
  'use strict';

  let capturedCredential = null;
  let currentClaimCode = null;

  /** Hiển thị panel với claim code */
  function showPanel(code, credential) {
    currentClaimCode = code;
    capturedCredential = credential;

    const codeEl = document.getElementById('claim-code');
    const submitBtn = document.getElementById('submit-btn');
    const statusEl = document.getElementById('status');

    if (codeEl) codeEl.textContent = code;
    if (statusEl) {
      statusEl.textContent = 'Đã capture credential. Dán code ở trên và nhấn Submit.';
      statusEl.style.color = '#f0c040';
    }
    if (submitBtn) submitBtn.disabled = false;
  }

  /** Xử lý submit */
  async function handleSubmit() {
    const statusEl = document.getElementById('status');
    const submitBtn = document.getElementById('submit-btn');

    if (!submitBtn) return;
    submitBtn.disabled = true;

    if (statusEl) {
      statusEl.textContent = 'Đang gửi claim...';
      statusEl.style.color = '#888';
    }

    // Gửi message cho bridge.js để submit lên SW
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DF_SUBMIT_CLAIM',
      });

      if (response?.ok) {
        if (statusEl) {
          statusEl.textContent = 'Đã gửi! Chờ DM xác nhận từ bot...';
          statusEl.style.color = '#4caf50';
        }
      } else {
        if (statusEl) {
          statusEl.textContent = 'Lỗi: ' + (response?.error || 'Unknown');
          statusEl.style.color = '#f44336';
        }
        submitBtn.disabled = false;
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = 'Lỗi network: ' + err.message;
        statusEl.style.color = '#f44336';
      }
      submitBtn.disabled = false;
    }
  }

  /** Lắng nghe kết quả từ SW */
  chrome.runtime.onMessage.addListener((message) => {
    const statusEl = document.getElementById('status');

    if (message.type === 'DF_LINK_SUCCESS') {
      if (statusEl) {
        statusEl.textContent = '✅ Linked thành công! Kiểm tra DM trên Discord.';
        statusEl.style.color = '#4caf50';
      }
      chrome.storage.local.set({ df_link_status: 'linked' });
    }

    if (message.type === 'DF_LINK_ERROR') {
      if (statusEl) {
        statusEl.textContent = '❌ Lỗi: ' + message.error;
        statusEl.style.color = '#f44336';
      }
    }
  });

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', handleSubmit);

    // Đọc claim code từ URL hoặc storage
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');

    if (codeFromUrl) {
      chrome.storage.local.get(['df_credential'], (result) => {
        if (result.df_credential) {
          capturedCredential = result.df_credential;
          showPanel(codeFromUrl, capturedCredential);
        }
      });
    }
  });
})();
