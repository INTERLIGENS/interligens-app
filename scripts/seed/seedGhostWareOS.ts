/**
 * scripts/seed/seedGhostWareOS.ts
 *
 * Seed complet du casefile GhostWareOS ($GHOST).
 * Additif — idempotent — safe à relancer.
 *
 *   - KolProfile: upsert par handle
 *   - KolWallet: insert si (kolHandle, address) absent
 *   - LaundryTrail + 7 LaundrySignal: insert si kolHandle absent
 *   - KolProceedsEvent: insert summary row via raw SQL
 *
 * Usage:
 *   npx tsx scripts/seed/seedGhostWareOS.ts
 */

import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const HANDLE = "ghostwareos";
const GHOST_MINT = "BBKPiLM9KjdJW7oQSKt99RVWcZdhF6sEHRKnwqeBGHST";
const SEED_EVENT_DATE = new Date("2026-04-16T00:00:00.000Z");

// ─── 1. KolProfile ──────────────────────────────────────────────
const PROFILE = {
  handle: HANDLE,
  platform: "x",
  displayName: "GhostWareOS",
  label: "ghost_investigation",
  riskFlag: "confirmed",
  tier: "CRITICAL",
  publishStatus: "published",
  publishable: true,
  rugCount: 5, // 4 dead tokens + GHOST itself
  totalDocumented: 6750,
  pdfScore: 91,
  confidence: "high",
  status: "active",
  proceedsStatus: "partial",
  proceedsCoverage: "partial",
  walletAttributionStatus: "confirmed",
  walletAttributionStrength: "confirmed",
  evidenceStatus: "strong",
  evidenceDepth: "comprehensive",
  completenessLevel: "substantial",
  profileStrength: "strong",
  editorialStatus: "published",
  behaviorFlags: JSON.stringify([
    "SERIAL_DEPLOYER",
    "FAKE_CELEBRITY_TOKENS",
    "LP_DRAIN_ACTIVE",
    "CEX_CASHOUT_ACTIVE",
    "NO_CODE_SOURCE",
    "EMPTY_WHITEPAPER",
    "SPONSORED_MEDIA_ONLY",
    "TOKEN_EXTENSIONS_FALSE",
  ]),
  summary:
    "GhostWareOS ($GHOST) — Solana pump-and-dump with privacy narrative. " +
    "Token created via HyperPad (no-code). Zero GitHub, empty whitepaper. " +
    "SPL standard token (NOT Token2022) — Token Extensions FALSE. " +
    "Deployer holds fake celebrity tokens (Nicki Minaj, Kanye West). " +
    "Fund chain: HTX (KYC) → First Funder → Deployer → $GHOST → LP drain → Binance/Bybit cashout. " +
    "TigerScore 91/100 — RED CONFIRMED.",
  observedBehaviorSummary:
    "Serial token deployer. 4 dead impersonation tokens (kanyewest Feb 2025, GMGN.Ai Oct 2025, " +
    "XChat Nov 2025, NICKI MINAJ Feb 2026). GHOST is the only token with sustained marketing " +
    "(sponsored articles crypto.news, bitcoinethereumnews, Cryptopolitan). Active LP drain " +
    "and CEX cashout as of April 2026.",
  documentedFacts:
    "Token mint: BBKPiLM9KjdJW7oQSKt99RVWcZdhF6sEHRKnwqeBGHST (Solana SPL standard). " +
    "Created via HyperPad (app.hypersol.xyz) — no-code memecoin deployer. " +
    "Deployed 22 Oct 2025. First pool Meteora same day. " +
    "ATH $0.026 on 2 Nov 2025 (11 days post-launch). Currently -92% from ATH. " +
    "Deployer wallet 3Ke5Fs... holds 0 GHOST (fully dumped) + 4 fake celebrity tokens. " +
    "Funded from HTX Hot Wallet (BY4St) via First Funder — 20.8 SOL ($3,784) — 4 min pass-through. " +
    "Cashout wallet 6GdyeT... active April 2026: ~$6,750 to Binance + Bybit. " +
    "Zero GitHub repos. Whitepaper URL returns empty page. " +
    "GhostPay = HoudiniSwap frontend wrapper, not proprietary crypto.",
  internalNote:
    "INTERLIGENS GHOST investigation. TigerScore 91. " +
    "Operator identifiable via HTX KYC. Cashout active Binance+Bybit April 2026. " +
    "Serial scammer: kanyewest, GMGN.Ai, XChat, NICKI MINAJ — all dead. " +
    "Sources: Helius DAS API, Arkham Intelligence, DexScreener API, Irys metadata, CryptoRank.",
};

// ─── 2. KolWallets ──────────────────────────────────────────────
const WALLETS = [
  {
    address: "3Ke5FsSYtdW2LVL3MT5SnVBcCyx2uR7yw8PLgJYG9YfK",
    chain: "SOL",
    label:
      "GHOST Deployer — Metaplex metadata authority (full scope). " +
      "Balance GHOST: 0 (fully dumped). " +
      "Also holds: OFFICIAL NICKI MINAJ (385M), OFFICIAL XChat (101M), kanyewest (1.44M), OFFICIAL GMGN.Ai (61M).",
    claimType: "verified_onchain" as const,
  },
  {
    address: "6GdyeTSdnttEczHxVLirxRj37Yc3NxhwfZyT8ohhvqsW",
    chain: "SOL",
    label:
      "GHOST Cashout wallet — Active April 2026. " +
      "$1,600 Binance (15 Apr) + $1,850 Binance (13 Apr) + $2,500 Bybit (10 Apr) + $800 Binance (8 Apr). " +
      "Total documented: ~$6,750 in 2 weeks.",
    claimType: "verified_onchain" as const,
  },
  {
    address: "GFjhiWN8jYsU2S2SUvVJ1AFgRidSPzYzdnKgwiRy8VL",
    chain: "SOL",
    label:
      "GHOST First Funder — Pass-through wallet funded by HTX Hot Wallet (BY4St). " +
      "22 Oct 2025 18:09 UTC: received 20.8 SOL ($3,784) from HTX. " +
      "22 Oct 2025 18:13 UTC: forwarded 20.799 SOL to deployer (4 min delay). " +
      "HTX = KYC-required CEX — operator identifiable by authorities.",
    claimType: "verified_onchain" as const,
  },
];

// ─── 3. LaundryTrail EN + FR ────────────────────────────────────
const NARRATIVE_EN =
  "Complete fund chain traced: HTX (KYC CEX) → First Funder (pass-through, 4 min relay) → " +
  "Deployer (serial scammer with 4 dead fake celebrity tokens) → $GHOST token deployment via HyperPad (no-code) → " +
  "LP drain over 6 months → Cashout wallet → Binance + Bybit deposits. " +
  "The operator is identifiable via HTX KYC records. Cashout is active as of April 2026 " +
  "with ~$6,750 documented over 2 weeks. The token uses SPL standard (not Token2022) — " +
  "Token Extensions FALSE — making all privacy claims technically impossible.";

const NARRATIVE_FR =
  "Chaîne de fonds complète tracée : HTX (CEX KYC) → First Funder (pass-through, relai 4 min) → " +
  "Deployer (serial scammer avec 4 tokens morts d'impersonation de célébrités) → déploiement $GHOST via HyperPad (no-code) → " +
  "drain LP sur 6 mois → wallet cashout → dépôts Binance + Bybit. " +
  "L'opérateur est identifiable via les registres KYC HTX. Le cashout est actif en avril 2026 " +
  "avec ~$6,750 documentés sur 2 semaines. Le token utilise SPL standard (pas Token2022) — " +
  "Token Extensions FALSE — rendant toutes les claims privacy techniquement impossibles.";

// 7 signals matching the user's specification
const SIGNALS = [
  {
    family: "CASH" as const,
    confirmed: true,
    severity: "STRONG" as const,
    detail:
      "Signal 1 — FUNDED VIA CEX KYC: HTX Hot Wallet → First Funder → Deployer in 4 minutes. " +
      "20.8 SOL ($3,784) on 22 Oct 2025 18:09 UTC. Operator has verified HTX account with KYC.",
  },
  {
    family: "CASH" as const,
    confirmed: true,
    severity: "STRONG" as const,
    detail:
      "Signal 2 — CASHOUT ACTIF BINANCE + BYBIT: April 2026: ~$6,750 extracted to Binance and Bybit " +
      "via cashout wallet 6GdyeT... — 15 Apr → Binance $1,600 / 13 Apr → $1,850 / 10 Apr → Bybit $2,500 / 8 Apr → Binance $800.",
  },
  {
    family: "FRAG" as const,
    confirmed: true,
    severity: "STRONG" as const,
    detail:
      "Signal 3 — SERIAL SCAMMER DOCUMENTÉ: Same deployer launched 4 dead tokens: " +
      "kanyewest (26 Feb 2025, $0 liquidity), OFFICIAL GMGN.Ai (20 Oct 2025, $0), " +
      "OFFICIAL XChat (1 Nov 2025, $0), OFFICIAL NICKI MINAJ (17 Feb 2026, $0, last tx 11 Apr 2026).",
  },
  {
    family: "DEG" as const,
    confirmed: true,
    severity: "STRONG" as const,
    detail:
      "Signal 4 — TOKEN EXTENSIONS FALSE: SPL token standard (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA). " +
      "Zero Token2022 Confidential Transfer extensions. A 'privacy token' with no privacy on-chain. Verified via Helius getAccountInfo.",
  },
  {
    family: "DEG" as const,
    confirmed: true,
    severity: "STRONG" as const,
    detail:
      "Signal 5 — ZÉRO CODE SOURCE: No GitHub repos (ghostwareos, ghost-ware, ghostware — all 404). " +
      "Whitepaper empty (whitepaper.ghostwareos.com = title only). " +
      "GhostPay = HoudiniSwap frontend wrapper. Zero ZK implementation despite PLONK/MPC/HPKE claims.",
  },
  {
    family: "FRAG" as const,
    confirmed: true,
    severity: "STRONG" as const,
    detail:
      "Signal 6 — PUMP & DUMP DOCUMENTÉ: Launch 22 Oct 2025 → ATH $0.026 in 11 days → -92% current. " +
      "100% media coverage = sponsored content (crypto.news, bitcoinethereumnews, Cryptopolitan). " +
      "Token created via HyperPad (no-code memecoin deployer that also sells volume bots).",
  },
  {
    family: "CASH" as const,
    confirmed: true,
    severity: "STRONG" as const,
    detail:
      "Signal 7 — SLOW LP DRAIN: LP tokens retained at launch. Progressive liquidity removal → SOL → " +
      "cashout wallet → CEX deposits. Pattern still active April 2026. " +
      "Deployer holds 0 GHOST (fully dumped). ~$6,750 documented cashout in partial 2-week window.",
  },
];

// ─── Main seed ──────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`[seed-ghost] Starting GhostWareOS casefile seed`);

  // 1. Upsert KolProfile
  const existing = await prisma.kolProfile.findUnique({ where: { handle: HANDLE } });
  if (!existing) {
    await prisma.kolProfile.create({ data: PROFILE });
    console.log(`  ✓ KolProfile CREATED: ${HANDLE}`);
  } else {
    await prisma.kolProfile.update({ where: { handle: HANDLE }, data: PROFILE });
    console.log(`  ✓ KolProfile UPDATED: ${HANDLE}`);
  }

  // 2. Insert wallets
  let walletsInserted = 0;
  for (const w of WALLETS) {
    const already = await prisma.kolWallet.findFirst({
      where: { kolHandle: HANDLE, address: w.address },
    });
    if (already) {
      console.log(`  · Wallet ${w.address.slice(0, 12)}... already exists`);
      continue;
    }
    await prisma.kolWallet.create({
      data: {
        kolHandle: HANDLE,
        address: w.address,
        chain: w.chain,
        label: w.label,
        claimType: w.claimType,
        attributionSource: "interligens_ghost_investigation",
        sourceLabel: "INTERLIGENS Investigation GHOST",
        attributionStatus: "confirmed",
        isPubliclyUsable: true,
        confidence: "high",
      },
    });
    walletsInserted++;
    console.log(`  ✓ Wallet CREATED: ${w.address.slice(0, 12)}... (${w.chain})`);
  }

  // 3. Laundry trail + signals
  const existingTrail = await prisma.laundryTrail.findFirst({ where: { kolHandle: HANDLE } });
  if (!existingTrail) {
    const trail = await prisma.laundryTrail.create({
      data: {
        kolHandle: HANDLE,
        walletAddress: "3Ke5FsSYtdW2LVL3MT5SnVBcCyx2uR7yw8PLgJYG9YfK",
        chain: "solana",
        trailType: "cex_funded_serial_deployer_lp_drain",
        laundryRisk: "CRITICAL",
        recoveryDifficulty: "PARTIAL",
        trailBreakHop: null,
        fundsUnresolved: null,
        narrativeText: NARRATIVE_EN,
        narrativeTextFr: NARRATIVE_FR,
        evidenceNote:
          "Complete fund chain: HTX (KYC) → First Funder → Deployer → $GHOST → LP drain → Binance/Bybit. " +
          "Sources: Arkham Intelligence, Helius DAS API, DexScreener API, Irys on-chain metadata.",
        signals: {
          create: SIGNALS.map((s) => ({
            family: s.family,
            confirmed: s.confirmed,
            severity: s.severity,
            detail: s.detail,
            rawData: {},
          })),
        },
      },
    });
    console.log(`  ✓ LaundryTrail CREATED: ${trail.id} — ${SIGNALS.length} signals`);
  } else {
    console.log(`  · LaundryTrail already exists for ${HANDLE}`);
  }

  // 4. Proceeds event
  const syntheticTx = `ghost_summary_${HANDLE}`;
  try {
    await prisma.$executeRaw`
      INSERT INTO "KolProceedsEvent" (
        id, "kolHandle", "walletAddress", chain, "txHash", "eventDate",
        "tokenSymbol", "tokenAddress", "amountTokens", "amountUsd",
        "priceUsdAtTime", "pricingSource", "eventType", ambiguous, notes, "createdAt"
      ) VALUES (
        ${"ghost_sum_" + HANDLE},
        ${HANDLE},
        ${"6GdyeTSdnttEczHxVLirxRj37Yc3NxhwfZyT8ohhvqsW"},
        ${"SOL"},
        ${syntheticTx},
        ${SEED_EVENT_DATE},
        ${"GHOST"},
        ${GHOST_MINT},
        ${null},
        ${6750},
        ${null},
        ${"arkham_aggregate"},
        ${"cex_deposit"},
        ${false},
        ${"Summary aggregate — Binance ($1,600 + $1,850 + $800 USDC) + Bybit ($2,500 USDT) — April 2026. Partial window only."},
        NOW()
      )
      ON CONFLICT ("txHash") DO NOTHING
    `;
    console.log(`  ✓ KolProceedsEvent CREATED: $6,750`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠ Proceeds insert skipped: ${msg}`);
  }

  // 5. Summary
  console.log(`\n[seed-ghost] Done.`);
  console.log(`  KolProfile: ${HANDLE} — publishStatus=published — TigerScore=91 (pdfScore)`);
  console.log(`  Wallets: ${walletsInserted} created`);
  console.log(`  LaundryTrail: 7 signals (CASH x3, FRAG x2, DEG x2)`);
  console.log(`  Observed Proceeds: $6,750`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
