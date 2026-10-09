/**
 * Tiện ích hỗ trợ tìm kiếm và kiểm tra file ZIP tiện ích mở rộng Delta Force.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Lấy đường dẫn tuyệt đối của file DF-Extension.zip.
 * Hỗ trợ các đường dẫn tương ứng với cả môi trường dev (src) và production (dist).
 *
 * @returns Đường dẫn tuyệt đối đến file zip hoặc null nếu không tìm thấy
 */
export function getExtensionZipPath(): string | null {
  const candidatePaths = [
    path.resolve(process.cwd(), 'src', 'assets', 'downloads', 'DF-Extension.zip'),
    path.resolve(process.cwd(), 'dist', 'assets', 'downloads', 'DF-Extension.zip'),
    path.resolve(process.cwd(), 'assets', 'downloads', 'DF-Extension.zip'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
