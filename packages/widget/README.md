# @interligens/widget

Embeddable TigerScore widget for INTERLIGENS partners.

Displays a compact animated score ring (max 200×200 px) for any token or wallet address.

---

## Installation

```bash
npm install @interligens/widget
# or
yarn add @interligens/widget
```

> **Partner key required.** Contact INTERLIGENS to obtain your `X-Partner-Key`.

---

## Usage — React

```tsx
import { InterligensWidget } from "@interligens/widget";

export function MyTokenPage() {
  return (
    <InterligensWidget
      address="EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
      partnerKey="your_partner_key"
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `address` | `string` | required | Token mint (Solana base58) or EVM 0x address |
| `partnerKey` | `string` | required | Your `X-Partner-Key` from INTERLIGENS |
| `apiBase` | `string` | `https://app.interligens.com` | API base URL (override for staging) |
| `size` | `number` | `120` | Widget diameter in px (80–200 recommended) |

### Color scheme

| Tier | Color | Meaning |
|------|-------|---------|
| GREEN | `#00C853` | Low risk |
| ORANGE | `#FF6B00` | Moderate risk |
| RED | `#FF1744` | High risk — avoid |

---

## Usage — Plain HTML (standalone embed)

No React required. Add the script tag and place `data-interligens-widget` divs anywhere.

```html
<!-- 1. Add script once in <head> or before </body> -->
<script
  src="https://app.interligens.com/widget/embed.js"
  data-partner-key="your_partner_key"
  defer
></script>

<!-- 2. Place widget placeholders anywhere -->
<div
  data-interligens-widget
  data-address="EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
  data-size="120"
></div>
```

### data-attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-interligens-widget` | yes | — | Marks the element as a widget placeholder |
| `data-address` | yes | — | Token or wallet address to score |
| `data-size` | no | `120` | Widget size in px |

---

## Usage — iframe fallback

For environments where JavaScript injection is restricted:

```html
<iframe
  src="https://app.interligens.com/widget/iframe?address=ADDRESS&key=YOUR_KEY"
  width="160"
  height="180"
  frameborder="0"
  scrolling="no"
  allowtransparency="true"
></iframe>
```

Replace `ADDRESS` with the token/wallet address and `YOUR_KEY` with your partner key.

---

## API

The widget calls the INTERLIGENS Partner API:

```
GET /api/partner/v1/score-lite?address={address}
X-Partner-Key: your_partner_key
```

Response:
```json
{
  "address": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  "score": 20,
  "verdict": "SAFE",
  "tier": "GREEN",
  "signals_count": 2,
  "cache_hit": false,
  "as_of": "2026-04-29T12:00:00.000Z",
  "version": "v1",
  "powered_by": "INTERLIGENS"
}
```

Rate limit: 60 requests/minute per IP.

---

## Build from source

```bash
cd packages/widget
npm install
npm run build        # builds CJS + ESM + types
npm run build:embed  # builds standalone IIFE for <script> tag
```

Output in `dist/`:
- `index.js` — CommonJS
- `index.mjs` — ESM
- `index.d.ts` — TypeScript types
- `embed.js` — standalone IIFE script
