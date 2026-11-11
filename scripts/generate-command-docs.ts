import fs from 'node:fs';
import path from 'node:path';
import { data as configData } from '../src/features/admin/config.command.js';
import { data as dfData } from '../src/features/delta-force/df.command.js';
import { data as payData } from '../src/features/payment/pay.command.js';
import { data as donateData } from '../src/features/payment/donate.command.js';
import { data as teamData } from '../src/features/team-find/team.command.js';
import { extractCommandPathsFromBuilders } from '../src/infrastructure/registry/command-parser.js';
import { VI_LOCALE } from '../src/locales/vi.js';
import { EN_LOCALE } from '../src/locales/en.js';
import { BOT_VERSION, EXTENSION_VERSION } from '../src/config/version.js';
import { COMMAND_PATH_POLICIES } from '../src/config/permissions.js';

export function generateCommandCatalogMarkdown(): string {
  const allBuilders = [configData, dfData, payData, donateData, teamData];
  const parsedCommands = extractCommandPathsFromBuilders(allBuilders);

  const lines: string[] = [
    '# Danh Mục Lệnh Chuẩn — Bot Delta (Ground Truth Command Catalog)',
    '',
    `> **Tài liệu tự động sinh (Auto-generated)** — Phiên bản Bot: **v${BOT_VERSION}**`,
    '> *Mọi AI Assistant và lập trình viên bắt buộc tuân theo tài liệu này. Không tự suy diễn cú pháp hay tham số.*',
    '',
    '## 1. Thống Kê Tổng Quan',
    '',
    `- **Tổng số lệnh thực thi**: \`${parsedCommands.length}\` subcommands.`,
    `- **Nhóm lệnh**: \`/df\`, \`/team\`, \`/pay\`, \`/donate\`, \`/config\`.`,
    '',
    '## 2. Bảng Tra Cứu Lệnh Chi Tiết',
    '',
    '| Canonical Path | Mô tả (VI) | Description (EN) | Quyền (RBAC Policy) | Tham số (Options) |',
    '| :--- | :--- | :--- | :--- | :--- |',
  ];

  for (const cmd of parsedCommands) {
    const viMeta = (VI_LOCALE.commands as any)[cmd.path];
    const enMeta = (EN_LOCALE.commands as any)[cmd.path];
    const descVi = viMeta?.desc || cmd.description || 'Chưa cập nhật';
    const descEn = enMeta?.desc || '*(Admin / Internal)*';
    const policy = COMMAND_PATH_POLICIES[cmd.path] || 'MEMBER';

    const optionsStr =
      cmd.options.length > 0
        ? cmd.options
            .map((opt) => `\`${opt.name}${opt.required ? '*' : ''}\``)
            .join(', ')
        : '*Không có*';

    lines.push(`| \`/${cmd.path.replace(/\./g, ' ')}\` | ${descVi} | ${descEn} | \`${policy}\` | ${optionsStr} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('*Ghi chú: Ký hiệu `*` sau tên tham số biểu thị tham số bắt buộc (required).*');
  lines.push('');

  return lines.join('\n');
}

export function generateReadmeCommandsTable(): string {
  const allBuilders = [configData, dfData, payData, donateData, teamData];
  const parsedCommands = extractCommandPathsFromBuilders(allBuilders);

  const lines: string[] = [
    '| Lệnh (Slash Command) | Quyền hạn | Mô tả chức năng |',
    '| :--- | :--- | :--- |',
  ];

  for (const cmd of parsedCommands) {
    const policy = COMMAND_PATH_POLICIES[cmd.path] || 'MEMBER';
    let policyLabel = 'Thành viên';

    if (
      cmd.path.startsWith('df.autopost.') ||
      cmd.path === 'config.bot.announce' ||
      cmd.path.startsWith('config.qr-server.')
    ) {
      policyLabel = 'Bot Owner';
    } else if (policy === 'MANAGE_RBAC') {
      policyLabel = 'Server Owner / Admin';
    } else if (policy === 'MANAGE_CONFIG' || policy === 'MANAGE_DF_CODE') {
      policyLabel = 'Quản trị viên';
    }

    const viMeta = (VI_LOCALE.commands as any)[cmd.path];
    const desc = viMeta?.desc || cmd.description || 'Chưa cập nhật';
    const commandText = `\`/${cmd.path.replace(/\./g, ' ')}\``;

    lines.push(`| ${commandText} | ${policyLabel} | ${desc} |`);
  }

  return lines.join('\n');
}

export function updateReadmeFile(): string {
  const readmePath = path.resolve(process.cwd(), 'README.md');
  if (!fs.existsSync(readmePath)) return '';

  let content = fs.readFileSync(readmePath, 'utf8');

  // 1. Cập nhật Badge version
  content = content.replace(
    /(\[!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-)[^)]+(-informational\.svg\)\])/g,
    `$1${BOT_VERSION}$2`,
  );

  // 2. Cập nhật version extension trong phần giới thiệu
  content = content.replace(
    /(DF Toolbox Extension \(v)[\d.]+(\))/g,
    `$1${EXTENSION_VERSION}$2`,
  );

  // 3. Inject bảng lệnh tự động vào giữa cặp thẻ
  const tableMarkdown = generateReadmeCommandsTable();
  const pattern = /(<!-- COMMANDS_TABLE_START -->)[\s\S]*?(<!-- COMMANDS_TABLE_END -->)/;
  if (pattern.test(content)) {
    content = content.replace(pattern, `$1\n\n${tableMarkdown}\n\n$2`);
  }

  fs.writeFileSync(readmePath, content, 'utf8');
  return readmePath;
}

export function writeCatalogFile(): string {
  const catalogContent = generateCommandCatalogMarkdown();
  const targetPath = path.resolve(process.cwd(), 'docs', 'COMMANDS_CATALOG.md');
  fs.writeFileSync(targetPath, catalogContent, 'utf8');
  updateReadmeFile();
  return targetPath;
}

if (process.argv[1]?.includes('generate-command-docs')) {
  const filePath = writeCatalogFile();
  console.log(`[CatalogGen] Đã tạo thành công danh mục lệnh tại: ${filePath}`);
  console.log(`[CatalogGen] Đã cập nhật bảng lệnh và version badge trong README.md`);
}
