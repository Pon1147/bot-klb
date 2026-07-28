(function () {
  'use strict';

  const CONFIG = window.Pon1147.config;
  const { sleep, log } = window.Pon1147.utils;
  const { RedeemNetwork } = window.Pon1147.network;
  const { classify } = window.Pon1147.classifier;
  const {
    findInput,
    findButton,
    setValue,
    clickRedeem,
    getDialogMessage,
    closeDialog,
    clearOldMessage,
  } = window.Pon1147.dom;

  const redeemOne = async (code, idx, total) => {
    try {
      console.warn('[redeemOne] Starting:', code, idx, '/', total);
    } catch (e) {
      console.error('[redeemOne] Init error:', e);
    }
    for (let att = 1; att <= CONFIG.maxRetries + 1; att++) {
      await clearOldMessage();

      const input = findInput();
      const button = findButton();
      if (!input || !button) {
        log('WARN', `No UI: input=${!!input} btn=${!!button}`, code);
        return {
          stt: `${idx}/${total}`,
          code,
          status: 'OTHER',
          message: 'Không tìm thấy ô nhập hoặc nút Đổi',
        };
      }

      const attempt = RedeemNetwork.beginAttempt(code);

      setValue(input, '');
      await sleep(40);
      setValue(input, code);
      await sleep(60);

      let requestSent = false;
      for (let submitTry = 1; submitTry <= CONFIG.submitClickRetries + 1; submitTry++) {
        const btn = submitTry === 1 ? button : findButton();
        if (!btn) break;

        clickRedeem(btn);

        const confirmStart = Date.now();
        while (Date.now() - confirmStart < CONFIG.submitConfirmMs) {
          await sleep(40);

          if (RedeemNetwork.hasRequestStarted(attempt)) {
            requestSent = true;
            break;
          }

          if (RedeemNetwork.getNetworkMessage(attempt).text) {
            requestSent = true;
            break;
          }

          const dom = getDialogMessage();
          if (dom.text) {
            requestSent = true;
            break;
          }
        }
        if (requestSent) break;

        if (submitTry <= CONFIG.submitClickRetries) {
          log('WARN', `Click chưa tạo request, bấm lại (${submitTry})`, code);
        }
      }

      let msg = { source: '', text: '', rawCode: null };
      const start = Date.now();

      while (Date.now() - start < CONFIG.timeoutMs) {
        await sleep(CONFIG.pollMs);

        msg = RedeemNetwork.getNetworkMessage(attempt);
        if (msg.text) break;

        if (Date.now() - start >= 400) {
          const domMsg = getDialogMessage();
          if (domMsg.text) {
            msg = { source: domMsg.source, text: domMsg.text, rawCode: null };
            break;
          }
        }
      }

      let status = classify(msg.text);
      if (status === 'SUCCESS' && msg.source !== 'response') {
        status = 'NO_RESPONSE';
        msg = {
          source: msg.source,
          text: '(có popup thành công nhưng chưa bắt được phản hồi mạng)',
          rawCode: null,
        };
      }
      if (!msg.text) {
        status = 'NO_RESPONSE';
        msg = { source: '', text: 'Timeout / Không thấy phản hồi', rawCode: null };
      }

      log(
        'INFO',
        `Code=${msg.rawCode ?? '-'} Src=${msg.source || 'none'} Msg="${String(msg.text).slice(0, 70)}" → ${status}`,
        code,
      );

      closeDialog();
      RedeemNetwork.endAttempt();

      if (
        (status === 'TEMP_ERROR' ||
          (status === 'NO_RESPONSE' && !RedeemNetwork.hasRequestStarted(attempt))) &&
        att <= CONFIG.maxRetries
      ) {
        log('WARN', `Retry ${att}/${CONFIG.maxRetries}`, code);
        await sleep(900);
        continue;
      }

      return {
        stt: `${idx}/${total}`,
        code,
        status,
        message: msg.text,
      };
    }
  };

  window.Pon1147 = window.Pon1147 || {};
  window.Pon1147.redeem = { redeemOne };
})();
