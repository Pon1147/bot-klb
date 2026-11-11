// Dynamic extension version from manifest
let extVersion = '1.6.0';
try {
  const manifest = typeof chrome !== 'undefined' && chrome?.runtime?.getManifest ? chrome.runtime.getManifest() : null;
  if (manifest?.version) {
    extVersion = manifest.version;
  }
} catch (_) {}

// Bilingual Dictionary (Tiếng Việt & English)
const TRANSLATIONS = {
  vi: {
    page_title: 'Chào mừng cài đặt DF Toolbox — Hướng Dẫn Sử Dụng',
    badge_prefix: '🎉 CÀI ĐẶT THÀNH CÔNG · v',
    hero_title: 'Chào Mừng Bạn Đến Với <span>DF Toolbox</span>',
    hero_desc: 'Tiện ích hỗ trợ tự động hóa Delta Force: Cầu nối liên kết tài khoản Discord, tra cứu thị trường thời gian thực và tự động nhập giftcode Garena siêu tốc.',
    tab_link: '1. Liên Kết Tài Khoản Bot',
    tab_redeem: '2. Tự Động Nhập Giftcode',
    tab_commands: '3. Danh Sách Lệnh Hot',

    // Tab 1: Link Guide
    link_step1_title: 'Lấy mã liên kết trên Discord',
    link_step1_desc: 'Mở kênh Discord có <strong>Bot Delta</strong>, gõ lệnh dưới đây. Bot sẽ phản hồi riêng (chỉ bạn nhìn thấy) kèm mã Claim 6 ký tự (ví dụ: <code>TAKCGF</code>, hiệu lực 10 phút):',
    copy_btn: 'Sao chép',
    copied_btn: '✓ Đã chép!',
    copy_err: 'Lỗi copy!',
    mock_channel: 'Discord — #bot-commands',
    mock_time: 'Hôm nay lúc 14:30',
    mock_embed_tag: '🔐 Khởi tạo liên kết tài khoản Delta Force HQ',
    mock_embed_body: 'Mã liên kết xác thực (hiệu lực 10 phút):',
    mock_claim_pill: 'Mã Claim: <span>TAKCGF</span>',
    mock_embed_hint: 'Hãy mở trang web Delta Force HQ và nhập mã trên để hoàn tất.',

    link_step2_title: 'Đăng nhập trang sự kiện Delta Force HQ',
    link_step2_desc: 'Truy cập trang web Delta Force HQ chính thức và tiến hành đăng nhập tài khoản Garena của bạn:',
    link_step2_btn: 'Mở Delta Force HQ (Garena) ↗',
    mock_hq_login: '👤 Đăng Nhập Garena ✓',

    link_step3_title: 'Nhập mã trên bảng tiện ích DF Toolbox',
    link_step3_desc: 'Sau khi đăng nhập xong, bảng tiện ích <strong>DF Toolbox — Link</strong> sẽ tự động xuất hiện ở góc dưới bên phải màn hình. Bạn dán mã Claim nhận từ Discord vào ô và bấm <strong>Liên kết Discord</strong>:',
    mock_panel_status: 'Đã capture! OpenID: 1002•••',
    mock_panel_btn: 'Liên kết Discord',
    mock_panel_hint: '<strong>🛡️ An toàn:</strong> Tuyệt đối không lưu mật khẩu<br>1. Gõ <strong>/df link start</strong> trên Discord để lấy mã 6 ký tự<br>2. Dán mã vào ô phía trên<br>3. Bấm nút <strong>Liên kết Discord</strong>',
    tip_manual_link: '💡 <em>Mẹo: Bạn cũng có thể mở icon DF Toolbox trên thanh tiện ích Chrome để dán mã Claim thủ công bất cứ lúc nào.</em>',

    link_step4_title: 'Kiểm tra trạng thái & Trải nghiệm',
    link_step4_desc: 'Quay lại Discord và gõ lệnh kiểm tra:',
    link_success_note: '✅ Khi đã liên kết thành công, bạn sẽ xem được đầy đủ thống kê K/D, lịch sử trận đấu, sảnh đồ đỏ và bảng giá chợ Garena đồng bộ từ máy chủ Garena!',

    // Tab 2: Auto Redeem
    redeem_step1_title: 'Ghim tiện ích lên thanh trình duyệt',
    redeem_step1_desc: 'Nhấp vào biểu tượng <strong>Mảnh ghép (Extensions)</strong> ở góc trên bên phải Chrome, tìm <strong>DF Toolbox</strong> và bấm biểu tượng chiếc <strong>Ghim (Pin)</strong> để tiện sử dụng.',
    redeem_step2_title: 'Lấy mã code hằng ngày từ Bot',
    redeem_step2_desc: 'Bot tự động cào và cập nhật mật khẩu, mã code két sắt map mỗi sáng. Hãy dùng lệnh:',
    redeem_step3_title: 'Mở trang nhập code & Bấm tự động',
    redeem_step3_desc1: 'Truy cập trang đổi mã quà tặng chính thức của Garena:',
    redeem_step3_btn: 'Mở Trang Đổi Code Garena ↗',
    redeem_step3_desc2: 'Mở popup <strong>DF Toolbox</strong>, dán danh sách mã code vào ô văn bản và bấm <strong>Bắt đầu tự động nhập</strong>. Tiện ích sẽ xử lý từng mã và báo cáo trạng thái thành công/thất bại theo thời gian thực:',
    mock_redeem_header: 'Tiện ích DF Toolbox — Auto Redeem',
    mock_redeem_status: '✓ Sẵn Sàng',
    mock_redeem_success1: 'Đã nhận quà thành công',
    mock_redeem_success2: 'Đã nhận quà thành công',
    mock_redeem_pending: 'Đang tự động xử lý...',
    mock_redeem_btn: '▶ Bắt Đầu Tự Động Nhập (3/3)',

    // Tab 3: Hot Commands
    cmd_market: 'Tra cứu bàn chế tác, chi phí, nguyên liệu và giá chợ thị trường realtime (tự động phân biệt Garena/Global).',
    cmd_stats: 'Xem thông số chiến đấu tổng quan: K/D, số giờ chơi, tỷ lệ rút quân an toàn & chuyển đổi mùa giải độc quyền.',
    cmd_history: 'Xem lịch sử các trận chiến gần nhất, chiến lợi phẩm loot mang ra & thông số K/D từng trận.',
    cmd_vault: 'Sảnh Triển Lãm Đồ Đỏ: Thống kê kho báu giá trị cao nhất, tổng tài sản Coin và bộ sưu tập đồ đỏ.',
    cmd_map: 'Mô phỏng bản đồ 3D tương tác: vị trí két sắt, điểm loot tài nguyên & lối thoát hiểm an toàn.',
    cmd_build: 'Thư viện build súng chuẩn Meta Garena, phân loại Hazard/Havoc và copy mã Gunsmith 1-chạm.',

    // Footer
    footer_p1: 'Phát triển bởi đội ngũ Bot Delta & Delta Force Community.',
    footer_p2: 'Tiện ích tuân thủ chuẩn Chrome Manifest V3 · Cam kết an toàn: Tuyệt đối không can thiệp hay lưu trữ mật khẩu/OTP.',
  },
  en: {
    page_title: 'Welcome to DF Toolbox — User Guide & Setup',
    badge_prefix: '🎉 INSTALLATION SUCCESSFUL · v',
    hero_title: 'Welcome to <span>DF Toolbox</span>',
    hero_desc: 'Delta Force automation utility: Discord account link bridge, real-time market tracker, and high-speed Garena gift code auto-redeemer.',
    tab_link: '1. Link Bot Account',
    tab_redeem: '2. Auto Redeem Giftcode',
    tab_commands: '3. Hot Commands List',

    // Tab 1: Link Guide
    link_step1_title: 'Get authentication link code on Discord',
    link_step1_desc: 'Open any Discord channel with <strong>Bot Delta</strong> and run the command below. The bot will send an ephemeral message (only visible to you) with a 6-character Claim code (e.g. <code>TAKCGF</code>, valid for 10 minutes):',
    copy_btn: 'Copy',
    copied_btn: '✓ Copied!',
    copy_err: 'Copy error!',
    mock_channel: 'Discord — #bot-commands',
    mock_time: 'Today at 2:30 PM',
    mock_embed_tag: '🔐 Initialize Delta Force HQ Account Link',
    mock_embed_body: 'Authentication link code (valid for 10 minutes):',
    mock_claim_pill: 'Claim Code: <span>TAKCGF</span>',
    mock_embed_hint: 'Open Delta Force HQ website and enter the code above to complete.',

    link_step2_title: 'Log in to Delta Force HQ event page',
    link_step2_desc: 'Visit the official Delta Force HQ website and log in to your Garena account:',
    link_step2_btn: 'Open Delta Force HQ (Garena) ↗',
    mock_hq_login: '👤 Garena Login ✓',

    link_step3_title: 'Enter code in DF Toolbox extension panel',
    link_step3_desc: 'After logging in, the <strong>DF Toolbox — Link</strong> panel will automatically appear in the bottom-right corner. Paste the Claim code from Discord and click <strong>Link Discord</strong>:',
    mock_panel_status: 'Captured! OpenID: 1002•••',
    mock_panel_btn: 'Link Discord',
    mock_panel_hint: '<strong>🛡️ Secure:</strong> Never stores passwords<br>1. Type <strong>/df link start</strong> on Discord for a 6-character code<br>2. Paste code into the box above<br>3. Click <strong>Link Discord</strong>',
    tip_manual_link: '💡 <em>Tip: You can also click the DF Toolbox icon in Chrome toolbar to paste your Claim code manually anytime.</em>',

    link_step4_title: 'Verify Status & Enjoy',
    link_step4_desc: 'Return to Discord and run the status check command:',
    link_success_note: '✅ Once linked successfully, you can view your full K/D stats, match history, red vault showcase, and live Garena market prices synchronized from Garena servers!',

    // Tab 2: Auto Redeem
    redeem_step1_title: 'Pin extension to browser toolbar',
    redeem_step1_desc: 'Click the <strong>Puzzle icon (Extensions)</strong> at the top right of Chrome, find <strong>DF Toolbox</strong>, and click the <strong>Pin</strong> icon for easy access.',
    redeem_step2_title: 'Get daily codes from Bot',
    redeem_step2_desc: 'The bot automatically scrapes and updates daily safe vault passwords every morning. Use command:',
    redeem_step3_title: 'Open redemption page & Click auto-redeem',
    redeem_step3_desc1: 'Visit the official Garena gift code redemption page:',
    redeem_step3_btn: 'Open Garena Redeem Page ↗',
    redeem_step3_desc2: 'Open <strong>DF Toolbox</strong> popup, paste your list of codes into the text area, and click <strong>Start Auto-Redeem</strong>. The extension processes each code and reports real-time success/failure status:',
    mock_redeem_header: 'DF Toolbox Extension — Auto Redeem',
    mock_redeem_status: '✓ Ready',
    mock_redeem_success1: 'Reward redeemed successfully',
    mock_redeem_success2: 'Reward redeemed successfully',
    mock_redeem_pending: 'Processing automatically...',
    mock_redeem_btn: '▶ Start Auto-Redeem (3/3)',

    // Tab 3: Hot Commands
    cmd_market: 'Look up crafting bench recipes, costs, materials, and real-time market prices (auto Garena/Global).',
    cmd_stats: 'View overall combat identity: K/D, playtime, extraction rate, and exclusive season switcher.',
    cmd_history: 'View recent match history, extracted loot value, and per-match combat K/D.',
    cmd_vault: 'Red Vault Showcase: High-value treasure collection, total Coin valuation, and red item showcase.',
    cmd_map: 'Interactive 3D map simulator: safe vault locations, resource loot spots, and extraction points.',
    cmd_build: 'Garena meta weapon build library, categorized by Hazard/Havoc with 1-click Gunsmith copy.',

    // Footer
    footer_p1: 'Developed by Bot Delta Team & Delta Force Community.',
    footer_p2: 'Compliant with Chrome Manifest V3 · Security guarantee: Zero password or OTP storage/tampering.',
  }
};

let currentLang = 'vi';

function setLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'vi';
  const t = TRANSLATIONS[currentLang];

  document.documentElement.lang = currentLang;
  document.title = t.page_title;

  // Cập nhật hero badge
  const badgeEl = document.querySelector('.hero-badge');
  if (badgeEl) {
    const versionMatch = badgeEl.textContent.match(/v[\d.]+/);
    const ver = versionMatch ? versionMatch[0].replace(/^v/, '') : extVersion;
    badgeEl.textContent = `${t.badge_prefix}${ver}`;
  }

  // Cập nhật toàn bộ các phần tử có data-i18n
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (t[key]) {
      el.innerHTML = t[key];
    }
  });

  // Cập nhật text của copy buttons
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.dataset.originalText = t.copy_btn;
    if (!btn.classList.contains('copied')) {
      btn.textContent = t.copy_btn;
    }
    btn.setAttribute('aria-label', `${t.copy_btn} ${btn.dataset.copy || ''}`);
  });

  // Cập nhật trạng thái active của buttons chuyển đổi ngôn ngữ
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    const isActive = btn.dataset.lang === currentLang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  try {
    localStorage.setItem('df_welcome_lang', currentLang);
  } catch (_) {}
}

// Khởi tạo ngôn ngữ đã lưu hoặc mặc định
try {
  const saved = localStorage.getItem('df_welcome_lang');
  if (saved === 'en' || saved === 'vi') {
    currentLang = saved;
  }
} catch (_) {}

// Gán sự kiện click cho các nút chuyển ngôn ngữ
document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    if (lang && lang !== currentLang) {
      setLanguage(lang);
    }
  });
});

// Chạy setLanguage lần đầu khi load DOM
setLanguage(currentLang);

// Tab switching logic with full WAI-ARIA and roving tabindex
const tabs = Array.from(document.querySelectorAll('.tab-btn'));
const panels = Array.from(document.querySelectorAll('.tab-content'));

function activateTab(targetBtn) {
  if (!targetBtn) return;
  const targetId = `tab-${targetBtn.dataset.tab}`;

  tabs.forEach((btn) => {
    const isTarget = btn === targetBtn;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    btn.setAttribute('tabindex', isTarget ? '0' : '-1');
  });

  panels.forEach((panel) => {
    const isTarget = panel.id === targetId;
    panel.classList.toggle('active', isTarget);
    if (isTarget) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  });

  targetBtn.focus();
}

tabs.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    activateTab(btn);
  });

  // Arrow key navigation (automatic activation)
  btn.addEventListener('keydown', (e) => {
    let targetIndex = null;

    if (e.key === 'ArrowRight') {
      targetIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = tabs.length - 1;
    }

    if (targetIndex !== null) {
      e.preventDefault();
      activateTab(tabs[targetIndex]);
    }
  });
});

// Robust Copy to Clipboard with timer tracking and no text-stuck bug
document.querySelectorAll('.copy-btn').forEach((btn) => {
  if (!btn.dataset.originalText) {
    btn.dataset.originalText = btn.textContent.trim();
  }

  btn.addEventListener('click', async () => {
    const textToCopy = btn.dataset.copy;
    if (!textToCopy) return;

    // Clear any pending timeout from previous rapid clicks
    if (btn._copyTimeout) {
      clearTimeout(btn._copyTimeout);
      btn._copyTimeout = null;
    }

    const t = TRANSLATIONS[currentLang] || TRANSLATIONS.vi;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for non-secure / restricted environments
        const tempInput = document.createElement('textarea');
        tempInput.value = textToCopy;
        tempInput.setAttribute('readonly', '');
        tempInput.style.position = 'absolute';
        tempInput.style.left = '-9999px';
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }

      btn.classList.add('copied');
      btn.textContent = t.copied_btn;

      btn._copyTimeout = setTimeout(() => {
        btn.textContent = t.copy_btn;
        btn.classList.remove('copied');
        btn._copyTimeout = null;
      }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      btn.textContent = t.copy_err;
      btn._copyTimeout = setTimeout(() => {
        btn.textContent = t.copy_btn;
        btn._copyTimeout = null;
      }, 2000);
    }
  });
});
