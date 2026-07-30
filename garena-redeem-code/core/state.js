// @deprecated — NOT loaded by manifest. Use content/content.js (monolithic) instead.
import { STATUSES, CODE_STATUSES } from './constants.js';

const VALID_TRANSITIONS = {
  [STATUSES.NO_CODES]: [STATUSES.READY],
  [STATUSES.READY]: [STATUSES.RUNNING],
  [STATUSES.RUNNING]: [STATUSES.PAUSED, STATUSES.COMPLETED],
  [STATUSES.PAUSED]: [STATUSES.READY, STATUSES.RUNNING],
  [STATUSES.COMPLETED]: [],
};

export function createInitialState(codes) {
  const total = codes.length;
  return {
    sessionId: generateId(),
    codes,
    currentIndex: 0,
    currentCode: null,
    status: total > 0 ? STATUSES.READY : STATUSES.NO_CODES,
    stats: { total, success: 0, failed: 0 },
    logs: [],
    codeStates: codes.map((c) => ({
      redeemCode: c,
      status: CODE_STATUSES.PENDING,
      result: null,
      reason: null,
    })),
  };
}

export function transition(state, newStatus) {
  const allowed = VALID_TRANSITIONS[state.status];
  if (!allowed?.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${state.status} -> ${newStatus}`
    );
  }
  return { ...state, status: newStatus };
}

export function computeRemaining(stats) {
  return stats.total - stats.success - stats.failed;
}

export function updateCodeState(state, index, update) {
  const codeStates = state.codeStates.map((cs, i) =>
    i === index ? { ...cs, ...update } : cs
  );
  return { ...state, codeStates };
}

export function setCurrentCode(state, code) {
  return { ...state, currentCode: code };
}

export function setCurrentIndex(state, index) {
  return { ...state, currentIndex: index };
}

export function updateStats(state, successDelta, failedDelta) {
  const stats = {
    ...state.stats,
    success: state.stats.success + successDelta,
    failed: state.stats.failed + failedDelta,
  };
  return { ...state, stats };
}

export function appendLog(state, logEntry) {
  const logs = [...state.logs, logEntry];
  // Keep last 200 entries
  const trimmed = logs.length > 200 ? logs.slice(-200) : logs;
  return { ...state, logs: trimmed };
}

export function pauseState(state) {
  return { ...state, status: STATUSES.PAUSED };
}

export function resumeState(state) {
  return { ...state, status: STATUSES.RUNNING };
}

export function completeState(state) {
  return { ...state, status: STATUSES.COMPLETED };
}

export function resetSession(codes) {
  return createInitialState(codes);
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
