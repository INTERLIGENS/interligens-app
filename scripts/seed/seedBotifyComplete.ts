/**
 * scripts/seed/seedBotifyComplete.ts
 *
 * Seed complet de tous les acteurs BOTIFY (co-fondateurs, équipe, KOLs Arkham).
 * Additif — idempotent — safe à relancer.
 *
 *   - KolProfile: upsert par handle
 *   - KolWallet: insert si (kolHandle, address) absent
 *   - KolProceedsEvent: insert summary row via raw SQL, txHash synthétique unique
 *
 * Usage:
 *   tsx scripts/seed/seedBotifyComplete.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Wallet = {
  address: string;
  chain: "SOL" | "ETH";
  label: string;
  claimType: "verified_onchain" | "attributed";
};

type Actor = {
  handle: string;
  platform: "X";
  tier: "CRITICAL" | "HIGH" | "MEDIUM";
  publishStatus: "published" | "draft";
  wallets: Wallet[];
  proceedsUsd: number;
  cex: string;
  note: string;
};

const BOTIFY_ACTORS: Actor[] = [
  {
    handle: "bkokoski",
    platform: "X",
    tier: "CRITICAL",
    publishStatus: "published",
    wallets: [
      { address: "HRuLzZkfkmqt3sMRXLoSEA5i58Z4rm7qtPTQZmd14LUx", chain: "SOL", label: "BK opérationnel — créateur token BOTIFY, signataire TX OrbitApe", claimType: "verified_onchain" },
      { address: "0x32B6006e5b942F47Ab4DB68eE70f683370853ecF", chain: "ETH", label: "BK ETH personnel — Arkham kokoskib", claimType: "verified_onchain" },
      { address: "5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj", chain: "SOL", label: "BK MOM (0.055% F&F) — reçu 300K BOTIFY distributeur", claimType: "attributed" },
      { address: "HSueXrabQVABdHezbQ5Q4UbgLTx4Nc6VqyX5R88zzxmz", chain: "SOL", label: "BK DAD (0.055% F&F)", claimType: "attributed" },
      { address: "CFEBsnVtB3qz9ano2nL9mVjmUu26EGDpoY9nGEAqRTqR", chain: "SOL", label: "BK ILLYA (0.05% F&F)", claimType: "attributed" },
      { address: "FzDXp1AqPhmwqkXjeFeTohbVcDEbJM9bjDcH9DPN4nEc", chain: "SOL", label: "BK CARTER (0.02% F&F)", claimType: "attributed" },
      { address: "3cEzB3atFPXs8YCLDP8RQCw3vBNLi84g7v7GgJ4nDaEB", chain: "SOL", label: "BK JON (0.03% F&F)", claimType: "attributed" },
      { address: "DqTxtH5CLg6V36ULj8Zdmd7BTxre3HqbLCckb3F5sn8r", chain: "SOL", label: "BK AZEEM (0.04% F&F)", claimType: "attributed" },
    ],
    proceedsUsd: 110000,
    cex: "HeaiD (hub) — $110K en 3h30 le 20/03/2026",
    note: "Co-fondateur BOTIFY. Ex-VP/COO Dione Protocol (août 2022→mars 2026). Portfolio Arkham EVM $400,732. Cashout $110K USDC 20/03/2026.",
  },
  {
    handle: "sxyz500",
    platform: "X",
    tier: "CRITICAL",
    publishStatus: "published",
    wallets: [
      { address: "57kwBCtsJMpTEu3GtAVeUm8qycMWFHVAGwT1JE2aKFWn", chain: "SOL", label: "SAM wallet 1 — 2% allocation KOL table", claimType: "attributed" },
      { address: "5XJduTqthJTprFQEGNAV9wizfvgJpkwxvAR9rMwmUDxS", chain: "SOL", label: "SAM wallet 2 — $92K Arkham · Binance+BloFin", claimType: "verified_onchain" },
      { address: "BYpdZppXdVvTGTW86RwswvnJhqRJHe2LxyseYBjP4X7v", chain: "SOL", label: "SAM relay cashout — $117,919 en 3 jours", claimType: "verified_onchain" },
      { address: "23cdxwyFgC4ru5FdN5NEcGLzPioBkqknhGU8rLK2S9P1", chain: "SOL", label: "SAM MUM (0.05% F&F) — reçoit SOL depuis wallet 2 directement", claimType: "verified_onchain" },
      { address: "9PQwizgbW2ruvypLQ9baVRZ4tiJdhDrEzD63m4oMqtxB", chain: "SOL", label: "SAM DAD (0.07% F&F)", claimType: "attributed" },
      { address: "4b4sZ9e8ShmnubZ1vU4SafEVeyGmZNshNGqLARoXESMZ", chain: "SOL", label: "SAM NICK (0.03% F&F)", claimType: "attributed" },
      { address: "EjKURS65kyjQdydjmcwQUX8twjxQHVJwez1E9DXU9fVQ", chain: "SOL", label: "SAM SIMON (0.02% F&F)", claimType: "attributed" },
      { address: "D1W3zviRxGa3tzFUuwqj1uZPM79hJAx9cdidDcxhV96K", chain: "SOL", label: "SAM RUT (0.02% F&F)", claimType: "attributed" },
    ],
    proceedsUsd: 209931,
    cex: "Binance (EB9P7+AYJfd+7qH8k) + BloFin (CyUkM) + Rollbit",
    note: "Co-fondateur BOTIFY. @sxyz500 = @samjoleary = SAMBO. Australie. Vol ADL→HK payé trésorerie BOTIFY.",
  },
  {
    handle: "GordonGekko",
    platform: "X",
    tier: "CRITICAL",
    publishStatus: "published",
    wallets: [
      { address: "0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41", chain: "ETH", label: "Gordon EVM/Hyperliquid principal", claimType: "verified_onchain" },
      { address: "4sD4U2aWXZrgbCGXcCYagECV9oajrjudYQqE1B4e6Za6", chain: "SOL", label: 'Gordon KOL 1% (9.18m BOTIFY) — "GG" table', claimType: "verified_onchain" },
      { address: "4yscBpfbcB1wmviW4854CYqVz1KgjKoKRpg4uf5XSLe3", chain: "SOL", label: "Gordon KOL 0.665% (2.12m BOTIFY) — knownBad", claimType: "verified_onchain" },
      { address: "3X9RErem7uNhqdYbJrM5bTvtcsqbbZB15tkXxqcnaqA6", chain: "SOL", label: "Gordon daily release — Arkham confirmé @GordonGekko · actif 4 avr 2026", claimType: "verified_onchain" },
      // $SWIF $445K finding retiré du dossier 2026-05-15 (non vérifié — pas de TX hash,
      // contradiction $SWIF/$TRUMP). Wallets conservés mais attribution dégradée.
      { address: "A8L7hRc3qUbA9JXb4D4NcYtECx9qzpY7KCoz6kAwqqx5", chain: "SOL", label: "swif_pending_verification_1", claimType: "attributed" },
      { address: "EqYGemqo1DeFkKoAvps8baQNqaLEHaTg1EBkXTxa431", chain: "SOL", label: "swif_pending_verification_2", claimType: "attributed" },
    ],
    // 2026-05-15: 485627 → 40627 après retrait du finding $445K SWIF (non vérifié). Reste = cashouts BOTIFY confirmés.
    proceedsUsd: 40627,
    cex: "Binance (4XJwd) + OKX DEX — MaestroBots + Temporal MEV",
    note: "KOL BOTIFY 1.665% supply. Actif 4 avril 2026 sur pump.fun. Cluster Arkham 10 wallets. ($SWIF $445K finding retiré 2026-05-15 — non vérifié, cf. MIGRATION_RETAILVISION.md.)",
  },
  {
    handle: "EduRio",
    platform: "X",
    tier: "HIGH",
    publishStatus: "published",
    wallets: [
      { address: "GWnE324dDERAgrQU7B6SVUbFkkzgx7JppfzvzpASKF66", chain: "SOL", label: "EduRio wallet 1 — $187K via MEXC", claimType: "verified_onchain" },
      { address: "EBLZB5QA9QPFwUgtDcUHeWqRptc6q5ywLk4Dk1GhWA2M", chain: "SOL", label: "EduRio wallet 2 — $160K via MEXC", claimType: "verified_onchain" },
    ],
    proceedsUsd: 347237,
    cex: "MEXC (GwGYQ, 64sWx, 6rSoW, HiMfq, GAcjV) — 5 comptes",
    note: "KOL 2% (8.5m BOTIFY). $347,237 via MEXC en quelques jours. Jan–fév 2025.",
  },
  {
    handle: "MoneyLord",
    platform: "X",
    tier: "HIGH",
    publishStatus: "published",
    wallets: [{ address: "7QquANyvZgpNKdavkdDVjQ5GwwBDck7wMf9ZTTotp8JJ", chain: "SOL", label: "MoneyLord KOL 1% — Arkham @MoneyLord confirmé", claimType: "verified_onchain" }],
    proceedsUsd: 85484,
    cex: "Bybit (6aQZS $28,218 + BMdrM $19,899) — $48K en 1 journée",
    note: "KOL 1% (5m BOTIFY). Dump $48K Bybit en 1 jour (27 fév 2025).",
  },
  {
    handle: "ElonTrades",
    platform: "X",
    tier: "HIGH",
    publishStatus: "published",
    wallets: [{ address: "BN5edYKL6tV4ZsTKqJGJBmHjrxW4seK6i5sXSG3fGKwX", chain: "SOL", label: "ElonTrades KOL 1% (9.48m) — Arkham confirmé", claimType: "verified_onchain" }],
    proceedsUsd: 53313,
    cex: "MEXC (F9XGz) — $27,507 en 1 TX",
    note: "KOL 1% (9.48m BOTIFY). Lié BQ72 famille BK. Dump massif 1 TX vers MEXC.",
  },
  {
    handle: "Nekoz",
    platform: "X",
    tier: "HIGH",
    publishStatus: "published",
    wallets: [{ address: "5KtrjaTBSpsmg42PGRHYohoXd4pHPRZ21yzskfsU9WNa", chain: "SOL", label: "Nekoz KOL 0.4% (3.4m)", claimType: "attributed" }],
    proceedsUsd: 85506,
    cex: "Non identifié directement (Arkham)",
    note: "KOL 0.4%. $85,506 Arkham. Actif mars 2026.",
  },
  {
    handle: "Barbie",
    platform: "X",
    tier: "HIGH",
    publishStatus: "published",
    wallets: [{ address: "D68istiZpeSrCzMsJSWb46hRimqFTCP8xqHRtbfSm3Z4", chain: "SOL", label: "Barbie KOL 0.1% ($10K deal)", claimType: "attributed" }],
    proceedsUsd: 65289,
    cex: "MEXC (MTj6P $22,826 + 8jBCA)",
    note: "KOL 0.1% ($10K deal). $65,289 dont $52K USDC. Jan–mai 2025.",
  },
  {
    handle: "wulfcryptox",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "GzLUEPZHGUrfqPnPErtSiTjxrWUkZdw8tcQoJTQKN2zx", chain: "SOL", label: "Wulf KOL 0.05% (120 SOL deal) — Arkham @wulfcryptox", claimType: "verified_onchain" }],
    proceedsUsd: 36592,
    cex: "Bybit (39sDe) — $28,168 en 1 TX",
    note: "KOL 0.05%. @wulfcryptox Arkham. $28K Bybit en 1 TX (2 mars 2025).",
  },
  {
    handle: "SolanaRockets",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "3XAcxTSiw5twRudMFhG7Mmg6h5hGxyB7jjwKVW4Nh4BT", chain: "SOL", label: "SolanaRockets — 150 SOL deal — Arkham @SolanaRockets", claimType: "verified_onchain" }],
    proceedsUsd: 32254,
    cex: "ChangeNOW (DsNYZ $4,557) + Rollbit",
    note: "@SolanaRockets Arkham. ChangeNOW no-KYC. Rollbit compte actif.",
  },
  {
    handle: "0xBossman",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "9P2np34H1umoKVGeXMFd5UUpA5m6DHuv5uPDoucGyF9", chain: "SOL", label: "Bossman KOL 0.166% ($10K deal) — Arkham @0xBossman", claimType: "verified_onchain" }],
    proceedsUsd: 39656,
    cex: "Non identifié directement",
    note: "@0xBossman Arkham. $39,656. $LIFE token actif.",
  },
  {
    handle: "sibeleth",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "9ZYq8SL5XPECWqnfYB1F6i7oT4Fakfck8QhzZqo18fHX", chain: "SOL", label: "Sibel KOL 0.256% — Arkham @sibeleth (3 wallets)", claimType: "verified_onchain" }],
    proceedsUsd: 23297,
    cex: "Binance Hot Wallet + Bybit Hot Wallet entrants · actif avr 2026",
    note: "@sibeleth Arkham. Actif 7 avr 2026. Binance+Bybit confirmés.",
  },
  {
    handle: "ShmooNFT",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "EjhN9HgBwhzcpKEJtgiUL41PWKF7u56NpbFjuL7hvn2P", chain: "SOL", label: "Shmoo KOL 0.325% ($10K deal) — Arkham @ShmooNFT", claimType: "verified_onchain" }],
    proceedsUsd: 852,
    cex: "Non identifié",
    note: "@ShmooNFT Arkham. Cashout Arkham minimal visible.",
  },
  {
    handle: "SamuelXeus",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "draft",
    wallets: [{ address: "9turTgeLPDk77u4aZDvgtYZaXzjZ1jzxV239j6WDmv2X", chain: "SOL", label: "Xeus KOL 0.52% (5.2m) — Arkham @SamuelXeus", claimType: "verified_onchain" }],
    proceedsUsd: 408,
    cex: "Non identifié",
    note: "@SamuelXeus Arkham confirmé. Jito MEV.",
  },
  {
    handle: "CryptoZin",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "Ao47TMguxAXCG7CmcQJTnh5fu9tqkeZFo1YsS4hCyryr", chain: "SOL", label: "CryptoZin KOL 0.1745% ($10K) — Arkham @CryptoZin", claimType: "verified_onchain" }],
    proceedsUsd: 7767,
    cex: "Coinbase (5NFhK $69)",
    note: "@CryptoZin Arkham.",
  },
  {
    handle: "Brommy",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "J9Lwoh2bimo4UwLHPJU7TvMhxqgpRimtsBqPS25y8kN2", chain: "SOL", label: "Brommy KOL 0.25%", claimType: "attributed" }],
    proceedsUsd: 21883,
    cex: "Coinbase (CgN2k) $20,227 — 30 mars 2026",
    note: "$20K Coinbase 16 jours. Actif.",
  },
  {
    handle: "Geppetto",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "EnrRj77ffuRc9MfY2GKygTSbpu8QyFT7VZdK1DHk3hhc", chain: "SOL", label: "Geppetto @geppeto88 KOL 0.059% ($10K deal)", claimType: "attributed" }],
    proceedsUsd: 21058,
    cex: "MEXC (9E5aR) x2 — $4K",
    note: "28K abonnés Telegram. MEXC confirmé. Jan–mai 2025.",
  },
  {
    handle: "Blackbeard",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "6pADY44tK88735dyK6AzAUu2dpracC7h4RPTHbM727CL", chain: "SOL", label: "Blackbeard KOL 0.05% (500k)", claimType: "attributed" }],
    proceedsUsd: 20572,
    cex: "Bybit Hot Wallet entrant (AC5RD $1,493)",
    note: "$11K BOTIFY. Bybit confirmé.",
  },
  {
    handle: "CoachTY",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "5Rx84j9TqiFH2CgeQKP2pHKGPsK45PcXXiKdqPdQPRkR", chain: "SOL", label: "CoachTY KOL 0.069% ($25K deal)", claimType: "attributed" }],
    proceedsUsd: 19065,
    cex: "Coinbase (1Q3p4) $4,783",
    note: "$25K deal. Coinbase confirmé juin 2025.",
  },
  {
    handle: "Ronnie",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "2C1HCNgXLryQ4W5ExrehTy793K9nzWcZcfpq2NsVPVHx", chain: "SOL", label: "Ronnie KOL 0.1265% ($25K deal)", claimType: "attributed" }],
    proceedsUsd: 24388,
    cex: "Coinbase (BBsWw + EjhhE)",
    note: "$25K deal. 2 comptes Coinbase.",
  },
  {
    handle: "Exy",
    platform: "X",
    tier: "MEDIUM",
    publishStatus: "published",
    wallets: [{ address: "F3jZKYLYh7wR2cfatZV1w6jXiwrgQh9PyPXEL7segYtW", chain: "SOL", label: "Exy KOL 0.2% (1.9m)", claimType: "attributed" }],
    proceedsUsd: 38017,
    cex: "Rollbit Treasury → Exy $10,900 SOL",
    note: "$38K en 3 jours. Rollbit compte actif.",
  },
];

const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const SEED_EVENT_DATE = new Date("2026-04-15T00:00:00.000Z");

async function upsertActor(actor: Actor): Promise<{
  profileCreated: boolean;
  walletsInserted: number;
  eventInserted: boolean;
}> {
  let profileCreated = false;
  const existing = await prisma.kolProfile.findUnique({ where: { handle: actor.handle } });
  if (!existing) {
    await prisma.kolProfile.create({
      data: {
        handle: actor.handle,
        platform: actor.platform,
        tier: actor.tier,
        publishStatus: actor.publishStatus,
        internalNote: actor.note,
        label: "botify",
        publishable: actor.publishStatus === "published",
        riskFlag: actor.tier === "CRITICAL" ? "confirmed" : "flagged",
      },
    });
    profileCreated = true;
  } else {
    await prisma.kolProfile.update({
      where: { handle: actor.handle },
      data: {
        platform: actor.platform,
        tier: actor.tier,
        publishStatus: actor.publishStatus,
        internalNote: actor.note,
      },
    });
  }

  let walletsInserted = 0;
  for (const w of actor.wallets) {
    const already = await prisma.kolWallet.findFirst({
      where: { kolHandle: actor.handle, address: w.address },
    });
    if (already) continue;
    await prisma.kolWallet.create({
      data: {
        kolHandle: actor.handle,
        address: w.address,
        chain: w.chain,
        label: w.label,
        claimType: w.claimType,
        attributionSource: "botify_investigation",
        sourceLabel: "INTERLIGENS Investigation BOTIFY",
        attributionStatus: w.claimType === "verified_onchain" ? "confirmed" : "review",
        isPubliclyUsable: actor.publishStatus === "published",
        confidence: w.claimType === "verified_onchain" ? "high" : "medium",
      },
    });
    walletsInserted++;
  }

  let eventInserted = false;
  if (actor.proceedsUsd > 0) {
    const syntheticTx = `botify_summary_${actor.handle.toLowerCase()}`;
    const firstWallet = actor.wallets[0]?.address ?? "unknown";
    const chain = actor.wallets[0]?.chain ?? "SOL";
    try {
      await prisma.$executeRaw`
        INSERT INTO "KolProceedsEvent" (
          id, "kolHandle", "walletAddress", chain, "txHash", "eventDate",
          "tokenSymbol", "tokenAddress", "amountTokens", "amountUsd",
          "priceUsdAtTime", "pricingSource", "eventType", ambiguous, notes, "createdAt"
        ) VALUES (
          ${"botify_sum_" + actor.handle.toLowerCase()},
          ${actor.handle},
          ${firstWallet},
          ${chain},
          ${syntheticTx},
          ${SEED_EVENT_DATE},
          ${"BOTIFY"},
          ${BOTIFY_MINT},
          ${null},
          ${actor.proceedsUsd},
          ${null},
          ${"arkham_aggregate"},
          ${"cex_deposit"},
          ${false},
          ${"Summary aggregate — " + actor.cex},
          NOW()
        )
        ON CONFLICT ("txHash") DO NOTHING
      `;
      eventInserted = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠ proceeds insert skipped for ${actor.handle}: ${msg}`);
    }
  }

  return { profileCreated, walletsInserted, eventInserted };
}

async function main(): Promise<void> {
  console.log(`[seed-botify] Starting — ${BOTIFY_ACTORS.length} actors`);
  let created = 0;
  let updated = 0;
  let totalWallets = 0;
  let totalEvents = 0;

  for (const actor of BOTIFY_ACTORS) {
    try {
      const r = await upsertActor(actor);
      if (r.profileCreated) created++;
      else updated++;
      totalWallets += r.walletsInserted;
      if (r.eventInserted) totalEvents++;
      console.log(
        `  ✓ ${actor.handle.padEnd(16)} ${r.profileCreated ? "CREATED" : "updated"} · wallets +${r.walletsInserted} · event ${r.eventInserted ? "+1" : "skip"}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${actor.handle}: ${msg}`);
    }
  }

  console.log(`\n[seed-botify] Done — profiles: ${created} created, ${updated} updated — wallets +${totalWallets} — events +${totalEvents}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
