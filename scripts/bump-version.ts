import fs from 'node:fs';
import path from 'node:path';
import { packageExtension } from './package-extension.js';

type BumpType = 'patch' | 'minor' | 'major';
type BumpTarget = 'all' | 'bot' | 'ext';

/**
 * Tính toán version tiếp theo theo chuẩn SemVer (x.y.z)
 */
function incrementVersion(current: string, type: BumpType): string {
  const parts = current.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Định dạng version không hợp lệ (cần SemVer x.y.z): ${current}`);
  }

  let [major, minor, patch] = parts;
  if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

/**
 * Đồng bộ version vào file HTML popup và welcome
 */
export function syncHtmlVersions(extensionVersion: string): void {
  const rootDir = process.cwd();
  const popupHtmlPath = path.resolve(rootDir, 'garena-redeem-code', 'popup', 'popup.html');
  const welcomeHtmlPath = path.resolve(rootDir, 'garena-redeem-code', 'welcome', 'welcome.html');

  if (fs.existsSync(popupHtmlPath)) {
    let content = fs.readFileSync(popupHtmlPath, 'utf8');
    content = content.replace(
      /(<span class="header-subtitle">Delta Force Utility Suite · v)[\d.]+(<\/span>)/g,
      `$1${extensionVersion}$2`,
    );
    content = content.replace(/(<span>DF Toolbox v)[\d.]+( — Bot KLB<\/span>)/g, `$1${extensionVersion}$2`);
    fs.writeFileSync(popupHtmlPath, content, 'utf8');
  }

  if (fs.existsSync(welcomeHtmlPath)) {
    let content = fs.readFileSync(welcomeHtmlPath, 'utf8');
    content = content.replace(
      /(<div class="hero-badge">.+? · v)[\d.]+(<\/div>)/g,
      `$1${extensionVersion}$2`,
    );
    content = content.replace(
      /(<span class="header-subtitle">Delta Force Utility Suite · v)[\d.]+(<\/span>)/g,
      `$1${extensionVersion}$2`,
    );
    fs.writeFileSync(welcomeHtmlPath, content, 'utf8');
  }
}

/**
 * Cập nhật file src/config/version.ts
 */
export function updateVersionTs(botVersion: string, extensionVersion: string): void {
  const rootDir = process.cwd();
  const versionTsPath = path.resolve(rootDir, 'src', 'config', 'version.ts');
  const content = `/**
 * Single Source of Truth cho Version của Bot KLB và Extension DF Toolbox.
 * Được tự động đồng bộ bởi scripts/bump-version.ts và scripts/package-extension.ts.
 */
export const BOT_VERSION = '${botVersion}';
export const EXTENSION_VERSION = '${extensionVersion}';
`;
  fs.writeFileSync(versionTsPath, content, 'utf8');
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const rawType = args[0]?.toLowerCase() || 'minor';
  const target = (args[1]?.toLowerCase() as BumpTarget) || 'all';

  const rootDir = process.cwd();
  const pkgPath = path.resolve(rootDir, 'package.json');
  const manifestPath = path.resolve(rootDir, 'garena-redeem-code', 'manifest.json');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  let newBotVersion = pkg.version;
  let newExtVersion = manifest.version;

  const isExplicit = /^\d+\.\d+\.\d+$/.test(rawType);
  const bumpType: BumpType = isExplicit ? 'patch' : (rawType as BumpType);

  if (target === 'all' || target === 'bot') {
    newBotVersion = isExplicit ? rawType : incrementVersion(pkg.version, bumpType);
    pkg.version = newBotVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`✓ Bot Version: ${pkg.version} -> ${newBotVersion}`);
  }

  if (target === 'all' || target === 'ext') {
    newExtVersion = isExplicit ? rawType : incrementVersion(manifest.version, bumpType);
    manifest.version = newExtVersion;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`✓ Extension Version: ${manifest.version} -> ${newExtVersion}`);
  }

  // Đồng bộ HTML & TS constants
  syncHtmlVersions(newExtVersion);
  updateVersionTs(newBotVersion, newExtVersion);
  console.log(`✓ Đồng bộ HTML & version.ts thành công (Bot v${newBotVersion}, Extension v${newExtVersion})`);

  // Đóng gói lại file zip
  await packageExtension();
  console.log('✓ Hoàn tất bump version và đóng gói!');
}

if (process.argv[1]?.endsWith('bump-version.ts') || process.argv[1]?.endsWith('bump-version.js')) {
  run().catch((err) => {
    console.error('Lỗi khi bump version:', err);
    process.exit(1);
  });
}
