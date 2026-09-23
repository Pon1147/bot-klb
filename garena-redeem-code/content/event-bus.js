/**
 * Runtime Event Bus — in-memory event bus cho realtime communication
 *
 * Thay thế chrome.storage.onChanged làm event bus chính.
 * chrome.storage.local chỉ dùng cho persistence (save/load).
 *
 * Events:
 * - STATE_CHANGE: centralState thay đổi
 * - AUTH_STATE_CHANGE: auth state thay đổi
 * - NOTIFICATION: notification mới
 */

(function () {
  'use strict';

  // ===== Event Bus =====
  const listeners = new Map(); // eventType → [callback1, callback2, ...]

  /**
   * Subscribe to an event type
   * @param {string} eventType - Event type to listen for
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  function on(eventType, callback) {
    if (!listeners.has(eventType)) {
      listeners.set(eventType, []);
    }
    listeners.get(eventType).push(callback);

    // Return unsubscribe function
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

  /**
   * Emit an event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
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

  /**
   * Subscribe to all events
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  function onAll(callback) {
    // Store reference for unsubscribe
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

  // ===== Export =====
  window.EventBus = {
    on,
    emit,
    onAll,
  };

  console.log('[EventBus] Initialized');
})();
