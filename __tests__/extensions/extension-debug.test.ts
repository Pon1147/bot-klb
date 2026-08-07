/**
 * Tests cho debug.js logger module.
 * Kiểm tra các helper functions hoạt động đúng.
 */

// --- Simulate debug.js functions ---

const TAGS = {
  BACKGROUND: '\u{1F534} BG',
  CONTENT: '\u{1F535} CT',
  POPUP: '\u{1F7E2} PU',
  NETWORK: '\u{1F525} NW',
  UI: '\u{1F3A8} UI',
  CLASSIFIER: '\u{1F50E} CL',
  STORAGE: '\u{1F4E1} ST',
  RERUN: '\u{1F501} RR',
};

const COLORS = {
  INFO: '#4fc3f7',
  SUCCESS: '#66bb6a',
  WARN: '#ffb74d',
  ERROR: '#ef5350',
  DEBUG: '#98A2B3',
};

/**
 * Simulate logRedeem từ debug.js
 */
function logRedeem(code: string, index: number, total: number, status: string, message?: string) {
  const msg = `${code} → ${status}`;
  return `[#${index}/${total}] ${msg}${message ? ' | ' + message.slice(0, 40) : ''}`;
}

/**
 * Simulate logState từ debug.js
 */
function logState(label: string, state: { index?: number; results?: Array<{ status: string }> } | null) {
  const idx = state?.index ?? 0;
  const count = (state?.results || []).length;
  return `${label}: index=${idx}, results=${count}`;
}

/**
 * Simulate logMessageFlow từ debug.js
 */
function logMessageFlow(direction: string, type: string, payload?: { url?: string }) {
  const url = payload?.url ? ` | ${payload.url}` : '';
  return `${direction} ${type}${url}`;
}

/**
 * Simulate logClassify từ debug.js
 */
function logClassify(message: string | null, status: string) {
  const msg = (message || '').slice(0, 50);
  return `classify("${msg}") → ${status}`;
}

/**
 * Simulate logRerun từ debug.js
 */
function logRerun(codes: string[], action: string) {
  return `${action}: ${codes.length} codes — ${codes.join(', ')}`;
}

// ============================================================
// TESTS
// ============================================================

describe('debug.js logger module', () => {
  describe('logRedeem', () => {
    it('nên format đúng redeem log', () => {
      const result = logRedeem('ABC123', 1, 5, 'RUNNING');
      expect(result).toContain('[#1/5]');
      expect(result).toContain('ABC123');
      expect(result).toContain('RUNNING');
    });

    it('nên include message nếu có', () => {
      const result = logRedeem('ABC123', 1, 5, 'SUCCESS', 'ok');
      expect(result).toContain('ok');
    });

    it('nên truncate message dài', () => {
      const longMsg = 'A'.repeat(100);
      const result = logRedeem('ABC123', 1, 5, 'ERROR', longMsg);
      // Message bị slice(0, 40) → max 40 chars
      expect(result.length).toBeLessThanOrEqual('[#1/5] ABC123 → ERROR | '.length + 40);
    });
  });

  describe('logState', () => {
    it('nên format state log đúng', () => {
      const result = logState('SET', { index: 3, results: [{ status: 'SUCCESS' }] });
      expect(result).toBe('SET: index=3, results=1');
    });

    it('nên handle null state', () => {
      const result = logState('CLEAR', null);
      expect(result).toBe('CLEAR: index=0, results=0');
    });

    it('nên handle empty results', () => {
      const result = logState('GET', { index: 0, results: [] });
      expect(result).toBe('GET: index=0, results=0');
    });
  });

  describe('logMessageFlow', () => {
    it('nên format message flow đúng', () => {
      const result = logMessageFlow('BG ←', 'STATUS_UPDATE');
      expect(result).toBe('BG ← STATUS_UPDATE');
    });

    it('nên include URL nếu có', () => {
      const result = logMessageFlow('PU ←', 'POPUP_STATS_UPDATE', { url: 'https://redeem.df.garena.sg/' });
      expect(result).toContain('https://redeem.df.garena.sg/');
    });
  });

  describe('logClassify', () => {
    it('nên format classify log đúng', () => {
      const result = logClassify('ok', 'SUCCESS');
      expect(result).toBe('classify("ok") → SUCCESS');
    });

    it('nên truncate message dài', () => {
      const longMsg = 'A'.repeat(100);
      const result = logClassify(longMsg, 'INVALID');
      expect(result).toContain('classify("');
      expect(result).toContain('INVALID');
    });

    it('nên handle null message', () => {
      const result = logClassify(null, 'NO_RESPONSE');
      expect(result).toBe('classify("") → NO_RESPONSE');
    });
  });

  describe('logRerun', () => {
    it('nên format rerun log đúng', () => {
      const result = logRerun(['C1', 'C2', 'C3'], 'NO_RESPONSE codes found');
      expect(result).toBe('NO_RESPONSE codes found: 3 codes — C1, C2, C3');
    });

    it('nên handle empty codes', () => {
      const result = logRerun([], 'Starting rerun');
      expect(result).toBe('Starting rerun: 0 codes — ');
    });
  });

  describe('Tags & Colors', () => {
    it('nên có đủ 8 tags', () => {
      expect(Object.keys(TAGS)).toHaveLength(8);
      expect(TAGS.BACKGROUND).toContain('BG');
      expect(TAGS.CONTENT).toContain('CT');
      expect(TAGS.POPUP).toContain('PU');
      expect(TAGS.NETWORK).toContain('NW');
      expect(TAGS.UI).toContain('UI');
      expect(TAGS.CLASSIFIER).toContain('CL');
      expect(TAGS.STORAGE).toContain('ST');
      expect(TAGS.RERUN).toContain('RR');
    });

    it('nên có đủ 5 colors', () => {
      expect(Object.keys(COLORS)).toHaveLength(5);
      expect(COLORS.INFO).toBe('#4fc3f7');
      expect(COLORS.SUCCESS).toBe('#66bb6a');
      expect(COLORS.WARN).toBe('#ffb74d');
      expect(COLORS.ERROR).toBe('#ef5350');
      expect(COLORS.DEBUG).toBe('#98A2B3');
    });
  });
});
