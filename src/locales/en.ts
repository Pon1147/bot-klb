/**
 * English Language Dictionary for International Users.
 * Typed TypeScript const object with strict fallbacks.
 */

export const EN_LOCALE = {
  // ─── Help Center Headers & Intent Prose ───
  help: {
    title: 'Help Center — Bot Delta',
    page_indicator: 'Page {current} / {total}',
    footer:
      '> **Bot Delta v{botVersion}** • **DF Toolbox v{extVersion}** • Author: **Pon1147** • [Support](https://discord.gg/vz6w6c3Xe3)',
    user_isolation_error: 'You cannot interact with another user’s help session.',

    // Option Labels for Select Menu
    options: {
      overview_label: '1. Overview & Quickstart',
      overview_desc: 'Introduction to Bot Delta, quickstart guide & extension',
      stats_label: '2. Combat Profiles & Stats',
      stats_desc: 'Combat records, K/D, match history & red item collection',
      tactics_label: '3. Tactics, Maps & Weapon Builds',
      tactics_desc: '3D interactive maps, meta gun builds, safe vault codes',
      link_label: '4. Utilities & Account Linking',
      link_desc: 'Link Delta Force HQ account & auto-claim Garena giftcodes',
      payment_label: '5. Payments & Donations',
      payment_desc: 'Generate VietQR payment invoices & support bot development',
      admin_label: '6. Server Administration',
      admin_desc: 'Manage RBAC, VietQR workflow, auto-posting & notices',
    },

    // Page Specific Written Prose
    pages: {
      1: {
        heading: '# Help Center — Bot Delta',
        intro:
          '**Bot Delta** is a dedicated Discord assistant for **Delta Force (Garena Server)** players.\n🌐 **Bilingual Support**: Seamlessly adapts to your Discord client language (Vietnamese ⟷ English).',
        step_title: '### 3 Quick Steps to Get Started:',
        step_1:
          '1. **`/df link start`**: Get your link token & install the **DF Toolbox** extension.',
        step_2:
          '2. **`/df stats`**: View your combat identity card (K/D, survival rate, rank, matches).',
        step_3: '3. **`/df code show`**: Access today’s safe vault codes across all 6 maps.',
        nav_title: '### Navigation Guide:',
        nav_1: '• Select functional categories using the **Dropdown Menu** below.',
        nav_2: '• Use **[ Previous ]** / **[ Next ]** buttons to navigate through pages.',
        nav_3:
          '• Click **[ Download Extension ]** to get the DF Toolbox installation file directly.',
      },
      2: {
        heading: '# Combat Profiles & Player Stats',
        note: '*Note: You must link your account using `/df link start` for the bot to fetch stats from Delta Force HQ.*',
      },
      3: {
        heading: '# Tactics, Maps & Weapon Meta',
        note: '',
      },
      4: {
        heading: '# DF Toolbox & Account Linking',
        intro:
          '**DF Toolbox** is a lightweight Chrome Extension for seamless game data sync & automated giftcode redemption.',
        features_title: '### Key Highlights:',
        feature_1:
          '• **Auto-Claim 277+ Garena Giftcodes**: Automatically scans and redeems all active codes in 1 click.',
        feature_2:
          '• **Secure Token Extraction**: End-to-end encrypted with AES-256-GCM without exposing your password.',
        feature_3:
          '• **Real-time Sync**: Keeps match history and extraction trophies up to date after every deployment.',
        install_title: '### Quick Installation Guide (Requires PC/Laptop):',
        install_1: '1. Click **[ Download Extension ]** below to download `DF-Extension.zip`.',
        install_2: '2. Extract the downloaded `.zip` file into a local folder on your computer.',
        install_3:
          '3. Open Chrome/Edge -> Navigate to `chrome://extensions/` -> Enable **Developer mode**.',
        install_4: '4. Click **Load unpacked** -> Select the extracted folder to complete setup.',
      },
      5: {
        heading: '# VietQR Payments & Donations',
        intro:
          'Automated payment processing with VietQR (NAPAS 247) and donation support via PayOS gateway.',
        vietqr_title: '### Customer Orders & Invoices:',
        donate_title: '### Support Bot Development (Donate):',
        donate_desc:
          '• Run `/donate [amount]` to create a PayOS payment link to support bot infrastructure costs.',
      },
      6: {
        heading: '# Server Administration & Bot Operations',
        intro:
          'Administrative commands reserved for **Server Owners**, **Administrators**, and designated **Moderators**.',
      },
    },
  },

  // ─── Descriptions & Examples for End-User Commands ───
  commands: {
    'df.stats': {
      desc: 'Display combat identity card (K/D, extraction rate, rank tier, matches) & season selector.',
      example: '/df stats season:s4 player:123456789012345678',
    },
    'df.daily': {
      desc: 'Comprehensive summary report of your combat performance today.',
      example: '/df daily',
    },
    'df.history': {
      desc: 'View recent match history for the last 1–20 deployments (operator, map, extraction result).',
      example: '/df history limit:10',
    },
    'df.match': {
      desc: 'Inspect detailed results of a specific match (with auto-suggested recent 5 matches).',
      example: '/df match match_id:1234567890',
    },
    'df.vault': {
      desc: 'Red Item Trophy Hall — Showcase of rare treasures extracted & appraisal valuation.',
      example: '/df vault',
    },
    'df.map': {
      desc: 'Map tactical guides, safe locations, evacuation routes & 3D simulation links at deltaforcetools.gg.',
      example: '/df map map_name:zero_dam',
    },
    'df.build': {
      desc: 'Garena meta weapon build library with mode/class filtering and 1-tap code copy.',
      example: '/df build weapon:m4a1 mode:havoc',
    },
    'df.gun': {
      desc: 'Quick search for meta weapon loadouts by gun name and game mode.',
      example: '/df gun weapon:m4a1',
    },
    'df.gift-code': {
      desc: 'Get 280 starter giftcodes and tools to auto-redeem rewards on Garena.',
      example: '/df gift-code',
    },
    'df.code.show': {
      desc: 'Today’s safe vault combination codes for all 6 maps (auto-updated daily).',
      example: '/df code show page:1',
    },
    'df.code.status': {
      desc: 'Check the status of today’s safe vault codes synchronization.',
      example: '/df code status',
    },
    'df.market': {
      desc: 'Check market commodity prices & workbench crafting profit margins from the HQ API.',
      example: '/df market item:titanium',
    },
    'df.workshop': {
      desc: 'View optimal crafting recommendations at the Underground Base Workshop.',
      example: '/df workshop',
    },
    'df.link.start': {
      desc: 'Initiate a Delta Force HQ account linking session and download DF Toolbox.',
      example: '/df link start',
    },
    'df.link.status': {
      desc: 'Check the current linking status of your Delta Force HQ account.',
      example: '/df link status',
    },
    'df.unlink': {
      desc: 'Unlink your Delta Force HQ account from your Discord identity.',
      example: '/df unlink',
    },
    'df.help': {
      desc: 'Display the comprehensive user guide and help manual for Bot Delta.',
      example: '/df help',
    },
    'team.find': {
      desc: 'Post or find squad recruitment for rank climb by map, mode & automated voice dispatch.',
      example: '/team find map:dam rank:diamond mic:true',
    },
    'pay.create': {
      desc: 'Create an automated VietQR bank transfer payment invoice.',
      example: '/pay create amount:50000 description:ServiceInvoice',
    },
    'pay.history': {
      desc: 'View your VietQR transaction payment history in this server.',
      example: '/pay history',
    },
    'pay.top': {
      desc: 'View top spending and supporter leaderboards in this server.',
      example: '/pay top',
    },
    donate: {
      desc: 'Generate a PayOS payment link to support bot server operating costs.',
      example: '/donate amount:20000',
    },

    // ─── Administration & Configuration Commands (BM-01 & BM-02) ───
    'config.roles.set': {
      desc: 'Configure RBAC permissions for administrative and member roles.',
      example: '/config roles set role_type:bot_admin role:@AdminRole',
    },
    'config.roles.view': {
      desc: 'View current role-based access control (RBAC) configuration.',
      example: '/config roles view',
    },

    'config.welcome.setchannel': {
      desc: 'Select the channel for automated new member welcome messages.',
      example: '/config welcome setchannel channel:#welcome',
    },
    'config.welcome.setrole': {
      desc: 'Set the automatic role assigned to new members upon joining.',
      example: '/config welcome setrole role:@Member',
    },
    'config.welcome.toggle': {
      desc: 'Enable or disable the automated member welcome system.',
      example: '/config welcome toggle enabled:true',
    },
    'config.welcome.status': {
      desc: 'View current member welcome system configuration and status.',
      example: '/config welcome status',
    },
    'config.welcome.test': {
      desc: 'Send a test welcome message to preview layout and formatting.',
      example: '/config welcome test',
    },

    'config.leave.setchannel': {
      desc: 'Select the channel for member departure and farewell notices.',
      example: '/config leave setchannel channel:#farewell',
    },
    'config.leave.toggle': {
      desc: 'Enable or disable member departure notifications.',
      example: '/config leave toggle enabled:true',
    },
    'config.leave.status': {
      desc: 'View current member departure notification configuration.',
      example: '/config leave status',
    },
    'config.leave.test': {
      desc: 'Send a test farewell message to preview layout and formatting.',
      example: '/config leave test',
    },

    'config.booster.setchannel': {
      desc: 'Select the channel for server booster appreciation messages.',
      example: '/config booster setchannel channel:#boosters',
    },
    'config.booster.setrole': {
      desc: 'Set the designated reward role for server boosters.',
      example: '/config booster setrole role:@BoosterRole',
    },
    'config.booster.toggle': {
      desc: 'Enable or disable the server booster appreciation system.',
      example: '/config booster toggle enabled:true',
    },
    'config.booster.status': {
      desc: 'View current server booster configuration status.',
      example: '/config booster status',
    },
    'config.booster.test': {
      desc: 'Send a test booster appreciation message to preview layout.',
      example: '/config booster test',
    },

    'config.container.edit': {
      desc: 'Interactively edit Discord Components V2 message containers.',
      example: '/config container edit type:welcome',
    },
    'config.container.reset': {
      desc: 'Reset Discord Components V2 container layout to default templates.',
      example: '/config container reset type:welcome',
    },

    'config.bot.guilds': {
      desc: 'View list of all Discord servers the bot has joined (Bot Owner).',
      example: '/config bot guilds',
    },
    'config.bot.setannouncechannel': {
      desc: 'Set the designated channel to receive bot update announcements.',
      example: '/config bot setannouncechannel channel:#announcements',
    },
    'config.bot.announce': {
      desc: 'Broadcast feature update announcements to all servers (Bot Owner).',
      example: '/config bot announce preview:true',
    },

    'config.qr-server.toggle': {
      desc: 'Enable or disable premium VietQR payment licensing for a server.',
      example: '/config qr-server toggle enabled:true',
    },
    'config.qr-server.status': {
      desc: 'Check premium VietQR payment licensing status for a server.',
      example: '/config qr-server status',
    },

    'config.vietqr.set': {
      desc: 'Configure the receiving bank account for automated VietQR payments.',
      example: '/config vietqr set bank:MB account_no:0987654321 account_name:JohnDoe',
    },
    'config.vietqr.workflow': {
      desc: 'Configure payment approval workflow, staff role & feedback ratings.',
      example: '/config vietqr workflow staff_role:@Staff enable_rating:true',
    },
    'config.vietqr.status': {
      desc: 'View current receiving bank account details and payment status.',
      example: '/config vietqr status',
    },
    'config.vietqr.preview': {
      desc: 'Generate a sample VietQR code to preview and test bank scanning.',
      example: '/config vietqr preview amount:50000',
    },
    'config.vietqr.reset': {
      desc: 'Remove and reset all VietQR banking account configuration.',
      example: '/config vietqr reset',
    },

    'df.code.setchannel': {
      desc: 'Set the channel to auto-receive daily 6-map safe vault codes.',
      example: '/df code setchannel channel:#daily-codes',
    },
    'df.code.settime': {
      desc: 'Set daily scheduled time to post safe vault codes (default 08:00).',
      example: '/df code settime time:08:00',
    },
    'df.code.setadminchannel': {
      desc: 'Set the administrative channel for safe codes scheduler error logs.',
      example: '/df code setadminchannel channel:#bot-logs',
    },

    'df.autopost.set': {
      desc: 'Schedule auto-posting for map tactical guides or meta weapon builds.',
      example: '/df autopost set type:map interval_hours:6',
    },
    'df.autopost.toggle': {
      desc: 'Toggle automated tactical guide and weapon build broadcasting.',
      example: '/df autopost toggle',
    },
    'df.autopost.status': {
      desc: 'View auto-posting schedules and channel broadcast status.',
      example: '/df autopost status',
    },
    'df.autopost.run': {
      desc: 'Immediately trigger a tactical guide or weapon build broadcast.',
      example: '/df autopost run type:map',
    },
  },
} as const;
