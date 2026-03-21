// seed-kol-network.mjs
// Sprint 5 — Seed @planted (Djordje Stupar) + @GordonGekko + @DonWedge
// Run: node seed-kol-network.mjs

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as fs from "fs";

// Toujours utiliser .env.local (ep-bold-sky prod)
if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
  console.log("✅ Using .env.local (ep-bold-sky)");
} else {
  dotenv.config();
  console.warn("⚠️  .env.local not found — falling back to .env");
}

const prisma = new PrismaClient();

async function main() {
  console.log("\n── SEEDING KOL NETWORK (planted + GordonGekko + DonWedge) ──\n");

  // ─────────────────────────────────────────
  // 1. @planted — Djordje Stupar
  // ─────────────────────────────────────────
  const planted = await prisma.kolProfile.upsert({
    where: { handle: "planted" },
    update: {},
    create: {
      handle: "planted",
      displayName: "planted",
      realName: "Djordje Stupar",
      platform: "X",
      followers: 12000,
      riskScore: 82,
      riskTier: "HIGH",
      verified: true,
      notes:
        "Identity confirmed via public source cross-reference. " +
        "Meeting confirmed: BK (Brandon Kokoski) + @GordonGekko — 30/04/2025. " +
        "Coordinated promotion activity on BOTIFY + GHOST documented during active cashout period. " +
        "Network connection to BK cluster established.",
      cases: {
        create: [
          {
            tokenName: "BOTIFY",
            tokenMint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
            chain: "SOLANA",
            role: "CO_PROMOTER",
            status: "CONFIRMED",
            estimatedLoss: 450000,
            notes:
              "Promotion activity documented alongside @bkokoski during BOTIFY active period. " +
              "Pattern matches coordinated shill campaign.",
          },
          {
            tokenName: "GHOST",
            tokenMint: null,
            chain: "SOLANA",
            role: "CO_PROMOTER",
            status: "UNDER_REVIEW",
            estimatedLoss: null,
            notes: "GHOST promotion overlap with BK/SAM cluster. Under investigation.",
          },
        ],
      },
      evidences: {
        create: [
          {
            type: "SOCIAL_MEETING",
            source: "PUBLIC_SOURCE",
            classification: "SOURCE_ATTRIBUTED",
            confidence: "CONFIRMED",
            description:
              "Meeting confirmed: @planted (Djordje Stupar) + @bkokoski (Brandon Kokoski) + @GordonGekko — 30/04/2025.",
            txHash: null,
            usdAmount: null,
            collectedAt: new Date("2025-04-30"),
            exhibitId: "EX-P01",
          },
          {
            type: "COORDINATED_PROMOTION",
            source: "PUBLIC_SOURCE",
            classification: "SOURCE_ATTRIBUTED",
            confidence: "STRONG_LINKAGE",
            description:
              "Promotion cadence on BOTIFY matches BK cluster active period. " +
              "Cross-account timing analysis confirms coordinated posting.",
            txHash: null,
            usdAmount: null,
            collectedAt: new Date("2026-01-15"),
            exhibitId: "EX-P02",
          },
        ],
      },
    },
  });
  console.log(`✅ @planted seeded — id: ${planted.id}`);

  // ─────────────────────────────────────────
  // 2. @GordonGekko
  // ─────────────────────────────────────────
  const gordon = await prisma.kolProfile.upsert({
    where: { handle: "GordonGekko" },
    update: {},
    create: {
      handle: "GordonGekko",
      displayName: "GordonGekko",
      realName: null,
      platform: "X",
      followers: 28000,
      riskScore: 78,
      riskTier: "HIGH",
      verified: false,
      notes:
        "Real identity under investigation. " +
        "Meeting confirmed with @bkokoski + @planted (Djordje Stupar) — 30/04/2025. " +
        "Coordinated KOL activity across BOTIFY/GHOST promotion period documented. " +
        "Watchlist active — monitoring X API.",
      cases: {
        create: [
          {
            tokenName: "BOTIFY",
            tokenMint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
            chain: "SOLANA",
            role: "CO_PROMOTER",
            status: "UNDER_REVIEW",
            estimatedLoss: 800000,
            notes:
              "Co-promotion during BOTIFY active period. Network overlap with BK cluster. " +
              "Cashout attribution pending wallet deanonymization.",
          },
          {
            tokenName: "GHOST",
            tokenMint: null,
            chain: "SOLANA",
            role: "CO_PROMOTER",
            status: "UNDER_REVIEW",
            estimatedLoss: null,
            notes: "GHOST overlap — cross-reference with @lynk0x pattern ongoing.",
          },
        ],
      },
      evidences: {
        create: [
          {
            type: "SOCIAL_MEETING",
            source: "PUBLIC_SOURCE",
            classification: "SOURCE_ATTRIBUTED",
            confidence: "CONFIRMED",
            description:
              "Meeting confirmed: @GordonGekko + @bkokoski + @planted (Djordje Stupar) — 30/04/2025. " +
              "Establishes in-person coordination between network actors.",
            txHash: null,
            usdAmount: null,
            collectedAt: new Date("2025-04-30"),
            exhibitId: "EX-G01",
          },
          {
            type: "COORDINATED_PROMOTION",
            source: "PUBLIC_SOURCE",
            classification: "SOURCE_ATTRIBUTED",
            confidence: "STRONG_LINKAGE",
            description:
              "Cross-account promotion activity on BOTIFY + GHOST. " +
              "Timing overlap with BK/SAM cluster cashout events.",
            txHash: null,
            usdAmount: null,
            collectedAt: new Date("2026-02-01"),
            exhibitId: "EX-G02",
          },
        ],
      },
    },
  });
  console.log(`✅ @GordonGekko seeded — id: ${gordon.id}`);

  // ─────────────────────────────────────────
  // 3. @DonWedge
  // ─────────────────────────────────────────
  const donwedge = await prisma.kolProfile.upsert({
    where: { handle: "DonWedge" },
    update: {},
    create: {
      handle: "DonWedge",
      displayName: "DonWedge",
      realName: null,
      platform: "X",
      followers: 15000,
      riskScore: 71,
      riskTier: "HIGH",
      verified: false,
      notes:
        "Real identity under investigation. " +
        "Network overlap with BK cluster documented. " +
        "Co-promotion activity on multiple rug-linked tokens. Watchlist active.",
      cases: {
        create: [
          {
            tokenName: "BOTIFY",
            tokenMint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
            chain: "SOLANA",
            role: "CO_PROMOTER",
            status: "UNDER_REVIEW",
            estimatedLoss: null,
            notes: "Promotion overlap with BK cluster. Cashout pattern under review.",
          },
        ],
      },
      evidences: {
        create: [
          {
            type: "COORDINATED_PROMOTION",
            source: "PUBLIC_SOURCE",
            classification: "SOURCE_ATTRIBUTED",
            confidence: "STRONG_LINKAGE",
            description:
              "Network overlap with BK cluster established via cross-account analysis. " +
              "Co-promotion pattern on BOTIFY matches insider timeline.",
            txHash: null,
            usdAmount: null,
            collectedAt: new Date("2026-01-20"),
            exhibitId: "EX-D01",
          },
        ],
      },
    },
  });
  console.log(`✅ @DonWedge seeded — id: ${donwedge.id}`);

  // ─────────────────────────────────────────
  // 4. Link network — ajoute HRuLzZ evidence à bkokoski
  // ─────────────────────────────────────────
  const bk = await prisma.kolProfile.findUnique({ where: { handle: "bkokoski" } });
  if (bk) {
    // Check si evidence HRuLzZ existe déjà
    const existing = await prisma.kolEvidence.findFirst({
      where: {
        kolProfileId: bk.id,
        description: { contains: "HRuLzZ" },
      },
    });

    if (!existing) {
      await prisma.kolEvidence.create({
        data: {
          kolProfileId: bk.id,
          type: "ONCHAIN_CORRELATION",
          source: "HELIUS_RPC",
          classification: "ON_CHAIN_VERIFIED",
          confidence: "CONFIRMED",
          description:
            "Wallet HRuLzZ...d14LUx identified as common funding source for Associated Wallets A, B, and C (BK cluster). " +
            "All three wallets received initial SOL from same source address within 24h window. " +
            "Establishes centralized control — consistent with single actor operating multiple wallets.",
          txHash: null,
          usdAmount: null,
          collectedAt: new Date("2026-03-21"),
          exhibitId: "EX-11-HRuLzZ",
        },
      });
      console.log("✅ HRuLzZ correlation evidence ajoutée à @bkokoski");
    } else {
      console.log("ℹ️  HRuLzZ evidence déjà présente pour @bkokoski");
    }
  } else {
    console.warn("⚠️  @bkokoski non trouvé en DB — lancer seed-kokoski.mjs d'abord");
  }

  // ─────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────
  const total = await prisma.kolProfile.count();
  const evidenceTotal = await prisma.kolEvidence.count();
  console.log(`\n── DONE ──`);
  console.log(`   KolProfile total : ${total}`);
  console.log(`   KolEvidence total: ${evidenceTotal}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
