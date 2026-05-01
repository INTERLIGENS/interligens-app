# TigerScore — Scoring Engine Reference

For Dood. Plain language, no jargon.

---

## What is TigerScore?

A number from 0 to 100. The higher it is, the riskier the token.  
Every scan combines on-chain data, detective files, market structure, and regulatory databases to produce one number.

---

## Tiers

| Tier | Score | Meaning |
|------|-------|---------|
| GREEN | 0–34 | No major risk signals found |
| ORANGE | 35–69 | Warning signs present — proceed with caution |
| RED | 70–100 | Critical signals — do not interact |

**Verified in source:** `src/lib/tigerscore/engine.ts` line 237.

---

## What feeds the score?

### 1. On-chain signals (Solana / EVM)
- Number of approvals and whether any are **unlimited** (any spender can drain the wallet)
- **Freeze authority** active (deployer can freeze your tokens)
- **Mint authority** active (deployer can print more tokens and dilute)
- **Mutable metadata** (name/symbol can change after launch)
- **Unknown programs** interacted with
- Transaction count (very low = suspicious)
- EVM: whether address is in INTERLIGENS known-bad registry

### 2. Detective casefile (from internal DB)
- CONFIRMED CRITICAL claims (= hard evidence gathered by investigators)
- **Any confirmed critical claim adds +70 to the score immediately**

### 3. Scam lineage (on-chain graph)
- If the deployer/wallet is **directly linked** to a prior scam: +70 (CONFIRMED)
- If there is an **indirect link**: +50 (REFERENCED)

### 4. Market structure (Solana tokens only, no casefile required)
- Token launched on pump.fun: +30
- Pool is less than 3 days old: +20
- FDV/liquidity ratio ≥ 40 (e.g. $100M FDV, $2.5M liquidity): +20
- 24h volume > 5× liquidity: +15
- **Market boosters are capped at +50 total** and only apply to SOL tokens without a casefile

### 5. Intelligence databases (async)
- **OFAC, AMF (France), FCA (UK):** Sanctions lists
- **GoPlus, ScamSniffer, Forta:** On-chain risk oracles
- **Hard cap:** Intelligence adjustment cannot exceed 20% of the base score  
  → Example: base score 50 + intelligence = max 60 (not 80)
- **Sanction match floor:** If address is on a sanctions list → minimum score 15

---

## Signal table

| Signal | Points added | Notes |
|--------|-------------|-------|
| Unlimited approval(s) | +70 | Drain risk |
| Freeze authority | +70 | Solana only |
| Confirmed critical claim | +70 | From casefile |
| Scam lineage (confirmed) | +70 | Direct wallet link |
| Scam lineage (referenced) | +50 | Indirect link |
| Address poisoning | +45 | Lookalike paste-attack |
| Mint authority active | +35 | Supply inflation risk |
| Unknown programs | +35 | Unverified interactions |
| High approvals (≥9, not unlimited) | +35 | Large attack surface |
| Pump-like pattern | +30 | pump.fun address/URL |
| High manipulation (KOL DB) | +20 | Coordinated shill signals |
| Fresh pool (≤3 days) | +20 | High rug risk |
| FDV/liquidity ratio ≥40 | +20 | Overvalued vs thin liquidity |
| High alerts (on-chain) | +15 | Community distress |
| Low trust (KOL DB) | +15 | Below-threshold transparency |
| Mutable metadata | +15 | Metadata can change |
| Volume/liquidity spike | +15 | 24h volume > 5× liquidity |
| Low tx count (<5) | +10 | Fresh/disposal wallet |
| EVM dormant wallet | +10 | New wallet with > 1 ETH |
| EVM known-bad | +100 | Hard floor — overrides all |
| EVM high tx count (>10k) | -5 | Established wallet (positive) |

---

## Why tokens without a casefile score 0–20

A fresh token with no detective file has no confirmed claims, no scam lineage, and no approval risk (it was just deployed). The engine starts at 0.

Market boosters can only push it higher if:
- It's a SOL token
- No casefile exists
- The market structure is suspicious

**Normal token with clean market:** score = 0–5 (GREEN)  
**1-day-old pump.fun token with 50:1 FDV/liquidity:** score = 50 (ORANGE)

Without these boosters, a clean token will always land in the 0–20 range. This is by design — INTERLIGENS does not punish tokens for the absence of evidence.

---

## Intelligence cap — the 0.20 rule

Intelligence sources (OFAC, GoPlus, etc.) can only **adjust** the base TigerScore, not **replace** it.

The maximum adjustment is capped at 20% of the base score.

```
base score × 0.20 = max intelligence adjustment
```

**Why:** Prevents a single regulatory hit from artificially inflating a score that has zero on-chain risk signals. Intelligence reinforces the score; it does not set it.

---

## How to get natural ORANGE scores

Currently, most tokens without a casefile land GREEN (0–34). These technical changes would generate ORANGE results for genuinely borderline tokens:

### Option A — Expand market booster triggers
Enable market boosters for EVM tokens (currently SOL-only). Tokens on Base or Arbitrum with a 50:1 FDV/liquidity ratio would immediately score ORANGE.

### Option B — Weight fresh EVM wallets
A wallet with 0 transactions and 0.5 ETH that deploys a token has essentially the same risk profile as a fresh Solana deployer. Currently this doesn't trigger a HIGH driver.

### Option C — Connect KOL DB live signals
`manipulationLevel`, `alertsLevel`, and `trustLevel` are defined in the input schema but not populated in the main scoring flow. Connecting these from the watch engine would add 15–20 points for tokens actively being shilled.

### Option D — Lower the scam-lineage threshold
The REFERENCED threshold (+50) requires an explicit graph linkage. Adding a "soft-reference" tier (+25) for 2nd-degree connections would push ambiguous tokens into ORANGE instead of GREEN.

### Option E — Add a "no-audit" signal
If a token's program/contract has never been audited and has > $500k in liquidity, add +15 to reflect unverified code risk. Currently not a tracked signal.

---

## Data flow (simplified)

```
On-chain RPC
    ↓
Casefile claims       → computeTigerScore() → base score 0–100
Market data (DEX)
    ↓
Intelligence DB       → adjustedScore (capped at base × 0.20)
    ↓
Final: max(baseScore, adjustedScore) → tier GREEN / ORANGE / RED
```

---

## Entry points in the codebase

| Function | File | Usage |
|----------|------|-------|
| `computeTigerScore()` | `src/lib/tigerscore/engine.ts` | Core driver accumulator |
| `computeTigerScoreWithIntel()` | `src/lib/tigerscore/engine.ts` | + intelligence overlay |
| `computeTigerScoreFromScan()` | `src/lib/tigerscore/adapter.ts` | From RPC scan data |
| `computeVerdict()` | `src/lib/publicScore/computeVerdict.ts` | Public API entry |
