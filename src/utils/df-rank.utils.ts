/**
 * Delta Force HQ rank mapping.
 * Source: https://www.playdeltaforce.com/basic_info/ranks_vi.js
 */

export interface DfRank {
  rankId: number;
  mode: 'MP' | 'SOL';
  name: string;
  minScore: number;
  maxScore: number | null;
  imageUrl: string;
}

const RANKS: DfRank[] = [
  { rankId: 0, mode: 'MP', name: 'Binh Nhì III', minScore: 0, maxScore: 149, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_6db84934f8d0b5c877e86dbc39041630.png' },
  { rankId: 1, mode: 'MP', name: 'Binh Nhì II', minScore: 150, maxScore: 299, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_e00fd8a8c6f00d71a2710090f695843d.png' },
  { rankId: 2, mode: 'MP', name: 'Binh Nhì I', minScore: 300, maxScore: 449, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_ebea4f80d6a78e77ce021a688a65fcc7.png' },
  { rankId: 3, mode: 'MP', name: 'Hạ Sĩ III', minScore: 450, maxScore: 599, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_d43fb7fdb5009b87bf8e63401ee4fc91.png' },
  { rankId: 4, mode: 'MP', name: 'Hạ Sĩ II', minScore: 600, maxScore: 749, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_f56acc41a0340d7754de626ff7decbc6.png' },
  { rankId: 5, mode: 'MP', name: 'Hạ Sĩ I', minScore: 750, maxScore: 899, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_972e3630479a66c7e3da4f73eb6b235c.png' },
  { rankId: 6, mode: 'MP', name: 'Trung Sĩ IV', minScore: 900, maxScore: 1099, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_bed3f8dd7e73a7f72b7a1894a4b1b018.png' },
  { rankId: 7, mode: 'MP', name: 'Trung Sĩ III', minScore: 1100, maxScore: 1299, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_3bdb6186e377749177253cd56a3f6599.png' },
  { rankId: 8, mode: 'MP', name: 'Trung Sĩ II', minScore: 1300, maxScore: 1499, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_384f962298b4a926988bb2771e6f4032.png' },
  { rankId: 9, mode: 'MP', name: 'Trung Sĩ I', minScore: 1500, maxScore: 1699, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_709a607636a32d82aacab671f7d65ac0.png' },
  { rankId: 10, mode: 'MP', name: 'Trung Úy IV', minScore: 1700, maxScore: 1899, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_a6c43bcc677075533a3895cb29f7dbb4.png' },
  { rankId: 11, mode: 'MP', name: 'Trung Úy III', minScore: 1900, maxScore: 2099, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_169256c2a9f29ef5e94ad56db5f8c6df.png' },
  { rankId: 12, mode: 'MP', name: 'Trung Úy II', minScore: 2100, maxScore: 2299, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_c65c51eb07b716d720727c2cd65836bf.png' },
  { rankId: 13, mode: 'MP', name: 'Trung Úy I', minScore: 2300, maxScore: 2499, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_036751e10b3cd7a7dca45dee13dbc440.png' },
  { rankId: 14, mode: 'MP', name: 'Đại Tá V', minScore: 2500, maxScore: 2749, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_ecc62aa366977b24c03462be79d37f4e.png' },
  { rankId: 15, mode: 'MP', name: 'Đại Tá IV', minScore: 2750, maxScore: 2999, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_a9008e2bad6e82bb3d7e975a3dcb1ed4.png' },
  { rankId: 16, mode: 'MP', name: 'Đại Tá III', minScore: 3000, maxScore: 3249, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_5b4e61677464e4373e2c432e26f85a63.png' },
  { rankId: 17, mode: 'MP', name: 'Đại Tá II', minScore: 3250, maxScore: 3499, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_333ba9ea9fc9f4ae5e1bb3b1bc2eb2c7.png' },
  { rankId: 18, mode: 'MP', name: 'Đại Tá I', minScore: 3500, maxScore: 3749, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_4ba57a8d6b56eda3e6a8845e420cfecc.png' },
  { rankId: 19, mode: 'MP', name: 'Đại Tướng V', minScore: 3750, maxScore: 3999, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_61a8786c7421889bc4a80d234d95798d.png' },
  { rankId: 20, mode: 'MP', name: 'Đại Tướng IV', minScore: 4000, maxScore: 4249, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_9eea7762f51f7cfa23b6f689291ac29b.png' },
  { rankId: 21, mode: 'MP', name: 'Đại Tướng III', minScore: 4250, maxScore: 4499, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_2d7e478225c763d2a1c813c2a51bf88d.png' },
  { rankId: 22, mode: 'MP', name: 'Đại Tướng II', minScore: 4500, maxScore: 4749, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_f5b98527e5c92f68a53c91ca2478f8c9.png' },
  { rankId: 23, mode: 'MP', name: 'Đại Tướng I', minScore: 4750, maxScore: 4999, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_411f2abaf7ed558539ef8534bee220ce.png' },
  { rankId: 24, mode: 'MP', name: 'Nguyên Soái', minScore: 5000, maxScore: null, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_c0492da109a7f94d18ae87c114cd7e74.png' },
  { rankId: 25, mode: 'SOL', name: 'Đồng III', minScore: 1000, maxScore: 1149, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_4e3b05f68ab6a729bce3140033f411cd.png' },
  { rankId: 26, mode: 'SOL', name: 'Đồng II', minScore: 1150, maxScore: 1299, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_755bcc474ce917a4b33884d6c8ccf9ca.png' },
  { rankId: 27, mode: 'SOL', name: 'Đồng I', minScore: 1300, maxScore: 1449, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_92f16ed2fe6ed2b666d7a96b58f2023b.png' },
  { rankId: 28, mode: 'SOL', name: 'Bạc III', minScore: 1450, maxScore: 1599, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_15794bf08b4352369dede3e539273caa.png' },
  { rankId: 29, mode: 'SOL', name: 'Bạc II', minScore: 1600, maxScore: 1749, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_ea0dbe9a29630778ffb47a0ba6dc9055.png' },
  { rankId: 30, mode: 'SOL', name: 'Bạc I', minScore: 1750, maxScore: 1899, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_2b6b71f3a1328abd610e8156dc043a3b.png' },
  { rankId: 31, mode: 'SOL', name: 'Vàng IV', minScore: 1900, maxScore: 2099, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_c347649900586c186bb3dbd7f7ffff42.png' },
  { rankId: 32, mode: 'SOL', name: 'Vàng III', minScore: 2100, maxScore: 2299, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_6628c65e72bd0d45e036605ba7d07263.png' },
  { rankId: 33, mode: 'SOL', name: 'Vàng II', minScore: 2300, maxScore: 2499, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_5d66b4dab79ee1cf6e20fcc6db656129.png' },
  { rankId: 34, mode: 'SOL', name: 'Vàng I', minScore: 2500, maxScore: 2699, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_53a9c3cdc294117f26954a5e739b27c8.png' },
  { rankId: 35, mode: 'SOL', name: 'Bạch Kim IV', minScore: 2700, maxScore: 2899, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_45bec4294e2ffbef39236146159dfbac.png' },
  { rankId: 36, mode: 'SOL', name: 'Bạch Kim III', minScore: 2900, maxScore: 3099, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_537ea2daf86aeb4d3e924fde7fe13dfe.png' },
  { rankId: 37, mode: 'SOL', name: 'Bạch Kim II', minScore: 3100, maxScore: 3299, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_59baba72328f5a9fe30ee311db95ff4a.png' },
  { rankId: 38, mode: 'SOL', name: 'Bạch Kim I', minScore: 3300, maxScore: 3499, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_00d74e1b4597a066df504ceaebd2cc04.png' },
  { rankId: 39, mode: 'SOL', name: 'Kim Cương V', minScore: 3500, maxScore: 3749, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_10de9c73d959ad20610b2e7345df0cfc.png' },
  { rankId: 40, mode: 'SOL', name: 'Kim Cương IV', minScore: 3750, maxScore: 3999, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_54ec0f9862b751d73d04ec1f8db7b14f.png' },
  { rankId: 41, mode: 'SOL', name: 'Kim Cương III', minScore: 4000, maxScore: 4249, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_ea02c9844c9e55c49a20122accce9a14.png' },
  { rankId: 42, mode: 'SOL', name: 'Kim Cương II', minScore: 4250, maxScore: 4499, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_b08a0c69940d72ff8ef5e08001785750.png' },
  { rankId: 43, mode: 'SOL', name: 'Kim Cương I', minScore: 4500, maxScore: 4749, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_fc36591b61c1adba1f3c29d35f026b5c.png' },
  { rankId: 44, mode: 'SOL', name: 'Cao Thủ V', minScore: 4750, maxScore: 4999, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_4e2319b998a3a5a80821a08981b3946d.png' },
  { rankId: 45, mode: 'SOL', name: 'Cao Thủ IV', minScore: 5000, maxScore: 5249, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_fef5ffbd7a3a722fd4df0fea2454fcf5.png' },
  { rankId: 46, mode: 'SOL', name: 'Cao Thủ III', minScore: 5250, maxScore: 5499, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_4890f27387b095428b463272f9cc2672.png' },
  { rankId: 47, mode: 'SOL', name: 'Cao Thủ II', minScore: 5500, maxScore: 5749, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_c3ec51d55313ca9a9a639fc9533bdc33.png' },
  { rankId: 48, mode: 'SOL', name: 'Cao Thủ I', minScore: 5750, maxScore: 5999, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_4093a30992162d5ce7fa315e995312d7.png' },
  { rankId: 49, mode: 'SOL', name: 'Thách Đấu DF', minScore: 6000, maxScore: null, imageUrl: 'https://www.playdeltaforce.com/basic_info/rank_f145ef231188f33f5036a8bc27ab557e.png' },
];

/**
 * Resolve rank info from a score.
 * HQ uses SOL mode (score >= 1000), MP mode (score < 1000).
 */
export function resolveRankFromScore(score: number): DfRank | null {
  const mode = score >= 1000 ? 'SOL' : 'MP';
  const modeRanks = RANKS.filter((r) => r.mode === mode);
  for (const rank of modeRanks) {
    if (score >= rank.minScore && (rank.maxScore === null || score <= rank.maxScore)) {
      return rank;
    }
  }
  // Fallback: return closest rank by score
  const sorted = [...modeRanks].sort((a, b) => a.minScore - b.minScore);
  let closest = sorted[0];
  for (const rank of sorted) {
    if (score >= rank.minScore) {
      closest = rank;
    } else {
      break;
    }
  }
  return closest;
}
