/**
 * resolution-census.ts — COMBIEN DE PIÈCES SAVONS-NOUS LOCALISER ? LECTURE SEULE.
 *
 * ██  CE SCRIPT N'ÉCRIT RIEN. NI EN BASE, NI DANS R2, NI CHEZ UNE TSA.       ██
 * ██  IL NE FAIT AUCUN APPEL RÉSEAU VERS LE STOCKAGE.                        ██
 *
 *   « Evidentiary eligibility does not imply storage resolvability. An
 *     irreversible evidence operation requires both. »
 *
 * L'univers est EXACTEMENT celui du job : `tsaPendingUniverseSql()`. Le script
 * prend chaque pièce ÉLIGIBLE et lui pose la seconde question, celle que le
 * prédicat SQL ne pose pas : savons-nous OÙ sont ses octets ?
 *
 * Il n'ouvre aucun objet, ne relit aucun octet, n'appelle aucune TSA. Un SELECT,
 * puis `resoudreLocalisation` en mémoire. Le chiffre qu'il rend est la taille de
 * la dette de migration/résolution, et rien d'autre.
 *
 *   pnpm tsx src/scripts/evidence-chain/resolution-census.ts
 *
 * ⚠️ Ce script ne modifie AUCUN `evidentiaryStatus`. Une pièce non localisable
 * reste probatoirement ce qu'elle était : son état probatoire n'a pas changé,
 * seule notre capacité à l'atteindre est en cause. Les sortir de la queue en
 * les disqualifiant maquillerait une dette d'infrastructure en décision sur la
 * preuve.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { tsaPendingUniverseSql } from "../../lib/evidence-chain/eligibility";
import { resoudreLocalisation } from "../../lib/evidence-chain/storageResolution";
import { STORAGE_LOCATION_UNRESOLVED } from "../../lib/evidence-chain/stampGate";

async function main() {
  const universe = tsaPendingUniverseSql();
  const prisma = new PrismaClient();
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id","sha256","r2Key","evidentiaryStatus" FROM "EvidenceItem"
        WHERE ${universe} ORDER BY "ingestedAt" ASC`,
    )) as Array<{ id: string; sha256: string; r2Key: string | null; evidentiaryStatus: string | null }>;

    console.log(`[resolution-census] univers : ${universe}`);
    console.log(`[resolution-census] ${rows.length} pièce(s) probatoirement ÉLIGIBLE(s)\n`);

    let resolues = 0;
    const nonResolues: Array<{ id: string; motif: string }> = [];
    const motifs = new Map<string, number>();

    for (const r of rows) {
      const lieu = resoudreLocalisation({ id: r.id, r2Key: r.r2Key });
      if (lieu.ok) {
        resolues++;
        continue;
      }
      // On regroupe par NATURE du refus, pas par texte complet.
      const motif = r.r2Key ? "aucune autorité ne revendique" : "aucune clé de stockage";
      motifs.set(motif, (motifs.get(motif) ?? 0) + 1);
      nonResolues.push({ id: r.id, motif });
    }

    console.log(`  RÉSOLUES               : ${resolues}`);
    console.log(`  ${STORAGE_LOCATION_UNRESOLVED.toUpperCase().padEnd(22)} : ${nonResolues.length}`);
    for (const [motif, n] of [...motifs].sort((a, b) => b[1] - a[1])) {
      console.log(`      · ${motif} : ${n}`);
    }
    console.log(
      `\n  ÉLIGIBILITÉ PROBATOIRE ≠ RÉSOLVABILITÉ DE STOCKAGE : ${rows.length} éligibles, ${resolues} localisables.`,
    );
    console.log("  Aucun evidentiaryStatus n'a été lu pour décider, et aucun n'a été écrit.");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error("[resolution-census] FATAL", e); process.exit(1); });
