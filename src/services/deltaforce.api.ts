import axios, { AxiosInstance } from 'axios';
import type {
  DfApiResponse,
  DfMyDataResponse,
  DfMatchListResponse,
  DfCollectionResponse,
  DfDailyReportResponse,
  DfMatchDetailResponse,
  DfApiToken,
  DfWorkshopRecommendationResponse,
  DfManufactureDetailResponse,
} from '../types/deltaforce.types.js';
import {
  BASE_API_URL,
  DIRECT_API_URL,
  GAME_ID,
  DF_CHANNEL,
  ACCOUNT_TYPE,
  ACCOUNT_A_PARAM,
  LANG_TYPE,
  DF_ORIGIN,
  DF_REFERER,
  API_TIMEOUT_MS,
  SEASONS_MY_DATA,
  SEASON_LATEST,
} from '../config/deltaforce.config.js';
import { createLogger } from '../utils/logger.js';
import { maskString } from '../utils/string.utils.js';

const logger = createLogger('DfApi');

const FIXED_PARAMS = new URLSearchParams({
  game_id: GAME_ID,
  channel: DF_CHANNEL,
  account_type: ACCOUNT_TYPE,
  lang_type: LANG_TYPE,
  a: ACCOUNT_A_PARAM,
});

const HEADERS = {
  'content-type': 'application/json',
  origin: DF_ORIGIN,
  referer: DF_REFERER,
};

type AxiosCreator = (config: unknown) => AxiosInstance;

let axiosCreator: AxiosCreator = (config) =>
  axios.create(config as Parameters<typeof axios.create>[0]);

/** Thiết lập Axios creator cho unit test nhằm ngăn chặn tuyệt đối việc gửi request thật */
export function setAxiosCreatorForTest(creator: AxiosCreator | null): void {
  if (creator) {
    axiosCreator = creator;
  } else {
    axiosCreator = (config) => axios.create(config as Parameters<typeof axios.create>[0]);
  }
}

/**
 * Khử nhạy cảm URL query string: che token, signature và openid
 */
export function sanitizeUrl(urlStr: string): string {
  return urlStr
    .replace(/([?&]token=)[^&]+/gi, '$1***REDACTED***')
    .replace(/([?&]s=)[^&]+/gi, '$1***REDACTED***')
    .replace(/([?&]openid=)([^&]+)/gi, (_match, prefix, val) => {
      return `${prefix}${maskString(val)}`;
    });
}

/**
 * Khử nhạy cảm thông tin xác thực trong đối tượng AxiosError hoặc generic error
 * Đảm bảo token, s, openid không bao giờ xuất hiện trong application logs hoặc caller stack trace.
 */
export function sanitizeAxiosError(error: unknown): unknown {
  if (!error || typeof error !== 'object') return error;

  const err = error as Record<string, any>;

  // 1. Sanitize error.config (params, data, url)
  if (err.config && typeof err.config === 'object') {
    const config = err.config;
    if (config.params && typeof config.params === 'object') {
      config.params = { ...config.params };
      if ('token' in config.params) config.params.token = '***REDACTED***';
      if ('s' in config.params && config.params.s && config.params.s !== '0') {
        config.params.s = '***REDACTED***';
      }
      if ('openid' in config.params && typeof config.params.openid === 'string') {
        config.params.openid = maskString(config.params.openid);
      }
    }

    if (config.data) {
      if (typeof config.data === 'string') {
        try {
          const parsed = JSON.parse(config.data);
          if (parsed && typeof parsed === 'object') {
            if ('token' in parsed) parsed.token = '***REDACTED***';
            if ('s' in parsed && parsed.s && parsed.s !== '0') parsed.s = '***REDACTED***';
            if ('openid' in parsed && typeof parsed.openid === 'string') {
              parsed.openid = maskString(parsed.openid);
            }
            config.data = JSON.stringify(parsed);
          }
        } catch {
          config.data = config.data
            .replace(/"token"\s*:\s*"[^"]+"/g, '"token":"***REDACTED***"')
            .replace(/"s"\s*:\s*"[^"]+"/g, '"s":"***REDACTED***"')
            .replace(
              /"openid"\s*:\s*"([^"]+)"/g,
              (_m: string, id: string) => `"openid":"${maskString(id)}"`,
            );
        }
      } else if (typeof config.data === 'object') {
        config.data = { ...config.data };
        if ('token' in config.data) config.data.token = '***REDACTED***';
        if ('s' in config.data && config.data.s && config.data.s !== '0')
          config.data.s = '***REDACTED***';
        if ('openid' in config.data && typeof config.data.openid === 'string') {
          config.data.openid = maskString(config.data.openid);
        }
      }
    }

    if (typeof config.url === 'string') {
      config.url = sanitizeUrl(config.url);
    }
  }

  // 2. Sanitize error.request (Node.js ClientRequest)
  if (err.request && typeof err.request === 'object') {
    if (typeof err.request.path === 'string') {
      err.request.path = sanitizeUrl(err.request.path);
    }
  }

  // 3. Sanitize error.response.config (nếu có)
  if (err.response?.config && typeof err.response.config === 'object') {
    sanitizeAxiosError({ config: err.response.config });
  }

  // 4. Sanitize error.config.headers (nếu có trường token/authorization/cookie)
  if (err.config?.headers && typeof err.config.headers === 'object') {
    for (const h of ['token', 'authorization', 'cookie', 'x-token']) {
      if (h in err.config.headers) {
        err.config.headers[h] = '***REDACTED***';
      }
    }
  }

  // 5. Sanitize error.request._header (nếu có trong Node.js ClientRequest)
  if (err.request?._header && typeof err.request._header === 'string') {
    err.request._header = sanitizeUrl(err.request._header);
  }

  // 6. Sanitize error.response.data (nếu API echo lại token trong payload lỗi)
  if (err.response?.data) {
    if (typeof err.response.data === 'string') {
      err.response.data = sanitizeUrl(err.response.data)
        .replace(/"token"\s*:\s*"[^"]+"/g, '"token":"***REDACTED***"')
        .replace(/"s"\s*:\s*"[^"]+"/g, '"s":"***REDACTED***"');
    } else if (typeof err.response.data === 'object') {
      if ('token' in err.response.data) err.response.data.token = '***REDACTED***';
      if ('s' in err.response.data) err.response.data.s = '***REDACTED***';
    }
  }

  // 7. Sanitize error.message nếu message chứa URL với params
  if (typeof err.message === 'string') {
    err.message = sanitizeUrl(err.message);
  }

  // 8. Sanitize error.stack nếu stack trace chứa URL với params
  if (typeof err.stack === 'string') {
    err.stack = sanitizeUrl(err.stack);
  }

  // 9. Wrap toJSON() nếu AxiosError có phương thức toJSON()
  if (typeof err.toJSON === 'function' && !err._toJSONSanitized) {
    const originalToJSON = err.toJSON.bind(err);
    err.toJSON = () => {
      const json = originalToJSON();
      return sanitizeAxiosError(json);
    };
    err._toJSONSanitized = true;
  }

  return error;
}

/**
 * Thực thi POST request an toàn và tự động lọc sạch thông tin nhạy cảm khi có lỗi
 */
async function postSafe<T>(
  instance: AxiosInstance,
  url: string,
  body: unknown,
): Promise<DfApiResponse<T>> {
  try {
    const res = await instance.post<DfApiResponse<T>>(url, body);
    return res.data;
  } catch (error) {
    throw sanitizeAxiosError(error);
  }
}

function buildInstance(token: DfApiToken): AxiosInstance {
  logger.info(
    'buildInstance: openid=' +
      maskString(token.openid) +
      ', token_len=' +
      token.token.length +
      ', ts=' +
      (token.ts || '0') +
      ', s=' +
      (token.s ? '***REDACTED***' : '0') +
      ', u=' +
      (token.u || crypto.randomUUID()),
  );
  const instance = axiosCreator({
    baseURL: BASE_API_URL,
    params: {
      openid: token.openid,
      token: token.token,
      ts: token.ts || '0',
      s: token.s || '0',
      u: token.u || crypto.randomUUID(),
      ...Object.fromEntries(FIXED_PARAMS),
    },
    headers: HEADERS,
    timeout: API_TIMEOUT_MS,
  });

  if (instance.interceptors?.response?.use) {
    instance.interceptors.response.use(
      (response) => response,
      (error) => Promise.reject(sanitizeAxiosError(error)),
    );
  }

  return instance;
}

/**
 * Validate token bằng cách gọi GetMyData.
 * Trả về true nếu token còn hiệu lực, false nếu hết hạn hoặc invalid.
 */
export async function validateToken(token: DfApiToken, openid: string): Promise<boolean> {
  try {
    const instance = buildInstance(token);
    const body = {
      openid,
      token: token.token,
      game_id: GAME_ID,
      channel: DF_CHANNEL,
      account_type: Number(ACCOUNT_TYPE),
      lang_type: LANG_TYPE,
      needLogin: true,
      report_type: 1,
    };
    const resData = await postSafe<unknown>(instance, '/GetMyData', body);
    return resData.code === 0;
  } catch {
    return false;
  }
}

/**
 * Call DfTools/GetMyData to fetch player info, rank, and summary stats.
 */
export async function getMyData(token: DfApiToken): Promise<DfMyDataResponse> {
  const instance = buildInstance(token);
  const body = {
    openid: token.openid,
    token: token.token,
    game_id: GAME_ID,
    channel: DF_CHANNEL,
    account_type: Number(ACCOUNT_TYPE),
    lang_type: LANG_TYPE,
    needLogin: true,
    report_type: 1,
    seasonno: SEASONS_MY_DATA,
  };

  const resData = await postSafe<DfMyDataResponse>(instance, '/GetMyData', body);
  if (resData.code !== 0) {
    logger.info('GetMyData failed: code=' + resData.code + ', msg=' + resData.msg);
    throw new Error(`GetMyData failed: code=${resData.code} msg=${resData.msg}`);
  }
  return resData.data;
}

/**
 * Call GetMyData with a single season → returns stats for that season only.
 */
export async function getSeasonData(
  token: DfApiToken,
  seasonNo: string,
): Promise<DfMyDataResponse> {
  const instance = buildInstance(token);
  const body = {
    openid: token.openid,
    token: token.token,
    game_id: GAME_ID,
    channel: DF_CHANNEL,
    account_type: Number(ACCOUNT_TYPE),
    lang_type: LANG_TYPE,
    needLogin: true,
    report_type: 1,
    seasonno: [seasonNo],
  };

  const resData = await postSafe<DfMyDataResponse>(instance, '/GetMyData', body);
  if (resData.code !== 0) {
    logger.info(
      'GetMyData(season=' + seasonNo + ') failed: code=' + resData.code + ', msg=' + resData.msg,
    );
    throw new Error(
      `GetMyData (season ${seasonNo}) failed: code=${resData.code} msg=${resData.msg}`,
    );
  }
  return resData.data;
}

/**
 * Call GetMyData without season → returns latest/overview data.
 */
export async function getOverviewData(token: DfApiToken): Promise<DfMyDataResponse> {
  const instance = buildInstance(token);
  const body = {
    openid: token.openid,
    token: token.token,
    game_id: GAME_ID,
    channel: DF_CHANNEL,
    account_type: Number(ACCOUNT_TYPE),
    lang_type: LANG_TYPE,
    needLogin: true,
    report_type: 1,
  };

  const resData = await postSafe<DfMyDataResponse>(instance, '/GetMyData', body);
  if (resData.code !== 0) {
    logger.info('GetMyData(overview) failed: code=' + resData.code + ', msg=' + resData.msg);
    throw new Error(`GetMyData (overview) failed: code=${resData.code} msg=${resData.msg}`);
  }
  return resData.data;
}

/**
 * Call DfTools/GetMatchList to fetch recent match history.
 * Hỗ trợ pagination với offset và limit.
 */
export async function getMatchList(
  token: DfApiToken,
  options?: { offset?: number; limit?: number },
): Promise<DfMatchListResponse> {
  const instance = buildInstance(token);
  const body = {
    openid: token.openid,
    token: token.token,
    game_id: GAME_ID,
    channel: DF_CHANNEL,
    account_type: Number(ACCOUNT_TYPE),
    lang_type: LANG_TYPE,
    needLogin: true,
    report_type: 1,
    seasonno: [SEASON_LATEST],
    ...(options?.offset !== undefined ? { offset: options.offset } : {}),
    ...(options?.limit !== undefined ? { limit: options.limit } : {}),
  };

  const resData = await postSafe<DfMatchListResponse>(instance, '/GetMatchList', body);
  if (resData.code !== 0) {
    logger.info('GetMatchList failed: code=' + resData.code + ', msg=' + resData.msg);
    throw new Error(`GetMatchList failed: code=${resData.code} msg=${resData.msg}`);
  }
  return resData.data;
}

/**
 * Call DfTools/GetDahongCollection to fetch item collection.
 */
export async function getCollection(token: DfApiToken): Promise<DfCollectionResponse> {
  const instance = buildInstance(token);

  const resData = await postSafe<DfCollectionResponse>(instance, '/GetDahongCollection', {});
  if (resData.code !== 0) {
    logger.info('GetDahongCollection failed: code=' + resData.code + ', msg=' + resData.msg);
    throw new Error(`GetDahongCollection failed: code=${resData.code} msg=${resData.msg}`);
  }
  return resData.data;
}

/**
 * Call DfTools/GetDailyReport to fetch daily operations stats (earnings, killed, etc.)
 * Returns data for the current day's operations.
 */
export async function getDailyReport(token: DfApiToken): Promise<DfDailyReportResponse> {
  const instance = buildInstance(token);
  const body = {
    openid: token.openid,
    token: token.token,
    game_id: GAME_ID,
    channel: DF_CHANNEL,
    account_type: Number(ACCOUNT_TYPE),
    lang_type: LANG_TYPE,
    needLogin: true,
    report_type: 1,
  };

  const resData = await postSafe<DfDailyReportResponse>(instance, '/GetDailyReport', body);
  if (resData.code !== 0) {
    logger.info('GetDailyReport failed: code=' + resData.code + ', msg=' + resData.msg);
    throw new Error(`GetDailyReport failed: code=${resData.code} msg=${resData.msg}`);
  }
  return resData.data;
}

/**
 * Call DfTools/GetManufactureRecommendationList to fetch workshop production data.
 * Returns workbench items with hourly income, remaining time, and status.
 */
export async function getWorkshopRecommendations(
  token: DfApiToken,
): Promise<DfWorkshopRecommendationResponse> {
  const instance = buildInstance(token);

  const resData = await postSafe<DfWorkshopRecommendationResponse>(
    instance,
    '/GetManufactureRecommendationList',
    {},
  );
  if (resData.code !== 0) {
    logger.info(
      'GetManufactureRecommendationList failed: code=' + resData.code + ', msg=' + resData.msg,
    );
    throw new Error(
      `GetManufactureRecommendationList failed: code=${resData.code} msg=${resData.msg}`,
    );
  }
  return resData.data;
}

/**
 * Call DfTools/GetWorkbenchList to fetch current production data.
 * Returns workbench items with countdown timers (status >= 1).
 */
export async function getWorkbenchList(
  token: DfApiToken,
): Promise<DfWorkshopRecommendationResponse> {
  const instance = buildInstance(token);

  const resData = await postSafe<DfWorkshopRecommendationResponse>(
    instance,
    '/GetWorkbenchList',
    {},
  );
  if (resData.code !== 0) {
    logger.info('GetWorkbenchList failed: code=' + resData.code + ', msg=' + resData.msg);
    throw new Error(`GetWorkbenchList failed: code=${resData.code} msg=${resData.msg}`);
  }
  return resData.data;
}

/**
 * Call DfTools/GetMatchDetail to fetch full details of a specific match room.
 */
export async function getMatchDetail(
  token: DfApiToken,
  roomId: string,
): Promise<DfMatchDetailResponse> {
  const instance = buildInstance(token);
  const body = {
    openid: token.openid,
    token: token.token,
    game_id: GAME_ID,
    channel: DF_CHANNEL,
    account_type: Number(ACCOUNT_TYPE),
    lang_type: LANG_TYPE,
    needLogin: true,
    report_type: 1,
    room_id: roomId,
  };

  const resData = await postSafe<DfMatchDetailResponse>(instance, '/GetMatchDetail', body);
  if (resData.code !== 0) {
    logger.info('GetMatchDetail failed: code=' + resData.code + ', msg=' + resData.msg);
    throw new Error(`GetMatchDetail failed: code=${resData.code} msg=${resData.msg}`);
  }
  return resData.data;
}

/**
 * Call DfTools/GetManufactureRecommendationListNoAuth to fetch top profitable workbench items (no auth required).
 */
export async function getManufactureRecommendationListNoAuth(): Promise<DfWorkshopRecommendationResponse> {
  const instance = axiosCreator({
    baseURL: DIRECT_API_URL,
    headers: HEADERS,
    timeout: API_TIMEOUT_MS,
  });
  const body = {
    game_id: GAME_ID,
    channel: DF_CHANNEL,
    account_type: ACCOUNT_TYPE,
    account_a: ACCOUNT_A_PARAM,
    lang_type: LANG_TYPE,
  };

  const resData = await postSafe<DfWorkshopRecommendationResponse>(
    instance,
    '/GetManufactureRecommendationListNoAuth',
    body,
  );
  if (resData.code !== 0) {
    logger.info(
      'GetManufactureRecommendationListNoAuth failed: code=' +
        resData.code +
        ', msg=' +
        resData.msg,
    );
    throw new Error(
      `GetManufactureRecommendationListNoAuth failed: code=${resData.code} msg=${resData.msg}`,
    );
  }
  return resData.data;
}

export interface DfManufactureDetailResult {
  detail: DfManufactureDetailResponse;
  isPersonal: boolean;
}

/**
 * Call DfTools/GetManufactureDetail to fetch price fluctuation and recipe profit details.
 * Ưu tiên gọi qua cổng Auth Proxy (Garena) nếu có token người dùng, tự động fallback sang Direct API (Global).
 */
export async function getManufactureDetail(
  itemId: string,
  token?: DfApiToken,
): Promise<DfManufactureDetailResult> {
  if (token) {
    try {
      const instance = buildInstance(token);
      const body = {
        openid: token.openid,
        token: token.token,
        game_id: GAME_ID,
        channel: DF_CHANNEL,
        account_type: Number(ACCOUNT_TYPE),
        lang_type: LANG_TYPE,
        needLogin: true,
        item_id: itemId,
      };
      const res = await postSafe<DfManufactureDetailResponse>(
        instance,
        '/GetManufactureDetail',
        body,
      );
      if (res.code === 0 && res.data) {
        return { detail: res.data, isPersonal: true };
      }
      logger.info(
        `Personal GetManufactureDetail returned code=${res.code} msg=${res.msg}, falling back to Direct`,
      );
    } catch (err) {
      logger.warn(
        `Personal GetManufactureDetail failed: ${(err as Error).message}, falling back to Direct`,
      );
    }
  }

  // Fallback sang Direct API (NoAuth)
  const instance = axiosCreator({
    baseURL: DIRECT_API_URL,
    headers: HEADERS,
    timeout: API_TIMEOUT_MS,
  });
  const body = {
    game_id: GAME_ID,
    channel: DF_CHANNEL,
    account_type: ACCOUNT_TYPE,
    account_a: ACCOUNT_A_PARAM,
    lang_type: LANG_TYPE,
    item_id: itemId,
  };

  const resData = await postSafe<DfManufactureDetailResponse>(
    instance,
    '/GetManufactureDetail',
    body,
  );
  if (resData.code !== 0 || !resData.data) {
    logger.info('GetManufactureDetail failed: code=' + resData.code + ', msg=' + resData.msg);
    throw new Error(`GetManufactureDetail failed: code=${resData.code} msg=${resData.msg}`);
  }
  return { detail: resData.data, isPersonal: false };
}
