import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

/**
 * Đóng gói tiện ích mở rộng Delta Force (garena-redeem-code) thành file ZIP.
 * Loại bỏ các thư mục tests, markdown và file tạm để tạo file phân phối sạch.
 */
export async function packageExtension(): Promise<string> {
  const rootDir = process.cwd();
  const sourceDir = path.resolve(rootDir, 'garena-redeem-code');
  const targetDir = path.resolve(rootDir, 'src', 'assets', 'downloads');
  const targetZipPath = path.resolve(targetDir, 'DF-Extension.zip');

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Thư mục nguồn extension không tồn tại: ${sourceDir}`);
  }

  // Tự động đồng bộ version từ manifest.json sang HTML templates và TS constants
  const manifestPath = path.join(sourceDir, 'manifest.json');
  let extVersion = '1.0.0';
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      extVersion = manifest.version || '1.0.0';

      // Đồng bộ popup.html
      const popupHtmlPath = path.join(sourceDir, 'popup', 'popup.html');
      if (fs.existsSync(popupHtmlPath)) {
        let content = fs.readFileSync(popupHtmlPath, 'utf8');
        content = content.replace(
          /(<span class="header-subtitle">Delta Force Utility Suite · v)[\d.]+(<\/span>)/g,
          `$1${extVersion}$2`,
        );
        content = content.replace(/(<span>DF Toolbox v)[\d.]+( — Bot KLB<\/span>)/g, `$1${extVersion}$2`);
        fs.writeFileSync(popupHtmlPath, content, 'utf8');
      }

      // Đồng bộ welcome.html & welcome.js
      const welcomeHtmlPath = path.join(sourceDir, 'welcome', 'welcome.html');
      if (fs.existsSync(welcomeHtmlPath)) {
        let content = fs.readFileSync(welcomeHtmlPath, 'utf8');
        content = content.replace(
          /(<div class="hero-badge"[^>]*>.+? · v)[\d.]+(<\/div>)/g,
          `$1${extVersion}$2`,
        );
        content = content.replace(
          /(<span class="header-subtitle">Delta Force Utility Suite · v)[\d.]+(<\/span>)/g,
          `$1${extVersion}$2`,
        );
        fs.writeFileSync(welcomeHtmlPath, content, 'utf8');
      }

      const welcomeJsPath = path.join(sourceDir, 'welcome', 'welcome.js');
      if (fs.existsSync(welcomeJsPath)) {
        let content = fs.readFileSync(welcomeJsPath, 'utf8');
        content = content.replace(/(let extVersion = ')[^']+(';)/g, `$1${extVersion}$2`);
        fs.writeFileSync(welcomeJsPath, content, 'utf8');
      }

      // Đồng bộ version.ts
      const pkgPath = path.resolve(rootDir, 'package.json');
      let botVersion = '1.0.0';
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        botVersion = pkg.version || '1.0.0';
      }
      const versionTsPath = path.resolve(rootDir, 'src', 'config', 'version.ts');
      fs.writeFileSync(
        versionTsPath,
        `/**\n * Single Source of Truth cho Version của Bot KLB và Extension DF Toolbox.\n * Được tự động đồng bộ bởi scripts/bump-version.ts và scripts/package-extension.ts.\n */\nexport const BOT_VERSION = '${botVersion}';\nexport const EXTENSION_VERSION = '${extVersion}';\n`,
        'utf8',
      );
    } catch (err) {
      console.warn('Cảnh báo khi đồng bộ version:', err);
    }
  }

  // Tự động đồng bộ DEFAULT_CODES từ popup.js sang src/features/delta-force/giftcodes.data.ts
  const popupJsPath = path.join(sourceDir, 'popup', 'popup.js');
  const giftcodesTsPath = path.resolve(rootDir, 'src', 'features', 'delta-force', 'giftcodes.data.ts');
  if (fs.existsSync(popupJsPath)) {
    try {
      const popupContent = fs.readFileSync(popupJsPath, 'utf8');
      const match = popupContent.match(/const DEFAULT_CODES = \[([\s\S]*?)\];/);
      if (match) {
        const codes = match[1]
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.includes("'") || line.includes('"'))
          .map((line) => line.replace(/[^a-zA-Z0-9_-]/g, ''))
          .filter(Boolean);

        if (codes.length > 0) {
          const tsContent = [
            '/**',
            ` * Danh sách ${codes.length} mã Giftcode Garena Delta Force tân thủ.`,
            ' * Tự động đồng bộ từ DEFAULT_CODES trong garena-redeem-code/popup/popup.js',
            ' * bởi scripts/package-extension.ts.',
            ' */',
            `export const STARTER_GIFT_CODES: readonly string[] = ${JSON.stringify(codes, null, 2)} as const;`,
            '',
          ].join('\n');

          fs.writeFileSync(giftcodesTsPath, tsContent, 'utf8');
          console.log(`✓ Đã đồng bộ ${codes.length} giftcodes từ popup.js sang giftcodes.data.ts`);
        }
      }
    } catch (err) {
      console.warn('Cảnh báo khi đồng bộ giftcodes:', err);
    }
  }

  // Đảm bảo thư mục đích tồn tại
  fs.mkdirSync(targetDir, { recursive: true });

  // Xóa file zip cũ nếu có
  if (fs.existsSync(targetZipPath)) {
    fs.unlinkSync(targetZipPath);
  }

  const output = fs.createWriteStream(targetZipPath);
  const zipOptions = { zlib: { level: 9 } };
  const archive =
    typeof archiver === 'function'
      ? archiver('zip', zipOptions)
      : archiver.ZipArchive
        ? new archiver.ZipArchive(zipOptions)
        : new archiver.Archiver('zip', zipOptions);

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const sizeKb = (archive.pointer() / 1024).toFixed(2);
      console.log(`✓ Đã đóng gói thành công: ${targetZipPath} (${sizeKb} KB)`);
      try {
        const { execSync } = require('node:child_process');
        execSync(`git add "${targetZipPath}"`, { stdio: 'ignore' });
      } catch {
        // Bỏ qua nếu không có git CLI (môi trường container production)
      }
      resolve(targetZipPath);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Cảnh báo khi nén:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Thêm các thành phần cần thiết
    // 1. manifest.json
    const manifestPath = path.join(sourceDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      archive.file(manifestPath, { name: 'manifest.json' });
    }

    // 2. Thư mục background
    const bgDir = path.join(sourceDir, 'background');
    if (fs.existsSync(bgDir)) {
      archive.directory(bgDir, 'background');
    }

    // 3. Thư mục content (chỉ đóng gói các script phục vụ Redeem và Link, loại trừ debug/investigator)
    const contentDir = path.join(sourceDir, 'content');
    if (fs.existsSync(contentDir)) {
      const excludedContentFiles = new Set([
        'auth-investigator.js',
        'auth-investigator-content.js',
        'auth-state-engine.js',
      ]);
      const files = fs.readdirSync(contentDir);
      for (const file of files) {
        if (!excludedContentFiles.has(file)) {
          archive.file(path.join(contentDir, file), { name: `content/${file}` });
        }
      }
    }

    // 4. Thư mục popup
    const popupDir = path.join(sourceDir, 'popup');
    if (fs.existsSync(popupDir)) {
      archive.directory(popupDir, 'popup');
    }

    // 5. Thư mục assets
    const assetsDir = path.join(sourceDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      archive.directory(assetsDir, 'assets');
    }

    // 6. Thư mục welcome (Onboarding Guide)
    const welcomeDir = path.join(sourceDir, 'welcome');
    if (fs.existsSync(welcomeDir)) {
      archive.directory(welcomeDir, 'welcome');
    }

    archive.finalize();
  });
}

// Chạy trực tiếp qua CLI
const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('package-extension.ts') ||
  process.argv[1].endsWith('package-extension.js')
);

if (isDirectExecution) {
  packageExtension().catch((err) => {
    console.error('✗ Lỗi khi đóng gói extension:', err);
    process.exit(1);
  });
}
