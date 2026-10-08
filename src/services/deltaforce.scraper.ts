import {
  HQ_URL_BASE,
  HQ_PAGE_TIMEOUT,
  HQ_SELECTOR_TIMEOUT,
  HQ_CODES_CACHE_TTL,
} from '../config/deltaforce.config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Scraper');

interface PuppeteerPage {
  setUserAgent(ua: string): Promise<void>;
  goto(url: string, opts: { waitUntil: string; timeout: number }): Promise<string | null>;
  waitForSelector(selector: string, opts: { timeout: number }): Promise<unknown>;
  evaluate<T>(fn: string | (() => T)): Promise<T>;
  evaluateOnNewDocument?(fn: string | (() => unknown)): Promise<unknown>;
  setRequestInterception(enabled: boolean): void;
  on(event: string, handler: (req: { url: () => string; continue: () => void }) => void): void;
  url(): string;
  screenshot(opts: { path: string }): Promise<string>;
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

type PuppeteerModule = {
  launch: (opts?: unknown) => Promise<unknown>;
};

let puppeteerLoader: () => Promise<PuppeteerModule> = async () => {
  const mod = await import('puppeteer');
  return mod.default as unknown as PuppeteerModule;
};

/** Thiết lập Puppeteer loader phục vụ unit test */
export function setPuppeteerLoaderForTest(loader: (() => Promise<PuppeteerModule>) | null): void {
  if (loader) {
    puppeteerLoader = loader;
  } else {
    puppeteerLoader = async () => {
      const mod = await import('puppeteer');
      return mod.default as unknown as PuppeteerModule;
    };
  }
}

async function loadPuppeteer() {
  return await puppeteerLoader();
}

export interface DailyData {
  codes: DailyCodes;
  operations: DailyOperations;
}

export interface FetchDailyOptions {
  /** Bỏ qua cache và cào lại dữ liệu mới từ HQ */
  forceRefresh?: boolean;
}

interface CachedDailyData {
  data: DailyData;
  expiresAt: number;
}

/** Cache trong bộ nhớ cho kết quả cào HQ */
let dailyDataCache: CachedDailyData | null = null;

/** Promise đang chạy để gom nhóm các cuộc gọi đồng thời (in-flight deduplication) */
let inFlightFetchPromise: Promise<DailyData> | null = null;

/** Kiểm tra kết quả DailyCodes có ít nhất 1 mã hợp lệ không */
function hasValidCodes(codes: DailyCodes): boolean {
  return Object.values(codes).some((code) => typeof code === 'string' && code.trim().length > 0);
}

/**
 * Xóa cache dữ liệu hàng ngày (phục vụ test hoặc ép buộc làm mới).
 */
export function clearDailyDataCache(): void {
  dailyDataCache = null;
  inFlightFetchPromise = null;
}

/**
 * Lấy dữ liệu cache hiện tại nếu còn hạn.
 */
export function getCachedDailyData(): DailyData | null {
  if (dailyDataCache && Date.now() < dailyDataCache.expiresAt) {
    return dailyDataCache.data;
  }
  return null;
}

/** Backward compat — scrape daily codes only, hỗ trợ tùy chọn forceRefresh */
export async function fetchDailyCodes(options?: FetchDailyOptions): Promise<DailyCodes> {
  const result = await fetchDailyAll(options);
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

/**
 * Lấy dữ liệu mật mã và thông số chiến dịch hàng ngày từ HQ.
 * Tự động cache kết quả trong thời gian HQ_CODES_CACHE_TTL và gom nhóm các request đồng thời.
 */
export async function fetchDailyAll(options?: FetchDailyOptions): Promise<DailyData> {
  // 1. Trả về từ cache nếu còn hạn và không bắt buộc làm mới
  if (!options?.forceRefresh && dailyDataCache && Date.now() < dailyDataCache.expiresAt) {
    const remainingSec = Math.max(0, Math.round((dailyDataCache.expiresAt - Date.now()) / 1000));
    logger.info(`[Scraper] Sử dụng dữ liệu cache hàng ngày (còn hiệu lực ${remainingSec}s)`);
    return dailyDataCache.data;
  }

  // 2. Nếu đang có một tiến trình cào dữ liệu đang chạy, dùng chung kết quả (deduplication)
  if (inFlightFetchPromise) {
    logger.info(
      '[Scraper] Đang có tiến trình cào dữ liệu đang chạy, dùng chung kết quả (deduplication)...',
    );
    return inFlightFetchPromise;
  }

  // 3. Khởi tạo tác vụ cào dữ liệu mới
  inFlightFetchPromise = (async () => {
    try {
      const data = await performScrapeDailyAll();
      // Chỉ lưu vào cache nếu có ít nhất 1 code hợp lệ
      if (hasValidCodes(data.codes)) {
        dailyDataCache = {
          data,
          expiresAt: Date.now() + HQ_CODES_CACHE_TTL,
        };
        logger.info(`[Scraper] Đã lưu dữ liệu vào cache (TTL: ${HQ_CODES_CACHE_TTL / 1000}s)`);
      }
      return data;
    } finally {
      inFlightFetchPromise = null;
    }
  })();

  return inFlightFetchPromise;
}

/**
 * Thực hiện cào dữ liệu thực tế bằng Puppeteer headless browser.
 */
async function performScrapeDailyAll(): Promise<DailyData> {
  const startTime = Date.now();
  logger.info(`[Scraper] Bắt đầu lấy dữ liệu hàng ngày từ HQ (${HQ_URL})...`);

  const puppeteer = await loadPuppeteer();
  let browser: PuppeteerBrowser | null = null;

  try {
    browser = (await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
    })) as unknown as PuppeteerBrowser;

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    if (typeof page.evaluateOnNewDocument === 'function') {
      await page.evaluateOnNewDocument('window.__name = (fn) => fn;');
    }

    // Dùng 'domcontentloaded' thay vì 'networkidle2' để tránh timeout
    await withRetry(async () => {
      await page.goto(HQ_URL, { waitUntil: 'domcontentloaded', timeout: HQ_PAGE_TIMEOUT });
    }, 3);

    // Chờ selector hiển thị
    await withRetry(async () => {
      await page.waitForSelector('span[data-info^="operations-"]', {
        timeout: HQ_SELECTOR_TIMEOUT,
      });
    }, 3);

    // Chờ 3 giây để dữ liệu async render vào DOM (bỏ qua khi chạy unit test)
    const renderDelay = process.env.NODE_ENV === 'test' ? 0 : 3000;
    if (renderDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, renderDelay));
    }

    const result = await page.evaluate<DailyData>(`(() => {
      const q = (sel) => document.querySelector(sel);

      // Daily codes (expect 4-digit numbers)
      const codeMap = {
        'operations-zero-dam': 'Đập Nước Zero',
        'operations-layali-grove': 'Thung lũng Layali',
        'operations-layali-brakkesh': 'Phố Cổ Brakkesh',
        'operations-layali-space-city': 'Trạm Không Gian',
        'operations-layali-tide-prison': 'Ngục Giam Thủy Triều',
        'operations-layali-az3': 'AZ3',
      };

      const codes = {};
      for (const [selector, name] of Object.entries(codeMap)) {
        const el = q('span[data-info="' + selector + '"]');
        if (el) {
          const text = (el.textContent || '').trim();
          const match = text.match(/\\S+/);
          codes[name] = match ? match[0] : null;
        } else {
          codes[name] = null;
        }
      }

      // Operations stats — chỉ lấy khi có data thật (không phải nodata state)
      const hasNoData = !!q('[data-info="operations-nodata"]');

      const opMap = {
        'operations-earnings': 'earnings',
        'operations-killed': 'killed',
        'operations-evacuation': 'evacuation',
        'operations-match-count': 'matchCount',
        'operations-kd': 'kd',
      };

      const operations = {};
      if (hasNoData) {
        for (const key of Object.values(opMap)) {
          operations[key] = null;
        }
      } else {
        for (const [selector, key] of Object.entries(opMap)) {
          const el = q('span[data-info="' + selector + '"]');
          operations[key] = el ? ((el.textContent || '').trim() || null) : null;
        }
      }

      return { codes, operations };
    })()`);

    const elapsed = Date.now() - startTime;
    logger.info(
      `[Scraper] Lấy dữ liệu thành công (${elapsed}ms): codes=${JSON.stringify(result.codes)}`,
    );

    return result as unknown as DailyData;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`[Scraper] Lấy dữ liệu thất bại (${elapsed}ms): ${(error as Error).message}`);
    throw error;
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
    })) as unknown as PuppeteerBrowser;

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
