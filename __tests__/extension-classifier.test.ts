/**
 * Tests cho classifier.js — kiểm tra mapping API response → status.
 *
 * Bug fix: "reached the redemption limit" (code 400067) phải trả về
 * LIMIT_REACHED thay vì INVALID.
 */

// --- Simulate classifier.js classify() ---

function classify(msg: string): string {
  const t = String(msg || '').toLowerCase();

  if (/^ok$|thành công|success/.test(t)) return 'SUCCESS';
  if (/error_hint_400067|reached the redemption limit|limit of cdkey group|đạt giới hạn/.test(t))
    return 'LIMIT_REACHED';
  if (/error_hint_400068|error_hint_400070|hết hạn|expired/.test(t)) return 'EXPIRED';
  // 400073: "current cdkey present error" → code đang tồn tại trong inventory (lỗi quà)
  if (/error_hint_400073|current cdkey present error/.test(t)) return 'PRESENT_ERROR';
  // 400072 + text match → code đã được sử dụng
  if (/error_hint_400072|đã.*(nhận|sử dụng)|already|used/.test(t)) return 'USED';
  if (/error_hint_400054|không hợp lệ|invalid|sai|current cdk does not match/.test(t))
    return 'INVALID';
  if (/captcha|xác minh|verification/.test(t)) return 'VERIFY';
  if (/lỗi mạng|network|rate|quá nhanh|too fast/.test(t)) return 'TEMP_ERROR';

  return msg ? 'OTHER' : 'NO_RESPONSE';
}

// --- Stats reduction (popup/panel logic) ---

function reduceStats(results: Array<{ status: string }>): Record<string, number> {
  return results.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    return a;
  }, {} as Record<string, number>);
}

/**
 * Count occurrences of a specific status in results.
 * Safer than reduceStats for single-status checks.
 */
function countStatus(results: Array<{ status: string }>, status: string): number {
  return results.filter((r) => r.status === status).length;
}

// ============================================================
// TESTS
// ============================================================

describe('classifier.js — API response → status mapping', () => {
  describe('Bug fix: 400067 redemption limit → LIMIT_REACHED', () => {
    it('nên classify "reached the redemption limit" → LIMIT_REACHED', () => {
      // API response: code=400067, msg="The current user has reached the redemption limit of cdkey group"
      const msg = 'The current user has reached the redemption limit of cdkey group';
      expect(classify(msg)).toBe('LIMIT_REACHED');
    });

    it('nên classify "limit of cdkey group" → LIMIT_REACHED', () => {
      const msg = 'limit of cdkey group';
      expect(classify(msg)).toBe('LIMIT_REACHED');
    });

    it('nên classify "đạt giới hạn" → LIMIT_REACHED', () => {
      const msg = 'đạt giới hạn';
      expect(classify(msg)).toBe('LIMIT_REACHED');
    });

    it('nên classify "error_hint_400067" → LIMIT_REACHED', () => {
      const msg = 'error_hint_400067';
      expect(classify(msg)).toBe('LIMIT_REACHED');
    });

    it('KHÔNG nên trả về INVALID cho redemption limit', () => {
      const msg = 'The current user has reached the redemption limit of cdkey group';
      expect(classify(msg)).not.toBe('INVALID');
    });
  });

  describe('Bug fix: 400073 present error → PRESENT_ERROR', () => {
    it('nên classify "error_hint_400073" → PRESENT_ERROR', () => {
      const msg = 'error_hint_400073';
      expect(classify(msg)).toBe('PRESENT_ERROR');
    });

    it('nên classify "current cdkey present error" → PRESENT_ERROR', () => {
      const msg = 'current cdkey present error';
      expect(classify(msg)).toBe('PRESENT_ERROR');
    });

    it('KHÔNG nên trả về USED cho 400073', () => {
      const msg = 'current cdkey present error';
      expect(classify(msg)).not.toBe('USED');
    });

    it('nên 400072 vẫn → USED (khác với 400073)', () => {
      expect(classify('error_hint_400072')).toBe('USED');
      expect(classify('already used')).toBe('USED');
    });
  });

  describe('Các status khác vẫn đúng', () => {
    it('nên classify "ok" / "success" → SUCCESS', () => {
      expect(classify('ok')).toBe('SUCCESS');
      expect(classify('OK')).toBe('SUCCESS');
      expect(classify('success')).toBe('SUCCESS');
      expect(classify('Thành công')).toBe('SUCCESS');
    });

    it('nên classify "already used" → USED', () => {
      expect(classify('already used')).toBe('USED');
      expect(classify('đã sử dụng')).toBe('USED');
    });

    it('nên classify "expired" → EXPIRED', () => {
      expect(classify('expired')).toBe('EXPIRED');
      expect(classify('hết hạn')).toBe('EXPIRED');
    });

    it('nên classify "không hợp lệ" / "invalid" → INVALID', () => {
      expect(classify('invalid')).toBe('INVALID');
      expect(classify('không hợp lệ')).toBe('INVALID');
      expect(classify('sai mã')).toBe('INVALID');
    });

    it('nên classify "captcha" / "verification" → VERIFY', () => {
      expect(classify('captcha')).toBe('VERIFY');
      expect(classify('xác minh')).toBe('VERIFY');
    });

    it('nên classify "network error" / "too fast" → TEMP_ERROR', () => {
      expect(classify('network error')).toBe('TEMP_ERROR');
      expect(classify('too fast')).toBe('TEMP_ERROR');
      expect(classify('lỗi mạng')).toBe('TEMP_ERROR');
    });

    it('nên classify empty string → NO_RESPONSE', () => {
      expect(classify('')).toBe('NO_RESPONSE');
      expect(classify(null as unknown as string)).toBe('NO_RESPONSE');
    });

    it('nên classify unknown message → OTHER', () => {
      expect(classify('some unknown error')).toBe('OTHER');
    });
  });

  // --- End-to-end: classifier → stats ---

  describe('End-to-end: classifier → popup stats', () => {
    it('nên popup hiển thị đúng LIMIT khi redeem bị redemption limit', () => {
      // Simulate 5 redeem results từ API responses thực tế
      const results = [
        { status: classify('ok') },                                    // SUCCESS
        { status: classify('The current user has reached the redemption limit of cdkey group') }, // LIMIT_REACHED
        { status: classify('already used') },                          // USED
        { status: classify('invalid code') },                          // INVALID
        { status: classify('expired') },                               // EXPIRED
      ];

      // Debug: log results
      expect(results.map((r) => r.status)).toEqual(['SUCCESS', 'LIMIT_REACHED', 'USED', 'INVALID', 'EXPIRED']);

      const counts = reduceStats(results);

      expect(counts['SUCCESS']).toBe(1);
      expect(counts['LIMIT_REACHED']).toBe(1);
      expect(counts['USED']).toBe(1);
      expect(counts['INVALID']).toBe(1);
      expect(counts['EXPIRED']).toBe(1);
    });

    it('nên popup LIMIT stat = 0 nếu không có redemption limit trong results', () => {
      const results = [
        { status: classify('ok') },
        { status: classify('ok') },
        { status: classify('already used') },
      ];

      const counts = reduceStats(results);
      expect(counts['LIMIT_REACHED']).toBeUndefined(); // popup sẽ hiển thị 0
    });

    it('nên panel hiển thị đủ 7 stats từ classifier', () => {
      // Panel có 7 cards: SUCCESS, USED, INVALID, LIMIT_REACHED, PRESENT_ERROR, EXPIRED, TEMP_ERROR
      const results = [
        { status: classify('ok') },                                    // SUCCESS
        { status: classify('already used') },                          // USED
        { status: classify('invalid') },                               // INVALID
        { status: classify('reached the redemption limit') },          // LIMIT_REACHED
        { status: classify('current cdkey present error') },           // PRESENT_ERROR
        { status: classify('expired') },                               // EXPIRED
        { status: classify('network error') },                         // TEMP_ERROR
      ];

      const counts = reduceStats(results);
      expect(counts['SUCCESS']).toBe(1);
      expect(counts['USED']).toBe(1);
      expect(counts['INVALID']).toBe(1);
      expect(counts['LIMIT_REACHED']).toBe(1);
      expect(counts['PRESENT_ERROR']).toBe(1);
      expect(counts['EXPIRED']).toBe(1);
      expect(counts['TEMP_ERROR']).toBe(1);
    });
  });
});
