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

    // 3. Thư mục content
    const contentDir = path.join(sourceDir, 'content');
    if (fs.existsSync(contentDir)) {
      archive.directory(contentDir, 'content');
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
