/**
 * Unit tests cho df-operator.utils.ts — resolveOperator function.
 */

import { resolveOperator, DEFAULT_OPERATOR_AVATAR } from '../../src/utils/df-operator.utils.js';

describe('df-operator.utils — resolveOperator', () => {
  it('nên trả về operator khi ID tồn tại', () => {
    const op = resolveOperator('20003');
    expect(op.name).toBe('Stinger');
    expect(op.operatorId).toBe('20003');
  });

  it('nên trả về operator cho các ID trong danh sách', () => {
    const knownIds = ['20003', '10010', '40005', '40010', '30010', '10011', '10012', '40011', '30011', '20005'];
    for (const id of knownIds) {
      const op = resolveOperator(id);
      expect(op.operatorId).toBe(id);
      if (id !== '10010') { // Vyron is the DEFAULT_OPERATOR_AVATAR source
        expect(op.avatarUrl).not.toBe(DEFAULT_OPERATOR_AVATAR);
      }
    }
  });

  it('nên trả về fallback khi operator ID không tồn tại (line 41)', () => {
    const op = resolveOperator('99999');
    expect(op.operatorId).toBe('99999');
    expect(op.name).toBe('Operator 99999');
    expect(op.avatarUrl).toBe(DEFAULT_OPERATOR_AVATAR);
  });

  it('nên trả về fallback với ID rỗng', () => {
    const op = resolveOperator('');
    expect(op.name).toBe('Operator ');
    expect(op.avatarUrl).toBe(DEFAULT_OPERATOR_AVATAR);
  });
});

describe('df-operator.utils — DEFAULT_OPERATOR_AVATAR', () => {
  it('nên là avatar URL hợp lệ', () => {
    expect(DEFAULT_OPERATOR_AVATAR).toContain('playdeltaforce.com');
    expect(DEFAULT_OPERATOR_AVATAR).toContain('operators_');
  });
});
