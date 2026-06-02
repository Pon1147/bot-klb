import puppeteer, { Browser, Page } from 'puppeteer';

interface DailyCodes {
  [key: string]: string | null;
}

export async function getDailyCodes(hqUrl: string): Promise<DailyCodes> {
  if (!hqUrl) {
    throw new Error('Vui lòng cung cấp URL HQ page');
  }

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page: Page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    console.log('[Scraper] Đang mở trang HQ...');
    await page.goto(hqUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await page.waitForSelector('span[data-info^="operations-"]', {
      timeout: 15000,
    });

    const dailyCodes = await page.evaluate((): DailyCodes => {
      const mapKeys = [
        'operations-zero-dam',
        'operations-layali-grove',
        'operations-layali-brakkesh',
        'operations-layali-space-city',
        'operations-layali-tide-prison',
      ];

      const result: DailyCodes = {};

      mapKeys.forEach((key) => {
        const el = document.querySelector(`span[data-info="${key}"]`);
        result[key] = el ? el.textContent?.trim() || null : null;
      });

      return result;
    });

    console.log('[Scraper] Lấy daily codes thành công');
    return dailyCodes;
  } catch (error) {
    console.error('[Scraper] Lỗi:', (error as Error).message);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

// Test trực tiếp
const hqUrl = 'https://www.playdeltaforce.com/events/hq/vi/index.html?laugue=vi&info='; // ← Thay URL thật

getDailyCodes(hqUrl)
  .then((codes) => console.log(codes))
  .catch((err) => console.error(err));
