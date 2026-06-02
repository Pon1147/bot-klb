// DF Stable - TypeScript Version

interface DailyPasswords {
  'Đập Nước Zero': string | undefined;
  'Thung lũng Layali': string | undefined;
  'Phố Cổ Brakkesh': string | undefined;
  'Trạm Không Gian': string | undefined;
  'Ngục Giam Thủy Triều': string | undefined;
}

interface PlayerData {
  player_info?: {
    avatar?: string;
    level?: number;
    nickname?: string;
    play_duration?: string;
    register_time?: string;
  };
  rank_data?: {
    current_rank?: string;
    current_rank_score?: number;
    highest_rank?: string;
    highest_rank_season_id?: number;
  };
  summary_data?: any;
}

(function (): void {
  console.clear();
  console.log('%c[DF Stable] Khởi động...', 'color:#0f0; font-weight:bold');

  // ==================== 1. DAILY PASSWORD ====================
  function getDailyPasswords(): DailyPasswords {
    const text = document.body.innerText;

    const passwords: DailyPasswords = {
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

  window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
    const url = args[0] as string;

    if (url.includes('GetMyData')) {
      try {
        const res = await origFetch(...args);
        const clone = res.clone();

        clone.json().then((json: { data?: PlayerData }) => {
          if (json?.data) {
            console.log('%c[Player Data]', 'color:#4caf50', json.data);
          }
        });

        return res;
      } catch (e) {
        // ignore
      }
    }

    return origFetch(...args);
  };

  // Hook XHR
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: any[]
  ): void {
    (this as any)._method = method;
    (this as any)._url = url;
    return origOpen.apply(this, arguments as any);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
    const url = (this as any)._url as string;

    if (url && url.includes('GetMyData')) {
      this.addEventListener('load', () => {
        try {
          const json: { data?: PlayerData } = JSON.parse(this.responseText);
          if (json?.data) {
            console.log('%c[Player Data]', 'color:#4caf50', json.data);
          }
        } catch (e) {
          // ignore
        }
      });
    }

    return origSend.apply(this, arguments as any);
  };

  console.log('%c[DF Stable] Đã lấy Daily Password + Player Data.', 'color:#0c0');
})();
