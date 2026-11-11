import fs from 'node:fs';
import path from 'node:path';
import {
  generateCommandCatalogMarkdown,
  generateReadmeCommandsTable,
} from '../../scripts/generate-command-docs.js';
import { BOT_VERSION } from '../../src/config/version.js';

describe('CI Stale Check — Command Documentation & README', () => {
  it('COMMANDS_CATALOG.md trên đĩa phải khớp 100% với output sinh từ runtime builder', () => {
    const catalogPath = path.resolve(process.cwd(), 'docs', 'COMMANDS_CATALOG.md');
    expect(fs.existsSync(catalogPath)).toBe(true);

    const onDiskContent = fs.readFileSync(catalogPath, 'utf8').replace(/\r\n/g, '\n').trim();
    const runtimeContent = generateCommandCatalogMarkdown().replace(/\r\n/g, '\n').trim();

    expect(onDiskContent).toBe(runtimeContent);
  });

  it('README.md bảng lệnh tự động (giữa COMMANDS_TABLE markers) phải khớp 100% với runtime generator', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const readmeContent = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
    const match = readmeContent.match(
      /<!-- COMMANDS_TABLE_START -->([\s\S]*?)<!-- COMMANDS_TABLE_END -->/,
    );
    expect(match).not.toBeNull();

    const tableOnDisk = match![1].trim();
    const runtimeTable = generateReadmeCommandsTable().replace(/\r\n/g, '\n').trim();

    expect(tableOnDisk).toBe(runtimeTable);
  });

  it('README.md version badge phải khớp với BOT_VERSION hiện tại', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    const readmeContent = fs.readFileSync(readmePath, 'utf8');

    expect(readmeContent).toContain(`version-${BOT_VERSION}-informational.svg`);
  });
});
