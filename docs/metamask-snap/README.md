# INTERLIGENS Guard — MetaMask Snap

Risk intelligence before you sign. Every transaction scored by INTERLIGENS TigerScore.

---

## What it does

INTERLIGENS Guard is a MetaMask Snap that intercepts transactions and signature requests before you sign. It calls the INTERLIGENS TigerScore API on the target address and surfaces the risk level directly inside MetaMask — no extra app, no wallet switch.

**Covered transaction types:**

| Transaction | Scored address |
|---|---|
| `approve` | spender |
| `permit` | spender + origin |
| `swap` | token out |
| `transfer` | recipient |
| `contract call` | contract |
| `message sign` | origin domain |

---

## Score interpretation

| Range | Verdict | Meaning |
|---|---|---|
| 0–30 | `SAFE` 🟢 | No major risk detected |
| 31–70 | `WARNING` 🟡 | Caution — review before proceeding |
| 71–100 | `AVOID` 🔴 | High risk — INTERLIGENS flags this address |

---

## Install

Open the companion dapp and click **Install INTERLIGENS Guard**:

```
https://snap.interligens.com   (production — pending deployment)
http://localhost:8080           (local dev)
```

MetaMask Flask is required for local development.
MetaMask stable supports Snaps from MetaMask v11+.

---

## How to test locally

```bash
# 1. Clone the repo
git clone https://github.com/INTERLIGENS/interligens-snap
cd interligens-snap

# 2. Install dependencies
yarn install

# 3. Start the snap dev server + companion dapp
yarn start
# → Snap served at  http://localhost:8080
# → Dapp served at  http://localhost:8000

# 4. Open MetaMask Flask (developer build)
#    https://metamask.io/flask/

# 5. Navigate to http://localhost:8000
#    Click "Install INTERLIGENS Guard"

# 6. Send a test transaction — the INTERLIGENS panel appears before signing
```

---

## Run tests

```bash
cd packages/snap
yarn test
```

```
PASS src/__tests__/snap.test.ts
  fetchScore
    ✓ returns a valid ScoreResult on success
    ✓ AbortError (timeout) → fallback without throwing
  onTransaction
    ✓ HIGH RISK address → verdict AVOID in panel
    ✓ SAFE address → verdict SAFE in panel
    ✓ empty `to` address → neutral message, no API call
    ✓ disclaimer present in AVOID, SAFE, error, and no-address panels
  onSignature
    ✓ scores the signature origin and includes disclaimer

Tests: 7 passed
```

---

## Build

```bash
yarn build          # builds snap bundle + companion dapp
yarn workspace @interligens/snap build   # snap only
yarn workspace site build               # dapp only
```

---

## Permissions requested

| Permission | Purpose |
|---|---|
| `endowment:network-access` | Call the INTERLIGENS TigerScore API |
| `endowment:transaction-insight` | Intercept transactions before signing |
| `endowment:signature-insight` | Intercept signature requests before signing |

MetaMask displays these permissions to the user at install time. The Snap cannot initiate transactions or move funds.

---

## Repo structure

```
interligens-snap/
├── packages/
│   ├── snap/
│   │   ├── src/
│   │   │   ├── index.tsx          # onTransaction + onSignature handlers
│   │   │   ├── api.ts             # fetchScore — TigerScore API adapter
│   │   │   └── __tests__/
│   │   │       └── snap.test.ts   # 7 tests
│   │   ├── images/
│   │   │   └── icon.svg           # INTERLIGENS orange badge
│   │   ├── dist/bundle.js         # built snap (3.4 KB)
│   │   └── snap.manifest.json     # permissions + metadata
│   └── site/                      # companion dapp (Gatsby + styled-components)
│       └── src/pages/index.tsx    # install page — dark INTERLIGENS theme
└── docs/metamask-snap/
    ├── README.md                  # this file
    └── POLICY.md                  # transaction policy matrix + wording rules
```

---

## API

The Snap calls:

```
GET https://app.interligens.com/api/v1/score?mint=<ADDRESS>
```

Response:

```json
{
  "score": 0-100,
  "verdict": "SAFE" | "WARNING" | "AVOID",
  "signals": [{ "label": "...", "severity": "..." }],
  "symbol": "...",
  "mint": "..."
}
```

**Fallback behavior:** if the API times out (>4 000ms) or is unreachable, the Snap displays a neutral message and does not block the transaction.

---

## Next steps to publish

1. **Test on MetaMask Flask** — `yarn start`, install at `localhost:8000`
2. **Submit to MetaMask Snap allowlist** — [docs.metamask.io/snaps/how-to/publish-a-snap](https://docs.metamask.io/snaps/how-to/publish-a-snap/)
3. **Publish to npm** — `npm publish` from `packages/snap/` as `@interligens/snap`
4. **Deploy companion dapp** — Vercel or static host at `snap.interligens.com`

---

## Legal

Signal-based risk analysis only. Not a legal finding or financial advice.  
Do your own research (DYOR).
