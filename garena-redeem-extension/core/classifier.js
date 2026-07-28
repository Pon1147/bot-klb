(function () {
  'use strict';

  const classify = (msg) => {
    const t = String(msg || '').toLowerCase();

    if (/^ok$|thành công|success/.test(t)) return 'SUCCESS';
    if (/error_hint_400067|reached the redemption limit|limit of cdkey group|đạt giới hạn/.test(t))
      return 'LIMIT_REACHED';
    if (/error_hint_400068|error_hint_400070|hết hạn|expired/.test(t)) return 'EXPIRED';
    if (
      /error_hint_400072|error_hint_400073|current cdkey present error|đã.*(nhận|sử dụng)|already|used/.test(
        t,
      )
    )
      return 'USED';
    if (/error_hint_400054|không hợp lệ|invalid|sai|current cdk does not match/.test(t))
      return 'INVALID';
    if (/captcha|xác minh|verification/.test(t)) return 'VERIFY';
    if (/lỗi mạng|network|rate|quá nhanh|too fast/.test(t)) return 'TEMP_ERROR';

    return msg ? 'OTHER' : 'NO_RESPONSE';
  };

  window.Pon1147 = window.Pon1147 || {};
  window.Pon1147.classifier = { classify };
})();
