import axios, { AxiosInstance } from 'axios';
import type {
  DfApiResponse,
  DfMyDataResponse,
  DfMatchListResponse,
  DfCollectionResponse,
  DfDailyReportResponse,
  DfApiToken,
} from '../types/deltaforce.types.js';

const BASE = 'https://sg-act.playerinfinite.com/api/proxy/logicial/DfTools';

const FIXED_PARAMS = new URLSearchParams({
  game_id: '30150',
  channel: '10',
  account_type: '1',
  lang_type: 'vi',
  a: '10005',
});

const HEADERS = {
  'content-type': 'application/json',
  origin: 'https://www.playdeltaforce.com',
  referer: 'https://www.playdeltaforce.com/',
};

function buildInstance(token: DfApiToken): AxiosInstance {
  console.log(
    '[DfApi] buildInstance: openid=' +
      token.openid +
      ', token_len=' +
      token.token.length +
      ', ts=' +
      (token.ts || '0') +
      ', s=' +
      (token.s || '0') +
      ', u=' +
      (token.u || crypto.randomUUID()),
  );
  return axios.create({
    baseURL: BASE,
    params: {
      openid: token.openid,
      token: token.token,
      ts: token.ts || '0',
      s: token.s || '0',
      u: token.u || crypto.randomUUID(),
      ...Object.fromEntries(FIXED_PARAMS),
    },
    headers: HEADERS,
    timeout: 15000,
  });
}

/**
 * Call DfTools/GetMyData to fetch player info, rank, and summary stats.
 */
export async function getMyData(token: DfApiToken): Promise<DfMyDataResponse> {
  const instance = buildInstance(token);
  const body = {
    openid: token.openid,
    token: token.token,
    game_id: '30150',
    channel: '10',
    account_type: 1,
    lang_type: 'vi',
    needLogin: true,
    report_type: 1,
    seasonno: ['10001', '10003', '10004', '10005', '10006', '10007', '10008', '10009'],
  };

  const res = await instance.post<DfApiResponse<DfMyDataResponse>>('/GetMyData', body);
  if (res.data.code !== 0) {
    console.log('[DfApi] GetMyData failed: code=' + res.data.code + ', msg=' + res.data.msg);
    throw new Error(`GetMyData failed: code=${res.data.code} msg=${res.data.msg}`);
  }
  return res.data.data;
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
    game_id: '30150',
    channel: '10',
    account_type: 1,
    lang_type: 'vi',
    needLogin: true,
    report_type: 1,
    seasonno: [seasonNo],
  };

  const res = await instance.post<DfApiResponse<DfMyDataResponse>>('/GetMyData', body);
  if (res.data.code !== 0) {
    console.log(
      '[DfApi] GetMyData(season=' +
        seasonNo +
        ') failed: code=' +
        res.data.code +
        ', msg=' +
        res.data.msg,
    );
    throw new Error(
      `GetMyData (season ${seasonNo}) failed: code=${res.data.code} msg=${res.data.msg}`,
    );
  }
  return res.data.data;
}

/**
 * Call DfTools/GetMatchList to fetch recent match history.
 */
export async function getMatchList(token: DfApiToken): Promise<DfMatchListResponse> {
  const instance = buildInstance(token);
  const body = {
    openid: token.openid,
    token: token.token,
    game_id: '30150',
    channel: '10',
    account_type: 1,
    lang_type: 'vi',
    needLogin: true,
    report_type: 1,
    seasonno: ['10009'],
  };

  const res = await instance.post<DfApiResponse<DfMatchListResponse>>('/GetMatchList', body);
  if (res.data.code !== 0) {
    console.log('[DfApi] GetMatchList failed: code=' + res.data.code + ', msg=' + res.data.msg);
    throw new Error(`GetMatchList failed: code=${res.data.code} msg=${res.data.msg}`);
  }
  return res.data.data;
}

/**
 * Call DfTools/GetDahongCollection to fetch item collection.
 */
export async function getCollection(token: DfApiToken): Promise<DfCollectionResponse> {
  const instance = buildInstance(token);

  const res = await instance.post<DfApiResponse<DfCollectionResponse>>('/GetDahongCollection', {});
  if (res.data.code !== 0) {
    console.log(
      '[DfApi] GetDahongCollection failed: code=' + res.data.code + ', msg=' + res.data.msg,
    );
    throw new Error(`GetDahongCollection failed: code=${res.data.code} msg=${res.data.msg}`);
  }
  return res.data.data;
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
    game_id: '30150',
    channel: '10',
    account_type: 1,
    lang_type: 'vi',
    needLogin: true,
    report_type: 1,
  };

  const res = await instance.post<DfApiResponse<DfDailyReportResponse>>('/GetDailyReport', body);
  if (res.data.code !== 0) {
    console.log('[DfApi] GetDailyReport failed: code=' + res.data.code + ', msg=' + res.data.msg);
    throw new Error(`GetDailyReport failed: code=${res.data.code} msg=${res.data.msg}`);
  }
  return res.data.data;
}
