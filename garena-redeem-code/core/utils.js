// @deprecated — NOT loaded by manifest. Use content/content.js (monolithic) instead.
/**
 * Generate a unique ID for logs and sessions.
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an element is actually visible in the DOM.
 */
export function visible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
}

/**
 * Deduplicate an array of strings while preserving order.
 */
export function deduplicate(arr) {
  return [...new Set(arr)];
}

/**
 * Parse redeem codes from a textarea value (one code per line).
 * Returns deduplicated, trimmed, non-empty codes.
 */
export function parseCodesFromText(text) {
  if (!text || typeof text !== 'string') return [];
  return deduplicate(text.split('\n').map((c) => c.trim()).filter((c) => c));
}
