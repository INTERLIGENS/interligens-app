# INTERLIGENS x Phantom -- Partnership Proposal

## The Problem

Solana retail investors are losing hundreds of millions of dollars annually to token scams. In 2025 alone, rug pulls, honeypots, and pump-and-dump schemes on Solana DEXs have drained an estimated $500M+ from retail wallets. The explosion of low-barrier token launches (pump.fun alone has facilitated 5M+ token deployments) has created an environment where scam tokens outnumber legitimate projects by orders of magnitude.

**The gap:** wallet providers display token prices, balances, and swap interfaces -- but zero risk intelligence. Users swap blindly, trusting charts and social hype instead of on-chain evidence.

## INTERLIGENS in Numbers

| Metric | Value |
|--------|-------|
| Tokens scored | 1,000+ Solana tokens analyzed |
| KOL profiles | 215 published, 9 deep investigations |
| Intelligence sources | GoPlus, ScamSniffer, Forta, AMF, FCA, OFAC |
| Market data coverage | DexScreener + GeckoTerminal dual-provider |
| Detection signals | 15+ risk drivers (freeze authority, mint authority, pump patterns, FDV/liquidity ratio, deployer lineage) |
| Scam lineage graph | On-chain fund-flow tracing across deployer wallets |
| API response time | < 500ms p95 (public endpoint, no auth required) |
| False positive rate | < 3% on confirmed scam tokens |

## What We're Proposing

### Option A -- API Integration

Phantom integrates the INTERLIGENS `/api/v1/score` endpoint directly into its swap confirmation UI. When a user initiates a swap to a token, Phantom displays the TigerScore verdict (GREEN/ORANGE/RED) and top risk signals before the transaction is signed.

- **Effort:** minimal (single API call, JSON response)
- **Branding:** "Risk score powered by INTERLIGENS" or co-branded
- **Endpoint:** `GET https://app.interligens.com/api/v1/score?mint={address}`
- **Rate limit:** 60/min per IP (upgradable to dedicated tier)

### Option B -- White-Label

TigerScore is surfaced as **"Phantom Safety Score"** with Phantom branding. INTERLIGENS operates the scoring engine behind a dedicated, SLA-backed endpoint. Phantom controls the UI, copy, and user experience.

- **Dedicated endpoint** with API key authentication
- **SLA:** 200ms p95, 99.9% uptime
- **Custom response fields:** `phantom_warning_level`, `phantom_disclaimer`
- **See:** `docs/white-label-spec.md` for full technical specification

### Option C -- Extension Co-Branding

INTERLIGENS Guard Chrome extension is co-branded as **"Phantom Guard"** or **"Protected by Phantom x INTERLIGENS"**. Distributed via Chrome Web Store and/or bundled with the Phantom browser extension.

- Extension already functional (Manifest V3, supports pump.fun, Jupiter, Raydium, Birdeye, DexScreener)
- Badge injects directly into DEX pages with risk verdict
- Popup UI with detailed signals and casefile links

## Why Now

1. **Regulatory pressure is accelerating.** MiCA enforcement in the EU (Jan 2025) and SEC actions against token promoters create liability for platforms that facilitate access to scam tokens without warnings.

2. **Wallet providers are the last line of defense.** DEXs have no incentive to warn users. Wallets do -- user trust is their moat.

3. **Phantom's market position.** As the dominant Solana wallet, Phantom has the distribution to make risk scoring a standard expectation, not a niche feature. First-mover advantage here defines the category.

4. **Community demand is vocal.** "Why doesn't my wallet warn me?" is a recurring sentiment across Crypto Twitter and Reddit after every major rug pull event.

## Contact

- **Project:** INTERLIGENS -- https://app.interligens.com
- **Founder:** Dood
- **Email:** contact@interligens.com
- **Public API docs:** https://app.interligens.com/docs/api-v1

---

*INTERLIGENS -- Scan before you swap.*
