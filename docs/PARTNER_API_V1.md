# INTERLIGENS Partner API V1

**Base URL:** `https://app.interligens.com/api/partner/v1`  
**Auth:** `X-Partner-Key: <your_key>` header on every request  
**Rate limit:** 60 requests/minute per IP  
**CORS:** All origins (`*`)

Contact INTERLIGENS to obtain your partner key.

---

## Endpoints

### 1. GET /score-lite

Returns a TigerScore and risk tier for a single address.

**Auth required:** Yes (`X-Partner-Key`)

#### Request

```
GET /api/partner/v1/score-lite?address={address}
X-Partner-Key: your_key
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | yes | Solana base58 mint OR EVM `0x` address |

#### Response `200`

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

| Field | Type | Description |
|-------|------|-------------|
| `score` | number (0–100) | Risk score — 0 = safe, 100 = critical risk |
| `verdict` | `SAFE` \| `WARNING` \| `AVOID` | Human-readable risk level |
| `tier` | `GREEN` \| `ORANGE` \| `RED` | Color tier |
| `signals_count` | number | Number of risk signals detected |
| `cache_hit` | boolean | `true` if served from 5-min cache |

**Tier thresholds:**
- `GREEN` (`SAFE`): score 0–34
- `ORANGE` (`WARNING`): score 35–69
- `RED` (`AVOID`): score 70–100

#### Errors

| Code | Error | Description |
|------|-------|-------------|
| 401 | `unauthorized` | Missing or invalid `X-Partner-Key` |
| 400 | `bad_request` | Missing `address` or invalid format |
| 429 | `rate_limit_exceeded` | 60 req/min exceeded |
| 504 | `timeout` | Scoring took > 10s |
| 500 | `internal_error` | Unexpected server error |

#### Example

```bash
curl "https://app.interligens.com/api/partner/v1/score-lite?address=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" \
  -H "X-Partner-Key: your_key"
```

---

### 2. POST /transaction-check

Pre-flight check for a blockchain transaction. Scores the destination (and optionally the source) address and returns an ALLOW/WARN/BLOCK recommendation.

**Auth required:** Yes (`X-Partner-Key`)

#### Request

```
POST /api/partner/v1/transaction-check
X-Partner-Key: your_key
Content-Type: application/json

{
  "to": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "from": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
  "chain": "eth"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | string | yes | Destination address (EVM or Solana) |
| `from` | string | no | Source address — scored in parallel if provided |
| `chain` | string | no | Chain: `eth`, `sol`, `bsc`, `base`, `arb`, `tron`. Default: `eth` |

#### Response `200`

```json
{
  "recommendation": "ALLOW",
  "reason": "Score 20/100 — no critical risk signals detected",
  "score_to": 20,
  "score_from": 15,
  "verdict_to": "SAFE",
  "chain": "eth",
  "version": "v1",
  "powered_by": "INTERLIGENS"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `recommendation` | `ALLOW` \| `WARN` \| `BLOCK` | Action to take |
| `reason` | string | Human-readable explanation |
| `score_to` | number | Risk score for destination |
| `score_from` | number \| null | Risk score for source (null if not provided) |

**Recommendation thresholds:**
- `ALLOW`: score_to 0–39
- `WARN`: score_to 40–69
- `BLOCK`: score_to 70–100

#### Errors

| Code | Error | Description |
|------|-------|-------------|
| 401 | `unauthorized` | Missing or invalid `X-Partner-Key` |
| 400 | `bad_request` | Validation failure (see `message` field) |
| 500 | `internal_error` | Failed to score destination |

#### Example

```bash
curl -X POST "https://app.interligens.com/api/partner/v1/transaction-check" \
  -H "X-Partner-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{"to":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","chain":"eth"}'
```

---

### 3. POST /batch-score

Score up to 10 addresses in a single request. Results are returned in the same order as inputs.

**Auth required:** Yes (`X-Partner-Key`)

#### Request

```
POST /api/partner/v1/batch-score
X-Partner-Key: your_key
Content-Type: application/json

{
  "addresses": [
    "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `addresses` | string[] | yes | 1–10 addresses (EVM or Solana, mixed allowed) |

#### Response `200`

```json
{
  "results": [
    { "address": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", "score": 20, "verdict": "SAFE",    "tier": "GREEN"  },
    { "address": "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",   "score": 0,  "verdict": "SAFE",    "tier": "GREEN"  },
    { "address": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",      "score": 0,  "verdict": "SAFE",    "tier": "GREEN"  }
  ],
  "processed": 3,
  "errors": 0,
  "version": "v1"
}
```

Each result is either a success or an error object:

```json
{ "address": "invalid", "error": "invalid_address" }
{ "address": "...",      "error": "timeout" }
{ "address": "...",      "error": "internal_error" }
```

#### Errors (top-level)

| Code | Error | Description |
|------|-------|-------------|
| 401 | `unauthorized` | Missing or invalid `X-Partner-Key` |
| 400 | `bad_request` | Empty array, > 10 addresses, non-string values |

#### Example

```bash
curl -X POST "https://app.interligens.com/api/partner/v1/batch-score" \
  -H "X-Partner-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{"addresses":["EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm","0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]}'
```

---

## Widget integration

For frontend embedding without exposing your partner key server-side, use the `@interligens/widget` package.  
See `packages/widget/README.md` for installation and usage.

---

## Changelog

| Version | Date | Notes |
|---------|------|-------|
| v1.0 | 2026-04-29 | Initial release — score-lite, transaction-check, batch-score |
