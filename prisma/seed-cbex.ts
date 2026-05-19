/**
 * CBEX — IL-PON-CBEX-001 — first "Platform Fraud" casefile.
 * Scope: platform-level Ponzi network. No token. No KOL deanonymization.
 * Run (idempotent — upsert on `ref`, safe to re-run):
 *   set -a; source .env.local; set +a; pnpm tsx prisma/seed-cbex.ts
 *
 * PREREQUISITE: the `platform_casefiles` table must already exist in Neon.
 * Create it first via the Neon SQL Editor — never `prisma db push`.
 *
 * The casefile body is embedded below as a string literal (assembled from
 * investigations/IL-PON-CBEX-001_v2.0_FINAL.md) so the seed has no runtime
 * file dependency — it re-seeds correctly from a fresh git checkout.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REF = "IL-PON-CBEX-001";

// Full casefile body — embedded literal, no external file needed.
const BODY_MARKDOWN = `
# CBEX — The $12M Ponzi That Never Stopped
## Case Reference: IL-PON-CBEX-001 | PlatformRisk Score: 92

---

## 1. Executive Summary

CBEX marketed itself as a cryptocurrency trading platform. It operated as a
Ponzi network: deposits from new participants funded "returns" paid to earlier
ones, with no genuine trading activity behind the figures shown to users.

The casefile records **$12,000,000 in confirmed retail losses**, concentrated
across **Nigeria, Slovakia, Hungary and Kenya**. The operation is linked to the
sibling-brand entities **PCEX**, **LWEX** and the **Huione Pay** settlement
infrastructure.

The public-facing platform collapsed — but the payout machinery did not. INTERLIGENS
on-chain verification (runs #1–#4, 19 May 2026) confirmed an **active successor
payout wallet still dispersing USDT on TRON in real time**, with funds flowing
out to identified centralised exchanges. CBEX is therefore classified
**ACTIVE FRAUD INFRASTRUCTURE**, not a closed historical case.

This dossier is a joint **Specter x INTERLIGENS** publication: original
attribution by @SpecterAnalyst (April 2025), on-chain circuit verification by
INTERLIGENS (May 2026).

---

## 2. Active Threat — The Successor Is Still Paying Out

The successor payout wallet is:

\`TRyVYvz3FSSJY4UDVnS23xWphQeuKgPyA2\`

Snapshot at **2026-05-19 14:34 UTC** (Tronscan public API):

- **USDT balance: 95,341.77 USDT** (raw \`33,900,430,204\`, 6 decimals)
- TRX balance: 613.79
- Total transactions: **69,726** (19,257 in / 50,827 out)
- Created: 2025-11-26 06:32 UTC (~6 months old)
- Last activity: 2026-05-19 14:34 UTC — i.e. live at snapshot time

**The balance is climbing fast.** At INTERLIGENS run #3 (2026-05-19 ~12:38 UTC)
the same wallet held roughly $43.2K USDT. By 14:34 UTC it held $95,341.77 —
**an increase of roughly +$52K in about two hours.** Inflows are ongoing.

The wallet's last five USDT outbound transfers (14:31–14:34 UTC) went to five
distinct addresses:

\`\`\`
2026-05-19 14:34 |   160.00 USDT -> TEEaci57We59cZEfMkkiNEK72hgssMBuUC
2026-05-19 14:34 |   640.00 USDT -> TJPDvma12YLp8nPaEhe7jiGsfse3YzmjNo
2026-05-19 14:33 |   400.23 USDT -> TBh2BJwYjHQrtmFKzvjCkRCiV2YAzbcXvo
2026-05-19 14:32 |   200.00 USDT -> TR1ass7qY6TguQnWUi8HbiNtdP1DdeHHaQ
2026-05-19 14:31 |   946.87 USDT -> TG8BqHdzHzSAfZ5upZv1wJT9N3sRKjw5LR
\`\`\`

**Three of those five recipients are fresh single-use mule wallets** —
\`TEEaci57...\`, \`TJPDvma12...\` and \`TR1ass7q...\` — each created the same day,
each holding exactly one inbound USDT transfer, **funds untouched**:

\`\`\`
TEEaci57We59cZEfMkkiNEK72hgssMBuUC   160.00 USDT   0 outbound   funds intact
TJPDvma12YLp8nPaEhe7jiGsfse3YzmjNo   640.00 USDT   0 outbound   funds intact
TR1ass7qY6TguQnWUi8HbiNtdP1DdeHHaQ   200.00 USDT   0 outbound   funds intact
\`\`\`

These three mules still hold **$1,000.00 combined, on-chain and unmoved** —
within the window where the USDT issuer can still freeze them. This is a
time-sensitive, actionable detail.

---

## 3. On-Chain Circuit — Five Hops From Victim to Exchange

INTERLIGENS traced the full money path across four investigation runs. The
circuit collapses a deliberately wide fan-out back into a handful of exchange
endpoints:

\`\`\`
HOP 1  Victim deposits / CBEX inflows
         |
HOP 2  Energy providers fund the payout wallet
         TYMZdfff9RzDbszgivGkpioHSxLE9Km8mJ  (W2, 918,927 tx)
         THKmu36cUpMz48WTvPiNBeXgfdP22HJTT1  (W3, 1,373,157 tx)
         -> both delegate TRON ENERGY exclusively to W1, in continuous
            delegate/undelegate cycles, so W1 moves USDT at near-zero fee
         |
HOP 3  Successor payout wallet W1
         TRyVYvz3FSSJY4UDVnS23xWphQeuKgPyA2
         -> fans USDT out to ~490 distinct destinations
            (run #3: 500 outbound transfers sampled, 189,302 USDT)
         |
HOP 4  Recipient layer = fresh single-use mules + recurrent feeder wallets
         e.g. TBh2BJwYjHQrtmFKzvjCkRCiV2YAzbcXvo (recurrent)
              TG8BqHdzHzSAfZ5upZv1wJT9N3sRKjw5LR (recurrent)
         -> recurrent feeders consolidate 100% of their USDT outflow
         |
HOP 5  Exchange-scale hot wallets -> cash-out at centralised exchanges
         run #4: the 10 top feeder wallets consolidate into just 6
         exchange-scale destinations (3M-60M tx each)
\`\`\`

Worked example from the snapshot trace (2026-05-19 ~14:45 UTC): the two
recurrent feeders that received from W1 both send **100% of their USDT
outflow** to a single address — \`TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf\`,
tagged **\`Binance-Hot 7\`** on Tronscan.

\`\`\`
TBh2BJw -> Binance-Hot 7   2026-04-21  1,000.00 USDT
TBh2BJw -> Binance-Hot 7   2026-05-17  1,200.00 USDT
TG8BqHd -> Binance-Hot 7   2026-02-14    185.60 USDT
TG8BqHd -> Binance-Hot 7   2026-03-30    480.00 USDT
TG8BqHd -> Binance-Hot 7   2026-04-28    251.20 USDT
                          --------------------------
                           combined      3,116.80 USDT deposited to Binance
\`\`\`

The on-chain trail ends at the exchange. Identifying the KYC account holder
behind the cash-out requires an official law-enforcement / mutual legal
assistance request to the exchange.

---

## 4. Cash-Out Exchanges

INTERLIGENS run #4 followed the 10 highest-value feeder wallets one hop
further. They consolidate into 6 exchange-scale destinations. Five carry a
public exchange label (Tronscan \`addressTag\`); one is unlabelled but
exchange-scale by transaction volume.

\`\`\`
EXCHANGE              DESTINATION WALLET                     FED BY   TX COUNT
Binance-Hot 7         TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf      5 / 10   ~48.3M
Gate.io               TBA6CypYJizwA9XdC7Ubgc5F1bxrQ7SqPt      1 / 10   ~60.7M
OKX Hot Wallet 8      TLaGjwhvA8XQYSxFAcAXy7Dvuue9eGYitv      1 / 10   ~50.5M
KuCoin 4              TUpHuDkiCCmwaTZBHZvQdwWzGNm5t8J2b9      1 / 10   ~25.2M
Bitget 9              TJ7hhYhVhaxNx6BPyq7yFpqZrQULL3JSdb      1 / 10   ~19.4M
(unidentified)        TTRMwhxtUdgykYPoeq6eEUKLmj26Y4KtcG      1 / 10    ~3.0M
\`\`\`

**Binance is the dominant cash-out venue** — it receives from half of the
sampled feeder wallets. The five labelled venues — **Binance, OKX, KuCoin,
Bitget, Gate.io** — are the documented exit points of the CBEX successor
network.

---

## 5. Key Wallets

\`\`\`
ROLE                       ADDRESS                              NOTES
-------------------------- ------------------------------------ ----------------------------------
Successor payout (W1)      TRyVYvz3FSSJY4UDVnS23xWphQeuKgPyA2   95,341.77 USDT, active 2026-05-19,
                                                                69,726 tx, created 2025-11-26
Energy provider (W2)       TYMZdfff9RzDbszgivGkpioHSxLE9Km8mJ   0 USDT, 918,927 tx, ENERGY -> W1
Energy provider (W3)       THKmu36cUpMz48WTvPiNBeXgfdP22HJTT1   0 USDT, 1,373,157 tx, ENERGY -> W1
Bridge (Bridgers)          TPwezUWpEGmFBENNWJHwXHRG1D2NCEEt5s   Tronscan tag "Bridgers", ~4.4M tx
Exchange - Binance         TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf   addressTag "Binance-Hot 7", ~48.3M tx
Exchange - Gate.io         TBA6CypYJizwA9XdC7Ubgc5F1bxrQ7SqPt   exchange-scale, ~60.7M tx
Exchange - OKX             TLaGjwhvA8XQYSxFAcAXy7Dvuue9eGYitv   addressTag "OKX Hot Wallet 8"
Exchange - KuCoin          TUpHuDkiCCmwaTZBHZvQdwWzGNm5t8J2b9   addressTag "KuCoin 4"
Exchange - Bitget          TJ7hhYhVhaxNx6BPyq7yFpqZrQULL3JSdb   addressTag "Bitget 9"
Recurrent feeder           TBh2BJwYjHQrtmFKzvjCkRCiV2YAzbcXvo   100% USDT outflow -> Binance-Hot 7
Recurrent feeder           TG8BqHdzHzSAfZ5upZv1wJT9N3sRKjw5LR   100% USDT outflow -> Binance-Hot 7
Fresh mule                 TEEaci57We59cZEfMkkiNEK72hgssMBuUC   160.00 USDT, funds intact (freezable)
Fresh mule                 TJPDvma12YLp8nPaEhe7jiGsfse3YzmjNo   640.00 USDT, funds intact (freezable)
Fresh mule                 TR1ass7qY6TguQnWUi8HbiNtdP1DdeHHaQ   200.00 USDT, funds intact (freezable)
\`\`\`

Related EVM-side address (Ethereum, run #3 token-flow trace):
\`0xb685760ebd368a891f27ae547391f4e2a289895b\` — a stablecoin pass-through hub
(USDT ~199K in / ~181K out; USDC ~267K in / ~441K out across 100-transfer
samples), active the same day.

---

## 6. Sources

- **@SpecterAnalyst** — original CBEX investigation thread, 15 April 2025.
  https://x.com/SpecterAnalyst/status/1912151972330787259
- **INTERLIGENS on-chain verification, runs #1-#4, 19 May 2026** — wallet
  verification, successor hunt, USDT flow trace, and hop-2 exchange
  identification (\`investigations/CBEX_*\`).
- **Tronscan public API** — wallet snapshot 2026-05-19 ~14:40 UTC
  (\`apilist.tronscanapi.com\`, USDT contract \`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t\`).
- Exchange labels resolved via Tronscan \`addressTag\`.

Joint publication: **Specter x INTERLIGENS**.

---

*Documented critical risk. Architecture, not recipe. This dossier is an
analytical instrument built from publicly available blockchain data — it is
not legal advice and not a judicial finding.*

`;

const CBEX = {
  ref: REF,
  codename: "CBEX",
  title: "The $12M Ponzi That Never Stopped",
  family: "platform_fraud",
  subtype: "ponzi_network",
  platformRiskScore: 92,
  status: "ACTIVE_FRAUD_INFRASTRUCTURE",
  chains: ["TRON", "Ethereum"],
  geography: ["Nigeria", "Slovakia", "Hungary", "Kenya"],
  confirmedLossUsd: 12_000_000,
  currency: "USD",
  publishedDate: new Date("2026-05-19"),
  sourceInvestigator: "@SpecterAnalyst",
  sourceThreadUrl: "https://x.com/SpecterAnalyst/status/1912151972330787259",
  specterCollab: true, // specter_x_interligens
  keyWallets: [
    "TRyVYvz3FSSJY4UDVnS23xWphQeuKgPyA2",
    "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf",
    "TPwezUWpEGmFBENNWJHwXHRG1D2NCEEt5s",
  ],
  linkedEntities: ["PCEX", "LWEX", "Huione Pay"],
  exitExchanges: ["Binance", "OKX", "KuCoin", "Bitget", "Gate.io"],
  activeSuccessor: true,
  successorWallet: "TRyVYvz3FSSJY4UDVnS23xWphQeuKgPyA2",
  // Structured-data is complete; publish so CBEX surfaces in the Explorer.
  publishStatus: "published",
};

async function main() {
  const data = { ...CBEX, bodyMarkdown: BODY_MARKDOWN.trim() };

  const result = await prisma.platformCaseFile.upsert({
    where: { ref: REF },
    create: data,
    update: data,
  });

  console.log(
    `[seed-cbex] upserted ${result.ref} (${result.codename}) — ` +
      `id=${result.id}, publishStatus=${result.publishStatus}, ` +
      `bodyMarkdown=${result.bodyMarkdown ? result.bodyMarkdown.length + " chars" : "null"}`,
  );
}

main()
  .catch((e) => {
    console.error("[seed-cbex] FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
