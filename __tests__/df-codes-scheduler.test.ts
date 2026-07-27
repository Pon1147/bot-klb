/**
 * Unit tests cho df-codes-scheduler.ts — daily df-code auto-post scheduler.
 */

jest.mock('../src/config/bot.config.js', () => ({
  botConfig: { dfCodesChannelId: '1234567890' },
}));

jest.mock('../src/services/deltaforce.scraper.js', () => ({
  fetchDailyCodes: jest.fn(),
}));

jest.mock('../src/commands/df/code.command.js', () => ({
  buildCodesContainer: jest.fn((_codes: any, hasCodes: boolean) => ({
    components: [{ type: 17, components: [] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
  hasAnyCodes: jest.fn((codes: any) => !!(codes && Object.values(codes).some((v: any) => v != null))),
}));

jest.mock('../src/utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

import { fetchDailyCodes } from '../src/services/deltaforce.scraper.js';
import { buildCodesContainer, hasAnyCodes } from '../src/commands/df/code.command.js';

describe('df-codes-scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchDailyCodes as jest.Mock).mockResolvedValue({
      'Đập Nước Zero': '1234',
      'Thung lũng Layali': '5678',
      'Phố Cổ Brakkesh': '9012',
      AZ3: 'AB12',
      'Trạm Không Gian': '3456',
      'Ngục Giam Thủy Triều': '7890',
    });
  });

  describe('shouldFireAt', () => {
    function shouldFireAt(date: Date): boolean {
      const utcHour = date.getUTCHours();
      const utcMinute = date.getUTCMinutes();
      return utcHour === 1 && utcMinute === 0;
    }

    it('tra ve true khi 01:00 UTC', () => {
      expect(shouldFireAt(new Date('2026-07-27T01:00:00.000Z'))).toBe(true);
    });

    it('tra ve false khi 12:00 UTC', () => {
      expect(shouldFireAt(new Date('2026-07-27T12:00:00.000Z'))).toBe(false);
    });

    it('tra ve false khi 01:01 UTC', () => {
      expect(shouldFireAt(new Date('2026-07-27T01:01:00.000Z'))).toBe(false);
    });

    it('tra ve false khi 00:59 UTC', () => {
      expect(shouldFireAt(new Date('2026-07-27T00:59:00.000Z'))).toBe(false);
    });
  });

  it('fetch codes va build container khi fire', async () => {
    const codes = await fetchDailyCodes();
    const hasCodes = hasAnyCodes(codes);
    const result = buildCodesContainer(codes, hasCodes);

    expect(fetchDailyCodes).toHaveBeenCalled();
    expect(buildCodesContainer).toHaveBeenCalledWith(codes, true);
    expect(result.components).toHaveLength(1);
  });

  it('handle scraper error', async () => {
    (fetchDailyCodes as jest.Mock).mockRejectedValue(new Error('Network error'));

    const codes = await fetchDailyCodes().catch(() => null);
    const hasCodes = hasAnyCodes(codes);

    expect(hasCodes).toBe(false);
  });
});
