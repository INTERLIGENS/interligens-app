/**
 * Enrichissement des wallets KOL — linker idempotent.
 *
 * ┌─ NOTE FACTUELLE (RÈGLE #0) ──────────────────────────────────────┐
 * │ Le casefile `data/cases/botify.json` NE CONTIENT PAS de mapping  │
 * │ KOL→wallet. Il ne contient que : case_meta, sources (screens),   │
 * │ claims (C1-C8) et un unique wallet `detective_trade` (non         │
 * │ attribué à un handle KOL).                                        │
 * │                                                                   │
 * │ La source RÉELLE des wallets du cluster BOTIFY est                │
 * │ `BOTIFY_KOL_SCAN_REPORT.json` (41 entrées handle→wallet),         │
 * │ produit par `src/scripts/seed/botifyKolScan.ts`.                  │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * Ce script lit `BOTIFY_KOL_SCAN_REPORT.json` et lie chaque wallet au KOL
 * correspondant dans la table `KolWallet`. Contrairement à
 * `botifyKolScan.ts`, il NE fait AUCUN appel Helius : c'est un simple
 * linker DB, sûr à rejouer.
 *
 * Schéma réel (vérifié dans prisma/schema.prod.prisma) :
 *   - `KolProfile.handle` (unique)
 *   - `KolWallet.kolHandle` → FK vers `KolProfile.handle`
 *   Il n'existe PAS de modèle `KolEntity` ni de colonne `kolEntityId`.
 *
 * DRY-RUN par défaut (aucune écriture, affiche l'audit complet).
 * Pour écrire en base :
 *   RUN_ENRICH_KOL_WALLETS=1 npx tsx src/scripts/seed/enrichKolWallets.ts
 */

import * as dotenv from "dotenv";
dotenv.config(); // .env → DB prod (ep-square-band)

import fs from "fs";
import path from "path";

const DRY_RUN = process.env.RUN_ENRICH_KOL_WALLETS !== "1";
const REPORT_FILE = "BOTIFY_KOL_SCAN_REPORT.json";

type ScanKol = { handle?: string; wallet?: string };

/** Adresse base58 Solana plausible (32-44 caractères). */
function looksLikeSolAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

async function main() {
  console.log(`[enrich-kol-wallets] mode=${DRY_RUN ? "DRY-RUN" : "WRITE"}`);

  // Import dynamique APRÈS dotenv.config() pour que DATABASE_URL soit lu.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // ── État AVANT ──────────────────────────────────────────────────
    const totalKol = await prisma.kolProfile.count();
    const beforeRow = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(DISTINCT "kolHandle")::bigint AS c FROM "KolWallet"
    `;
    const kolWithWalletBefore = Number(beforeRow[0]?.c ?? 0);

    console.log(`[enrich-kol-wallets] KolProfile total          : ${totalKol}`);
    console.log(`[enrich-kol-wallets] KOL avec wallet (AVANT)    : ${kolWithWalletBefore}`);

    // ── Lecture de la source ───────────────────────────────────────
    const reportPath = path.resolve(process.cwd(), REPORT_FILE);
    if (!fs.existsSync(reportPath)) {
      console.error(`[enrich-kol-wallets] introuvable : ${reportPath}`);
      console.error("[enrich-kol-wallets] générez-le d'abord via botifyKolScan.ts");
      process.exit(1);
    }
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      kols?: ScanKol[];
    };
    const scanKols = report.kols ?? [];

    // Aplatir : un wallet arkham peut contenir "addr1,addr2".
    const pairs: Array<{ handle: string; address: string }> = [];
    for (const k of scanKols) {
      const handle = (k.handle ?? "").trim();
      if (!handle) continue;
      for (const raw of (k.wallet ?? "").split(",")) {
        const address = raw.trim();
        if (address && looksLikeSolAddress(address)) {
          pairs.push({ handle, address });
        }
      }
    }
    console.log(`[enrich-kol-wallets] paires handle/wallet lues  : ${pairs.length}`);

    // ── Traitement ─────────────────────────────────────────────────
    let walletsCreated = 0;
    let walletsExisting = 0;
    let profilesCreated = 0;

    for (const { handle, address } of pairs) {
      const profile = await prisma.kolProfile.findUnique({ where: { handle } });
      if (!profile) {
        if (DRY_RUN) {
          console.log(`  [dry] KolProfile manquant → créerait @${handle}`);
        } else {
          await prisma.kolProfile.create({
            data: {
              handle,
              platform: "x",
              label: "kol",
              riskFlag: "paid-promo",
              tier: "HIGH",
              publishStatus: "draft",
              internalNote:
                "Créé par enrichKolWallets.ts — cluster BOTIFY (BOTIFY_KOL_SCAN_REPORT.json).",
            },
          });
        }
        profilesCreated++;
      }

      const existing = await prisma.kolWallet.findFirst({
        where: { kolHandle: handle, address, chain: "SOL" },
      });
      if (existing) {
        walletsExisting++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry] lierait @${handle} → ${address} (SOL)`);
      } else {
        await prisma.kolWallet.create({
          data: {
            kolHandle: handle,
            address,
            chain: "SOL",
            label: "BOTIFY KOL — lié depuis BOTIFY_KOL_SCAN_REPORT.json",
            claimType: "source_attributed",
            sourceLabel: "BOTIFY_KOL_SCAN_REPORT.json",
            confidence: "medium",
            attributionStatus: "review",
          },
        });
      }
      walletsCreated++;
    }

    // ── État APRÈS ─────────────────────────────────────────────────
    const afterRow = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(DISTINCT "kolHandle")::bigint AS c FROM "KolWallet"
    `;
    const kolWithWalletAfter = Number(afterRow[0]?.c ?? 0);

    console.log("─".repeat(60));
    console.log(`[enrich-kol-wallets] profils KOL à créer/créés  : ${profilesCreated}`);
    console.log(`[enrich-kol-wallets] wallets déjà présents      : ${walletsExisting}`);
    console.log(`[enrich-kol-wallets] wallets à lier/liés        : ${walletsCreated}`);
    console.log(`[enrich-kol-wallets] KOL avec wallet (APRÈS)    : ${kolWithWalletAfter}`);
    if (DRY_RUN) {
      console.log(
        "[enrich-kol-wallets] DRY-RUN — aucune écriture. RUN_ENRICH_KOL_WALLETS=1 pour appliquer.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[enrich-kol-wallets] fatal", err);
  process.exit(1);
});
