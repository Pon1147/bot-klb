(function () {
  'use strict';

  const listeners = new Map();

  function on(eventType, callback) {
    if (!listeners.has(eventType)) {
      listeners.set(eventType, []);
    }
    listeners.get(eventType).push(callback);

    return function off() {
      const callbacks = listeners.get(eventType);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx !== -1) {
          callbacks.splice(idx, 1);
        }
      }
    };
  }

  function emit(eventType, data) {
    const callbacks = listeners.get(eventType);
    if (!callbacks) return;

    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (e) {
        console.error(`[EventBus] Error in listener for ${eventType}:`, e);
      }
    }
  }

  function onAll(callback) {
    const allCallbacks = listeners.get('__all__') || [];
    allCallbacks.push(callback);
    listeners.set('__all__', allCallbacks);

    return function off() {
      const idx = allCallbacks.indexOf(callback);
      if (idx !== -1) {
        allCallbacks.splice(idx, 1);
      }
    };
  }

  window.EventBus = {
    on,
    emit,
    onAll,
  };

  console.log('[EventBus] Initialized');
})();
