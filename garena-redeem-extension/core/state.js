(function () {
  'use strict';

  // Lấy resumeKey an toàn — fallback nếu config chưa load
  const resumeKey = (typeof window !== 'undefined' && window.Pon1147?.config?.resumeKey)
    ? window.Pon1147.config.resumeKey
    : 'garena_redeem_v2_state';

  let state;
  try {
    state = JSON.parse(localStorage.getItem(resumeKey) || 'null') || {
      index: 0,
      results: [],
      startedAt: Date.now(),
    };
  } catch (e) {
    console.error('[State] Init error:', e);
    state = { index: 0, results: [], startedAt: Date.now() };
  }

  const saveState = () => {
    try {
      localStorage.setItem(resumeKey, JSON.stringify(state));
    } catch (e) {
      console.error('[State] saveState error:', e);
    }
  };

  const clearState = () => {
    try {
      localStorage.removeItem(resumeKey);
    } catch (e) {
      console.error('[State] clearState error:', e);
    }
  };

  window.Pon1147 = window.Pon1147 || {};
  window.Pon1147.state = {
    get state() {
      return state;
    },
    set state(val) {
      state = val;
    },
    saveState: saveState,
    clearState: clearState,
  };
  console.error('[State] Initialized, state:', JSON.parse(JSON.stringify(state)));
})();
