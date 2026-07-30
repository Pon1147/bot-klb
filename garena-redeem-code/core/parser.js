// @deprecated — NOT loaded by manifest. Use content/content.js (monolithic) instead.
import { RESPONSE_CODE_MAP } from './constants.js';

export function parseRedeemResponse(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'object') {
    return {
      result: 'FAILED',
      reason: 'UNKNOWN',
      responseCode: null,
      message: 'Invalid response format',
      seq: '',
      raw: rawResponse,
    };
  }

  const responseCode = Number(rawResponse.code);
  const mapped = RESPONSE_CODE_MAP[responseCode];

  if (mapped) {
    return {
      result: mapped.result,
      reason: mapped.reason,
      responseCode,
      message: rawResponse.msg || '',
      seq: rawResponse.seq || '',
      raw: rawResponse,
    };
  }

  // Unknown response code -> FAILED/UNKNOWN (never guess)
  return {
    result: 'FAILED',
    reason: 'UNKNOWN',
    responseCode,
    message: rawResponse.msg || '',
    seq: rawResponse.seq || '',
    raw: rawResponse,
  };
}
