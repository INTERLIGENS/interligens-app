# INTERLIGENS Public API v1

Public, unauthenticated REST API to score any Solana token for scam risk using the TigerScore engine.

**Base URL:** `https://app.interligens.com/api/v1`

---

## Score a Solana token

```
GET /score?mint={mint_address}
```

No authentication required. Rate limit: **60 requests/minute** per IP.

### Parameters

| Name | In    | Type   | Required | Description                        |
|------|-------|--------|----------|------------------------------------|
| mint | query | string | yes      | Solana token mint address (base58, 32-44 characters) |

### Example request

```bash
curl https://app.interligens.com/api/v1/score?mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### Success response (200)

```json
{
  "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "symbol": "USDC",
  "name": "USD Coin",
  "score": 8,
  "verdict": "GREEN",
  "phantom_warning_level": "ALLOW",
  "phantom_disclaimer": "No major risk signals detected.",
  "signals": [
    {
      "id": "mutable_metadata",
      "label": "Mutable metadata",
      "severity": "MEDIUM",
      "value": 15
    }
  ],
  "sources": ["DexScreener", "INTERLIGENS CaseDB"],
  "cached": false,
  "timestamp": "2026-04-12T12:00:00.000Z",
  "api_version": "v1"
}
```

### Response fields

| Field       | Type     | Description                                       |
|-------------|----------|---------------------------------------------------|
| mint        | string   | The queried mint address                           |
| symbol      | string?  | Token ticker (if known from CaseDB)                |
| name        | string?  | Token name (if known from CaseDB)                  |
| score       | number   | TigerScore risk score, 0 (safe) to 100 (critical)  |
| verdict     | string   | `"GREEN"` (0-34), `"ORANGE"` (35-69), `"RED"` (70-100) |
| phantom_warning_level | string | `"ALLOW"` (GREEN), `"WARN"` (ORANGE), `"BLOCK"` (RED) |
| phantom_disclaimer | string | Short EN disclaimer for wallet UI display          |
| signals     | array    | Risk signals detected (see below)                  |
| sources     | string[] | Data sources used for this score                   |
| cached      | boolean  | Whether market data was served from cache          |
| timestamp   | string   | ISO 8601 timestamp of this response                |
| api_version | string   | Always `"v1"`                                      |

### Signal object

| Field    | Type    | Description                                      |
|----------|---------|--------------------------------------------------|
| id       | string  | Machine-readable signal identifier                |
| label    | string  | Human-readable description                        |
| severity | string  | `"LOW"`, `"MEDIUM"`, `"HIGH"`, or `"CRITICAL"`    |
| value    | number? | Score contribution (delta)                         |

### Response headers

```
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=300
X-RateLimit-Limit: 60
X-RateLimit-Remaining: <n>
```

---

## Error responses

### 400 — Invalid mint address

```json
{
  "error": "invalid_mint",
  "message": "Expected a valid Solana base58 address (32-44 characters)"
}
```

### 429 — Rate limit exceeded

```json
{
  "error": "rate_limit_exceeded",
  "retry_after": 60
}
```

### 500 — Internal error

```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

---

## CORS

The API supports cross-origin requests from any origin. Preflight `OPTIONS` requests return appropriate CORS headers.

---

## Rate limiting

- **60 requests per minute** per client IP
- Sliding window algorithm
- `X-RateLimit-Remaining` header indicates remaining requests in the current window
- When exceeded, wait 60 seconds or check the `retry_after` field

---

## Data sources

The TigerScore engine aggregates signals from multiple sources:

- **DexScreener / GeckoTerminal** — Market data (liquidity, FDV, volume, pool age)
- **INTERLIGENS CaseDB** — Off-chain investigation files and confirmed claims
- **GoPlus / ScamSniffer / Forta** — On-chain security intelligence
- **AMF / FCA / OFAC** — Regulatory sanctions matching
- **Lineage Graph** — On-chain deployer and fund-flow scam lineage detection

---

*INTERLIGENS -- Scan before you swap.*
