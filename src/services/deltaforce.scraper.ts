import { HQ_URL_BASE, HQ_PAGE_TIMEOUT, HQ_SELECTOR_TIMEOUT } from '../config/deltaforce.config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Scraper');

interface PuppeteerPage {
  setUserAgent(ua: string): Promise<void>;
  goto(url: string, opts: { waitUntil: string; timeout: number }): Promise<string | null>;
  waitForSelector(selector: string, opts: { timeout: number }): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<T>;
  setRequestInterception(enabled: boolean): void;
  on(event: string, handler: (req: { url: () => string; continue: () => void }) => void): void;
}

interface PuppeteerBrowser {
  close(): Promise<void>;
  newPage(): Promise<PuppeteerPage>;
}

export interface DailyCodes {
  'Đập Nước Zero': string | null;
  'Thung lũng Layali': string | null;
  'Phố Cổ Brakkesh': string | null;
  'Trạm Không Gian': string | null;
  'Ngục Giam Thủy Triều': string | null;
  AZ3: string | null;
}

export interface DailyOperations {
  earnings: string | null;
  killed: string | null;
  evacuation: string | null;
  matchCount: string | null;
  kd: string | null;
}

// URL đã được fix typo: laugue → language
const HQ_URL = HQ_URL_BASE;

async function loadPuppeteer() {
  const mod = await import('puppeteer');
  return mod.default;
}

export interface DailyData {
  codes: DailyCodes;
  operations: DailyOperations;
}

/** Backward compat — scrape daily codes only */
export async function fetchDailyCodes(): Promise<DailyCodes> {
  const result = await fetchDailyAll();
  return result.codes;
}

/**
 * Retry wrapper cho Puppeteer operations.
 * Retry lên đến 3 lần với exponential backoff (1s, 2s, 4s).
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        logger.error(
          `[Scraper] Retry exhausted after ${maxRetries} attempts: ${(error as Error).message}`,
        );
        throw error;
      }

      const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      logger.warn(
        `[Scraper] Attempt ${attempt}/${maxRetries} failed: ${(error as Error).message}. Retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError!;
}

export async function fetchDailyAll(): Promise<DailyData> {
  const puppeteer = await loadPuppeteer();
  let browser: PuppeteerBrowser | null = null;

  try {
    browser = (await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    })) as PuppeteerBrowser;

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    // Dùng 'domcontentloaded' thay vì 'networkidle2' để tránh timeout
    // khi website có background requests (WebSocket, analytics) không bao giờ idle
    await withRetry(async () => {
      await page.goto(HQ_URL, { waitUntil: 'domcontentloaded', timeout: HQ_PAGE_TIMEOUT });
    });

    // Thử waitForSelector với retry
    await withRetry(async () => {
      await page.waitForSelector('span[data-info^="operations-"]', {
        timeout: HQ_SELECTOR_TIMEOUT,
      });
    });

    const result = await page.evaluate(() => {
      // puppeteer evaluate chạy trong browser context, globalThis là Document
      const q = globalThis.document.querySelector.bind(globalThis.document);

      // Daily codes (expect 4-digit numbers)
      const codeMap: Record<string, string> = {
        'operations-zero-dam': 'Đập Nước Zero',
        'operations-layali-grove': 'Thung lũng Layali',
        'operations-layali-brakkesh': 'Phố Cổ Brakkesh',
        'operations-layali-space-city': 'Trạm Không Gian',
        'operations-layali-tide-prison': 'Ngục Giam Thủy Triều',
        'operations-layali-az3': 'AZ3',
      };

      const codes: Record<string, string | null> = {};
      for (const [selector, name] of Object.entries(codeMap)) {
        const el = q(`span[data-info="${selector}"]`);
        if (el) {
          const text = el.textContent?.trim();
          const match = text?.match(/\S+/);
          codes[name] = match ? match[0] : null;
        } else {
          codes[name] = null;
        }
      }

      // Operations stats — chỉ lấy khi có data thật (không phải nodata state)
      const hasNoData = !!q(`[data-info="operations-nodata"]`);

      const opMap: Record<string, string> = {
        'operations-earnings': 'earnings',
        'operations-killed': 'killed',
        'operations-evacuation': 'evacuation',
        'operations-match-count': 'matchCount',
        'operations-kd': 'kd',
      };

      const operations: Record<string, string | null> = {};
      if (hasNoData) {
        for (const key of Object.values(opMap)) {
          operations[key] = null;
        }
      } else {
        for (const [selector, key] of Object.entries(opMap)) {
          const el = q(`span[data-info="${selector}"]`);
          operations[key] = el ? el.textContent?.trim() || null : null;
        }
      }

      return { codes, operations };
    });

    return result as unknown as DailyData;
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
  let browser: PuppeteerBrowser | null = null;

  try {
    browser = (await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })) as PuppeteerBrowser;

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    // Intercept GetMyData request to extract token
    const tokenPromise = new Promise<{ openid: string; token: string }>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timeout: không tìm thấy token trong 20s')),
        timeoutMs,
      );

      page.setRequestInterception(true);
      page.on('request', (req: { url: () => string; continue: () => void }) => {
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

    await page.goto(hqUrl, { waitUntil: 'networkidle2', timeout: HQ_PAGE_TIMEOUT });

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
