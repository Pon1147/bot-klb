import { writeFileSync } from 'fs';
import { join } from 'path';
import { buildViewModel } from '../src/renderers/df-stats/view-model.js';
import { renderDashboard } from '../src/renderers/df-stats/svg-renderer.js';
import type { DfMyDataResponse } from '../src/types/deltaforce.types.js';

// Mock data dựa trên reference image (furasky)
const mockResponse: DfMyDataResponse = {
  player_info: {
    nickname: 'furasky',
    level: 60,
    avatar: 'https://example.com/avatars/furasky.png',
    play_duration: '1018.3',
    register_time: '1710000000', // 2024-03-10
  },
  rank_data: {
    current_rank: 'Delta Force Pinnacle',
    current_rank_score: 6419,
    highest_rank: 'Delta Force Pinnacle',
    highest_rank_season_id: 10,
  },
  summary_data: {
    total_match_count: 4875,
    combat: {
      kill_operator_count: 9774,
      hit_rate: '56.55%',
      headshot_kill_rate: '28.3%',
      high_kill_death_ratio: '2.45',
      med_kill_death_ratio: '1.82',
      low_kill_death_ratio: '1.23',
    },
    economy: {
      total_reward: '112670000',
      extract_value: '1070000',
      profit_loss_ratio: '1.35',
      total_mandel_brick: 5230,
    },
    team: {
      revive_teammate_count: 1205,
      rescue_teammate_count: 2757,
      retreat_rate: '3.2%',
      teammate_extract_value: '8540000',
    },
    bf_combat: null,
    performance: null,
    vehicle: null,
  },
};

async function main() {
  console.log('Building ViewModel from mock data...');
  const viewModel = buildViewModel(mockResponse, 'overview');

  console.log('Rendering dashboard...');
  const imageBuffer = await renderDashboard(viewModel);

  const outDir = join(process.cwd(), '');
  const outPath = join(outDir, 'dev-preview.png');
  writeFileSync(outPath, imageBuffer);

  console.log(`✅ Saved to: ${outPath}`);
  console.log(`   Size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
  console.log('   Open it and compare with the reference image.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
