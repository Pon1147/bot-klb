"use strict";
// DF Stable - TypeScript Version
(function () {
    console.clear();
    console.log('%c[DF Stable] Khởi động...', 'color:#0f0; font-weight:bold');
    // ==================== 1. DAILY PASSWORD ====================
    function getDailyPasswords() {
        const text = document.body.innerText;
        const passwords = {
            'Đập Nước Zero': (text.match(/Đập Nước Zero\s*(\d+)/) || [])[1],
            'Thung lũng Layali': (text.match(/Thung lũng Layali\s*(\d+)/) || [])[1],
            'Phố Cổ Brakkesh': (text.match(/Phố Cổ Brakkesh\s*(\d+)/) || [])[1],
            'Trạm Không Gian': (text.match(/Trạm Không Gian\s*(\d+)/) || [])[1],
            'Ngục Giam Thủy Triều': (text.match(/Ngục Giam Thủy Triều\s*(\d+)/) || [])[1],
        };
        console.log('%c[Daily Passwords]', 'color:#ffeb3b');
        console.table(passwords);
        return passwords;
    }
    getDailyPasswords();
    // ==================== 2. PLAYER DATA (API) ====================
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
        const url = args[0];
        if (url.includes('GetMyData')) {
            try {
                const res = await origFetch(...args);
                const clone = res.clone();
                clone.json().then((json) => {
                    if (json?.data) {
                        console.log('%c[Player Data]', 'color:#4caf50', json.data);
                    }
                });
                return res;
            }
            catch (e) {
                // ignore
            }
        }
        return origFetch(...args);
    };
    // Hook XHR
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._method = method;
        this._url = url;
        return origOpen.apply(this, arguments);
    };
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
        const url = this._url;
        if (url && url.includes('GetMyData')) {
            this.addEventListener('load', () => {
                try {
                    const json = JSON.parse(this.responseText);
                    if (json?.data) {
                        console.log('%c[Player Data]', 'color:#4caf50', json.data);
                    }
                }
                catch (e) {
                    // ignore
                }
            });
        }
        return origSend.apply(this, arguments);
    };
    console.log('%c[DF Stable] Đã lấy Daily Password + Player Data.', 'color:#0c0');
})();
