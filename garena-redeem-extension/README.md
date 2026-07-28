# Pon1147 Redeem Tool - Browser Extension

Chrome/Edge browser extension for auto-redeeming Garena codes.

## Setup

1. Mở `chrome://extensions/` (hoặc `edge://extensions/`)
2. Bật **Developer mode**
3. Click **Load unpacked**
4. Chọn folder `garena-redeem-extension/`

## Usage

1. Truy cập trang redeem của Garena (`redeem.df.garena.sg`)
2. Panel sẽ hiện ở góc trái trên màn hình
3. Click **START MISSION** để chạy

## Project Structure

```text
garena-redeem-extension/
├── manifest.json          - Extension manifest (Manifest V3)
├── content.js             - All-in-one: logic + UI (Tactical HUD)
├── README.md
├── core/                  - Legacy modules (not used in v2.3+)
├── ui/                    - Legacy UI modules (not used in v2.3+)
├── assets/                - Static assets
└── icons/                 - Extension icons (16x16, 48x48, 128x128)
```

## Architecture

- **Single content script** — all logic and UI in one file, no dependency on load order
- **Manifest V3** — content script runs on Garena redeem pages
- **Network hooking** — fetch/XHR patched in page world, responses via postMessage
- **State resume** — localStorage persists progress, survives page refresh
- **Tactical HUD UI** — Delta Force inspired design with live log, stats, progress
