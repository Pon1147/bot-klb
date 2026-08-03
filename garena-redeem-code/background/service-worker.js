// Service Worker - Extension lifecycle management

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Initialize storage with default state on first install
    chrome.storage.local.get('centralState', (result) => {
      if (!result.centralState) {
        // Generate a simple default state
        // DEFAULT_CODES loaded from popup on first use
        const defaultState = {
          sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          codes: [],
          currentIndex: 0,
          currentCode: null,
          status: 'NO_CODES',
          stats: { total: 0, success: 0, failed: 0 },
          logs: [],
          codeStates: [],
        };
        chrome.storage.local.set({ centralState: defaultState });
      }
    });
  }
});
