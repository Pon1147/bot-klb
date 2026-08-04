/**
 * DfToolsClient — Layer 3 của kiến trúc 3 lớp.
 *
 * Load binding → decrypt → request per endpoint profile → data.
 * Không biết credential đến từ extension hay manual.
 *
 * Endpoint profiles: mỗi endpoint có bộ param khác nhau.
 * Nếu s = f(token, ts, params) → regenerate mỗi request.
 */

import crypto from 'node:crypto';
import axios from 'axios';
import Database from 'better-sqlite3';
import { getActiveBinding, touchLastOk, updateLastError } from '../database/df-binding.db.js';
import { decryptCredential } from './df-crypto.js';
import { createLogger } from '../utils/logger.js';
import {
  BASE_API_URL,
  GAME_ID,
  DF_CHANNEL,
  ACCOUNT_TYPE,
  ACCOUNT_A_PARAM,
  LANG_TYPE,
  SEASONS_MY_DATA,
  SEASON_LATEST,
} from '../config/deltaforce.config.js';

const logger = createLogger('DfToolsClient');

/** Endpoint profile: định nghĩa params cần thiết cho mỗi endpoint */
interface DfEndpointProfile {
  path: string;
  requiredParams: string[];
  optionalParams?: string[];
  bodyTemplate?: Record<string, unknown>;
}

/** Registry endpoint profiles */
const ENDPOINT_PROFILES: Record<string, DfEndpointProfile> = {
  MY_DATA: {
    path: '/GetMyData',
    requiredParams: ['openid', 'token', 'ts'],
    optionalParams: ['s', 'u'],
    bodyTemplate: { seasonno: SEASONS_MY_DATA },
  },
  MATCH_LIST: {
    path: '/GetMatchList',
    requiredParams: ['openid', 'token', 'ts'],
    optionalParams: ['s', 'u'],
    bodyTemplate: { seasonno: [SEASON_LATEST] },
  },
  COLLECTION: {
    path: '/GetDahongCollection',
    requiredParams: ['openid', 'token', 'ts'],
    optionalParams: ['s', 'u'],
    bodyTemplate: {},
  },
  DAILY_REPORT: {
    path: '/GetDailyReport',
    requiredParams: ['openid', 'token', 'ts'],
    optionalParams: ['s', 'u'],
    bodyTemplate: {},
  },
};

/** Credential sau khi decrypt */
interface DecryptedCredential {
  token: string;
  ts?: string;
  s?: string;
  u?: string;
  [key: string]: string | undefined;
}

/**
 * DfToolsClient — gọi DfTools API với credential đã decrypt.
 */
export class DfToolsClient {
  private axiosInstance: axios.AxiosInstance;

  constructor(
    private database: Database.Database,
    private discordUserId: string,
  ) {
    this.axiosInstance = axios.create({
      baseURL: BASE_API_URL,
      timeout: 15000,
      headers: {
        origin: 'https://www.playdeltaforce.com',
        referer: 'https://www.playdeltaforce.com/',
      },
    });
  }

  /**
   * Load và decrypt credential từ binding.
   */
  private async getDecryptedCredential(): Promise<DecryptedCredential> {
    const binding = getActiveBinding(this.database, this.discordUserId);
    if (!binding) {
      throw new Error('No active binding found for user');
    }

    try {
      const plaintext = decryptCredential(
        binding.cred_nonce,
        binding.cred_ciphertext,
        binding.cred_tag,
        this.discordUserId,
        binding.openid,
        binding.key_version,
      );

      return JSON.parse(plaintext) as DecryptedCredential;
    } catch (error) {
      logger.error(
        'Decrypt failed for user ' +
          this.discordUserId +
          ': ' +
          (error instanceof Error ? error.message : String(error)),
      );
      throw new Error('Failed to decrypt credential');
    }
  }

  /**
   * Request DfTools API theo endpoint profile.
   */
  async request(
    endpointKey: keyof typeof ENDPOINT_PROFILES,
    extraParams?: Record<string, string>,
  ): Promise<unknown> {
    const profile = ENDPOINT_PROFILES[endpointKey];
    if (!profile) {
      throw new Error('Unknown endpoint: ' + endpointKey);
    }

    const cred = await this.getDecryptedCredential();

    // Build query params
    const params: Record<string, string> = {
      game_id: GAME_ID,
      channel: DF_CHANNEL,
      account_type: ACCOUNT_TYPE,
      a: ACCOUNT_A_PARAM,
      lang_type: LANG_TYPE,
    };

    // Add required params from credential
    for (const p of profile.requiredParams) {
      if (cred[p] !== undefined) params[p] = cred[p] as string;
    }

    // Add optional params
    for (const p of profile.optionalParams ?? []) {
      if (cred[p] !== undefined) params[p] = cred[p] as string;
    }

    // u = unique per request
    params.u = crypto.randomUUID();

    // Extra params (override)
    if (extraParams) {
      Object.assign(params, extraParams);
    }

    // Body
    const body = { ...profile.bodyTemplate, ...extraParams };

    try {
      const response = await this.axiosInstance.post(profile.path, body, { params });
      return response.data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`${endpointKey} failed for user ${this.discordUserId}: ${errorMsg}`);
      updateLastError(this.database, this.discordUserId, errorMsg);
      throw error;
    }
  }

  /**
   * Convenience methods.
   */
  async getMyData(seasonNos?: number[]): Promise<unknown> {
    return this.request('MY_DATA', seasonNos ? { seasonno: seasonNos.join(',') } : undefined);
  }

  async getMatchList(offset = 0, limit = 20): Promise<unknown> {
    return this.request('MATCH_LIST', { offset: String(offset), limit: String(limit) });
  }

  async getCollection(): Promise<unknown> {
    return this.request('COLLECTION');
  }

  async getDailyReport(): Promise<unknown> {
    return this.request('DAILY_REPORT');
  }

  /**
   * Verify credential bằng cách gọi API đơn giản.
   */
  async verifyCredential(): Promise<boolean> {
    try {
      await this.getMyData();
      touchLastOk(this.database, this.discordUserId);
      return true;
    } catch {
      return false;
    }
  }
}
