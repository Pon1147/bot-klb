/// <reference types="jest" />

const mockPage = {
  setUserAgent: jest.fn().mockResolvedValue(undefined),
  evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined),
  goto: jest.fn().mockResolvedValue(null),
  waitForSelector: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn().mockResolvedValue({
    codes: {
      'Đập Nước Zero': '1234',
      'Thung lũng Layali': '5678',
      'Phố Cổ Brakkesh': '9012',
      'Trạm Không Gian': '3456',
      'Ngục Giam Thủy Triều': '7890',
      AZ3: '6215',
    },
    operations: {
      earnings: '100,000',
      killed: '10',
      evacuation: '100%',
      matchCount: '5',
      kd: '2.0',
    },
  }),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockPuppeteer = {
  launch: jest.fn().mockResolvedValue(mockBrowser),
};

import {
  fetchDailyAll,
  fetchDailyCodes,
  clearDailyDataCache,
  getCachedDailyData,
  setPuppeteerLoaderForTest,
} from '../../src/services/deltaforce.scraper.js';

describe('deltaforce.scraper caching & deduplication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDailyDataCache();
    setPuppeteerLoaderForTest(async () => mockPuppeteer as any);
  });

  afterEach(() => {
    clearDailyDataCache();
  });

  afterAll(() => {
    setPuppeteerLoaderForTest(null);
  });

  it('lần đầu fetch gọi puppeteer và lưu kết quả vào cache', async () => {
    expect(getCachedDailyData()).toBeNull();

    const data = await fetchDailyAll();

    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
    expect(data.codes['Đập Nước Zero']).toBe('1234');
    expect(getCachedDailyData()).toEqual(data);
  });

  it('lần thứ hai fetch trong thời gian TTL lấy từ cache, không gọi puppeteer', async () => {
    const data1 = await fetchDailyAll();
    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);

    const data2 = await fetchDailyAll();
    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
    expect(data2).toEqual(data1);
  });

  it('fetchDailyCodes trả về codes từ cache', async () => {
    const codes = await fetchDailyCodes();
    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
    expect(codes['Đập Nước Zero']).toBe('1234');

    const codes2 = await fetchDailyCodes();
    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
    expect(codes2).toEqual(codes);
  });

  it('forceRefresh: true bỏ qua cache và gọi lại puppeteer', async () => {
    await fetchDailyAll();
    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);

    await fetchDailyAll({ forceRefresh: true });
    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(2);
  });

  it('clearDailyDataCache xóa cache thành công', async () => {
    await fetchDailyAll();
    expect(getCachedDailyData()).not.toBeNull();

    clearDailyDataCache();
    expect(getCachedDailyData()).toBeNull();

    await fetchDailyAll();
    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(2);
  });

  it('in-flight request deduplication: nhiều lời gọi đồng thời chỉ khởi chạy 1 lần puppeteer', async () => {
    const p1 = fetchDailyAll();
    const p2 = fetchDailyAll();
    const p3 = fetchDailyCodes();

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
    expect(r1.codes['Đập Nước Zero']).toBe('1234');
    expect(r2).toEqual(r1);
    expect(r3).toEqual(r1.codes);
  });
});
