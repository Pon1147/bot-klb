/**
 * Delta Force HQ – Daily Codes Scraper
 *
 * Dùng Puppeteer để extract daily operation codes từ trang HQ.
 * Chạy standalone: npx tsx src/scraper/getDailyCodes.ts
 */

/**
 * Delta Force HQ – Daily Codes Scraper
 *
 * Dùng Puppeteer để extract daily operation codes từ trang HQ.
 * Chạy standalone: npx tsx src/scraper/getDailyCodes.ts
 */
import type { Browser } from 'puppeteer' with { 'resolution-mode': 'import' };

export interface DailyCodes {
  'Đập Nước Zero': string | null;
  'Thung lũng Layali': string | null;
  'Phố Cổ Brakkesh': string | null;
  'Trạm Không Gian': string | null;
  'Ngục Giam Thủy Triều': string | null;
}

const MAP_KEYS: Record<string, string> = {
  'operations-zero-dam': 'Đập Nước Zero',
  'operations-layali-grove': 'Thung lũng Layali',
  'operations-layali-brakkesh': 'Phố Cổ Brakkesh',
  'operations-layali-space-city': 'Trạm Không Gian',
  'operations-layali-tide-prison': 'Ngục Giam Thủy Triều',
};

const HQ_URL = 'https://www.playdeltaforce.com/events/hq/vi/index.html?laugue=vi&info=';

export async function getDailyCodes(url: string = HQ_URL): Promise<DailyCodes> {
  const puppeteer = await import('puppeteer');
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    console.log('[Scraper] Đang mở trang HQ...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForSelector('span[data-info^="operations-"]', { timeout: 15000 });

    const dailyCodes: DailyCodes = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (keys: Record<string, string>) => {
        const result: any = {};
        for (const [selector, name] of Object.entries(keys)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const el = (globalThis as any).document?.querySelector(`span[data-info="${selector}"]`);
          if (el) {
            const text = el.textContent?.trim();
            if (text) {
              const match = text.match(/\d{4}/);
              if (match) {
                result[name] = match[0];
              } else {
                result[name] = null;
              }
            } else {
              result[name] = null;
            }
          } else {
            result[name] = null;
          }
        }
        return result;
      },
      MAP_KEYS,
    );

    console.log('[Scraper] ✅ Lấy daily codes thành công');
    return dailyCodes;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Chạy trực tiếp
if (process.argv[1] && process.argv[1].includes('getDailyCodes')) {
  const hqUrl = process.argv[2] || HQ_URL;
  getDailyCodes(hqUrl)
    .then((codes) => console.log(JSON.stringify(codes, null, 2)))
    .catch((err: Error) => console.error('[Scraper] Lỗi:', err.message));
}
