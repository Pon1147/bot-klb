# Garena Redeem Code Extension

Chrome Extension (Manifest V3) for automated redeem code on Garena Delta Force.

## Installation

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this folder

## Architecture

```
content.js (content script isolated world)
    │
    └── fetch + concat + import() all modules
          ├── dashboard.js    → UI render + realtime state (chrome.storage available)
          └── redeem-controller.js → Redeem queue, start/pause/resume
                │
                └── core/ (constants, state, storage, parser, capture, utils)
```

**Quan trọng:** Dashboard/controller chạy trong content script isolated world (có chrome API). Module files được fetch từ extension, rewrite import paths sang chrome-extension:// URLs, concat thành blob URL rồi import(). Không inject `<script>` tag (chạy trong page context → không có chrome API).

## File Structure

| File | Responsibility |
|------|---------------|
| `core/constants.js` | DEFAULT_CODES, RESPONSE_CODE_MAP, CONFIG |
| `core/state.js` | State model, transitions, updates |
| `core/storage.js` | Chrome.storage access layer |
| `core/parser.js` | parseRedeemResponse() |
| `core/capture.js` | Network response capture |
| `core/utils.js` | Shared utilities (generateId, sleep, visible, deduplicate) |
| `popup/popup.js` | Code config (save/reset) |
| `content/content.js` | Entry point, fetch+concat+import all modules |
| `content/bootstrap.js` | Single entry point — initializes dashboard + controller |
| `content/dashboard.js` | UI render + realtime state |
| `content/redeem-controller.js` | Redeem queue, start/pause/resume |
| `background/service-worker.js` | Extension lifecycle (initStorage on install) |

## Usage

1. Click extension icon → Popup opens
2. Edit codes in textarea (one per line)
3. Click "Save codes"
4. Go to https://redeem.df.garena.sg/vi/cdkgarena.html
5. Dashboard panel appears → Click "Bat dau"
6. Monitor progress in real-time

## Response Codes

Add new codes to `core/constants.js` → `RESPONSE_CODE_MAP`:

```js
400072: { result: 'FAILED', reason: 'USED', label: 'Da su dung' },
```

## State Machine

```
NO_CODES → READY → RUNNING → PAUSED → RUNNING → COMPLETED
```

## Author

Pon1147
