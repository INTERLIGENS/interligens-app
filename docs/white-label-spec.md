# INTERLIGENS x Phantom -- White-Label Integration Spec

Technical specification for Option B: TigerScore as "Phantom Safety Score".

---

## 1. Dedicated Endpoint

```
GET https://app.interligens.com/api/v1/phantom/score?mint={mint_address}
```

### Authentication

```
Authorization: Bearer <PHANTOM_API_KEY>
```

API key provisioned per environment (staging, production). Keys are rotated quarterly. Rate limiting is per-key, not per-IP.

### Rate Limits

| Tier | Requests/min | Requests/day | Burst |
|------|-------------|-------------|-------|
| Staging | 120 | 50,000 | 200 |
| Production | 600 | 1,000,000 | 1,000 |

### Response

```json
{
  "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "symbol": "USDC",
  "name": "USD Coin",
  "score": 8,
  "verdict": "GREEN",
  "phantom_warning_level": "none",
  "phantom_disclaimer": null,
  "signals": [
    {
      "id": "mutable_metadata",
      "label": "Mutable metadata",
      "severity": "MEDIUM",
      "value": 15
    }
  ],
  "sources": ["DexScreener", "GoPlus"],
  "cached": false,
  "timestamp": "2026-04-12T12:00:00.000Z",
  "api_version": "v1",
  "partner": "phantom"
}
```

### Phantom-specific fields

| Field | Type | Description |
|-------|------|-------------|
| `phantom_warning_level` | `"none"` \| `"caution"` \| `"danger"` \| `"block"` | Simplified warning tier for Phantom UI |
| `phantom_disclaimer` | `string` \| `null` | Legal disclaimer text when `danger` or `block` |
| `partner` | `"phantom"` | Partner identifier |

### Warning level mapping

| TigerScore | Verdict | `phantom_warning_level` | Suggested Phantom UX |
|-----------|---------|------------------------|---------------------|
| 0-19 | GREEN | `none` | No warning shown |
| 20-34 | GREEN | `caution` | Subtle info banner |
| 35-69 | ORANGE | `danger` | Yellow warning modal before swap |
| 70-100 | RED | `block` | Red blocking modal, require explicit "I understand the risk" confirmation |

---

## 2. SLA

| Metric | Target |
|--------|--------|
| Response time p50 | < 100ms |
| Response time p95 | < 200ms |
| Response time p99 | < 500ms |
| Uptime (monthly) | 99.9% |
| Error rate | < 0.1% |
| Data freshness | Market data cached max 10 min, intelligence real-time |

### Monitoring

- Status page: dedicated endpoint at `/api/v1/phantom/health`
- Alerting: PagerDuty integration, Phantom engineering notified on downtime
- Monthly SLA report delivered to Phantom ops team

### Failover behavior

If the INTERLIGENS scoring engine is unavailable:
- Return `HTTP 503` with `Retry-After` header
- Phantom should fall back to "Score unavailable" state (not block the swap)
- Cached scores remain valid for their TTL (5 minutes)

---

## 3. Data & Privacy

- **No user data collected.** The API receives only the mint address. No wallet addresses, no IP logging, no user identifiers.
- **No PII.** Phantom does not need to share any user information.
- **Audit trail.** Per-key request counts available via dashboard. No request content logging.
- **GDPR/CCPA compliant.** No personal data processed.

---

## 4. Pricing Models

### Model A -- Per-Query

| Volume (monthly) | Price per query |
|-------------------|----------------|
| 0 - 100,000 | $0.002 |
| 100,001 - 1,000,000 | $0.0015 |
| 1,000,001+ | $0.001 |

Estimated cost at 500K queries/month: **$850/month**

### Model B -- Fixed Monthly License

| Tier | Monthly fee | Included queries | Overage |
|------|------------|-----------------|---------|
| Starter | $1,500 | 500,000 | $0.002/query |
| Growth | $3,500 | 2,000,000 | $0.0015/query |
| Enterprise | $7,500 | Unlimited | -- |

### Model C -- Revenue Share

- Phantom integrates a "Powered by INTERLIGENS" link
- INTERLIGENS receives attribution + referral traffic
- Zero monetary cost to Phantom
- Best for initial pilot phase (3-6 months)

---

## 5. Integration Timeline

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| Pilot | 2 weeks | API key provisioned, staging endpoint live, sample integration code |
| Beta | 4 weeks | Production endpoint, SLA monitoring, Phantom UI integration |
| GA | 2 weeks | Chrome Web Store listing (if Option C), marketing assets, press coordination |

---

## 6. Technical Contact

- API support: api@interligens.com
- Status page: app.interligens.com/api/v1/phantom/health
- Documentation: app.interligens.com/docs/api-v1

---

*INTERLIGENS -- Scan before you swap.*
