(async () => {
  const SOURCE = {
    name: "Nghẹo Game",
    website: "https://ngheogame.com/",
    discord: "https://discord.gg/BuZWYtNwyf"
  };

  const raw = prompt("Dán danh sách code vào đây, mỗi code một dòng:");
  if (!raw || !raw.trim()) return console.warn("Chưa nhập code nào.");

  const CODES = raw.split(/\n+/).map(x => x.trim()).filter(Boolean);
  document.getElementById("garena-redeem-summary-panel")?.remove();

  const CONFIG = {
    maxRetries: 0,
    delayBetweenCodesMs: 1000,
    timeoutMs: 2000,
    retryDelayMs: 1000,
    pollMs: 100,
    submitClickRetries: 1,
    submitConfirmMs: 350
  };

  if (typeof window.__garenaRedeemRestoreHooks === "function") {
    try {
      window.__garenaRedeemRestoreHooks();
    } catch (_) {}
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const requestStarts = [];
  const pageResponses = [];
  const networkResponses = [];
  const originalConsoleLog = console.log.bind(console);
  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  const originalXhrOpen = window.XMLHttpRequest && XMLHttpRequest.prototype.open;
  const originalXhrSend = window.XMLHttpRequest && XMLHttpRequest.prototype.send;
  let hooksRestored = false;
  let activeAttempt = null;
  let attemptCounter = 0;

  const restoreHooks = () => {
    if (hooksRestored) return;

    console.log = originalConsoleLog;
    if (originalFetch) window.fetch = originalFetch;
    if (originalXhrOpen && originalXhrSend) {
      XMLHttpRequest.prototype.open = originalXhrOpen;
      XMLHttpRequest.prototype.send = originalXhrSend;
    }

    hooksRestored = true;
    if (window.__garenaRedeemRestoreHooks === restoreHooks) {
      delete window.__garenaRedeemRestoreHooks;
    }
  };

  window.__garenaRedeemRestoreHooks = restoreHooks;

  const findCodeInPayload = payload => {
    if (payload == null) return "";

    if (typeof Request !== "undefined" && payload instanceof Request) {
      return findCodeInPayload(payload.url);
    }

    if (typeof URLSearchParams !== "undefined" && payload instanceof URLSearchParams) {
      return findCodeInPayload(payload.toString());
    }

    if (typeof FormData !== "undefined" && payload instanceof FormData) {
      return findCodeInPayload([...payload.entries()].map(([key, value]) => `${key}=${value}`).join("&"));
    }

    if (Array.isArray(payload)) {
      return payload.map(findCodeInPayload).find(Boolean) || "";
    }

    if (typeof payload === "object") {
      try {
        return findCodeInPayload(JSON.stringify(payload));
      } catch (_) {
        return "";
      }
    }

    const text = String(payload);
    return [...CODES].sort((a, b) => b.length - a.length).find(code => text.includes(code)) || "";
  };

  const captureResponse = (data, meta = {}) => {
    if (
      meta.attemptId &&
      meta.requestCode &&
      data &&
      typeof data === "object" &&
      "code" in data &&
      ("msg" in data || "code_type" in data)
    ) {
      networkResponses.push({
        time: Date.now(),
        data,
        attemptId: meta.attemptId || null,
        requestCode: meta.requestCode || ""
      });
    }
  };

  const captureRequestStart = meta => {
    if (meta.attemptId && meta.requestCode) {
      requestStarts.push({
        time: Date.now(),
        attemptId: meta.attemptId,
        requestCode: meta.requestCode
      });
    }
  };

  console.log = (...args) => {
    for (const arg of args) {
      if (arg && typeof arg === "object" && "code" in arg && ("msg" in arg || "code_type" in arg)) {
        pageResponses.push({
          time: Date.now(),
          data: arg,
          attemptId: activeAttempt?.id || null
        });
      }
    }

    return originalConsoleLog(...args);
  };

  if (originalFetch) {
    window.fetch = async (...args) => {
      const attempt = activeAttempt ? { ...activeAttempt } : null;
      const requestCode = findCodeInPayload(args);
      captureRequestStart({
        attemptId: attempt?.id,
        requestCode
      });
      const response = await originalFetch(...args);

      response.clone().json()
        .then(data => captureResponse(data, {
          attemptId: attempt?.id,
          requestCode
        }))
        .catch(() => {});

      return response;
    };
  }

  if (originalXhrOpen && originalXhrSend) {
    XMLHttpRequest.prototype.open = function (...args) {
      this.__garenaRedeemUrl = args[1];
      return originalXhrOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      const attempt = activeAttempt ? { ...activeAttempt } : null;
      const requestCode = findCodeInPayload([this.__garenaRedeemUrl, args[0]]);
      captureRequestStart({
        attemptId: attempt?.id,
        requestCode
      });

      this.addEventListener("loadend", () => {
        try {
          if (typeof this.responseText === "string" && this.responseText.trim()) {
            captureResponse(JSON.parse(this.responseText), {
              attemptId: attempt?.id,
              requestCode
            });
          }
        } catch (_) {}
      });

      return originalXhrSend.apply(this, args);
    };
  }

  const visible = el => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
  };

  const setValue = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  };

  const findInput = () => document.querySelector(".exc-input") ||
    [...document.querySelectorAll("input")].find(el => visible(el) && !el.disabled && !el.readOnly);

  const findButton = () => document.querySelector(".btn-exchange") ||
    [...document.querySelectorAll("a,button")].find(el => visible(el) && el.innerText.trim() === "Đổi");

  if (!findInput() || !findButton()) {
    console.error("Không tìm thấy ô nhập hoặc nút Đổi.");
    restoreHooks();
    return;
  }

  const getMessage = () => {
    const dialog = [...document.querySelectorAll('[role="dialog"], .dialog, .pop, .popup, .modal')]
      .find(visible);

    if (dialog) {
      const text = (dialog.innerText || dialog.textContent || "").replace(/\s+/g, " ").trim();
      if (text) return { source: "dialog", text };
    }

    const tip = document.querySelector("#superTips, .super-tips");
    if (tip && (tip.innerText || tip.textContent || "").trim()) {
      return {
        source: "tip",
        text: (tip.innerText || tip.textContent || "").replace(/\s+/g, " ").trim()
      };
    }

    return { source: "", text: "" };
  };

  const getResponseMessage = attempt => {
    const item = networkResponses
      .filter(x => x.attemptId === attempt.id && x.requestCode === attempt.code)
      .sort((a, b) => a.time - b.time)[0];
    if (!item) return { source: "", text: "" };

    const response = item.data;
    const responseCode = Number(response.code);

    if (responseCode === 0) {
      return { source: "response", text: "ok" };
    }

    if (Number.isFinite(responseCode)) {
      return { source: "response", text: `error_hint_${responseCode}` };
    }

    return { source: "response", text: String(response.msg || "") };
  };

  const hasRequestStarted = attempt => requestStarts
    .some(x => x.attemptId === attempt.id && x.requestCode === attempt.code);

  const clickRedeem = button => {
    if (typeof MouseEvent !== "function") {
      button.click();
      return;
    }

    button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    button.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true, view: window }));
    button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    button.click();
  };

  const closeDialog = () => {
    const dialog = [...document.querySelectorAll('[role="dialog"], .dialog, .pop, .popup, .modal')]
      .find(visible);
    if (!dialog) return;

    const closeBtn =
      dialog.querySelector("a[href='javascript:void(0);'], a[href='javascript:void(0)'], .close, .btn-close") ||
      [...dialog.querySelectorAll("a,button")].find(visible);

    if (closeBtn) closeBtn.click();
  };

  const clearOldMessage = async () => {
    const tip = document.querySelector("#superTips, .super-tips");
    if (tip) tip.textContent = "";
    closeDialog();
    await sleep(120);
    if (tip) tip.textContent = "";
    closeDialog();
  };

  const classify = msg => {
    const t = (msg || "").toLowerCase();

    if (/^ok$|thành công|success/.test(t)) return "SUCCESS";
    if (/error_hint_400067|reached the redemption limit|limit of cdkey group|đạt giới hạn/.test(t)) return "LIMIT_REACHED";
    if (/error_hint_400068|hết hạn|expired/.test(t)) return "EXPIRED";
    if (/error_hint_400073|current cdkey present error/.test(t)) return "PRESENT_ERROR";
    if (/không hợp lệ|invalid|sai|current cdk does not match|error_hint_400054/.test(t)) return "INVALID";
    if (/đã.*(nhận|sử dụng)|already|used/.test(t)) return "USED";
    if (/captcha|xác minh|verification/.test(t)) return "VERIFY";
    if (/lỗi mạng|network|rate|quá nhanh|too fast/.test(t)) return "TEMP_ERROR";

    return msg ? "OTHER" : "NO_RESPONSE";
  };

  const STATUS_LABELS = {
    SUCCESS: "Thành công",
    LIMIT_REACHED: "Đã sử dụng",
    EXPIRED: "Hết hạn",
    PRESENT_ERROR: "Lỗi quà",
    INVALID: "Không hợp lệ",
    USED: "Đã dùng",
    VERIFY: "Cần xác minh",
    TEMP_ERROR: "Lỗi tạm thời",
    NO_RESPONSE: "Không thấy phản hồi",
    OTHER: "Khác"
  };

  const statusLabel = status => STATUS_LABELS[status] || status;

  const displayMessage = result => {
    if (result.status === "SUCCESS" && result.message === "ok") return "Đã nhận thành công";
    return result.message;
  };

  const style = {
    title: "background:#00ffc8;color:#001b16;font-weight:700;padding:3px 8px;border-radius:4px",
    run: "color:#00c8ff;font-weight:700",
    ok: "color:#00e676;font-weight:700",
    bad: "color:#ff5252;font-weight:700",
    warn: "color:#ffc400;font-weight:700",
    info: "color:#b388ff;font-weight:700"
  };

  const statusStyle = status => {
    if (status === "SUCCESS") return style.ok;
    if (["INVALID", "EXPIRED"].includes(status)) return style.bad;
    if (["LIMIT_REACHED", "PRESENT_ERROR", "TEMP_ERROR", "NO_RESPONSE", "VERIFY"].includes(status)) return style.warn;
    return style.info;
  };

  const redeemOne = async (code, index, total) => {
    const attempts = [];

    for (let attempt = 1; attempt <= CONFIG.maxRetries + 1; attempt++) {
      await clearOldMessage();

      const currentInput = findInput();
      const currentButton = findButton();

      if (!currentInput || !currentButton) {
        const status = "OTHER";
        const message = "Không tìm thấy ô nhập hoặc nút Đổi.";

        attempts.push({
          attempt,
          status,
          messageSource: "script",
          message
        });

        return {
          stt: `${index}/${total}`,
          code,
          status,
          message,
          attempts
        };
      }

      setValue(currentInput, "");
      await sleep(50);
      setValue(currentInput, code);
      await sleep(80);

      console.log(
        `%c[${index}/${total}] Đang chạy%c ${code}${attempt > 1 ? ` | thử lại ${attempt}` : ""}`,
        style.run,
        "color:inherit"
      );

      requestStarts.length = 0;
      pageResponses.length = 0;
      networkResponses.length = 0;
      const start = Date.now();
      const attemptMeta = {
        id: ++attemptCounter,
        code,
        startedAt: start
      };

      activeAttempt = attemptMeta;

      let requestSent = false;
      for (let submitTry = 1; submitTry <= CONFIG.submitClickRetries + 1; submitTry++) {
        const submitButton = submitTry === 1 ? currentButton : findButton();
        if (!submitButton) break;

        clickRedeem(submitButton);

        const confirmStart = Date.now();
        while (Date.now() - confirmStart < CONFIG.submitConfirmMs) {
          await sleep(50);
          if (hasRequestStarted(attemptMeta) || getResponseMessage(attemptMeta).text) {
            requestSent = true;
            break;
          }
        }

        if (requestSent) break;

        if (submitTry <= CONFIG.submitClickRetries) {
          console.log(
            `%c[${index}/${total}] Click chưa tạo request, bấm lại%c ${code}`,
            style.warn,
            "color:inherit"
          );
        }
      }

      let msg = { source: "", text: "" };

      while (Date.now() - start < CONFIG.timeoutMs) {
        await sleep(CONFIG.pollMs);

        msg = getResponseMessage(attemptMeta);
        if (msg.text) break;

        if (Date.now() - start >= 500) {
          msg = getMessage();
          if (msg.text) break;
        }
      }

      let status = classify(msg.text);
      if (status === "SUCCESS" && msg.source !== "response") {
        status = "NO_RESPONSE";
        msg = {
          source: msg.source,
          text: "(có popup thành công nhưng chưa bắt được phản hồi mạng để xác nhận)"
        };
      }

      closeDialog();
      if (activeAttempt?.id === attemptMeta.id) activeAttempt = null;

      attempts.push({
        attempt,
        status,
        messageSource: msg.source,
        message: msg.text || "(không thấy phản hồi)"
      });

      if (!["TEMP_ERROR", "NO_RESPONSE"].includes(status)) {
        return {
          stt: `${index}/${total}`,
          code,
          status,
          message: msg.text || "(không thấy phản hồi)",
          attempts
        };
      }

      if (attempt <= CONFIG.maxRetries) await sleep(CONFIG.retryDelayMs);
    }

    const last = attempts.at(-1);
    return {
      stt: `${index}/${total}`,
      code,
      status: last.status,
      message: last.message,
      attempts
    };
  };

  const copyText = async text => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  const runBatch = async (codes, title) => {
    const batchResults = [];
    const total = codes.length;

    if (title) {
      console.log("----------------------------------------");
      console.log(`%c${title}`, style.title);
    }

    for (let i = 0; i < total; i++) {
      const result = await redeemOne(codes[i], i + 1, total);
      batchResults.push(result);

      console.log(
        `%c[${result.stt}] ${statusLabel(result.status)}%c ${result.code}: ${displayMessage(result)}`,
        statusStyle(result.status),
        "color:inherit"
      );

      await sleep(CONFIG.delayBetweenCodesMs);
    }

    return batchResults;
  };

  const showNoResponsePanel = (results, onRerun) => {
    document.getElementById("garena-redeem-summary-panel")?.remove();

    const noResponseCodes = results
      .filter(r => r.status === "NO_RESPONSE")
      .map(r => r.code);

    const panel = document.createElement("div");
    panel.id = "garena-redeem-summary-panel";
    panel.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:999999",
      "width:min(360px,calc(100vw - 36px))",
      "background:#08110f",
      "color:#f4fff9",
      "border:1px solid #18ffc0",
      "box-shadow:0 14px 44px rgba(0,0,0,.45)",
      "font:14px/1.45 Arial,sans-serif",
      "padding:14px",
      "box-sizing:border-box"
    ].join(";");

    const title = document.createElement("div");
    title.textContent = noResponseCodes.length
      ? `Cần kiểm tra lại: ${noResponseCodes.length} code không thấy phản hồi`
      : "Hoàn tất: không có code mất phản hồi";
    title.style.cssText = "font-weight:700;color:#18ffc0;margin-bottom:8px";

    const desc = document.createElement("div");
    desc.textContent = noResponseCodes.length
      ? "Khuyến nghị: chạy lại riêng nhóm này để tránh bỏ sót do mạng/web phản hồi chậm."
      : "Tất cả code đều đã có phản hồi rõ ràng.";
    desc.style.cssText = "margin-bottom:12px;color:#d7fff2";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";

    const makeButton = (text, bg, color = "#001b16") => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      btn.style.cssText = [
        "border:0",
        "padding:8px 10px",
        "cursor:pointer",
        "font-weight:700",
        `background:${bg}`,
        `color:${color}`
      ].join(";");
      return btn;
    };

    if (noResponseCodes.length) {
      const rerunBtn = makeButton("Chạy lại code không phản hồi", "#18ffc0");
      rerunBtn.onclick = async () => {
        rerunBtn.disabled = true;
        rerunBtn.textContent = "Đang chạy lại...";

        const rerunStartedAt = new Date();
        const rerunResults = await onRerun(noResponseCodes);
        const rerunEndedAt = new Date();

        window.__garenaRedeemResults.reruns = window.__garenaRedeemResults.reruns || [];
        window.__garenaRedeemResults.reruns.push({
          startedAt: rerunStartedAt,
          endedAt: rerunEndedAt,
          results: rerunResults
        });

        console.log("----------------------------------------");
        console.log("%cTỔNG KẾT CHẠY LẠI", style.title);
        console.table(rerunResults.map(r => ({
          STT: r.stt,
          code: r.code,
          "trạng thái": statusLabel(r.status),
          "thông báo": displayMessage(r)
        })));

        showNoResponsePanel(rerunResults, onRerun);
        if (!rerunResults.some(r => r.status === "NO_RESPONSE")) restoreHooks();
      };

      const copyBtn = makeButton("Copy danh sách", "#25352f", "#f4fff9");
      copyBtn.onclick = async () => {
        await copyText(noResponseCodes.join("\n"));
        copyBtn.textContent = "Đã copy";
      };

      actions.append(rerunBtn, copyBtn);
    } else {
      const closeBtn = makeButton("Đóng", "#18ffc0");
      closeBtn.onclick = () => {
        panel.remove();
        restoreHooks();
      };
      actions.append(closeBtn);
    }

    const restoreBtn = makeButton("Tắt bảng", "#25352f", "#f4fff9");
    restoreBtn.onclick = () => {
      panel.remove();
      restoreHooks();
    };
    actions.append(restoreBtn);

    panel.append(title, desc, actions);
    document.body.appendChild(panel);
  };

  let keepHooksForRerun = false;

  try {
    const total = CODES.length;
    const startedAt = new Date();

    console.log("%cTỰ ĐỘNG ĐỔI CODE DELTA FORCE - BẢN ỔN ĐỊNH", style.title);
    console.log(`Nguồn: ${SOURCE.name}`);
    console.log(`Website: ${SOURCE.website}`);
    console.log(`Discord: ${SOURCE.discord}`);
    console.log(`Tổng code: ${total}`);
    console.log(`Nghỉ giữa code: ${CONFIG.delayBetweenCodesMs}ms | Chờ phản hồi: ${CONFIG.timeoutMs}ms | Thử lại tối đa: ${CONFIG.maxRetries}`);
    console.log("----------------------------------------");

    const results = await runBatch(CODES);

    const endedAt = new Date();

    console.log("----------------------------------------");
    console.log("%cHOÀN TẤT", style.title);
    console.log(`Nguồn: ${SOURCE.name}`);
    console.log(`Website: ${SOURCE.website}`);
    console.log(`Discord: ${SOURCE.discord}`);
    console.log(`Bắt đầu: ${startedAt.toLocaleString()}`);
    console.log(`Kết thúc: ${endedAt.toLocaleString()}`);

    console.table(results.map(r => ({
      STT: r.stt,
      code: r.code,
      "trạng thái": statusLabel(r.status),
      "thông báo": displayMessage(r)
    })));

    window.__garenaRedeemResults = {
      source: SOURCE,
      config: CONFIG,
      startedAt,
      endedAt,
      results
    };

    console.log("Kết quả lưu tại: window.__garenaRedeemResults");
    showNoResponsePanel(results, codes => runBatch(codes, "CHẠY LẠI CODE KHÔNG THẤY PHẢN HỒI"));
    keepHooksForRerun = results.some(r => r.status === "NO_RESPONSE");
  } finally {
    if (!keepHooksForRerun) restoreHooks();
  }
})();