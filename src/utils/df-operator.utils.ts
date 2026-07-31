/**
 * Delta Force operator info (name + avatar).
 * Source: https://www.playdeltaforce.com/basic_info/operators_vi.js
 */

export interface DfOperator {
  operatorId: string;
  name: string;
  avatarUrl: string;
}

const OPERATORS: DfOperator[] = [
  {
    operatorId: '20003',
    name: 'Stinger',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_1e21f39645b1d994e5840913594f76fe.png',
  },
  {
    operatorId: '10010',
    name: 'Vyron',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_eedcf8b0b48f7fec3dcf46087b92a643.png',
  },
  {
    operatorId: '40005',
    name: 'Luna',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_2cb64ca1f98c9daedc15e58145300e07.png',
  },
  {
    operatorId: '40010',
    name: 'Hackclaw',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_eef8d51478f30888d05fa5f14dda7c54.png',
  },
  {
    operatorId: '30010',
    name: 'Sineva',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_8775ddc0c75827beb6496a6ddb0b8565.png',
  },
  {
    operatorId: '10011',
    name: 'Nox',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_df672d957abc356c695e7410f67e983e.png',
  },
  {
    operatorId: '10012',
    name: 'Tempest',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_9bd318d90b680e233cc25fb9dddc1fb1.png',
  },
  {
    operatorId: '40011',
    name: 'Raptor',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_1af02999e3f3c6e2d8c3021d85c5fb15.png',
  },
  {
    operatorId: '30011',
    name: 'Thiết Bị',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_791425e6c061485479652e6d2bee5547.png',
  },
  {
    operatorId: '20005',
    name: 'Vlinder',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_b01b896f3c47247a4aa4fb4bc2013d2c.png',
  },
  {
    operatorId: '50001',
    name: 'Mắt Lửa Vô Hình',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_21cac283554746332a5deacb09e78a25.png',
  },
  {
    operatorId: '50002',
    name: 'Súng Phun Lửa',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_6a0074d9b74123b7bf7485258d210109.png',
  },
  {
    operatorId: '50003',
    name: 'Lính Hỏa Tiễn',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_09eebf740eeefe7ab84effcc353945ff.png',
  },
  {
    operatorId: '40012',
    name: 'Morse',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_fdd40cd713b1a48532600ee53f29d88a.png',
  },
  {
    operatorId: '10007',
    name: 'D-wolf',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_35cbe5081bfaf02e7f4a41651ff9c7a9.png',
  },
  {
    operatorId: '30008',
    name: 'Shepherd',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_4cd384d3d9f84544d83e86c8ade27f4a.png',
  },
  {
    operatorId: '30009',
    name: 'Uluru',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_dc708fdbd7858330365899b543817fa4.png',
  },
  {
    operatorId: '20004',
    name: 'Toxik',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_87fa922d1887bd005b434e56f2ab6a4e.png',
  },
];

/** Default fallback avatar (Vyron). */
export const DEFAULT_OPERATOR_AVATAR = OPERATORS[1].avatarUrl;

/**
 * Resolve operator info by ID. Returns fallback name/avatar if unknown.
 */
export function resolveOperator(operatorId: string): DfOperator {
  const found = OPERATORS.find((o) => o.operatorId === operatorId);
  if (found) return found;
  return {
    operatorId,
    name: `Operator ${operatorId}`,
    avatarUrl: DEFAULT_OPERATOR_AVATAR,
  };
}
