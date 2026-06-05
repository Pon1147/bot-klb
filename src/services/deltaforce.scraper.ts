export interface DailyCodes {
  'Đập Nước Zero': string | null;
  'Thung lũng Layali': string | null;
  'Phố Cổ Brakkesh': string | null;
  'Trạm Không Gian': string | null;
  'Ngục Giam Thủy Triều': string | null;
}

const HQ_URL = 'https://www.playdeltaforce.com/events/hq/vi/index.html?laugue=vi&info=';

async function loadPuppeteer() {
  const mod = await import('puppeteer');
  return mod.default;
}

export async function fetchDailyCodes(): Promise<DailyCodes> {
  const puppeteer = await loadPuppeteer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    await page.goto(HQ_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('span[data-info^="operations-"]', { timeout: 15000 });

    const dailyCodes = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mapKeys: Record<string, string>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = {};
        const q = (globalThis as any).document.querySelector.bind(
          (globalThis as any).document,
        );
        for (const [selector, name] of Object.entries(mapKeys)) {
          const el = q(`span[data-info="${selector}"]`);
          if (el) {
            const text = el.textContent?.trim();
            if (text) {
              const match = text!.match(/\d{4}/);
              if (match) {
                result[name] = match[0];
              }
            }
          } else {
            result[name] = null;
          }
        }
        return result;
      },
      {
        'operations-zero-dam': 'Đập Nước Zero',
        'operations-layali-grove': 'Thung lũng Layali',
        'operations-layali-brakkesh': 'Phố Cổ Brakkesh',
        'operations-layali-space-city': 'Trạm Không Gian',
        'operations-layali-tide-prison': 'Ngục Giam Thủy Triều',
      },
    );

    return dailyCodes;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract token from HQ page by intercepting GetMyData request.
 * User must be logged into the HQ page (cookies/session active).
 */
export async function extractToken(
  hqUrl: string,
  timeoutMs = 20000,
): Promise<{ openid: string; token: string } | null> {
  const puppeteer = await loadPuppeteer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    // Intercept GetMyData request to extract token
    const tokenPromise = new Promise<{ openid: string; token: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout: không tìm thấy token trong 20s')), timeoutMs);

      page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const url = req.url();
        if (url.includes('GetMyData')) {
          clearTimeout(timer);
          const params = new URLSearchParams(url.split('?')[1]);
          resolve({
            openid: params.get('openid')!,
            token: params.get('token')!,
          });
        }
        req.continue();
      });
    });

    await page.goto(hqUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    try {
      const token = await tokenPromise;
      return token;
    } catch (e) {
      console.warn('[Scraper] Không tìm thấy token:', (e as Error).message);
      return null;
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
