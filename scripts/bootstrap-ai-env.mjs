#!/usr/bin/env node
/**
 * bootstrap-ai-env.mjs — Kiểm tra & bootstrap môi trường AI coding thống nhất.
 *
 * 4 thành phần: Ponytail · OmniRoute · Graphify · Agent Skills
 *
 * Mặc định CHỈ đọc và báo cáo (không sửa gì). Idempotent: chạy lại nhiều lần
 * không tạo trùng, không hỏng config.
 *
 * Cách dùng:
 *   node scripts/bootstrap-ai-env.mjs                 # chỉ báo cáo trạng thái
 *   node scripts/bootstrap-ai-env.mjs --json          # output JSON (cho script khác)
 *   node scripts/bootstrap-ai-env.mjs --install-omniroute   # cài OmniRoute (opt-in)
 *   node scripts/bootstrap-ai-env.mjs --install-graphify    # cài Graphify (opt-in, cần Python)
 *
 * Không có dependency ngoài. Node >= 18.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const HOME = homedir();

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const installOmni = args.has('--install-omniroute');
const installGraphify = args.has('--install-graphify');

// --- helpers ---------------------------------------------------------------

function run(cmd) {
  try {
    return execSync(cmd, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

function countSkills(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() && existsSync(join(p, 'SKILL.md'));
  }).length;
}

function hasSkill(dir, name) {
  return existsSync(join(dir, name, 'SKILL.md'));
}

// --- phát hiện môi trường --------------------------------------------------

const env = {
  os: process.platform,
  node: run('node -v'),
  claude: run('claude --version'),
  uv: run('uv --version'),
  python: run('python --version') || run('python3 --version'),
};

// --- các đường dẫn config (đã verify trong Phase 1) ------------------------

const paths = {
  globalSkills: join(HOME, '.agents', 'skills'),
  projectSkills: join(REPO_ROOT, '.claude', 'skills'),
  globalClaudeMd: join(HOME, '.claude', 'CLAUDE.md'),
  globalClaudeSettings: join(HOME, '.claude', 'settings.json'),
  projectAgentsMd: join(REPO_ROOT, 'AGENTS.md'),
  omnirouteHome: join(HOME, '.omniroute'),
  graphifyHome: join(HOME, '.graphify'),
};

// --- trạng thái từng thành phần -------------------------------------------

const ponytail = {
  global: hasSkill(paths.globalSkills, 'ponytail'),
  project: hasSkill(paths.projectSkills, 'ponytail'),
};

const skills = {
  globalCount: countSkills(paths.globalSkills),
  projectCount: countSkills(paths.projectSkills),
  globalClaudeMd: existsSync(paths.globalClaudeMd),
  globalClaudeSettings: existsSync(paths.globalClaudeSettings),
  projectAgentsMd: existsSync(paths.projectAgentsMd),
};

const omniroute = {
  cli: run('omniroute --version'),
  home: existsSync(paths.omnirouteHome),
};

const graphify = {
  cli: run('graphify --version'),
  home: existsSync(paths.graphifyHome),
  uv: !!env.uv,
};

// --- cài đặt (opt-in, chỉ chạy khi có flag) --------------------------------

const actions = [];

if (installOmni) {
  if (omniroute.cli) {
    actions.push('omniroute: đã có CLI, bỏ qua (idempotent).');
  } else {
    actions.push('omniroute: đang cài (npm i -g omniroute)...');
    const r = run('npm install -g omniroute');
    actions.push(r ? 'omniroute: cài xong.' : 'omniroute: CÀI THẤT BẠI — xem log npm.');
  }
}

if (installGraphify) {
  if (graphify.cli) {
    actions.push('graphify: đã có CLI, bỏ qua (idempotent).');
  } else if (env.uv) {
    // uv tự quản lý Python (tải 3.11+ nếu thiếu) — không cần system Python.
    // Package chính thức trên PyPI là `graphifyy` (double-y); CLI vẫn là `graphify`.
    actions.push('graphify: đang cài (uv tool install graphifyy)...');
    const r = run('uv tool install graphifyy');
    actions.push(
      r
        ? 'graphify: cài xong. Chạy `graphify install` để đăng ký skill.'
        : 'graphify: CÀI THẤT BẠI — xem log uv.',
    );
  } else {
    actions.push('graphify: THIẾU uv — bỏ qua. Cài uv trước: winget install astral-sh.uv');
  }
}

// --- kết quả ---------------------------------------------------------------

const report = {
  env,
  paths,
  components: {
    ponytail: {
      installed: ponytail.global || ponytail.project,
      ...ponytail,
    },
    skills: {
      installed: skills.globalCount > 0 || skills.projectCount > 0,
      ...skills,
    },
    omniroute: { installed: !!omniroute.cli, ...omniroute },
    graphify: { installed: !!graphify.cli, ...graphify },
  },
  actions,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const mark = (b) => (b ? '✅' : '❌');
  console.log('=== Unified AI Coding Environment — Status ===\n');
  console.log(`OS: ${env.os}   Node: ${env.node}   Claude: ${env.claude}`);
  console.log(`Python: ${env.python || 'không có'}   uv: ${env.uv || 'không có'}\n`);

  console.log('Thành phần:');
  console.log(
    `  ${mark(report.components.ponytail.installed)} Ponytail      global=${mark(ponytail.global)} project=${mark(ponytail.project)}`,
  );
  console.log(
    `  ${mark(report.components.skills.installed)} Agent Skills  global=${skills.globalCount} project=${skills.projectCount}`,
  );
  console.log(
    `  ${mark(report.components.omniroute.installed)} OmniRoute     cli=${omniroute.cli || 'không có'} (gateway port 20128)`,
  );
  console.log(
    `  ${mark(report.components.graphify.installed)} Graphify      cli=${graphify.cli || 'không có'} uv=${mark(graphify.uv)}`,
  );

  console.log('\nConfig:');
  console.log(`  ${mark(skills.globalClaudeMd)} ${paths.globalClaudeMd}`);
  console.log(`  ${mark(skills.globalClaudeSettings)} ${paths.globalClaudeSettings}`);
  console.log(`  ${mark(skills.projectAgentsMd)} ${paths.projectAgentsMd}`);

  if (actions.length) {
    console.log('\nHành động:');
    for (const a of actions) console.log(`  - ${a}`);
  }

  console.log('\nGhi chú:');
  console.log('  - OmniRoute & Graphify MẶC ĐỊNH KHÔNG CÀI (tránh đụng provider/dependency).');
  console.log('  - Muốn cài: thêm --install-omniroute / --install-graphify.');
  console.log('  - Claude Code đang trỏ về endpoint công ty (ANTHROPIC_BASE_URL) — giữ nguyên.');
}
