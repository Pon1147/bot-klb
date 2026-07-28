(function () {
  'use strict';

  const CONFIG = window.Pon1147.config;

  let state = JSON.parse(localStorage.getItem(CONFIG.resumeKey) || 'null') || {
    index: 0,
    results: [],
    startedAt: Date.now(),
  };

  const saveState = () => localStorage.setItem(CONFIG.resumeKey, JSON.stringify(state));
  const clearState = () => localStorage.removeItem(CONFIG.resumeKey);

  window.Pon1147 = window.Pon1147 || {};
  window.Pon1147.state = {
    get state() {
      return state;
    },
    set state(val) {
      state = val;
    },
    saveState,
    clearState,
  };
})();
