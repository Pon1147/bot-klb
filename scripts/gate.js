#!/usr/bin/env node
/**
 * Pipeline Gate Checker (AGENTS.md §7)
 * Chạy tự động các chốt kiểm tra trước khi code (`pre`) hoặc trước khi báo cáo (`low|medium|high`).
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');

const mode = (process.argv[2] || 'pre').toLowerCase();
const allowMultiSlice = process.argv.includes('--multi-slice');

function run(cmd, inherit = false) {
  return execSync(cmd, {
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
  });
}

function fail(msg) {
  console.error(`[GATE BLOCKED] ${msg}`);
  process.exit(1);
}

// 1. Gate 3 — Branch Isolation: Tuyệt đối không làm việc trực tiếp trên main/master
const branch = run('git branch --show-current').trim();
if (!branch || branch === 'main' || branch === 'master') {
  fail(
    `Đang ở nhánh "${branch || 'detached'}". Bắt buộc tạo branch mới trước (git switch -c feat/... hoặc fix/...).`,
  );
}
console.log(`[PASS][Gate 3] Branch: ${branch}`);

if (mode === 'pre') {
  console.log('[PASS] Du dieu kien bat dau thuc thi.');
  process.exit(0);
}

// 2. Lấy danh sách file thay đổi (staged + unstaged + untracked)
const changedFiles = run('git status --porcelain')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.slice(3).trim().replace(/^"|"$/g, ''));

// 3. Gate 2 — Scope Check: Cảnh báo/chặn nếu chạm > 1 feature slice cùng lúc
const touchedSlices = new Set(
  changedFiles
    .map((f) => f.match(/^src\/features\/([^/]+)\//)?.[1])
    .filter(Boolean),
);
if (touchedSlices.size > 1 && !allowMultiSlice) {
  fail(
    `Phạm vi chạm ${touchedSlices.size} feature slices (${[...touchedSlices].join(', ')}). Tách task hoặc truyền --multi-slice nếu cố ý.`,
  );
}
console.log(
  `[PASS][Gate 2] Slice: ${touchedSlices.size ? [...touchedSlices].join(', ') : 'ngoài features/'}`,
);

// 4. Gate 3 — Node16 `.js` import check trên các file .ts vừa sửa trong src/
const badImports = [];
for (const file of changedFiles) {
  if (!file.startsWith('src/') || !file.endsWith('.ts') || !fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.matchAll(/from\s+['"](\.[^'"]+)['"]/g);
  for (const m of matches) {
    const imp = m[1];
    if (!imp.endsWith('.js') && !imp.endsWith('.json')) {
      badImports.push(`${file} -> "${imp}"`);
    }
  }
}
if (badImports.length > 0) {
  fail(`Thiếu đuôi .js (node16) ở relative import:\n  - ${badImports.join('\n  - ')}`);
}
console.log('[PASS][Gate 3] Import .js (node16)');

// 5. Gate 4 — Verify theo mức độ rủi ro (low | medium | high)
console.log('[RUN][Gate 4] npm run check');
try {
  run('npm run check', true);
  if (mode === 'medium' || mode === 'high') {
    console.log('[RUN][Gate 4] npm test');
    run('npm test', true);
  }
} catch {
  fail(`Verify thất bại ở mức "${mode}". Sửa lỗi trước khi báo cáo.`);
}

console.log(`[PASS] Hoan tat tat ca gate (mode: ${mode}).`);
