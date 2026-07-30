// ===== POPUP CONFIG — Luôn load DEFAULT_CODES từ code_redeem.js =====

(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const codesInput = $('#codesInput');
  const btnSave = $('#btnSave');
  const btnReset = $('#btnReset');

  let defaultCodes = [];

  // ===== LOAD DEFAULT_CODES từ code_redeem.js (JSONP) =====
  function loadDefaultCodes() {
    return new Promise((resolve) => {
      window._codesCallback = (codes) => {
        defaultCodes = codes;
        resolve(codes);
      };
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('code_redeem.js?callback=_codesCallback');
      s.onerror = () => {
        resolve([]);
      };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  // ===== INIT =====
  loadDefaultCodes().then((codes) => {
    codesInput.value = codes.join('\n');
  });

  // ===== SAVE CODES =====
  btnSave.addEventListener('click', () => {
    const raw = codesInput.value.trim();
    if (!raw) {
      alert('Vui lòng nhập ít nhất 1 code!');
      return;
    }

    const codes = raw.split('\n').map((c) => c.trim()).filter((c) => c);
    chrome.storage.local.set({ redeem_codes: codes }, () => {
      btnSave.textContent = '✅ Đã lưu!';
      btnSave.style.background = '#22c55e';
      setTimeout(() => {
        btnSave.textContent = '💾 Lưu codes';
        btnSave.style.background = '';
      }, 1500);
    });
  });

  // ===== RESET TO DEFAULT =====
  btnReset.addEventListener('click', () => {
    if (!confirm('Reset về codes mặc định?')) return;
    codesInput.value = defaultCodes.join('\n');
    chrome.storage.local.set({ redeem_codes: defaultCodes }, () => {
      btnReset.textContent = '✅ Done!';
      setTimeout(() => {
        btnReset.textContent = '💪 Reset default';
      }, 1500);
    });
  });

})();
