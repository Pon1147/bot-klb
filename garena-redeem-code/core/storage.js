// @deprecated — NOT loaded by manifest. Use content/content.js (monolithic) instead.
import { DEFAULT_CODES } from './constants.js';
import { createInitialState } from './state.js';

const STORAGE_KEY = 'centralState';
const CODES_KEY = 'redeem_codes';

export async function getCentralState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

export async function setCentralState(state) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: state }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function getCodes() {
  return new Promise((resolve) => {
    chrome.storage.local.get(CODES_KEY, (result) => {
      resolve(result[CODES_KEY] || []);
    });
  });
}

export async function saveCodes(codes) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [CODES_KEY]: codes }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function initStorage() {
  const existing = await getCentralState();
  if (existing) return;

  const state = createInitialState(DEFAULT_CODES);
  await setCentralState(state);
  await saveCodes(DEFAULT_CODES);
}

export async function clearStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
