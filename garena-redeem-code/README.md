# DF Toolbox — Chrome Extension

A Chrome extension for Delta Force HQ that provides three main features: **redeem codes**, **Discord account linking**, and **auth state monitoring**.

---

## Features

### 1. Redeem Codes

Auto-redeem codes on the [Garena Redeem Page](https://redeem.df.garena.sg).

- Paste a list of codes (one per line)
- Click **Save Codes** to store them
- Open the redeem page — a dashboard panel appears at the bottom-right
- Click **Start** to begin auto-redeeming
- Monitor real-time results: Success, Failed, Used, Retryable, Untested

### 2. Discord Account Linking

Link your Garena Delta Force account to your Discord bot account.

1. Run `/df-link start` on Discord → receive a 6-character claim code
2. Open `playdeltaforce.com` — the **DF Toolbox — Link** panel appears
3. Paste the claim code and click **Link Discord**
4. Wait for the "Linked successfully" confirmation DM

### 3. Auth State Engine

Monitor your Garena authentication state in real-time.

- Track session ID, token state, refresh support, and remaining time
- View event timeline of auth-related network requests
- Inspect refresh flow: requests, responses, token changes
- Monitor network events: XHR, fetch, storage writes
- View storage writes: keys, types, and values

---

## Installation

### Step 1: Extract

1. You will receive a file: `garena-redeem-code-v2.0.0.zip`
2. Right-click → **Extract All**
3. Choose a location (e.g., Desktop)
4. Open the extracted folder

> **Important:** You should see `manifest.json` immediately. If you need to open another folder first, go back one level.

Correct structure:

```
garena-redeem-code/
├── manifest.json
├── background/
├── content/
├── popup/
└── assets/
```

### Step 2: Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right corner)
3. Click **Load unpacked**
4. Select the `garena-redeem-code` folder
5. Click **Select Folder**

If installed successfully, you will see **DF Toolbox** in the extensions list.

---

## Configuration

### Webhook URL (Required for Discord Linking)

The extension sends claim data to a Discord webhook.

1. Click the **DF Toolbox** extension icon
2. Go to the **Config** tab
3. In the **Webhook** section, paste your Discord webhook URL:
   ```
   https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
   ```
4. Click **Save Webhook**

> The webhook URL is stored locally and never leaves your browser.

### Redeem Codes

1. Click the extension icon
2. Go to the **Config** tab
3. Paste codes into the **Redeem Codes** textarea (one per line)
4. Click **Save Codes**

---

## Usage

### Redeem Codes

1. Click the **DF Toolbox** icon → paste codes → click **Save Codes**
2. Open the [Garena Redeem Page](https://redeem.df.garena.sg)
3. Look for the **Garena Redeem** dashboard panel at the bottom-right
4. Click **Start** to begin auto-redeeming
5. Monitor results on the panel:

| Status | Meaning |
|--------|---------|
| Redeemed | Code redeemed successfully |
| Dead | Code expired or already used |
| Retryable | Temporary error — can retry |
| Untested | Code not yet processed |

### Stop or Resume

- Click **Stop** to pause the redeem process
- Click **Continue** to resume from where you left off

> **Note:** Do not close the redeem page while the process is running.

### Link Discord Account

1. Run `/df-link start` on Discord → receive a claim code
2. Open [playdeltaforce.com](https://www.playdeltaforce.com)
3. The **DF Toolbox — Link** panel appears at the bottom-right
4. Paste the claim code → click **Link Discord**
5. Wait for the confirmation DM from the bot

### Auth State Engine

1. Click the extension icon → go to the **Auth Investigator** tab
2. Navigate to sub-tabs:

| Tab | Shows |
|-----|-------|
| Overview | Session ID, token state, refresh support, remaining time |
| Timeline | Chronological list of auth-related events |
| Refresh | Refresh flow: requests, responses, token changes |
| Network | XHR and fetch events with details |
| Storage | LocalStorage write events |

---

## Troubleshooting

### Dashboard panel not appearing

1. Make sure you are on the correct page (`redeem.df.garena.sg` or `playdeltaforce.com`)
2. Refresh the page (F5)
3. Check that the extension is enabled in `chrome://extensions`
4. Close and reopen the tab

### Redeem process not starting

- Have you logged into Garena?
- Have you saved codes?
- Are codes entered one per line?
- Are you on the correct redeem page?

### Link panel not appearing

- Make sure you are on `playdeltaforce.com`
- Refresh the page
- Check that the extension is enabled

### Claim code rejected

- Codes expire after **10 minutes** — generate a new one with `/df-link start`
- Each code can only be used **once**

### "Webhook not configured"

- Go to extension popup → Config tab → Webhook section
- Save a valid Discord webhook URL

### Auth Investigator tab shows no data

- Visit `playdeltaforce.com`, `sso.garena.com`, or `auth.garena.com`
- The extension captures auth events automatically
- Data appears in the Investigator tab after visiting these pages

---

## Uninstall

1. Open Chrome → navigate to `chrome://extensions`
2. Find **DF Toolbox**
3. Click **Remove**

> This only removes the extension. Your redeem codes and webhook URL are stored in Chrome's local storage and will be cleared on removal.

---

## Support

If you encounter issues or need help, join our Discord server: [Discord Support](https://discord.gg/vz6w6c3Xe3)

**Author:** Pon1147
