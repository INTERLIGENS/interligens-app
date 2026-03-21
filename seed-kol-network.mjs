
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as fs from "fs";

if (fs.existsSync(".env.local")) { dotenv.config({ path: ".env.local" }); }
else { dotenv.config(); }

const prisma = new PrismaClient();

async function upsertKol(handle, data) {
  return prisma.kolProfile.upsert({
    where: { handle },
    update: {},
    create: { handle, ...data },
  });
}

async function main() {
  console.log("\n── SEEDING KOL NETWORK ──\n");

  // @planted
  const planted = await upsertKol("planted", {
    platform: "x",
    displayName: "planted",
    label: "Djordje Stupar",
    riskFlag: "high",
    confidence: "confirmed",
    status: "active",
    tier: "HIGH",
    rugCount: 2,
    followerCount: 12000,
    verified: true,
    notes: "Identity confirmed via public source. Meeting confirmed: BK + @GordonGekko — 30/04/2025. Coordinated promotion BOTIFY + GHOST.",
    tags: JSON.stringify(["network-bk","botify","ghost","co-promoter"]),
    evidences: { create: [
      { type: "SOCIAL_MEETING", label: "Meeting confirmed — BK + GordonGekko — 30/04/2025", description: "Meeting confirmed: @planted (Djordje Stupar) + @bkokoski + @GordonGekko — 30/04/2025.", wallets: "[]", dateFirst: new Date("2025-04-30"), dateLast: new Date("2025-04-30") },
      { type: "COORDINATED_PROMOTION", label: "Co-promotion BOTIFY — timing overlap BK cluster", description: "Promotion cadence on BOTIFY matches BK cluster. Coordinated posting confirmed.", wallets: "[]", token: "BOTIFY", dateFirst: new Date("2026-01-01"), dateLast: new Date("2026-03-20") },
    ]},
    kolCases: { create: [
      { caseId: "BOTIFY", role: "co_promoter", paidUsd: 450000, evidence: "Promotion alongside @bkokoski during BOTIFY active period.", claimType: "source_attributed", confidenceLevel: "confirmed" },
      { caseId: "GHOST",  role: "co_promoter", evidence: "GHOST overlap with BK/SAM cluster. Under investigation.", claimType: "analytical_estimate", confidenceLevel: "provisional" },
    ]},
  });
  console.log("✅ @planted — id:", planted.id, "| label:", planted.label);

  // @GordonGekko
  const gordon = await upsertKol("GordonGekko", {
    platform: "x",
    displayName: "GordonGekko",
    label: "Unknown — under investigation",
    riskFlag: "high",
    confidence: "strong_linkage",
    status: "active",
    tier: "HIGH",
    rugCount: 2,
    followerCount: 28000,
    verified: false,
    notes: "Real identity under investigation. Meeting confirmed: @bkokoski + @planted — 30/04/2025. Coordinated KOL activity BOTIFY/GHOST.",
    tags: JSON.stringify(["network-bk","botify","ghost","co-promoter"]),
    evidences: { create: [
      { type: "SOCIAL_MEETING", label: "Meeting confirmed — BK + planted — 30/04/2025", description: "Meeting confirmed: @GordonGekko + @bkokoski + @planted (Djordje Stupar) — 30/04/2025.", wallets: "[]", dateFirst: new Date("2025-04-30"), dateLast: new Date("2025-04-30") },
      { type: "COORDINATED_PROMOTION", label: "Co-promotion BOTIFY + GHOST — timing overlap BK/SAM", description: "Cross-account promotion BOTIFY + GHOST. Timing overlap with BK/SAM cashout events.", wallets: "[]", token: "BOTIFY", dateFirst: new Date("2026-01-01"), dateLast: new Date("2026-03-20") },
    ]},
    kolCases: { create: [
      { caseId: "BOTIFY", role: "co_promoter", paidUsd: 800000, evidence: "Co-promotion BOTIFY. Network overlap BK cluster.", claimType: "analytical_estimate", confidenceLevel: "provisional" },
      { caseId: "GHOST",  role: "co_promoter", evidence: "GHOST overlap — cross-ref @lynk0x ongoing.", claimType: "analytical_estimate", confidenceLevel: "provisional" },
    ]},
  });
  console.log("✅ @GordonGekko — id:", gordon.id);

  // @DonWedge
  const donwedge = await upsertKol("DonWedge", {
    platform: "x",
    displayName: "DonWedge",
    label: "Unknown — under investigation",
    riskFlag: "high",
    confidence: "strong_linkage",
    status: "active",
    tier: "HIGH",
    rugCount: 1,
    followerCount: 15000,
    verified: false,
    notes: "Real identity under investigation. Network overlap BK cluster. Co-promotion multiple rug-linked tokens.",
    tags: JSON.stringify(["network-bk","botify","co-promoter"]),
    evidences: { create: [
      { type: "COORDINATED_PROMOTION", label: "Network overlap BK cluster — BOTIFY", description: "Network overlap BK cluster. Co-promotion BOTIFY matches insider timeline.", wallets: "[]", token: "BOTIFY", dateFirst: new Date("2026-01-01"), dateLast: new Date("2026-03-20") },
    ]},
    kolCases: { create: [
      { caseId: "BOTIFY", role: "co_promoter", evidence: "Promotion overlap BK cluster. Cashout under review.", claimType: "analytical_estimate", confidenceLevel: "provisional" },
    ]},
  });
  console.log("✅ @DonWedge — id:", donwedge.id);

  // HRuLzZ sur @bkokoski
  const bk = await prisma.kolProfile.findUnique({ where: { handle: "bkokoski" } });
  if (bk) {
    const existing = await prisma.kolEvidence.findFirst({ where: { kolHandle: "bkokoski", label: { contains: "HRuLzZ" } } });
    if (!existing) {
      await prisma.kolEvidence.create({ data: {
        kolHandle: "bkokoski",
        type: "ONCHAIN_CORRELATION",
        label: "HRuLzZ — common funding source wallets A/B/C",
        description: "Wallet HRuLzZ...d14LUx = common funding source for wallets A, B, C (BK cluster). All three funded from same source within 24h. Centralized control confirmed.",
        wallets: JSON.stringify(["5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj","HSueXrabQVABdHezbQ5Q4UbgLTx4Nc6VqyX5R88zzxmz","FzDXp1AqPhmwqkXjeFeTohbVcDEbJM9bjDcH9DPN4nEc"]),
        dateFirst: new Date("2026-03-21"),
      }});
      console.log("✅ HRuLzZ evidence ajoutée à @bkokoski");
    } else {
      console.log("ℹ️  HRuLzZ déjà présent");
    }
  } else {
    console.warn("⚠️  @bkokoski non trouvé");
  }

  const total = await prisma.kolProfile.count();
  const evTotal = await prisma.kolEvidence.count();
  console.log("\n── DONE ──");
  console.log("   KolProfile total :", total);
  console.log("   KolEvidence total:", evTotal);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
