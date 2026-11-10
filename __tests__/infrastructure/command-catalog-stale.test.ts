import fs from 'node:fs';
import path from 'node:path';
import { generateCommandCatalogMarkdown } from '../../scripts/generate-command-docs.js';

describe('CI Stale Check — docs/COMMANDS_CATALOG.md', () => {
  it('COMMANDS_CATALOG.md trên đĩa phải khớp 100% với output sinh từ runtime builder', () => {
    const catalogPath = path.resolve(process.cwd(), 'docs', 'COMMANDS_CATALOG.md');
    expect(fs.existsSync(catalogPath)).toBe(true);

    const onDiskContent = fs.readFileSync(catalogPath, 'utf8').replace(/\r\n/g, '\n').trim();
    const runtimeContent = generateCommandCatalogMarkdown().replace(/\r\n/g, '\n').trim();

    expect(onDiskContent).toBe(runtimeContent);
  });
});
