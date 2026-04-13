# INTERLIGENS Guard -- Chrome Extension

Chrome extension (Manifest V3) that scans Solana tokens for scam signals
on DEX websites before you swap.

## Supported DEXs

- pump.fun
- Jupiter (jup.ag)
- Raydium
- Birdeye
- DexScreener

## Dev install

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this `interligens-guard/` folder
4. Navigate to any supported DEX with a Solana token
5. The INTERLIGENS Guard badge appears in the bottom-right corner

## How it works

1. **Content script** detects the current DEX page and extracts the Solana mint address
2. **Background service worker** calls the INTERLIGENS public API (`/api/v1/score`)
3. A floating badge is injected into the page showing the TigerScore verdict
4. Scores are cached in `chrome.storage.session` for 5 minutes
5. Click the badge or use the **popup** for detailed risk signals

## File structure

```
manifest.json    Manifest V3 configuration
background.js    Service worker: API bridge + session cache
content.js       Content script: DEX detection + mint extraction + badge injection
popup.html       Extension popup UI
popup.js         Popup logic: score display + manual scan
icons/           Placeholder icons (16/48/128px)
```

## Build prod

```bash
npm install -g web-ext
web-ext build --source-dir=. --artifacts-dir=./dist
```

## Submit to Chrome Web Store

1. Zip this folder (exclude `.git`, `node_modules`, `dist`)
2. Upload on [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Category: Productivity / Security
