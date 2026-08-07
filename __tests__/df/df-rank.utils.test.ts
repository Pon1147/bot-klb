/**
 * Unit tests cho df-rank.utils.ts — resolveRankFromScore.
 */

import { resolveRankFromScore, DfRank } from '../../src/utils/df-rank.utils.js';

describe('resolveRankFromScore', () => {
  describe('MP mode (score < 1000)', () => {
    it('nên trả về Binh Nhì III cho score = 0', () => {
      const rank = resolveRankFromScore(0);
      expect(rank).not.toBeNull();
      expect(rank!.mode).toBe('MP');
      expect(rank!.name).toBe('Binh Nhì III');
    });

    it('nên trả về Binh Nhì II cho score = 150', () => {
      const rank = resolveRankFromScore(150);
      expect(rank!.name).toBe('Binh Nhì II');
    });

    it('nên trả về Hạ Sĩ III cho score = 450', () => {
      const rank = resolveRankFromScore(450);
      expect(rank!.name).toBe('Hạ Sĩ III');
    });

    it('nên trả về Hạ Sĩ II cho score = 600', () => {
      const rank = resolveRankFromScore(600);
      expect(rank!.mode).toBe('MP');
      expect(rank!.name).toBe('Hạ Sĩ II');
    });
  });

  describe('SOL mode (score >= 1000)', () => {
    it('nên trả về Đồng III cho score = 1000', () => {
      const rank = resolveRankFromScore(1000);
      expect(rank!.mode).toBe('SOL');
      expect(rank!.name).toBe('Đồng III');
    });

    it('nên trả về Bạc III cho score = 1450', () => {
      const rank = resolveRankFromScore(1450);
      expect(rank!.name).toBe('Bạc III');
    });

    it('nên trả về Vàng IV cho score = 1900', () => {
      const rank = resolveRankFromScore(1900);
      expect(rank!.name).toBe('Vàng IV');
    });

    it('nên trả về Bạch Kim IV cho score = 2700', () => {
      const rank = resolveRankFromScore(2700);
      expect(rank!.name).toBe('Bạch Kim IV');
    });

    it('nên trả về Kim Cương V cho score = 3500', () => {
      const rank = resolveRankFromScore(3500);
      expect(rank!.name).toBe('Kim Cương V');
    });

    it('nên trả về Cao Thủ V cho score = 4750', () => {
      const rank = resolveRankFromScore(4750);
      expect(rank!.name).toBe('Cao Thủ V');
    });

    it('nên trả về Thách Đấu DF cho score >= 6000', () => {
      expect(resolveRankFromScore(6000)!.name).toBe('Thách Đấu DF');
      expect(resolveRankFromScore(10000)!.name).toBe('Thách Đấu DF');
    });
  });

  describe('Edge cases', () => {
    it('nên trả về rank có imageUrl hợp lệ', () => {
      const rank = resolveRankFromScore(2000);
      expect(rank!.imageUrl).toMatch(/^https:\/\/www\.playdeltaforce\.com/);
    });

    it('nên trả về rank có rankId hợp lệ', () => {
      const rank = resolveRankFromScore(2000);
      expect(typeof rank!.rankId).toBe('number');
    });

    it('nên trả về fallback rank cho score âm', () => {
      const rank = resolveRankFromScore(-100);
      expect(rank).not.toBeNull();
      expect(rank!.mode).toBe('MP');
    });

    it('nên trả về rank đúng cho boundary', () => {
      expect(resolveRankFromScore(149)!.name).toBe('Binh Nhì III');
      expect(resolveRankFromScore(150)!.name).toBe('Binh Nhì II');
      expect(resolveRankFromScore(299)!.name).toBe('Binh Nhì II');
      expect(resolveRankFromScore(300)!.name).toBe('Binh Nhì I');
    });
  });
});
